import express from "express";
import path from "path";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { User, Reel, Product, Order, ChatMessage, LiveSession, Comment } from "./src/types";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Storage } from "@google-cloud/storage";
import multer from "multer";

// Configure dotenv to read environment variables
dotenv.config();

// Unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 11);

// Mongoose User Schema
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String },
  bio: { type: String },
  isOnline: { type: Boolean, default: false },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  savedReelIds: { type: [String], default: [] },
  coverPhoto: { type: String },
  isGuest: { type: Boolean, default: false },
  password: { type: String }
});

const MongoUser = (mongoose.models.User || mongoose.model("User", UserSchema)) as any;

// Mongoose Publicacion Schema
const PublicacionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  title: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  creatorId: { type: String }
});

const MongoPublicacion = (mongoose.models.Publicacion || mongoose.model("Publicacion", PublicacionSchema)) as any;

// Mongoose Product Schema
const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  imageUrl: { type: String },
  stock: { type: Number, default: 0 },
  sellerId: { type: String },
  rating: { type: Number, default: 5 },
  shippingCost: { type: Number, default: 0 },
  images: { type: [String], default: [] },
  videos: { type: [String], default: [] },
  variants: [{
    name: { type: String },
    options: { type: [String] }
  }],
  category: { type: String }
});

const MongoProduct = (mongoose.models.Product || mongoose.model("Product", ProductSchema)) as any;

// Mongoose Reel Schema
const ReelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  videoUrl: { type: String },
  thumbnailUrl: { type: String },
  description: { type: String },
  creatorId: { type: String },
  creatorName: { type: String },
  creatorAvatar: { type: String },
  likes: { type: Number, default: 0 },
  comments: [{
    id: { type: String },
    username: { type: String },
    avatar: { type: String },
    text: { type: String },
    createdAt: { type: String }
  }],
  shares: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  productId: { type: String },
  type: { type: String, default: "video" },
  images: { type: [String], default: [] }
});

const MongoReel = (mongoose.models.Reel || mongoose.model("Reel", ReelSchema)) as any;

// Google Cloud Storage setup
const storage = new Storage({
  keyFilename: path.join(process.cwd(), "mall-1bucket.json"),
});
const bucketName = "mall-1bucket";
const bucket = storage.bucket(bucketName);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max limit
  }
});

