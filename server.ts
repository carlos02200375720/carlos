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
import fs from "fs";

// Configure dotenv to read environment variables first
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
  password: { type: String },
  email: { type: String, default: "" }
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
let storage: Storage;
const googleJsonPath = path.join(process.cwd(), "google.json");
const mallJsonPath = path.join(process.cwd(), "mall-1bucket.json");

if (fs.existsSync(googleJsonPath)) {
  storage = new Storage({
    keyFilename: googleJsonPath,
  });
  console.log("📂 Storage client initialized using google.json");
} else if (fs.existsSync(mallJsonPath)) {
  storage = new Storage({
    keyFilename: mallJsonPath,
  });
  console.log("📂 Storage client initialized using mall-1bucket.json");
} else if (process.env.GOOGLE) {
  try {
    const googleCredentials = JSON.parse(process.env.GOOGLE);
    storage = new Storage({
      credentials: {
        client_email: googleCredentials.client_email,
        private_key: googleCredentials.private_key,
      },
      projectId: googleCredentials.project_id,
    });
    console.log("📂 Storage client initialized using GOOGLE env variable JSON");
  } catch (err) {
    console.error("❌ Error parsing GOOGLE env var JSON:", err);
    storage = new Storage();
  }
} else {
  storage = new Storage();
  console.log("📂 Storage client initialized with default environment credentials");
}

const bucketName = process.env.BUCKET_NAME || "mall-1bucket";
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
      const validExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".heic", ".heif"];
      const hasValidExt = validExtensions.some(ext => lowerName.endsWith(ext));
      if (!hasValidExt) {
        if (mimeType.includes("png")) {
          originalName += ".png";
        } else if (mimeType.includes("webp")) {
          originalName += ".webp";
        } else if (mimeType.includes("gif")) {
          originalName += ".gif";
        } else if (mimeType.includes("svg")) {
          originalName += ".svg";
        } else if (mimeType.includes("avif")) {
          originalName += ".avif";
        } else if (mimeType.includes("heic")) {
          originalName += ".heic";
        } else if (mimeType.includes("heif")) {
          originalName += ".heif";
        } else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
          originalName += ".jpeg";
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

// Helper: Upload base64 data URL to GCS
async function uploadBase64ToGCS(base64Str: string, folder: string = "profiles"): Promise<string> {
  // Check if it's a valid data URL
  if (!base64Str || !base64Str.startsWith("data:")) {
    return base64Str;
  }

  // Parse the data URL
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return base64Str;
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  // Determine file extension
  let extension = "jpg";
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime.includes("png")) {
    extension = "png";
  } else if (lowerMime.includes("webp")) {
    extension = "webp";
  } else if (lowerMime.includes("gif")) {
    extension = "gif";
  } else if (lowerMime.includes("svg")) {
    extension = "svg";
  } else if (lowerMime.includes("avif")) {
    extension = "avif";
  } else if (lowerMime.includes("heic")) {
    extension = "heic";
  } else if (lowerMime.includes("heif")) {
    extension = "heif";
  } else if (lowerMime.includes("jpeg") || lowerMime.includes("jpg")) {
    extension = "jpeg";
  }

  const filename = `${Date.now()}-${generateId()}.${extension}`;
  const blob = bucket.file(`${folder}/${filename}`);

  return new Promise<string>((resolve, reject) => {
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: mimeType,
      },
    });

    blobStream.on("error", (err) => {
      console.error("❌ Error uploading base64 to GCS:", err);
      reject(err);
    });

    blobStream.on("finish", () => {
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(buffer);
  });
}

// Helper: Get all users from MongoDB Atlas directly (0% mock data, always real-time database state)
async function getUsers(): Promise<User[]> {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbUsers = await MongoUser.find({
        id: { $nin: ["current_user", "user_guest"] },
        username: { $ne: "invitado" }
      });
      return dbUsers.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        bio: u.bio || "Creador en la plataforma",
        isOnline: u.isOnline !== undefined ? u.isOnline : false,
        followers: u.followers || 0,
        following: u.following || 0,
        savedReelIds: u.savedReelIds || [],
        coverPhoto: u.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isGuest: u.isGuest || false,
        password: u.password || "",
        email: u.email || ""
      }));
    }
  } catch (err) {
    console.error("Error fetching users from MongoDB:", err);
  }
  return [];
}


let products: Product[] = [];

let reels: Reel[] = [];

let chatMessages: ChatMessage[] = [];

let orders: Order[] = [];

let liveSessions: LiveSession[] = [];

// Active WebSocket Client Map: Key is userId
const activeClients = new Map<string, WebSocket>();

