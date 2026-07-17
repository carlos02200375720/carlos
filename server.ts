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
  coverPhoto: { type: String }
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
    const uniqueName = `${Date.now()}-${generateId()}-${file.originalname.replace(/\s+/g, "_")}`;
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
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "user_2",
    username: "cyber_synth",
    name: "Alex Rivers",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80",
    bio: "Live DJ, modular synthesizers, and electronic beats. 🎵 Streaming my jam sessions live!",
    isOnline: true,
    followers: 5430,
    following: 112,
    coverPhoto: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "user_3",
    username: "fitness_guru",
    name: "Sophia Chen",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
    bio: "Daily workouts, healthy lifestyle, and custom high-performance activewear. 💪 Let's stay active together!",
    isOnline: false,
    followers: 12800,
    following: 405,
    coverPhoto: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "user_4",
    username: "neon_crafter",
    name: "Lucas Gray",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
    bio: "Handmade cyber-decor and neon lamps. Bringing future neon lights into your warm home. 💡⚡",
    isOnline: true,
    followers: 3210,
    following: 89,
    coverPhoto: "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&w=800&q=80"
  },
];


let products: Product[] = [
  {
    id: "prod_1",
    name: "Modular Synth Keys",
    description: "Compact Eurorack compatible MIDI keyboard with glowing visual oscillator waves, tactile buttons, and velocity-sensitive silicone keys.",
    price: 199.99,
    imageUrl: "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?auto=format&fit=crop&w=600&q=80",
    stock: 5,
    sellerId: "user_2",
    rating: 4.8,
  },
  {
    id: "prod_2",
    name: "Cyberpunk RGB Headphones",
    description: "Deep bass Bluetooth headphones with programmable glowing RGB strip lights, memory foam cups, and active hybrid noise-cancellation.",
    price: 89.50,
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80",
    stock: 12,
    sellerId: "user_2",
    rating: 4.6,
  },
  {
    id: "prod_3",
    name: "Eco-Flex Yoga Mat",
    description: "100% biodegradable non-slip grip yoga mat in premium lavender, featuring alignment markings and a dual-layer tear-resistant weave.",
    price: 45.00,
    imageUrl: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=600&q=80",
    stock: 20,
    sellerId: "user_3",
    rating: 4.9,
  },
  {
    id: "prod_4",
    name: "Cyber Lotus Neon Lamp",
    description: "Intricate laser-cut acrylic neon lotus desktop lamp with 16 custom color modes, smart app controller, and solid timber base.",
    price: 120.00,
    imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80",
    stock: 8,
    sellerId: "user_4",
    rating: 4.7,
  },
];

let reels: Reel[] = [
  {
    id: "reel_1",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-on-a-mixer-41556-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80",
    description: "Patching some modular chords for tonight's live streaming set. Check out my custom MIDI keyboard tagged below! 🎹🔊 #synth #ambient #livemusic #cyberpunk",
    creatorId: "user_2",
    creatorName: "Alex Rivers",
    creatorAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80",
    likes: 1420,
    comments: [
      { id: "c_1", username: "cg0220037", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80", text: "Incredible modular patch! The synthesizer sounds so warm. 🔥", createdAt: "2026-07-16T10:00:00Z" },
      { id: "c_2", username: "fitness_guru", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80", text: "Perfect background beats for my yoga routines!", createdAt: "2026-07-16T10:30:00Z" }
    ],
    shares: 89,
    views: 4200,
    productId: "prod_1"
  },
  {
    id: "reel_2",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-with-goggles-and-neon-lights-42511-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80",
    description: "Mid-week warm up routine with our new Eco-Flex lavender mat. Focus, breath, stretch! 🧘‍♀️🌿 #fitness #yoga #wellness #eco",
    creatorId: "user_3",
    creatorName: "Sophia Chen",
    creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
    likes: 932,
    comments: [
      { id: "c_3", username: "neon_crafter", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80", text: "Need one of those mats! The alignment marks are so useful.", createdAt: "2026-07-16T09:15:00Z" }
    ],
    shares: 35,
    views: 2150,
    productId: "prod_3"
  },
  {
    id: "reel_3",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-sign-light-over-black-background-34304-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=300&q=80",
    description: "The Cyber Lotus neon lamp is finally back in stock! Each acrylic petal is hand-etched for optimum light diffusion. 🌌💡 #neonart #homedecor #handcraft #cyberpunk",
    creatorId: "user_4",
    creatorName: "Lucas Gray",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
    likes: 2105,
    comments: [
      { id: "c_4", username: "cyber_synth", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80", text: "Fits the studio vibe perfectly, ordering right now!", createdAt: "2026-07-16T08:00:00Z" }
    ],
    shares: 201,
    views: 8400,
    productId: "prod_4"
  }
];

let chatMessages: ChatMessage[] = [
  { id: "m_1", senderId: "user_2", receiverId: "current_user", text: "Hey Carlos! Thanks for the comment on my latest modular synthesizers reel.", timestamp: "2026-07-16T11:00:00Z" },
  { id: "m_2", senderId: "current_user", receiverId: "user_2", text: "Of course Alex! It sounds incredible. Is the custom keyboard available for shipping?", timestamp: "2026-07-16T11:02:00Z" },
  { id: "m_3", senderId: "user_2", receiverId: "current_user", text: "Yes! Worldwide shipping, and I assemble them myself. Let me know if you have any questions!", timestamp: "2026-07-16T11:05:00Z" }
];

let orders: Order[] = [];

let liveSessions: LiveSession[] = [
  {
    id: "live_alex",
    creatorId: "user_2",
    creatorName: "Alex Rivers",
    creatorAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80",
    title: "Synthesizer Soundscape Live Jam 🌌🎛️",
    viewersCount: 42,
    isLive: true,
    chatMessages: [
      { id: "lc_1", username: "neon_crafter", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80", text: "Sounds amazing from the start!", createdAt: "2026-07-16T13:45:00Z" },
      { id: "lc_2", username: "fitness_guru", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80", text: "Tuning in from the treadmill, loving the beats!", createdAt: "2026-07-16T13:48:00Z" }
    ]
  }
];

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

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoUri);
    console.log("✅ Successfully connected to MongoDB Atlas!");

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
        coverPhoto: u.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
      }));
      console.log(`📦 Loaded ${users.length} users successfully from MongoDB Atlas!`);
    }
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB Atlas:", error);
  }
}

async function startServer() {
  // Connect to MongoDB
  await connectToMongoDB();

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
    const { name, username, bio, avatar, coverPhoto } = req.body;
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

    // Save to MongoDB Atlas if connection is active
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoUser.findOneAndUpdate(
          { id: currentUserObj.id },
          { name, username, bio, avatar, coverPhoto },
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
    const { name, username, bio, avatar, coverPhoto } = req.body;
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
      isOnline: true
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
    const { targetUsername } = req.body;
    if (!targetUsername) {
      res.status(400).json({ error: "Target username is required" });
      return;
    }

    const targetUser = users.find(u => u.username === targetUsername && u.id !== "current_user");
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
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
              savedReelIds: currentUserObj.savedReelIds
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
        isOnline: currentUserObj.isOnline
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
            savedReelIds: targetUser.savedReelIds || []
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