// Helper: Upload file to GCS
const uploadToGCS = (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  return new Promise((resolve, reject) => {
    let originalName = file.originalname.replace(/\s+/g, "_");
    const mimeType = file.mimetype.toLowerCase();

    // Enforce correct extensions on upload as requested
    if (mimeType.startsWith("video/")) {
      if (!originalName.toLowerCase().endsWith(".mp4")) {
        originalName += ".mp4";
      }
    } else if (mimeType.startsWith("image/")) {
      const lowerName = originalName.toLowerCase();
      if (!lowerName.endsWith(".png") && !lowerName.endsWith(".jpeg") && !lowerName.endsWith(".jpg") && !lowerName.endsWith(".webp")) {
        if (mimeType.includes("png")) {
          originalName += ".png";
        } else if (mimeType.includes("webp")) {
          originalName += ".webp";
        } else {
          originalName += ".jpeg";
        }
      }
    }

    const uniqueName = `${Date.now()}-${generateId()}-${originalName}`;
    const blob = bucket.file(`${folder}/${uniqueName}`);
    
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on("error", (err) => {
      reject(err);
    });

    blobStream.on("finish", () => {
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

// In-memory Database (will act as runtime cache and fallback)
let users: User[] = [
  {
    id: "current_user",
    username: "cg0220037",
    name: "Carlos Gómez",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    bio: "Tech enthusiast, creator, and shopaholic. ✨ Building the future of interactive social commerce.",
    isOnline: true,
    followers: 124,
    following: 348,
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    isGuest: false
  },
  {
    id: "user_guest",
    username: "invitado",
    name: "Invitado",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    bio: "Modo invitado. Regístrate o inicia sesión para disfrutar la experiencia completa.",
    isOnline: true,
    followers: 0,
    following: 0,
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    isGuest: true
  }
];


let products: Product[] = [];

let reels: Reel[] = [];

let chatMessages: ChatMessage[] = [];

let orders: Order[] = [];

let liveSessions: LiveSession[] = [];

// Active WebSocket Client Map: Key is userId
const activeClients = new Map<string, WebSocket>();

// Connect to MongoDB Atlas and load/seed users
async function connectToMongoDB() {
  let mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("⚠️ MONGO_URI environment variable is missing. Running with in-memory database fallback.");
    return;
  }
  
  // Strip outer quotes if present (double or single quotes)
  mongoUri = mongoUri.trim();
  if (mongoUri.startsWith('"') && mongoUri.endsWith('"')) {
    mongoUri = mongoUri.slice(1, -1).trim();
  } else if (mongoUri.startsWith("'") && mongoUri.endsWith("'")) {
    mongoUri = mongoUri.slice(1, -1).trim();
  }

  // Robustly remove < and > surrounding password if present
  const match = mongoUri.match(/(mongodb\+srv:\/\/.*?):(.*?)@(.*)/);
  if (match) {
    const [_, prefix, pass, suffix] = match;
    if (pass.startsWith('<') && pass.endsWith('>')) {
      const cleanPass = pass.slice(1, -1);
      mongoUri = `${prefix}:${cleanPass}@${suffix}`;
    }
  }

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoUri);
    console.log("✅ Successfully connected to MongoDB Atlas!");

    // Delete test / mock data if they exist in MongoDB to allow testing with real data as requested by user
    console.log("🧹 Wiping test/mock accounts, products and reels from MongoDB Atlas...");
    await MongoUser.deleteMany({ username: { $nin: ["cg0220037", "invitado"] }, id: { $ne: "current_user" } });
    await MongoProduct.deleteMany({ id: { $in: ["prod_1", "prod_2", "prod_3", "prod_4"] } });
    await MongoReel.deleteMany({ id: { $in: ["reel_1", "reel_2", "reel_3"] } });
    console.log("🧹 Test/mock data wiped successfully!");

    // Seed initial users if database is empty
    const count = await MongoUser.countDocuments();
    if (count === 0) {
      console.log("🌱 Seeding default users to MongoDB...");
      await MongoUser.insertMany(users as any);
      console.log("🌱 Seeding completed!");
    } else {
      console.log("📦 Loading existing users from MongoDB...");
      const dbUsers = await MongoUser.find();
      users = dbUsers.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        bio: u.bio || "Creador en la plataforma",
        isOnline: u.isOnline !== undefined ? u.isOnline : true,
        followers: u.followers || 0,
        following: u.following || 0,
        savedReelIds: u.savedReelIds || [],
        coverPhoto: u.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isGuest: u.isGuest || false,
        password: u.password || ""
      }));

      // Ensure the guest user "invitado" is always present in memory
      if (!users.some(u => u.username === "invitado")) {
        users.push({
          id: "user_guest",
          username: "invitado",
          name: "Invitado",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: "Modo invitado. Regístrate o inicia sesión para disfrutar la experiencia completa.",
          isOnline: true,
          followers: 0,
          following: 0,
          coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          isGuest: true
        });
      }

      console.log(`📦 Loaded ${users.length} users successfully from MongoDB Atlas!`);
    }

    // Seed or Load Products from MongoDB Atlas
    const productCount = await MongoProduct.countDocuments();
    if (productCount === 0) {
      console.log("🌱 Seeding default products to MongoDB...");
      await MongoProduct.insertMany(products as any);
      console.log("🌱 Seeding products completed!");
    } else {
      console.log("📦 Loading products from MongoDB...");
      const dbProducts = await MongoProduct.find();
      products = dbProducts.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        price: p.price,
        imageUrl: p.imageUrl || "",
        stock: p.stock !== undefined ? p.stock : 10,
        sellerId: p.sellerId || "current_user",
        rating: p.rating || 5,
        shippingCost: p.shippingCost || 0,
        images: p.images || [],
        videos: p.videos || [],
        variants: p.variants || [],
        category: p.category || ""
      }));
      console.log(`📦 Loaded ${products.length} products successfully from MongoDB Atlas!`);
    }
 
    // Seed or Load Reels from MongoDB Atlas
    const reelCount = await MongoReel.countDocuments();
    if (reelCount === 0) {
      console.log("🌱 Seeding default reels to MongoDB...");
      await MongoReel.insertMany(reels as any);
      console.log("🌱 Seeding reels completed!");
    } else {
      console.log("📦 Loading reels from MongoDB...");
      const dbReels = await MongoReel.find();
      reels = dbReels.map(r => ({
        id: r.id,
        videoUrl: r.videoUrl || "",
        thumbnailUrl: r.thumbnailUrl || "",
        description: r.description || "",
        creatorId: r.creatorId || "current_user",
        creatorName: r.creatorName || "Carlos Gómez",
        creatorAvatar: r.creatorAvatar || "",
        likes: r.likes || 0,
        comments: r.comments || [],
        shares: r.shares || 0,
        views: r.views || 0,
        productId: r.productId || undefined,
        type: r.type || "video",
        images: r.images || []
      }));
      console.log(`📦 Loaded ${reels.length} reels successfully from MongoDB Atlas!`);
    }
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB Atlas:", error);
  }
}