// Store the original ID of the active current_user (defaults to guest user's ID)
let activeOriginalUserId = "user_guest";

// Connect to MongoDB Atlas and load/seed users
async function connectToMongoDB() {
  let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("⚠️ MONGO_URI / MONGODB_URI environment variable is missing. Running with in-memory database fallback.");
    return;
  }
  
  // Strip outer quotes if present (double or single quotes)
  mongoUri = mongoUri.trim();
  if (mongoUri.startsWith('"') && mongoUri.endsWith('"')) {
    mongoUri = mongoUri.slice(1, -1).trim();
  } else if (mongoUri.startsWith("'") && mongoUri.endsWith("'")) {
    mongoUri = mongoUri.slice(1, -1).trim();
  }

  // Parse credentials and host to properly clean and encode password
  const uriMatch = mongoUri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):(.*)@([^/]+)(.*)$/);
  if (uriMatch) {
    const [_, protocol, username, password, host, rest] = uriMatch;
    let cleanPass = password;
    // Remove angle brackets if user left them in from Atlas template
    if (cleanPass.startsWith('<') && cleanPass.endsWith('>')) {
      cleanPass = cleanPass.slice(1, -1);
    }
    // Encode special characters in password (such as '@') if not already encoded
    try {
      const decodedPass = decodeURIComponent(cleanPass);
      cleanPass = encodeURIComponent(decodedPass);
    } catch (e) {
      if (cleanPass.includes('@')) {
        cleanPass = cleanPass.replace(/@/g, '%40');
      }
    }
    mongoUri = `${protocol}${username}:${cleanPass}@${host}${rest}`;
  } else {
    // Fallback simple replacement if it doesn't match standard regex
    const simpleMatch = mongoUri.match(/(mongodb\+srv:\/\/.*?):(.*?)@(.*)/);
    if (simpleMatch) {
      const [_, prefix, pass, suffix] = simpleMatch;
      let cleanPass = pass;
      if (cleanPass.startsWith('<') && cleanPass.endsWith('>')) {
        cleanPass = cleanPass.slice(1, -1);
      }
      if (cleanPass.includes('@')) {
        cleanPass = cleanPass.replace(/@/g, '%40');
      }
      mongoUri = `${prefix}:${cleanPass}@${suffix}`;
    }
  }

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoUri);
    console.log("✅ Successfully connected to MongoDB Atlas!");

    // Delete any guest users ("user_guest", "current_user", "invitado") from the database to ensure zero trace of them
    console.log("🧹 Purging any leftover guest/anonymous profiles from database...");
    await MongoUser.deleteMany({
      $or: [
        { id: "user_guest" },
        { id: "current_user" },
        { username: "invitado" }
      ]
    });
    console.log("🧹 Guest/anonymous profiles purged successfully!");

    console.log("📦 Loading existing users from MongoDB...");
    const dbUsers = await MongoUser.find();
    console.log(`📦 Loaded ${dbUsers.length} users successfully from MongoDB Atlas!`);

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

  // Subir foto de perfil (avatar)
  app.post(['/api/upload-avatar', '/upload-avatar'], upload.single('avatar'), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });

      const userId = req.body.userId || "current_user";
      console.log(`🚀 Iniciando subida de avatar para el usuario: ${userId}`);
      const publicUrl = await uploadToGCS(req.file, "avatars");
      console.log(`✅ Avatar subido con éxito a GCS: ${publicUrl}`);

      // Update in MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          await MongoUser.findOneAndUpdate({ id: userId }, { avatar: publicUrl });
          console.log(`💾 Avatar actualizado en MongoDB para: ${userId}`);
        } catch (dbErr) {
          console.error("❌ Error al guardar el avatar en MongoDB:", dbErr);
        }
      }

      res.status(200).json({ success: true, url: publicUrl });
    } catch (err: any) {
      console.error("❌ Error al subir avatar:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Subir foto de portada (cover)
  app.post(['/api/upload-cover', '/upload-cover'], upload.single('cover'), async (req: any, res: any) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No se subió archivo' });

      const userId = req.body.userId || "current_user";
      console.log(`🚀 Iniciando subida de portada para el usuario: ${userId}`);
      const publicUrl = await uploadToGCS(req.file, "covers");
      console.log(`✅ Portada subida con éxito a GCS: ${publicUrl}`);

      // Update in MongoDB if connected
      if (mongoose.connection.readyState === 1) {
        try {
          await MongoUser.findOneAndUpdate({ id: userId }, { coverPhoto: publicUrl });
          console.log(`💾 Portada actualizada en MongoDB para: ${userId}`);
        } catch (dbErr) {
          console.error("❌ Error al guardar la portada en MongoDB:", dbErr);
        }
      }

      res.status(200).json({ success: true, url: publicUrl });
    } catch (err: any) {
      console.error("❌ Error al subir portada:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get all users
  app.get("/api/users", async (req, res) => {
    const dbUsers = await getUsers();
    res.json(dbUsers);
  });

  // Get specific user profile with their products, reels, and orders
  app.get("/api/users/:id", async (req, res) => {
    const dbUsers = await getUsers();
    let user = dbUsers.find((u) => u.id === req.params.id);

    // Dynamic current_user resolver to avoid seeding mock guest users at startup
    if (!user && req.params.id === "current_user") {
      // Look for any real registered user in the DB to represent the session
      const realUser = dbUsers.find(u => u.id !== "current_user");
      if (realUser) {
        user = {
          ...realUser,
          id: "current_user"
        };
        if (mongoose.connection.readyState === 1) {
          try {
            await MongoUser.findOneAndUpdate(
              { id: "current_user" },
              {
                name: realUser.name,
                username: realUser.username,
                bio: realUser.bio,
                avatar: realUser.avatar,
                coverPhoto: realUser.coverPhoto,
                followers: realUser.followers,
                following: realUser.following,
                savedReelIds: realUser.savedReelIds || [],
                isGuest: false,
                password: realUser.password
              },
              { upsert: true }
            );
            activeOriginalUserId = realUser.id;
          } catch (err) {
            console.error("Failed to automatically assign active session user:", err);
          }
        }
      } else {
        res.status(404).json({ error: "No users exist in the database. Please register first." });
        return;
      }
    }

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
  app.post("/api/users/current/save", async (req, res) => {
    const { reelId } = req.body;
    let currentUserObj = null;
    
    if (mongoose.connection.readyState === 1) {
      currentUserObj = await MongoUser.findOne({ id: "current_user" });
    }
    
    if (!currentUserObj) {
      res.status(401).json({ error: "Debe iniciar sesión para realizar esta acción." });
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

    if (mongoose.connection.readyState === 1) {
      await MongoUser.findOneAndUpdate(
        { id: "current_user" },
        { savedReelIds: currentUserObj.savedReelIds }
      );
    }

    res.json({ success: true, saved, savedReelIds: currentUserObj.savedReelIds });
  });

  // Update current user profile info
  app.post("/api/users/current/update", async (req, res) => {
    const { name, username, bio, avatar, coverPhoto, password } = req.body;
    let currentUserObj = null;

    if (mongoose.connection.readyState === 1) {
      currentUserObj = await MongoUser.findOne({ id: "current_user" });
    }

    if (!currentUserObj) {
      res.status(401).json({ error: "Debe iniciar sesión para realizar esta acción." });
      return;
    }

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (username !== undefined) updateFields.username = username;
    if (bio !== undefined) updateFields.bio = bio;
    if (password !== undefined) updateFields.password = password;

    if (avatar !== undefined) {
      if (avatar && avatar.startsWith("data:")) {
        try {
          console.log("📸 Base64 avatar detected in update, uploading to GCS...");
          updateFields.avatar = await uploadBase64ToGCS(avatar, "avatars");
          console.log(`✅ Base64 avatar uploaded to GCS: ${updateFields.avatar}`);
        } catch (uploadErr) {
          console.error("❌ Failed to upload base64 avatar to GCS:", uploadErr);
          updateFields.avatar = avatar;
        }
      } else {
        updateFields.avatar = avatar;
      }
    }

    if (coverPhoto !== undefined) {
      if (coverPhoto && coverPhoto.startsWith("data:")) {
        try {
          console.log("📸 Base64 cover photo detected in update, uploading to GCS...");
          updateFields.coverPhoto = await uploadBase64ToGCS(coverPhoto, "covers");
          console.log(`✅ Base64 cover photo uploaded to GCS: ${updateFields.coverPhoto}`);
        } catch (uploadErr) {
          console.error("❌ Failed to upload base64 cover photo to GCS:", uploadErr);
          updateFields.coverPhoto = coverPhoto;
        }
      } else {
        updateFields.coverPhoto = coverPhoto;
      }
    }

    let updatedUser = currentUserObj;
    if (mongoose.connection.readyState === 1) {
      try {
        updatedUser = await MongoUser.findOneAndUpdate(
          { id: "current_user" },
          updateFields,
          { new: true, upsert: true }
        );
        console.log(`💾 User profile updated in MongoDB Atlas for ${updatedUser.username}`);

        if (activeOriginalUserId && activeOriginalUserId !== "user_guest") {
          await MongoUser.findOneAndUpdate(
            { id: activeOriginalUserId },
            updateFields
          );
          console.log(`💾 Synchronized updated profile fields with original user record: ${activeOriginalUserId}`);
        }
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
        if (c.username === "cg0220037" || c.username === updatedUser.username) {
          if (username !== undefined) c.username = username;
          if (avatar !== undefined) c.avatar = avatar;
        }
      });
    });

    res.json({ success: true, user: updatedUser });
  });

  // Register a new user in MongoDB Atlas
  app.post("/api/users/register", async (req, res) => {
    const { name, username, bio, avatar, coverPhoto, password, email } = req.body;
    if (!name || !username) {
      res.status(400).json({ error: "Name and username are required" });
      return;
    }
    if (!email || !email.trim()) {
      res.status(400).json({ error: "El correo electrónico es un requisito obligatorio." });
      return;
    }

    const cleanUsername = username.replace(/\s+/g, "").toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if username already exists in database (excluding the temporary current_user session)
    let existingUser = null;
    let existingEmail = null;
    if (mongoose.connection.readyState === 1) {
      existingUser = await MongoUser.findOne({ username: cleanUsername, id: { $ne: "current_user" } });
      existingEmail = await MongoUser.findOne({ email: cleanEmail, id: { $ne: "current_user" } });
    }

    if (existingUser) {
      res.status(400).json({ error: "⚠️ El nombre de usuario ya está registrado." });
      return;
    }

    if (existingEmail) {
      res.status(400).json({ error: "⚠️ Este correo electrónico ya está registrado con otra cuenta." });
      return;
    }

    let resolvedAvatar = avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";
    let resolvedCoverPhoto = coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

    if (avatar && avatar.startsWith("data:")) {
      try {
        console.log("📸 Base64 avatar detected in registration, uploading to GCS...");
        resolvedAvatar = await uploadBase64ToGCS(avatar, "avatars");
        console.log(`✅ Base64 avatar uploaded to GCS: ${resolvedAvatar}`);
      } catch (uploadErr) {
        console.error("❌ Failed to upload base64 avatar during registration:", uploadErr);
      }
    }

    if (coverPhoto && coverPhoto.startsWith("data:")) {
      try {
        console.log("📸 Base64 cover photo detected in registration, uploading to GCS...");
        resolvedCoverPhoto = await uploadBase64ToGCS(coverPhoto, "covers");
        console.log(`✅ Base64 cover photo uploaded to GCS: ${resolvedCoverPhoto}`);
      } catch (uploadErr) {
        console.error("❌ Failed to upload base64 cover photo during registration:", uploadErr);
      }
    }

    const newUser: User = {
      id: "user_" + generateId(),
      name,
      username: cleanUsername,
      email: email.trim(),
      bio: bio || "Nuevo creador de contenido en la plataforma",
      avatar: resolvedAvatar,
      coverPhoto: resolvedCoverPhoto,
      followers: 0,
      following: 0,
      isOnline: true,
      password: password || ""
    };

    // Save to MongoDB if connected
    let updatedCurrentUser = null;
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoUser = new MongoUser(newUser);
        await mongoUser.save();
        console.log(`💾 Registered new user @${newUser.username} in MongoDB Atlas!`);

        // Automatically set active session to this newly registered user
        updatedCurrentUser = await MongoUser.findOneAndUpdate(
          { id: "current_user" },
          {
            name: newUser.name,
            username: newUser.username,
            email: newUser.email,
            bio: newUser.bio,
            avatar: newUser.avatar,
            coverPhoto: newUser.coverPhoto,
            followers: newUser.followers,
            following: newUser.following,
            savedReelIds: newUser.savedReelIds || [],
            isGuest: false,
            password: newUser.password
          },
          { upsert: true, new: true }
        );
        activeOriginalUserId = newUser.id;
        console.log(`💾 Automatically set active session to @${newUser.username}`);
      } catch (err) {
        console.error("Failed to save registered user to MongoDB:", err);
      }
    }

    const returnedUser = updatedCurrentUser || {
      ...newUser,
      id: "current_user",
      isGuest: false
    };

    res.json({ success: true, user: returnedUser });
  });

  // Switch current active user (swaps details and saves to Mongo)
  app.post("/api/users/current/switch", async (req, res) => {
    try {
      const { targetUsername, password } = req.body;
      if (!targetUsername) {
        res.status(400).json({ error: "Target username is required" });
        return;
      }

      let targetUser = null;
      if (mongoose.connection.readyState === 1) {
        targetUser = await MongoUser.findOne({ username: targetUsername, id: { $ne: "current_user" } });
      }
      if (!targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Require password if the user has a password registered
      const expectedPassword = targetUser.password || "";
      if (expectedPassword && expectedPassword !== password) {
        res.status(401).json({ error: "La contraseña ingresada es incorrecta. Por favor verifícala." });
        return;
      }

      let currentUserObj = null;
      if (mongoose.connection.readyState === 1) {
        try {
          currentUserObj = await MongoUser.findOneAndUpdate(
            { id: "current_user" },
            {
              $setOnInsert: {
                id: "current_user",
                username: targetUser.username,
                name: targetUser.name,
                avatar: targetUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
                bio: targetUser.bio || "",
                isOnline: true,
                followers: targetUser.followers || 0,
                following: targetUser.following || 0,
                coverPhoto: targetUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
                isGuest: false,
                password: targetUser.password || "",
                savedReelIds: targetUser.savedReelIds || []
              }
            },
            { upsert: true, new: true }
          );
        } catch (upsertErr: any) {
          console.warn("⚠️ Race condition caught during initial current_user upsert, fetching existing:", upsertErr.message);
          currentUserObj = await MongoUser.findOne({ id: "current_user" });
        }
      }

      // If we are offline or still couldn't resolve, create a transient memory fallback object
      if (!currentUserObj) {
        currentUserObj = {
          id: "current_user",
          username: targetUser.username,
          name: targetUser.name,
          avatar: targetUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: targetUser.bio || "",
          isOnline: true,
          followers: targetUser.followers || 0,
          following: targetUser.following || 0,
          coverPhoto: targetUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          isGuest: false,
          password: targetUser.password || "",
          savedReelIds: targetUser.savedReelIds || []
        };
      }

      // 1. Save the active state of "current_user" back to its original record in MongoDB (if activeOriginalUserId is valid)
      if (mongoose.connection.readyState === 1 && activeOriginalUserId) {
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
              password: currentUserObj.password,
              email: currentUserObj.email || ""
            },
            { upsert: true }
          );
        } catch (err) {
          console.error("Failed to save original user state in MongoDB on switch:", err);
        }
      }

      // 2. Set the new original ID and copy targetUser's details into "current_user"
      activeOriginalUserId = targetUser.id;

      // Save the new current_user state in Mongo as well
      let updatedCurrentUser = currentUserObj;
      if (mongoose.connection.readyState === 1) {
        try {
          updatedCurrentUser = await MongoUser.findOneAndUpdate(
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
              password: targetUser.password || "",
              email: targetUser.email || ""
            },
            { new: true, upsert: true }
          );
        } catch (err) {
          console.error("Failed to update current_user in MongoDB on switch:", err);
        }
      }

      console.log(`🔄 Switched session user to @${updatedCurrentUser.username} (original id: ${activeOriginalUserId})`);
      res.json({ success: true, user: updatedCurrentUser });
    } catch (routeErr: any) {
      console.error("❌ Exception caught in user/switch endpoint:", routeErr);
      res.status(500).json({ error: "Internal server error switching user profile", details: routeErr.message });
    }
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
      
      let creator = null;
      if (mongoose.connection.readyState === 1) {
        creator = await MongoUser.findOne({ id: creatorId || "current_user" });
      }

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
      
      let seller = null;
      if (mongoose.connection.readyState === 1) {
        seller = await MongoUser.findOne({ id: sellerId || "current_user" });
      }

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
  app.post("/api/live", async (req, res) => {
    const { title, creatorId } = req.body;
    
    let creator = null;
    if (mongoose.connection.readyState === 1) {
      creator = await MongoUser.findOne({ id: creatorId || "current_user" });
    }

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
            if (mongoose.connection.readyState === 1) {
              MongoUser.findOneAndUpdate({ id: clientUserId }, { isOnline: true })
                .then(() => broadcastPresence())
                .catch((err: any) => console.error("Error setting user online in WS:", err));
            } else {
              broadcastPresence();
            }
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
        if (mongoose.connection.readyState === 1) {
          MongoUser.findOneAndUpdate({ id: clientUserId }, { isOnline: false })
            .then(() => broadcastPresence())
            .catch((err: any) => console.error("Error setting user offline in WS close:", err));
        } else {
          broadcastPresence();
        }
      }

      if (currentStreamId) {
        handleStreamLeave(ws, currentStreamId);
      }
    });
  });

  // Helper: Broadcast presence list
  async function broadcastPresence() {
    try {
      const dbUsers = await getUsers();
      const presenceData = dbUsers.map((u) => ({
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
    } catch (err) {
      console.error("Error in broadcastPresence:", err);
    }
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