async function startServer() {
  // Connect to MongoDB asynchronously to avoid blocking the server startup on port 3000
  connectToMongoDB().catch((err) => {
    console.error("❌ Error running connectToMongoDB asynchronously:", err);
  });

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ENDPOINTS ---

  // Upload file to Google Cloud Storage & register in MongoDB
  app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      const { title, description, creatorId } = req.body;
      
      console.log(`🚀 Iniciando subida de archivo a GCS: ${req.file.originalname}`);
      const publicUrl = await uploadToGCS(req.file, "publicaciones");
      console.log(`✅ Archivo subido con éxito a GCS: ${publicUrl}`);

      // Crear registro en MongoDB
      let savedPublicacionObj = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const id = "pub_" + generateId();
          const newPublicacion = new MongoPublicacion({
            id,
            url: publicUrl,
            title: title || req.file.originalname,
            description: description || "",
            creatorId: creatorId || "current_user",
            createdAt: new Date()
          });

          savedPublicacionObj = await newPublicacion.save();
          console.log(`💾 Publicación guardada en MongoDB Atlas con id: ${id}`);
        } catch (dbErr) {
          console.error("❌ Error al guardar la publicación en MongoDB:", dbErr);
        }
      } else {
        console.log("⚠️ MongoDB no está conectado. No se guardó el registro en base de datos.");
      }

      res.json({
        success: true,
        message: "Archivo subido y registrado exitosamente",
        url: publicUrl,
        publicacion: savedPublicacionObj
      });
    } catch (error: any) {
      console.error("❌ Error en el proceso de upload:", error);
      res.status(500).json({ error: "Error interno del servidor durante el upload", details: error.message });
    }
  });

  // Alias /upload for compliance with generic requests
  app.post("/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      const { title, description, creatorId } = req.body;
      const publicUrl = await uploadToGCS(req.file, "publicaciones");

      let savedPublicacionObj = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const id = "pub_" + generateId();
          const newPublicacion = new MongoPublicacion({
            id,
            url: publicUrl,
            title: title || req.file.originalname,
            description: description || "",
            creatorId: creatorId || "current_user",
            createdAt: new Date()
          });

          savedPublicacionObj = await newPublicacion.save();
        } catch (dbErr) {
          console.error("❌ Error al guardar la publicación en MongoDB:", dbErr);
        }
      }

      res.json({
        success: true,
        message: "Archivo subido y registrado exitosamente",
        url: publicUrl,
        publicacion: savedPublicacionObj
      });
    } catch (error: any) {
      console.error("❌ Error en /upload:", error);
      res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
  });

  // Get all users
  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  // Get specific user profile with their products, reels, and orders
  app.get("/api/users/:id", (req, res) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    const userProducts = products.filter((p) => p.sellerId === user.id);
    const userReels = reels.filter((r) => r.creatorId === user.id);
    const userOrders = user.id === "current_user" ? orders : [];
    const userSavedReels = reels.filter((r) => (user.savedReelIds || []).includes(r.id));

    res.json({
      user,
      products: userProducts,
      reels: userReels,
      orders: userOrders,
      savedReels: userSavedReels,
    });
  });

  // Toggle save/unsave a reel
  app.post("/api/users/current/save", (req, res) => {
    const { reelId } = req.body;
    const currentUserObj = users.find((u) => u.id === "current_user");
    if (!currentUserObj) {
      res.status(404).json({ error: "Current user not found" });
      return;
    }

    if (!currentUserObj.savedReelIds) {
      currentUserObj.savedReelIds = [];
    }

    const index = currentUserObj.savedReelIds.indexOf(reelId);
    let saved = false;
    if (index > -1) {
      currentUserObj.savedReelIds.splice(index, 1);
    } else {
      currentUserObj.savedReelIds.push(reelId);
      saved = true;
    }

    res.json({ success: true, saved, savedReelIds: currentUserObj.savedReelIds });
  });

  // Update current user profile info
  app.post("/api/users/current/update", async (req, res) => {
    const { name, username, bio, avatar, coverPhoto, password } = req.body;
    const currentUserObj = users.find((u) => u.id === "current_user");
    if (!currentUserObj) {
      res.status(404).json({ error: "Current user not found" });
      return;
    }

    if (name !== undefined) currentUserObj.name = name;
    if (username !== undefined) currentUserObj.username = username;
    if (bio !== undefined) currentUserObj.bio = bio;
    if (avatar !== undefined) currentUserObj.avatar = avatar;
    if (coverPhoto !== undefined) currentUserObj.coverPhoto = coverPhoto;
    if (password !== undefined) currentUserObj.password = password;

    // Save to MongoDB Atlas if connection is active
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoUser.findOneAndUpdate(
          { id: currentUserObj.id },
          { name, username, bio, avatar, coverPhoto, password },
          { new: true, upsert: true }
        );
        console.log(`💾 User profile updated in MongoDB Atlas for ${currentUserObj.username}`);
      } catch (err) {
        console.error("Failed to update profile in MongoDB:", err);
      }
    }

    // Update in memory items that reference this user
    reels.forEach(r => {
      if (r.creatorId === "current_user") {
        if (name !== undefined) r.creatorName = name;
        if (avatar !== undefined) r.creatorAvatar = avatar;
      }
      r.comments.forEach(c => {
        if (c.username === "cg0220037" || c.username === currentUserObj.username) {
          if (username !== undefined) c.username = username;
          if (avatar !== undefined) c.avatar = avatar;
        }
      });
    });

    res.json({ success: true, user: currentUserObj });
  });

  // Register a new user in MongoDB Atlas
  app.post("/api/users/register", async (req, res) => {
    const { name, username, bio, avatar, coverPhoto, password } = req.body;
    if (!name || !username) {
      res.status(400).json({ error: "Name and username are required" });
      return;
    }

    const cleanUsername = username.replace(/\s+/g, "").toLowerCase();
    
    // Check if username already exists in cache/memory or database
    const existingUser = users.find(u => u.username === cleanUsername);
    if (existingUser) {
      res.status(400).json({ error: "El nombre de usuario ya está registrado." });
      return;
    }

    const newUser: User = {
      id: "user_" + generateId(),
      name,
      username: cleanUsername,
      bio: bio || "Nuevo creador de contenido en la plataforma",
      avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      coverPhoto: coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      followers: 0,
      following: 0,
      isOnline: true,
      password: password || ""
    };

    // Add to cache/memory list
    users.push(newUser);

    // Save to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoUser = new MongoUser(newUser);
        await mongoUser.save();
        console.log(`💾 Registered new user @${newUser.username} in MongoDB Atlas!`);
      } catch (err) {
        console.error("Failed to save registered user to MongoDB:", err);
      }
    }

    res.json({ success: true, user: newUser });
  });

  // Store the original ID of the active current_user (defaults to Carlos's original ID)
  let activeOriginalUserId = "current_user_original";

  // Switch current active user (swaps details in memory and saves to Mongo)
  app.post("/api/users/current/switch", async (req, res) => {
    const { targetUsername, password } = req.body;
    if (!targetUsername) {
      res.status(400).json({ error: "Target username is required" });
      return;
    }

    const targetUser = users.find(u => u.username === targetUsername && u.id !== "current_user");
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Require password if the user has a password registered or is the default non-guest user
    // The Guest ("invitado") doesn't require a password.
    if (targetUsername !== "invitado") {
      const expectedPassword = targetUser.password || (targetUser.username === "cg0220037" ? "123456" : "");
      if (expectedPassword && expectedPassword !== password) {
        res.status(401).json({ error: "La contraseña ingresada es incorrecta. Por favor verifícala." });
        return;
      }
    }

    const currentUserObj = users.find(u => u.id === "current_user");
    if (!currentUserObj) {
      res.status(404).json({ error: "Current user state not found" });
      return;
    }

    // 1. Save the active state of "current_user" back to its original record in the list and MongoDB
    const originalUserInList = users.find(u => u.id === activeOriginalUserId);
    if (originalUserInList) {
      originalUserInList.name = currentUserObj.name;
      originalUserInList.username = currentUserObj.username;
      originalUserInList.bio = currentUserObj.bio;
      originalUserInList.avatar = currentUserObj.avatar;
      originalUserInList.coverPhoto = currentUserObj.coverPhoto;
      originalUserInList.followers = currentUserObj.followers;
      originalUserInList.following = currentUserObj.following;
      originalUserInList.savedReelIds = currentUserObj.savedReelIds;
      originalUserInList.isGuest = currentUserObj.isGuest;
      originalUserInList.password = currentUserObj.password;

      if (mongoose.connection.readyState === 1) {
        try {
          await MongoUser.findOneAndUpdate(
            { id: activeOriginalUserId },
            { 
              name: currentUserObj.name,
              username: currentUserObj.username,
              bio: currentUserObj.bio,
              avatar: currentUserObj.avatar,
              coverPhoto: currentUserObj.coverPhoto,
              followers: currentUserObj.followers,
              following: currentUserObj.following,
              savedReelIds: currentUserObj.savedReelIds,
              isGuest: currentUserObj.isGuest,
              password: currentUserObj.password
            },
            { upsert: true }
          );
        } catch (err) {
          console.error("Failed to save original user state in MongoDB on switch:", err);
        }
      }
    } else {
      // If the original user wasn't in the list, create their separate backup record now
      const backupUser: User = {
        id: activeOriginalUserId,
        name: currentUserObj.name,
        username: currentUserObj.username,
        bio: currentUserObj.bio,
        avatar: currentUserObj.avatar,
        coverPhoto: currentUserObj.coverPhoto,
        followers: currentUserObj.followers,
        following: currentUserObj.following,
        savedReelIds: currentUserObj.savedReelIds || [],
        isOnline: currentUserObj.isOnline,
        isGuest: currentUserObj.isGuest,
        password: currentUserObj.password
      };
      users.push(backupUser);
      if (mongoose.connection.readyState === 1) {
        try {
          await new MongoUser(backupUser).save();
        } catch (err) {
          console.error("Failed to save backup user in MongoDB on switch:", err);
        }
      }
    }

    // 2. Set the new original ID and copy targetUser's details into "current_user"
    activeOriginalUserId = targetUser.id;
    
    currentUserObj.name = targetUser.name;
    currentUserObj.username = targetUser.username;
    currentUserObj.bio = targetUser.bio;
    currentUserObj.avatar = targetUser.avatar;
    currentUserObj.coverPhoto = targetUser.coverPhoto;
    currentUserObj.followers = targetUser.followers;
    currentUserObj.following = targetUser.following;
    currentUserObj.savedReelIds = targetUser.savedReelIds || [];
    currentUserObj.isGuest = targetUser.isGuest || false;
    currentUserObj.password = targetUser.password || (targetUser.username === "cg0220037" ? "123456" : "");

    // Save the new current_user state in Mongo as well
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoUser.findOneAndUpdate(
          { id: "current_user" },
          {
            name: targetUser.name,
            username: targetUser.username,
            bio: targetUser.bio,
            avatar: targetUser.avatar,
            coverPhoto: targetUser.coverPhoto,
            followers: targetUser.followers,
            following: targetUser.following,
            savedReelIds: targetUser.savedReelIds || [],
            isGuest: targetUser.isGuest || false,
            password: targetUser.password || (targetUser.username === "cg0220037" ? "123456" : "")
          },
          { upsert: true }
        );
      } catch (err) {
        console.error("Failed to update current_user in MongoDB on switch:", err);
      }
    }

    console.log(`🔄 Switched session user to @${currentUserObj.username} (original id: ${activeOriginalUserId})`);
    res.json({ success: true, user: currentUserObj });
  });

  // Get all video reels
  app.get("/api/reels", (req, res) => {
    res.json(reels);
  });

  // Like a reel
  app.post("/api/reels/:id/like", (req, res) => {
    const reel = reels.find((r) => r.id === req.params.id);
    if (!reel) {
      res.status(404).json({ error: "Reel not found" });
      return;
    }
    reel.likes += 1;
    
    // Broadcast metric update to all connected sockets
    broadcastToAll({
      type: "reel_updated",
      reelId: reel.id,
      likes: reel.likes,
      commentsCount: reel.comments.length
    });

    res.json({ success: true, likes: reel.likes });
  });

  // Post a comment on a reel
  app.post("/api/reels/:id/comment", (req, res) => {
    const reel = reels.find((r) => r.id === req.params.id);
    if (!reel) {
      res.status(404).json({ error: "Reel not found" });
      return;
    }

    const { username, avatar, text } = req.body;
    if (!text) {
      res.status(400).json({ error: "Comment text is required" });
      return;
    }

    const newComment: Comment = {
      id: "c_" + generateId(),
      username: username || "cg0220037",
      avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      text,
      createdAt: new Date().toISOString(),
    };

    reel.comments.push(newComment);

    // Broadcast metric update
    broadcastToAll({
      type: "reel_updated",
      reelId: reel.id,
      likes: reel.likes,
      commentsCount: reel.comments.length,
      newComment: newComment
    });

    res.json(newComment);
  });

  // Get all e-commerce products
  app.get("/api/products", (req, res) => {
    res.json(products);
  });

  // Get product by ID
  app.get("/api/products/:id", (req, res) => {
    const product = products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  });

  // Create a new publication (video, image, or carousel)
  app.post("/api/reels", async (req: any, res: any) => {
    try {
      const { videoUrl, thumbnailUrl, description, creatorId, type, images, productId } = req.body;
      const creator = users.find(u => u.id === (creatorId || "current_user"));
      if (!creator) {
        res.status(404).json({ error: "Creator not found" });
        return;
      }

      const newReel: Reel = {
        id: "reel_" + generateId(),
        videoUrl: videoUrl || "",
        thumbnailUrl: thumbnailUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80",
        description: description || "",
        creatorId: creator.id,
        creatorName: creator.name,
        creatorAvatar: creator.avatar,
        likes: 0,
        comments: [],
        shares: 0,
        views: 0,
        productId: productId || undefined,
        type: type || "video",
        images: images || []
      };

      // Add to memory list
      reels.unshift(newReel);

      // Save to MongoDB Atlas if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const mongoReel = new MongoReel(newReel);
          await mongoReel.save();
          console.log(`💾 Saved new publication ${newReel.id} to MongoDB Atlas`);
        } catch (dbErr) {
          console.error("❌ Failed to save publication to MongoDB Atlas:", dbErr);
        }
      }

      // Broadcast new reel event
      broadcastToAll({
        type: "reel_created",
        reel: newReel
      });

      res.status(201).json({ success: true, reel: newReel });
    } catch (err: any) {
      console.error("Error creating publication:", err);
      res.status(500).json({ error: "Failed to create publication", details: err.message });
    }
  });

  // Create a new product for sale
  app.post("/api/products", async (req: any, res: any) => {
    try {
      const { name, description, price, imageUrl, stock, sellerId, shippingCost, images, videos, variants, category } = req.body;
      const seller = users.find(u => u.id === (sellerId || "current_user"));
      if (!seller) {
        res.status(404).json({ error: "Seller not found" });
        return;
      }

      const newProduct: Product = {
        id: "prod_" + generateId(),
        name: name || "Producto sin nombre",
        description: description || "",
        price: Number(price) || 0,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80",
        stock: Number(stock) || 0,
        sellerId: seller.id,
        rating: 5,
        shippingCost: Number(shippingCost) || 0,
        images: images || [],
        videos: videos || [],
        variants: variants || [],
        category: category || ""
      };

      // Add to memory list
      products.unshift(newProduct);

      // Save to MongoDB Atlas if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const mongoProduct = new MongoProduct(newProduct);
          await mongoProduct.save();
          console.log(`💾 Saved new product ${newProduct.id} to MongoDB Atlas`);
        } catch (dbErr) {
          console.error("❌ Failed to save product to MongoDB Atlas:", dbErr);
        }
      }

      // Also automatically create a matching Reel publication for the Reels section (Reels feed)
      const newReel: Reel = {
        id: "reel_" + generateId(),
        videoUrl: newProduct.videos && newProduct.videos.length > 0 ? newProduct.videos[0] : "",
        thumbnailUrl: newProduct.imageUrl,
        description: `🛍️ ¡Nuevo producto en la categoría ${newProduct.category || "General"}!\n\n✨ **${newProduct.name}**\n\n${newProduct.description}`,
        creatorId: seller.id,
        creatorName: seller.name,
        creatorAvatar: seller.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        likes: 0,
        comments: [],
        shares: 0,
        views: 0,
        productId: newProduct.id,
        type: newProduct.videos && newProduct.videos.length > 0 ? "video" : (newProduct.images && newProduct.images.length > 1 ? "carousel" : "image"),
        images: newProduct.images || []
      };

      // Add to memory list
      reels.unshift(newReel);

      // Save companion Reel to MongoDB Atlas if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const mongoReel = new MongoReel(newReel);
          await mongoReel.save();
          console.log(`💾 Saved companion reel ${newReel.id} for product ${newProduct.id} to MongoDB Atlas`);
        } catch (dbErr) {
          console.error("❌ Failed to save companion reel to MongoDB Atlas:", dbErr);
        }
      }

      // Broadcast product event
      broadcastToAll({
        type: "product_created",
        product: newProduct
      });

      // Broadcast companion reel event
      broadcastToAll({
        type: "reel_created",
        reel: newReel
      });

      res.status(201).json({ success: true, product: newProduct, reel: newReel });
    } catch (err: any) {
      console.error("Error creating product:", err);
      res.status(500).json({ error: "Failed to create product", details: err.message });
    }
  });

  // Create purchase order (checkout)
  app.post("/api/orders", (req, res) => {
    const { items, shippingAddress } = req.body;
    if (!items || !items.length) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    let total = 0;
    const orderItems: any[] = [];

    // Verify stock and calculate total
    for (const item of items) {
      const product = products.find((p) => p.id === item.product.id);
      if (!product) {
        res.status(400).json({ error: `Product ${item.product.name} not found` });
        return;
      }

      if (product.stock < item.quantity) {
        res.status(400).json({ error: `Insufficient stock for product: ${product.name}` });
        return;
      }

      product.stock -= item.quantity;
      total += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl,
      });
    }

    const newOrder: Order = {
      id: "ord_" + generateId(),
      items: orderItems,
      total: Math.round((total + Number.EPSILON) * 100) / 100,
      shippingAddress: shippingAddress || "Default Delivery Address, City",
      paymentStatus: "paid",
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);

    // Broadcast stock updates
    broadcastToAll({
      type: "stock_updated",
      products: products.map((p) => ({ id: p.id, stock: p.stock }))
    });

    res.json(newOrder);
  });

  // Fetch orders
  app.get("/api/orders", (req, res) => {
    res.json(orders);
  });

  // Get historical chats with a partner
  app.get("/api/chats/:partnerId", (req, res) => {
    const partnerId = req.params.partnerId;
    const currentId = "current_user";

    const messages = chatMessages.filter(
      (m) =>
        (m.senderId === currentId && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === currentId)
    );

    res.json(messages);
  });

  // Get live streams
  app.get("/api/live", (req, res) => {
    res.json(liveSessions);
  });

  // Create a live stream session (Go Live)
  app.post("/api/live", (req, res) => {
    const { title, creatorId } = req.body;
    const creator = users.find((u) => u.id === (creatorId || "current_user"));

    if (!creator) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }

    // Check if creator already has active live stream
    const existing = liveSessions.find((s) => s.creatorId === creator.id && s.isLive);
    if (existing) {
      res.json(existing);
      return;
    }

    const newSession: LiveSession = {
      id: "live_" + generateId(),
      creatorId: creator.id,
      creatorName: creator.name,
      creatorAvatar: creator.avatar,
      title: title || "My Live Stream! 🔴",
      viewersCount: 0,
      isLive: true,
      chatMessages: [],
    };

    liveSessions.push(newSession);

    // Broadcast new live session
    broadcastToAll({
      type: "live_started",
      session: newSession
    });

    res.json(newSession);
  });

  // End a live stream session
  app.post("/api/live/:id/end", (req, res) => {
    const session = liveSessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: "Live session not found" });
      return;
    }

    session.isLive = false;

    // Remove from active list
    liveSessions = liveSessions.filter((s) => s.id !== session.id);

    broadcastToAll({
      type: "live_ended",
      sessionId: session.id
    });

    res.json({ success: true });
  });


  // Create the HTTP server
  const httpServer = createHttpServer(app);

  // --- WEBSOCKET SERVER ATTACHMENT ---
  const wss = new WebSocketServer({ noServer: true });

  // Handle Upgrade from HTTP to WS
  httpServer.on("upgrade", (request, socket, head) => {
    // Avoid upgrading if Vite has its own websocket connection in development
    if (request.url?.startsWith("/@vite") || request.url?.includes("hmr")) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    let clientUserId: string | null = null;
    let currentStreamId: string | null = null;

    ws.on("message", (messageStr: string) => {
      try {
        const payload = JSON.parse(messageStr);
        
        switch (payload.type) {
          case "auth": {
            clientUserId = payload.userId || "current_user";
            activeClients.set(clientUserId!, ws);

            // Update user online status
            const user = users.find((u) => u.id === clientUserId);
            if (user) user.isOnline = true;

            // Broadcast updated presence list
            broadcastPresence();
            break;
          }

          case "private_msg": {
            const { senderId, receiverId, text } = payload;
            if (!senderId || !receiverId || !text) return;

            const newMsg: ChatMessage = {
              id: "m_" + generateId(),
              senderId,
              receiverId,
              text,
              timestamp: new Date().toISOString()
            };

            chatMessages.push(newMsg);

            // Send to recipient if connected
            const recSocket = activeClients.get(receiverId);
            if (recSocket && recSocket.readyState === WebSocket.OPEN) {
              recSocket.send(JSON.stringify({
                type: "private_msg",
                message: newMsg
              }));
            }

            // Acknowledge back to sender
            ws.send(JSON.stringify({
              type: "private_msg_sent",
              message: newMsg
            }));
            break;
          }

          case "live_join": {
            const { streamId, username, avatar } = payload;
            currentStreamId = streamId;

            const session = liveSessions.find((s) => s.id === streamId);
            if (session) {
              session.viewersCount += 1;
              
              // Broadcast viewer update to everyone in this stream
              broadcastToStream(streamId, {
                type: "live_viewers",
                streamId,
                count: session.viewersCount
              });

              // Create system welcome message
              const systemMsg = {
                id: "lc_" + generateId(),
                username: "System 🤖",
                avatar: "",
                text: `${username || "A viewer"} entered the stream. Welcome!`,
                createdAt: new Date().toISOString()
              };

              session.chatMessages.push(systemMsg);
              
              broadcastToStream(streamId, {
                type: "live_chat_msg",
                streamId,
                msg: systemMsg
              });
            }
            break;
          }

          case "live_msg": {
            const { streamId, senderName, avatar, text } = payload;
            const session = liveSessions.find((s) => s.id === streamId);
            if (session && text) {
              const liveMsg = {
                id: "lc_" + generateId(),
                username: senderName,
                avatar: avatar,
                text: text,
                createdAt: new Date().toISOString()
              };

              session.chatMessages.push(liveMsg);

              broadcastToStream(streamId, {
                type: "live_chat_msg",
                streamId,
                msg: liveMsg
              });
            }
            break;
          }

          case "live_reaction": {
            const { streamId, reactionType } = payload;
            broadcastToStream(streamId, {
              type: "live_reaction",
              streamId,
              reactionType
            });
            break;
          }

          case "live_leave": {
            const { streamId } = payload;
            handleStreamLeave(ws, streamId);
            currentStreamId = null;
            break;
          }
        }
      } catch (err) {
        console.error("Error handling WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      if (clientUserId) {
        activeClients.delete(clientUserId);
        const user = users.find((u) => u.id === clientUserId);
        if (user) user.isOnline = false;
        broadcastPresence();
      }

      if (currentStreamId) {
        handleStreamLeave(ws, currentStreamId);
      }
    });
  });

  // Helper: Broadcast presence list
  function broadcastPresence() {
    const presenceData = users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      isOnline: u.isOnline
    }));

    broadcastToAll({
      type: "presence_list",
      users: presenceData
    });
  }

  // Helper: Handle client leaving live stream
  function handleStreamLeave(socket: WebSocket, streamId: string) {
    const session = liveSessions.find((s) => s.id === streamId);
    if (session) {
      session.viewersCount = Math.max(0, session.viewersCount - 1);
      broadcastToStream(streamId, {
        type: "live_viewers",
        streamId,
        count: session.viewersCount
      });
    }
  }

  // Helper: Send message to all connected clients
  function broadcastToAll(message: any) {
    const serialized = JSON.stringify(message);
    activeClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  }

  // Helper: Send message to all users viewing a specific stream
  function broadcastToStream(streamId: string, message: any) {
    const serialized = JSON.stringify(message);
    // For simplicity, we broadcast to all active clients (they check streamId locally)
    activeClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  }

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
