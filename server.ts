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
import { transcodeVideoToHLS, hlsQueue, deleteHlsStreamBatch, optimizeVideoToH264 } from "./src/server/hlsTranscoder";

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
  followingUserIds: { type: [String], default: [] },
  savedReelIds: { type: [String], default: [] },
  coverPhoto: { type: String },
  isGuest: { type: Boolean, default: false },
  password: { type: String },
  email: { type: String, default: "" },
  privacyPolicy: { type: String, default: "" }
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
  variantList: [{
    vid: { type: String },
    name: { type: String },
    color: { type: String },
    size: { type: String },
    price: { type: Number },
    imageUrl: { type: String },
    sku: { type: String }
  }],
  category: { type: String },
  cjVid: { type: String },
  cjPid: { type: String },
  views: { type: Number, default: 0 }
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
  creatorUsername: { type: String },
  creatorAvatar: { type: String },
  likes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] },
  comments: [{
    id: { type: String },
    username: { type: String },
    avatar: { type: String },
    text: { type: String },
    createdAt: { type: String }
  }],
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  productId: { type: String },
  type: { type: String, default: "video" },
  images: { type: [String], default: [] },
  hlsUrl: { type: String }
});

const MongoReel = (mongoose.models.Reel || mongoose.model("Reel", ReelSchema)) as any;

// Mongoose Cart Schema for persistent shopping cart per user/client
const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [{
    product: { type: mongoose.Schema.Types.Mixed, required: true },
    quantity: { type: Number, required: true, default: 1 }
  }],
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

const MongoCart = (mongoose.models.Cart || mongoose.model("Cart", CartSchema)) as any;
const cartMemoryStore = new Map<string, any[]>();

// Mongoose Order Schema for persistent orders, tracking numbers, and seller fulfillment
const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  buyerId: { type: String },
  buyerName: { type: String },
  buyerUsername: { type: String },
  buyerAvatar: { type: String },
  buyerEmail: { type: String },
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    imageUrl: { type: String },
    sellerId: { type: String },
    sellerName: { type: String },
    sellerUsername: { type: String },
    carrier: { type: String }
  }],
  total: { type: Number, required: true },
  shippingCost: { type: Number, default: 0 },
  shippingAddress: { type: String, required: true },
  paymentStatus: { type: String, default: "paid" },
  status: { type: String, default: "processing" },
  trackingNumber: { type: String, default: "" },
  carrier: { type: String, default: "" },
  trackingUrl: { type: String, default: "" },
  estimatedDelivery: { type: String, default: "" },
  sellerNotes: { type: String, default: "" },
  statusHistory: [{
    status: { type: String },
    label: { type: String },
    timestamp: { type: String },
    note: { type: String },
    trackingNumber: { type: String },
    carrier: { type: String }
  }],
  createdAt: { type: String },
  updatedAt: { type: String }
}, { strict: false });

const MongoOrder = (mongoose.models.Order || mongoose.model("Order", OrderSchema)) as any;

// Google Cloud Storage setup
let storage: Storage;
const googleJsonPath = path.join(process.cwd(), "google.json");
const mallJsonPath = path.join(process.cwd(), "mall-1bucket.json");

// Helper to ensure bucketName is a clean GCS bucket name and not JSON credentials
function getValidBucketName(): string {
  const raw = (process.env.BUCKET_NAME || "").trim();
  if (raw && !raw.startsWith("{") && !raw.includes("service_account") && raw.length <= 63) {
    return raw;
  }
  return "mall-1bucket";
}

const bucketName = getValidBucketName();

// Extract service account JSON if it was accidentally put in BUCKET_NAME instead of GOOGLE
let googleJsonFromEnv = process.env.GOOGLE;
if (!googleJsonFromEnv && process.env.BUCKET_NAME && process.env.BUCKET_NAME.trim().startsWith("{")) {
  googleJsonFromEnv = process.env.BUCKET_NAME.trim();
}

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
} else if (googleJsonFromEnv) {
  try {
    const googleCredentials = JSON.parse(googleJsonFromEnv);
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

const bucket = storage.bucket(bucketName);

// Configure multer for memory storage (200MB limit for high-definition video/image uploads)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max limit
  }
});

// Safe Multer middleware wrapper that catches errors and always returns clean JSON
const uploadSingleSafe = (fieldName: string) => (req: any, res: any, next: any) => {
  upload.single(fieldName)(req, res, (err: any) => {
    if (err) {
      console.error(`❌ Multer upload error on field '${fieldName}':`, err);
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "El archivo seleccionado supera el límite permitido de 200MB. Por favor, selecciona un archivo más liviano.",
          code: "LIMIT_FILE_SIZE"
        });
      }
      return res.status(400).json({
        error: `Error al procesar el archivo: ${err.message || err}`,
        code: err.code || "UPLOAD_ERROR"
      });
    }
    next();
  });
};

// Helper: Upload file to GCS (with H.264 mobile optimization for all videos)
const uploadToGCS = async (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  let originalName = file.originalname.replace(/\s+/g, "_");
  const mimeType = file.mimetype.toLowerCase();

  // Enforce correct extensions on upload as requested
  const isVideo = mimeType.startsWith("video/") || originalName.toLowerCase().endsWith(".mp4");
  if (isVideo) {
    if (!originalName.toLowerCase().endsWith(".mp4")) {
      const dotIdx = originalName.lastIndexOf(".");
      if (dotIdx !== -1) {
        originalName = originalName.substring(0, dotIdx) + ".mp4";
      } else {
        originalName += ".mp4";
      }
    }

    // Process video to universal H.264 (AVC) with adjusted bitrate and +faststart for instant mobile playback
    try {
      console.log(`🎬 [Upload] Procesando video ${originalName} a formato H.264 universal para móviles...`);
      const optResult = await optimizeVideoToH264(file.buffer, generateId());
      file.buffer = optResult.buffer;
      file.size = optResult.optimizedSize;
      (file as any).h264Optimization = optResult;
      console.log(`✨ [Upload] Video optimizado con éxito: ${optResult.compressionRatioPercent}% de compresión`);
    } catch (optErr: any) {
      console.warn("⚠️ [Upload] No se pudo completar la optimización H.264, usando buffer original:", optErr.message);
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

  return new Promise((resolve, reject) => {
    const uniqueName = `${Date.now()}-${generateId()}-${originalName}`;
    const blob = bucket.file(`${folder}/${uniqueName}`);
    
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: isVideo ? "video/mp4" : file.mimetype,
        cacheControl: isVideo ? "public, max-age=31536000, immutable" : "public, max-age=86400",
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

// Helper: Delete file from GCS by URL
async function deleteFromGCS(fileUrl?: string): Promise<void> {
  try {
    if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.includes(`storage.googleapis.com/${bucketName}/`)) {
      return;
    }
    const prefix = `storage.googleapis.com/${bucketName}/`;
    const idx = fileUrl.indexOf(prefix);
    if (idx !== -1) {
      const filePath = decodeURIComponent(fileUrl.substring(idx + prefix.length));
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        console.log(`🗑️ Archivo eliminado de GCS (${bucketName}): ${filePath}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error al eliminar archivo de GCS:", err);
  }
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
        followingUserIds: u.followingUserIds || [],
        savedReelIds: u.savedReelIds || [],
        coverPhoto: u.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isGuest: u.isGuest || false,
        password: u.password || "",
        email: u.email || "",
        privacyPolicy: u.privacyPolicy || ""
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

// Store active viewer sockets per streamId
const streamViewersMap = new Map<string, Set<WebSocket>>();

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
      const seenProdIds = new Set<string>();
      const uniqueDbProducts = dbProducts.filter((p) => {
        if (!p.id || seenProdIds.has(p.id)) return false;
        seenProdIds.add(p.id);
        return true;
      });
      products = uniqueDbProducts.map(p => ({
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
        category: p.category || "",
        views: p.views || 0
      }));
      console.log(`📦 Loaded ${products.length} unique products successfully from MongoDB Atlas!`);
    }
 
    // Seed or Load Reels from MongoDB Atlas
    const reelCount = await MongoReel.countDocuments();
    if (reelCount === 0) {
      console.log("🌱 Seeding default reels to MongoDB...");
      await MongoReel.insertMany(reels as any);
      console.log("🌱 Seeding reels completed!");
    } else {
      console.log("📦 Loading reels from MongoDB...");
      // Clean up any old rainbow placeholder thumbnails from MongoDB
      await MongoReel.updateMany(
        { thumbnailUrl: { $regex: "1618005182384" } },
        { $set: { thumbnailUrl: "" } }
      ).catch(() => {});

      const dbReels = await MongoReel.find();
      const userMap = new Map<string, any>();
      dbUsers.forEach((u: any) => {
        userMap.set(u.id, u);
      });
      const seenReelIds = new Set<string>();
      const uniqueDbReels = dbReels.filter((r) => {
        if (!r.id || seenReelIds.has(r.id)) return false;
        seenReelIds.add(r.id);
        return true;
      });
      reels = uniqueDbReels.map(r => {
        const creatorUser = userMap.get(r.creatorId);
        return {
          id: r.id,
          videoUrl: r.videoUrl || "",
          thumbnailUrl: (r.thumbnailUrl && !r.thumbnailUrl.includes("1618005182384")) ? r.thumbnailUrl : "",
          description: r.description || "",
          creatorId: r.creatorId || "current_user",
          creatorName: creatorUser ? creatorUser.name : (r.creatorName || "Carlos Gómez"),
          creatorUsername: creatorUser ? creatorUser.username : (r.creatorUsername || undefined),
          creatorAvatar: creatorUser ? creatorUser.avatar : (r.creatorAvatar || ""),
          likes: r.likes || 0,
          likedBy: r.likedBy || [],
          comments: r.comments || [],
          shares: r.shares || 0,
          saves: r.saves || 0,
          views: r.views || 0,
          productId: r.productId || undefined,
          type: r.type || "video",
          images: (r.images || []).filter((img: string) => !img || !img.includes("1618005182384"))
        };
      });
      console.log(`📦 Loaded ${reels.length} unique reels successfully from MongoDB Atlas!`);
    }

    // Load or Seed Orders from MongoDB Atlas
    console.log("📦 Loading orders from MongoDB...");
    const orderCount = await MongoOrder.countDocuments();
    if (orderCount === 0) {
      console.log("🌱 Seeding realistic demo purchase and sale orders to MongoDB...");
      const now = Date.now();
      const demoOrders: Order[] = [
        {
          id: "ord_demo_compra",
          buyerId: "current_user",
          buyerName: "Carlos Gómez",
          buyerUsername: "carlosg",
          buyerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
          items: [
            {
              productId: products[0]?.id || "prod_1",
              name: products[0]?.name || "Auriculares Inalámbricos Pro",
              price: products[0]?.price || 89.99,
              quantity: 1,
              imageUrl: products[0]?.imageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
              sellerId: "seller_official",
              sellerName: "Tech Store Oficial",
              sellerUsername: "techstore",
              carrier: "DHL Express"
            }
          ],
          total: (products[0]?.price || 89.99) + 5.99,
          shippingCost: 5.99,
          shippingAddress: "Av. Central 742, Piso 4, Madrid, España",
          paymentStatus: "paid",
          status: "shipped",
          trackingNumber: "DHL-84920184ES",
          carrier: "DHL Express",
          trackingUrl: "https://www.dhl.com",
          estimatedDelivery: new Date(now + 2 * 86400000).toISOString().split("T")[0],
          sellerNotes: "Paquete entregado a la agencia DHL en Madrid. En tránsito hacia destino.",
          statusHistory: [
            {
              status: "pending",
              label: "Pago confirmado exitosamente",
              timestamp: new Date(now - 86400000 * 2).toISOString(),
              note: "Transacción aprobada mediante tarjeta bancaria."
            },
            {
              status: "processing",
              label: "Empaque y preparación de producto",
              timestamp: new Date(now - 86400000 * 1.5).toISOString(),
              note: "Verificación de embalaje protector y precinto de seguridad."
            },
            {
              status: "shipped",
              label: "Despachado con número de guía DHL",
              timestamp: new Date(now - 86400000 * 0.8).toISOString(),
              note: "Guía DHL-84920184ES generada. En camino al centro de distribución.",
              trackingNumber: "DHL-84920184ES",
              carrier: "DHL Express"
            }
          ],
          createdAt: new Date(now - 86400000 * 2).toISOString(),
          updatedAt: new Date(now - 86400000 * 0.8).toISOString()
        },
        {
          id: "ord_demo_venta",
          buyerId: "user_maria",
          buyerName: "María Fernández",
          buyerUsername: "mariaf",
          buyerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
          buyerEmail: "maria.fernandez@ejemplo.com",
          items: [
            {
              productId: products[1]?.id || products[0]?.id || "prod_2",
              name: products[1]?.name || products[0]?.name || "Smartwatch Deportivo Ultra",
              price: products[1]?.price || 129.50,
              quantity: 2,
              imageUrl: products[1]?.imageUrl || products[0]?.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
              sellerId: "current_user",
              sellerName: "Carlos Gómez",
              sellerUsername: "carlosg",
              carrier: "FedEx"
            }
          ],
          total: (products[1]?.price || 129.50) * 2 + 7.50,
          shippingCost: 7.50,
          shippingAddress: "Calle Las Flores 128, Apto 3B, Barcelona, España",
          paymentStatus: "paid",
          status: "processing",
          trackingNumber: "FDX-938201948",
          carrier: "FedEx",
          trackingUrl: "https://www.fedex.com",
          estimatedDelivery: new Date(now + 4 * 86400000).toISOString().split("T")[0],
          sellerNotes: "Preparando pedido para recolección de FedEx.",
          statusHistory: [
            {
              status: "pending",
              label: "Pago recibido del cliente",
              timestamp: new Date(now - 3600000 * 5).toISOString(),
              note: "Pago acreditado por 2 unidades."
            },
            {
              status: "processing",
              label: "En preparación por tu negocio",
              timestamp: new Date(now - 3600000 * 2).toISOString(),
              note: "Asigna o confirma el número de guía para despachar."
            }
          ],
          createdAt: new Date(now - 3600000 * 5).toISOString(),
          updatedAt: new Date(now - 3600000 * 2).toISOString()
        }
      ];
      await MongoOrder.insertMany(demoOrders as any);
      orders = demoOrders;
      console.log(`🌱 Seeding orders completed (${orders.length} orders)!`);
    } else {
      const dbOrders = await MongoOrder.find().sort({ createdAt: -1 });
      const seenOrderIds = new Set<string>();
      orders = dbOrders
        .filter((o: any) => {
          if (!o.id || seenOrderIds.has(o.id)) return false;
          seenOrderIds.add(o.id);
          return true;
        })
        .map((o: any) => ({
          id: o.id,
          buyerId: o.buyerId,
          buyerName: o.buyerName,
          buyerUsername: o.buyerUsername,
          buyerAvatar: o.buyerAvatar,
          buyerEmail: o.buyerEmail,
          items: o.items || [],
          total: o.total,
          shippingCost: o.shippingCost || 0,
          shippingAddress: o.shippingAddress,
          paymentStatus: o.paymentStatus || "paid",
          status: o.status || "processing",
          trackingNumber: o.trackingNumber || "",
          carrier: o.carrier || "",
          trackingUrl: o.trackingUrl || "",
          estimatedDelivery: o.estimatedDelivery || "",
          sellerNotes: o.sellerNotes || "",
          statusHistory: o.statusHistory || [],
          createdAt: o.createdAt || new Date().toISOString(),
          updatedAt: o.updatedAt || o.createdAt || new Date().toISOString(),
        }));
      console.log(`📦 Loaded ${orders.length} orders successfully from MongoDB Atlas!`);
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

  // CORS middleware to allow requests from Cloud Run domain and client origins
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-username, x-user-id, *");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- API ENDPOINTS ---

  // Health check endpoint for fast server wake-up & readiness verification
  app.get(["/api/health", "/health"], (req, res) => {
    res.json({
      status: "ok",
      server: "mall-social-cloudrun",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongoConnected: mongoose.connection.readyState === 1
    });
  });

  // Upload file to Google Cloud Storage & register in MongoDB
  // Upload file to Google Cloud Storage & register in MongoDB with background HLS transcode
  app.post("/api/upload", uploadSingleSafe("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      const { title, description, creatorId } = req.body;
      const mimeType = req.file.mimetype.toLowerCase();
      const isVideo = mimeType.startsWith("video/") || req.file.originalname.toLowerCase().endsWith(".mp4");
      
      console.log(`🚀 Iniciando subida inmediata a GCS: ${req.file.originalname}`);
      const publicUrl = await uploadToGCS(req.file, "publicaciones");
      console.log(`✅ Archivo base subido con éxito a GCS: ${publicUrl}`);

      const pubId = "pub_" + generateId();
      const provisionalHlsUrl = undefined;

      // Crear registro en MongoDB inmediatamente
      let savedPublicacionObj = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const newPublicacion = new MongoPublicacion({
            id: pubId,
            url: publicUrl,
            title: title || req.file.originalname,
            description: description || "",
            creatorId: creatorId || "current_user",
            createdAt: new Date()
          });

          savedPublicacionObj = await newPublicacion.save();
          console.log(`💾 Publicación registrada en MongoDB con id: ${pubId}`);
        } catch (dbErr) {
          console.error("❌ Error al guardar publicación en MongoDB:", dbErr);
        }
      }

      let jobId: string | undefined = undefined;

      // Asynchronous non-blocking background queue for HLS multi-bitrate transcoding
      if (isVideo) {
        jobId = "hls_" + generateId();
        console.log(`⚡ [HLS Worker] Encolando trabajo en segundo plano ${jobId} para ${req.file.originalname}...`);

        hlsQueue.enqueue(
          jobId,
          req.file.buffer,
          req.file.originalname,
          bucket,
          bucketName,
          {
            publicacionId: pubId,
            onComplete: async (hlsResult) => {
              console.log(`🎉 [HLS Async] Transcodificación en segundo plano completada para ${pubId}: ${hlsResult.masterM3u8Url}`);
              
              // Update MongoPublicacion
              if (mongoose.connection.readyState === 1) {
                try {
                  await MongoPublicacion.updateOne({ id: pubId }, { $set: { hlsUrl: hlsResult.masterM3u8Url } });
                  await MongoReel.updateMany({ videoUrl: publicUrl }, { $set: { hlsUrl: hlsResult.masterM3u8Url } });
                } catch (updateErr) {
                  console.error("Error updating MongoDB with completed HLS stream:", updateErr);
                }
              }

              // Update in-memory reels if present
              reels.forEach((r) => {
                if (r.videoUrl === publicUrl) {
                  r.hlsUrl = hlsResult.masterM3u8Url;
                }
              });

              // Broadcast real-time update to all connected web/mobile clients
              broadcastToAll({
                type: "hls_job_completed",
                jobId,
                publicacionId: pubId,
                videoUrl: publicUrl,
                hlsUrl: hlsResult.masterM3u8Url,
                stats: {
                  latencyMs: hlsResult.latencyMs,
                  totalSegments: hlsResult.totalSegments,
                },
              });
            },
            onError: (err) => {
              console.warn(`⚠️ [HLS Async] Trabajo en segundo plano falló para ${pubId}:`, err.message);
            }
          }
        );
      }

      const h264Opt = (req.file as any).h264Optimization;

      // Return immediately to client without freezing UI (< 1s upload experience)
      res.json({
        success: true,
        message: isVideo
          ? "Video procesado a H.264 (AVC) ultra-compatible con bitrate ajustado y reproducción instantánea."
          : "Archivo subido exitosamente. Transcodificación HLS en cola en segundo plano.",
        url: publicUrl,
        hlsUrl: provisionalHlsUrl,
        jobId,
        publicacion: savedPublicacionObj,
        h264Optimization: h264Opt ? {
          codec: h264Opt.codec,
          originalSize: h264Opt.originalSize,
          optimizedSize: h264Opt.optimizedSize,
          compressionRatioPercent: h264Opt.compressionRatioPercent,
          durationMs: h264Opt.durationMs
        } : undefined
      });
    } catch (error: any) {
      console.error("❌ Error en el proceso de upload:", error);
      res.status(500).json({ error: "Error interno del servidor durante el upload", details: error.message });
    }
  });

  // Alias /upload
  app.post("/upload", uploadSingleSafe("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      const { title, description, creatorId } = req.body;
      const mimeType = req.file.mimetype.toLowerCase();
      const isVideo = mimeType.startsWith("video/") || req.file.originalname.toLowerCase().endsWith(".mp4");
      const publicUrl = await uploadToGCS(req.file, "publicaciones");
      const pubId = "pub_" + generateId();
      const provisionalHlsUrl = undefined;
      const h264Opt = (req.file as any).h264Optimization;

      let savedPublicacionObj = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const newPublicacion = new MongoPublicacion({
            id: pubId,
            url: publicUrl,
            title: title || req.file.originalname,
            description: description || "",
            creatorId: creatorId || "current_user",
            createdAt: new Date()
          });

          savedPublicacionObj = await newPublicacion.save();
        } catch (dbErr) {
          console.error("❌ Error al guardar publicación en MongoDB:", dbErr);
        }
      }

      let jobId: string | undefined = undefined;
      if (isVideo) {
        jobId = "hls_" + generateId();
        hlsQueue.enqueue(
          jobId,
          req.file.buffer,
          req.file.originalname,
          bucket,
          bucketName,
          {
            publicacionId: pubId,
            onComplete: async (hlsResult) => {
              if (mongoose.connection.readyState === 1) {
                await MongoPublicacion.updateOne({ id: pubId }, { $set: { hlsUrl: hlsResult.masterM3u8Url } });
                await MongoReel.updateMany({ videoUrl: publicUrl }, { $set: { hlsUrl: hlsResult.masterM3u8Url } });
              }
              reels.forEach(r => { if (r.videoUrl === publicUrl) r.hlsUrl = hlsResult.masterM3u8Url; });
              broadcastToAll({
                type: "hls_job_completed",
                jobId,
                publicacionId: pubId,
                videoUrl: publicUrl,
                hlsUrl: hlsResult.masterM3u8Url,
                stats: { latencyMs: hlsResult.latencyMs, totalSegments: hlsResult.totalSegments }
              });
            }
          }
        );
      }

      res.json({
        success: true,
        message: isVideo
          ? "Video procesado a H.264 (AVC) ultra-compatible y subido exitosamente"
          : "Archivo subido y registrado exitosamente",
        url: publicUrl,
        hlsUrl: provisionalHlsUrl,
        jobId,
        publicacion: savedPublicacionObj,
        h264Optimization: h264Opt ? {
          codec: h264Opt.codec,
          originalSize: h264Opt.originalSize,
          optimizedSize: h264Opt.optimizedSize,
          compressionRatioPercent: h264Opt.compressionRatioPercent,
          durationMs: h264Opt.durationMs
        } : undefined
      });
    } catch (error: any) {
      console.error("❌ Error en /upload:", error);
      res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
  });

  // HLS Queue Telemetry & Latency Monitoring Endpoint
  app.get("/api/hls/telemetry", (req: any, res: any) => {
    try {
      const telemetry = hlsQueue.getTelemetry();
      const jobs = hlsQueue.getAllJobs();
      res.json({
        success: true,
        telemetry,
        jobs: jobs.slice(0, 30),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch HLS telemetry", details: err.message });
    }
  });

  // HLS Dynamic Streaming Fallback Endpoint (Redirects directly to avoid CPU overhead)
  app.get("/api/hls/stream", async (req: any, res: any) => {
    try {
      const videoUrl = (req.query.url as string || "").trim();
      if (!videoUrl) {
        res.status(400).send("#EXTM3U\n# Error: video url required");
        return;
      }
      // Redirect directly to source video URL for native playback
      res.redirect(videoUrl);
    } catch (err: any) {
      res.status(500).send("#EXTM3U\n# Error streaming video");
    }
  });

  // Batch Cleanup & Deletion Endpoint for Reels & HLS segments in GCS
  app.delete(["/api/reels/:id", "/api/publicaciones/:id"], async (req: any, res: any) => {
    try {
      const targetId = req.params.id;
      if (!targetId) {
        res.status(400).json({ error: "ID is required" });
        return;
      }

      console.log(`🗑️ [Batch Cleanup] Deleting publication / reel ${targetId}...`);

      // Find reel in memory or database
      const existingReel = reels.find(r => r.id === targetId);
      const videoUrl = existingReel?.videoUrl || "";
      const hlsUrl = existingReel?.hlsUrl || "";

      let gcsCleanedFiles = 0;

      // 1. Batch delete all GCS HLS segments & playlists
      if (hlsUrl && hlsUrl.includes("storage.googleapis.com")) {
        const cleanupResult = await deleteHlsStreamBatch(bucket, hlsUrl);
        gcsCleanedFiles += cleanupResult.deletedCount;
      }

      // 2. Delete source MP4 video file from GCS if applicable
      if (videoUrl && videoUrl.includes("storage.googleapis.com")) {
        try {
          const videoMatch = videoUrl.match(/publicaciones\/([^/?#]+)/);
          if (videoMatch && videoMatch[0]) {
            await bucket.file(videoMatch[0]).delete({ ignoreNotFound: true });
            gcsCleanedFiles++;
            console.log(`🧹 Deleted source video file: ${videoMatch[0]}`);
          }
        } catch (srcDelErr) {
          console.warn("Could not delete source MP4 file from GCS:", srcDelErr);
        }
      }

      // 3. Remove from MongoDB
      if (mongoose.connection.readyState === 1) {
        try {
          await MongoReel.deleteOne({ id: targetId });
          await MongoPublicacion.deleteOne({ id: targetId });
          console.log(`💾 Deleted ${targetId} from MongoDB`);
        } catch (dbErr) {
          console.error("Error deleting from MongoDB:", dbErr);
        }
      }

      // 4. Remove from in-memory reels array
      reels = reels.filter(r => r.id !== targetId);

      // 5. Broadcast deletion to all clients
      broadcastToAll({
        type: "reel_deleted",
        reelId: targetId
      });

      res.json({
        success: true,
        message: `Publicación eliminada correctamente con limpieza en lote de ${gcsCleanedFiles} archivos en GCS.`,
        deletedId: targetId,
        gcsCleanedFiles,
      });
    } catch (err: any) {
      console.error("❌ Error deleting publication with batch cleanup:", err);
      res.status(500).json({ error: "Failed to delete publication", details: err.message });
    }
  });


  // Subir foto de perfil (avatar)
  app.post(['/api/upload-avatar', '/upload-avatar'], uploadSingleSafe('avatar'), async (req: any, res: any) => {
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
  app.post(['/api/upload-cover', '/upload-cover'], uploadSingleSafe('cover'), async (req: any, res: any) => {
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
    const rawParam = (req.params.id || "").trim();
    const cleanParam = rawParam.toLowerCase();

    const headerUsername = (req.headers["x-user-username"] as string)?.trim().toLowerCase();
    const headerUserId = (req.headers["x-user-id"] as string)?.trim();
    const queryUsername = (req.query.username as string)?.trim().toLowerCase();
    const queryUserId = (req.query.userId as string)?.trim();

    let user: any = null;

    // Dynamic current_user resolver to preserve user session
    if (
      rawParam === "current_user" ||
      cleanParam === "current_user" ||
      cleanParam === "invitado" ||
      cleanParam === "user_guest" ||
      cleanParam === "guest"
    ) {
      let activeUser: any = null;
      const targetIdentifier = headerUsername || queryUsername || headerUserId || queryUserId;

      if (mongoose.connection.readyState === 1) {
        if (targetIdentifier && targetIdentifier !== "invitado" && targetIdentifier !== "user_guest" && targetIdentifier !== "current_user" && targetIdentifier !== "guest") {
          activeUser = await MongoUser.findOne({
            $or: [
              { username: targetIdentifier.toLowerCase() },
              { id: targetIdentifier },
              { email: targetIdentifier.toLowerCase() }
            ]
          });
        }

        if (!activeUser && activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user" && activeOriginalUserId !== "invitado") {
          activeUser = await MongoUser.findOne({ id: activeOriginalUserId });
        }
      }

      if (!activeUser && targetIdentifier && targetIdentifier !== "invitado" && targetIdentifier !== "user_guest" && targetIdentifier !== "guest") {
        activeUser = dbUsers.find(u =>
          u.username?.toLowerCase() === targetIdentifier.toLowerCase() ||
          u.id === targetIdentifier ||
          (u.originalId && u.originalId === targetIdentifier)
        );
      }

      if (activeUser && activeUser.username !== "invitado" && !activeUser.isGuest) {
        user = {
          id: "current_user",
          originalId: activeUser.id,
          username: activeUser.username,
          name: activeUser.name,
          avatar: activeUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: activeUser.bio || "Creador en la plataforma",
          isOnline: activeUser.isOnline !== undefined ? activeUser.isOnline : true,
          followers: activeUser.followers || 0,
          following: activeUser.following || 0,
          followingUserIds: activeUser.followingUserIds || [],
          savedReelIds: activeUser.savedReelIds || [],
          coverPhoto: activeUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          isGuest: false,
          password: activeUser.password || "",
          email: activeUser.email || "",
          privacyPolicy: activeUser.privacyPolicy || ""
        };
      } else {
        // Safe guest user representation
        user = {
          id: "current_user",
          username: "invitado",
          name: "Invitado",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: "Explorando la plataforma",
          isOnline: false,
          followers: 0,
          following: 0,
          followingUserIds: [],
          savedReelIds: [],
          coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          isGuest: true,
          password: "",
          email: "",
          privacyPolicy: ""
        };
      }
    } else {
      // 1. Direct MongoDB lookup for the freshest profile data including privacyPolicy
      if (mongoose.connection.readyState === 1) {
        const found = await MongoUser.findOne({
          $or: [
            { id: rawParam },
            { id: cleanParam },
            { username: cleanParam },
            { username: rawParam },
            { name: rawParam }
          ]
        });
        if (found) {
          user = {
            id: found.id,
            originalId: found.id,
            username: found.username,
            name: found.name,
            avatar: found.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            bio: found.bio || "Creador en la plataforma",
            isOnline: found.isOnline !== undefined ? found.isOnline : false,
            followers: found.followers || 0,
            following: found.following || 0,
            followingUserIds: found.followingUserIds || [],
            savedReelIds: found.savedReelIds || [],
            coverPhoto: found.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            isGuest: false,
            password: found.password || "",
            email: found.email || "",
            privacyPolicy: found.privacyPolicy || ""
          };
        }
      }

      // 2. Fallback to in-memory dbUsers
      if (!user) {
        user = dbUsers.find(
          (u) =>
            u.id === rawParam ||
            u.username?.toLowerCase() === cleanParam ||
            u.id?.toLowerCase() === cleanParam ||
            (u.originalId && u.originalId === rawParam)
        );
      }

      // Fallback: If user is not yet in MongoUser or dbUsers, look up in reels
      if (!user) {
        const matchedReel = reels.find(
          (r) =>
            r.creatorId === rawParam ||
            r.creatorUsername?.toLowerCase() === cleanParam ||
            r.creatorName?.toLowerCase() === cleanParam ||
            (cleanParam && r.creatorUsername && cleanParam.includes(r.creatorUsername.toLowerCase())) ||
            (cleanParam && r.creatorId && cleanParam.includes(r.creatorId.toLowerCase()))
        );

        let matchedMongoReel = null;
        if (!matchedReel && mongoose.connection.readyState === 1) {
          matchedMongoReel = await MongoReel.findOne({
            $or: [
              { creatorId: rawParam },
              { creatorUsername: cleanParam },
              { creatorUsername: rawParam },
              { creatorName: rawParam }
            ]
          }).catch(() => null);
        }

        const sourceReel = matchedReel || matchedMongoReel;
        if (sourceReel) {
          let creatorMongoUser = null;
          if (mongoose.connection.readyState === 1) {
            creatorMongoUser = await MongoUser.findOne({
              $or: [
                { id: sourceReel.creatorId },
                { username: sourceReel.creatorUsername }
              ]
            }).catch(() => null);
          }
          user = {
            id: sourceReel.creatorId || rawParam,
            originalId: sourceReel.creatorId || rawParam,
            username: sourceReel.creatorUsername || sourceReel.creatorName?.toLowerCase().replace(/\s+/g, "") || "creador",
            name: sourceReel.creatorName || "Creador",
            avatar: sourceReel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            bio: creatorMongoUser?.bio || "Creador oficial en la plataforma",
            followers: creatorMongoUser?.followers || 120,
            following: creatorMongoUser?.following || 35,
            followingUserIds: creatorMongoUser?.followingUserIds || [],
            savedReelIds: creatorMongoUser?.savedReelIds || [],
            coverPhoto: creatorMongoUser?.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            isGuest: false,
            password: "",
            email: "",
            privacyPolicy: creatorMongoUser?.privacyPolicy || ""
          };
        }
      }

      // Fallback: Check in products
      if (!user) {
        const matchedProd = products.find(
          (p) =>
            p.sellerId === rawParam ||
            p.sellerName?.toLowerCase() === cleanParam ||
            (cleanParam && p.sellerId && cleanParam.includes(p.sellerId.toLowerCase()))
        );

        let matchedMongoProd = null;
        if (!matchedProd && mongoose.connection.readyState === 1) {
          matchedMongoProd = await MongoProduct.findOne({
            $or: [
              { sellerId: rawParam },
              { sellerName: rawParam }
            ]
          }).catch(() => null);
        }

        const sourceProd = matchedProd || matchedMongoProd;
        if (sourceProd) {
          let sellerMongoUser = null;
          if (mongoose.connection.readyState === 1) {
            sellerMongoUser = await MongoUser.findOne({
              $or: [
                { id: sourceProd.sellerId },
                { username: sourceProd.sellerName?.toLowerCase().replace(/\s+/g, "") }
              ]
            }).catch(() => null);
          }
          user = {
            id: sourceProd.sellerId || rawParam,
            originalId: sourceProd.sellerId || rawParam,
            username: sourceProd.sellerName?.toLowerCase().replace(/\s+/g, "") || "tienda",
            name: sourceProd.sellerName || "Tienda Oficial",
            avatar: sourceProd.sellerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            bio: sellerMongoUser?.bio || "Tienda y vendedor verificado en la plataforma",
            followers: sellerMongoUser?.followers || 85,
            following: sellerMongoUser?.following || 15,
            followingUserIds: sellerMongoUser?.followingUserIds || [],
            savedReelIds: sellerMongoUser?.savedReelIds || [],
            coverPhoto: sellerMongoUser?.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            isGuest: false,
            password: "",
            email: "",
            privacyPolicy: sellerMongoUser?.privacyPolicy || ""
          };
        }
      }
    }

    if (!user) {
       res.status(404).json({ error: "User not found" });
       return;
    }

    const userIdentifiers = new Set<string>();
    if (user.id) userIdentifiers.add(user.id);
    if (user.originalId) userIdentifiers.add(user.originalId);
    if (user.username) {
      userIdentifiers.add(user.username);
      userIdentifiers.add(user.username.toLowerCase());
    }
    if (activeOriginalUserId && activeOriginalUserId !== "user_guest" && (user.id === "current_user" || user.originalId === activeOriginalUserId)) {
      userIdentifiers.add(activeOriginalUserId);
    }

    const seenProd = new Set<string>();
    const userProducts = products
      .filter((p) =>
        userIdentifiers.has(p.sellerId) ||
        (user.id === "current_user" && p.sellerId === activeOriginalUserId)
      )
      .filter((p) => {
        if (!p.id || seenProd.has(p.id)) return false;
        seenProd.add(p.id);
        return true;
      });

    const seenReel = new Set<string>();
    const userReels = reels
      .filter((r) =>
        userIdentifiers.has(r.creatorId) ||
        (r.creatorUsername && userIdentifiers.has(r.creatorUsername.toLowerCase())) ||
        (user.id === "current_user" && r.creatorId === activeOriginalUserId)
      )
      .filter((r) => {
        if (!r.id || seenReel.has(r.id)) return false;
        seenReel.add(r.id);
        return true;
      });

    // Compute purchases made by the user
    const userPurchases = orders.filter((o) => {
      if (user.id === "current_user") {
        return o.buyerId === "current_user" || (activeOriginalUserId && o.buyerId === activeOriginalUserId) || !o.buyerId;
      }
      return (
        userIdentifiers.has(o.buyerId || "") ||
        (o.buyerUsername && userIdentifiers.has(o.buyerUsername.toLowerCase()))
      );
    });

    // Compute sales where the user is the seller of at least one product
    const userSales = orders.filter((o) => {
      return o.items.some((it) => {
        if (user.id === "current_user") {
          return it.sellerId === "current_user" || (activeOriginalUserId && it.sellerId === activeOriginalUserId) || !it.sellerId;
        }
        return (
          userIdentifiers.has(it.sellerId || "") ||
          (it.sellerUsername && userIdentifiers.has(it.sellerUsername.toLowerCase()))
        );
      });
    });

    const seenSaved = new Set<string>();
    const userSavedReels = reels
      .filter((r) => (user.savedReelIds || []).includes(r.id))
      .filter((r) => {
        if (!r.id || seenSaved.has(r.id)) return false;
        seenSaved.add(r.id);
        return true;
      });

    res.json({
      user,
      products: userProducts,
      reels: userReels,
      orders: userPurchases,
      purchases: userPurchases,
      sales: userSales,
      savedReels: userSavedReels,
    });
  });

  // Toggle save/unsave a reel
  app.post("/api/users/current/save", async (req, res) => {
    const { reelId, userId, username } = req.body;
    let currentUserObj: any = null;
    
    if (mongoose.connection.readyState === 1) {
      const candidates = [userId, username, activeOriginalUserId].filter(
        (id) => id && id !== "user_guest" && id !== "current_user" && id !== "invitado"
      );
      if (candidates.length > 0) {
        currentUserObj = await MongoUser.findOne({
          $or: candidates.flatMap((id) => [
            { id },
            { username: id },
            { username: typeof id === "string" ? id.toLowerCase() : id }
          ])
        });
      }
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
        { id: currentUserObj.id },
        { savedReelIds: currentUserObj.savedReelIds }
      );
    }

    // Update saves count on target reel
    const reel = reels.find((r) => r.id === reelId);
    let newSavesCount = 0;
    if (reel) {
      if (saved) {
        reel.saves = (reel.saves || 0) + 1;
      } else {
        reel.saves = Math.max(0, (reel.saves || 1) - 1);
      }
      newSavesCount = reel.saves;

      if (mongoose.connection.readyState === 1) {
        try {
          await MongoReel.updateOne({ id: reel.id }, { $set: { saves: reel.saves } });
        } catch (err) {
          console.error("❌ Failed to update reel saves in MongoDB:", err);
        }
      }

      // Broadcast metric update to all connected clients
      broadcastToAll({
        type: "reel_updated",
        reelId: reel.id,
        likes: reel.likes,
        saves: reel.saves,
        commentsCount: reel.comments.length
      });
    }

    res.json({ success: true, saved, saves: newSavesCount, savedReelIds: currentUserObj.savedReelIds });
  });

  // Toggle follow/unfollow a creator or user
  app.post("/api/users/:targetUserId/follow", async (req, res) => {
    const { targetUserId } = req.params;
    const currentUserIdReq = req.body?.currentUserId;
    const currentUsernameReq = req.body?.currentUsername;
    let currentUserObj: any = null;
    let targetUserObj: any = null;

    if (mongoose.connection.readyState === 1) {
      const candidates = [currentUserIdReq, currentUsernameReq, activeOriginalUserId].filter(
        (id) => id && id !== "user_guest" && id !== "current_user" && id !== "invitado"
      );
      if (candidates.length > 0) {
        currentUserObj = await MongoUser.findOne({
          $or: candidates.flatMap((id) => [
            { id },
            { username: id },
            { username: typeof id === "string" ? id.toLowerCase() : id }
          ])
        });
      }
      targetUserObj = await MongoUser.findOne({
        $or: [
          { id: targetUserId },
          { username: targetUserId },
          { username: typeof targetUserId === "string" ? targetUserId.toLowerCase() : targetUserId }
        ]
      });
    }

    // Fallback if not found in DB or DB disconnected
    if (!currentUserObj && currentUserIdReq && currentUserIdReq !== "user_guest" && currentUserIdReq !== "invitado") {
      currentUserObj = {
        id: currentUserIdReq,
        username: currentUsernameReq || "current_user",
        followingUserIds: [],
        following: 0,
        isGuest: false
      };
    }

    if (!currentUserObj || currentUserObj.isGuest || currentUserObj.username === "invitado") {
      res.status(401).json({ error: "Debe iniciar sesión para seguir a creadores." });
      return;
    }

    if (!currentUserObj.followingUserIds) {
      currentUserObj.followingUserIds = [];
    }

    const resolvedTargetId = targetUserObj ? targetUserObj.id : targetUserId;

    if (
      resolvedTargetId === currentUserObj.id ||
      resolvedTargetId === "current_user" ||
      (currentUserObj.username && resolvedTargetId.toLowerCase() === currentUserObj.username.toLowerCase())
    ) {
      res.status(400).json({ error: "No puedes seguirte a ti mismo." });
      return;
    }

    const index = currentUserObj.followingUserIds.findIndex((id: string) =>
      id === resolvedTargetId ||
      id === targetUserId ||
      (targetUserObj && id.toLowerCase() === targetUserObj.username?.toLowerCase()) ||
      id.toLowerCase() === targetUserId.toLowerCase()
    );

    let isFollowing = false;

    if (index > -1) {
      // Unfollow
      currentUserObj.followingUserIds.splice(index, 1);
      currentUserObj.following = Math.max(0, (currentUserObj.following || 1) - 1);
      if (targetUserObj) {
        targetUserObj.followers = Math.max(0, (targetUserObj.followers || 1) - 1);
      }
      isFollowing = false;
    } else {
      // Follow
      currentUserObj.followingUserIds.push(resolvedTargetId);
      currentUserObj.following = (currentUserObj.following || 0) + 1;
      if (targetUserObj) {
        targetUserObj.followers = (targetUserObj.followers || 0) + 1;
      }
      isFollowing = true;
    }

    if (mongoose.connection.readyState === 1) {
      if (currentUserObj._id) {
        await MongoUser.updateOne(
          { _id: currentUserObj._id },
          { $set: { followingUserIds: currentUserObj.followingUserIds, following: currentUserObj.following } }
        );
      }
      if (targetUserObj && targetUserObj._id) {
        await MongoUser.updateOne(
          { _id: targetUserObj._id },
          { $set: { followers: targetUserObj.followers } }
        );
      }
    }

    res.json({
      success: true,
      isFollowing,
      followingUserIds: currentUserObj.followingUserIds,
      targetUserId: resolvedTargetId,
      targetFollowers: targetUserObj ? targetUserObj.followers : 0,
      currentUserFollowing: currentUserObj.following
    });
  });

  // Update current user profile info
  app.post("/api/users/current/update", async (req, res) => {
    const { name, username, bio, avatar, coverPhoto, password, privacyPolicy, userId, currentUsername } = req.body;
    const headerUsername = (req.headers["x-user-username"] as string)?.trim().toLowerCase();
    const headerUserId = (req.headers["x-user-id"] as string)?.trim();
    let currentUserObj = null;

    if (mongoose.connection.readyState === 1) {
      const idCandidates = [activeOriginalUserId, userId, headerUserId].filter(
        id => id && id !== "user_guest" && id !== "current_user" && id !== "invitado" && id !== "guest"
      );
      const usernameCandidates = [currentUsername, headerUsername].filter(
        u => u && u !== "invitado" && u !== "user_guest" && u !== "guest"
      );

      for (const cid of idCandidates) {
        currentUserObj = await MongoUser.findOne({ id: cid });
        if (currentUserObj) break;
      }

      if (!currentUserObj) {
        for (const un of usernameCandidates) {
          currentUserObj = await MongoUser.findOne({ username: un.toLowerCase() });
          if (currentUserObj) break;
        }
      }
    }

    if (!currentUserObj) {
      res.status(401).json({ error: "Debe iniciar sesión para realizar esta acción." });
      return;
    }

    activeOriginalUserId = currentUserObj.id;

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (username !== undefined) updateFields.username = username;
    if (bio !== undefined) updateFields.bio = bio;
    if (password !== undefined) updateFields.password = password;
    if (privacyPolicy !== undefined) updateFields.privacyPolicy = privacyPolicy;

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
    if (mongoose.connection.readyState === 1 && currentUserObj.id !== "user_guest") {
      try {
        updatedUser = await MongoUser.findOneAndUpdate(
          { id: currentUserObj.id },
          updateFields,
          { new: true }
        );
        console.log(`💾 User profile updated directly in MongoDB Atlas for ${updatedUser.username}, privacyPolicy length: ${(updatedUser.privacyPolicy || "").length}`);
      } catch (err) {
        console.error("Failed to update profile in MongoDB:", err);
      }
    }

    // Update in memory items that reference this user
    reels.forEach(r => {
      if (r.creatorId === "current_user" || r.creatorId === currentUserObj.id) {
        if (name !== undefined) r.creatorName = name;
        if (avatar !== undefined) r.creatorAvatar = avatar;
      }
      r.comments.forEach(c => {
        if (c.username === "cg0220037" || c.username === (updatedUser?.username || "")) {
          if (username !== undefined) c.username = username;
          if (avatar !== undefined) c.avatar = avatar;
        }
      });
    });

    const returnedUser = {
      ...(updatedUser?.toObject ? updatedUser.toObject() : updatedUser),
      id: "current_user",
      originalId: currentUserObj.id,
      privacyPolicy: updatedUser?.privacyPolicy !== undefined ? updatedUser.privacyPolicy : (privacyPolicy || "")
    };

    res.json({ success: true, user: returnedUser });
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
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoUser = new MongoUser(newUser);
        await mongoUser.save();
        console.log(`💾 Registered new user @${newUser.username} in MongoDB Atlas!`);

        // Automatically set active session in-memory to this newly registered user
        activeOriginalUserId = newUser.id;
        console.log(`💾 Automatically set active session to @${newUser.username}`);
      } catch (err) {
        console.error("Failed to save registered user to MongoDB:", err);
      }
    }

    const returnedUser = {
      ...newUser,
      id: "current_user",
      originalId: newUser.id,
      isGuest: false
    };

    res.json({ success: true, user: returnedUser });
  });

  // Switch current active user (swaps details and saves to Mongo)
  app.post("/api/users/current/switch", async (req, res) => {
    try {
      const { targetUsername, password, isSessionRestore } = req.body;
      if (!targetUsername) {
        res.status(400).json({ error: "Target username is required" });
        return;
      }

      const cleanUsername = String(targetUsername).trim().toLowerCase().replace("@", "");

      let targetUser = null;
      if (mongoose.connection.readyState === 1) {
        targetUser = await MongoUser.findOne({
          $or: [
            { username: cleanUsername },
            { username: targetUsername },
            { username: { $regex: new RegExp(`^${cleanUsername}$`, "i") } },
            { email: cleanUsername },
            { email: String(targetUsername).trim().toLowerCase() },
            { id: targetUsername },
            { id: cleanUsername }
          ],
          id: { $ne: "current_user" }
        });
      }
      if (!targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Require password if the user has a password registered, unless it's a silent session restore from client localStorage
      const expectedPassword = targetUser.password || "";
      if (!isSessionRestore && expectedPassword && expectedPassword !== password) {
        res.status(401).json({ error: "La contraseña ingresada es incorrecta. Por favor verifícala." });
        return;
      }

      // Set the active session original user ID to targetUser's ID
      activeOriginalUserId = targetUser.id;

      // Construct current_user payload for the frontend
      const returnedUser = {
        id: "current_user",
        originalId: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        bio: targetUser.bio || "",
        avatar: targetUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        coverPhoto: targetUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        followers: targetUser.followers || 0,
        following: targetUser.following || 0,
        followingUserIds: targetUser.followingUserIds || [],
        savedReelIds: targetUser.savedReelIds || [],
        isGuest: false,
        password: targetUser.password || "",
        email: targetUser.email || "",
        privacyPolicy: targetUser.privacyPolicy || ""
      };

      console.log(`🔄 Switched session user to @${returnedUser.username} (original id: ${activeOriginalUserId})`);
      res.json({ success: true, user: returnedUser });
    } catch (routeErr: any) {
      console.error("❌ Exception caught in user/switch endpoint:", routeErr);
      res.status(500).json({ error: "Internal server error switching user profile", details: routeErr.message });
    }
  });

  // Logout active session on server
  app.post("/api/users/current/logout", async (req, res) => {
    try {
      activeOriginalUserId = "user_guest";
      console.log(`🔄 Session logged out on server. Reset activeOriginalUserId to user_guest`);
      res.json({ success: true, message: "Logged out successfully" });
    } catch (routeErr: any) {
      console.error("❌ Exception caught in user/logout endpoint:", routeErr);
      res.status(500).json({ error: "Internal server error on logout", details: routeErr.message });
    }
  });

  // Get all video reels
  app.get("/api/reels", async (req, res) => {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbUsers = await MongoUser.find();
        const userMap = new Map<string, any>();
        dbUsers.forEach((u: any) => {
          userMap.set(u.id, u);
        });

        const dbReels = await MongoReel.find();
        const seenReelIds = new Set<string>();
        const uniqueDbReels = dbReels.filter((r) => {
          if (!r.id || seenReelIds.has(r.id)) return false;
          seenReelIds.add(r.id);
          return true;
        });
        reels = uniqueDbReels.map(r => {
          const creatorUser = userMap.get(r.creatorId);
          return {
            id: r.id,
            videoUrl: r.videoUrl || "",
            thumbnailUrl: r.thumbnailUrl || "",
            description: r.description || "",
            creatorId: r.creatorId || "current_user",
            creatorName: creatorUser ? creatorUser.name : (r.creatorName || "Carlos Gómez"),
            creatorUsername: creatorUser ? creatorUser.username : (r.creatorUsername || undefined),
            creatorAvatar: creatorUser ? creatorUser.avatar : (r.creatorAvatar || ""),
            likes: r.likes || 0,
            likedBy: r.likedBy || [],
            comments: r.comments || [],
            shares: r.shares || 0,
            saves: r.saves || 0,
            views: r.views || 0,
            productId: r.productId || undefined,
            type: r.type || "video",
            images: r.images || [],
            hlsUrl: r.hlsUrl || (r.videoUrl ? `/api/hls/stream?url=${encodeURIComponent(r.videoUrl)}` : undefined)
          };
        });
      } catch (err) {
        console.error("❌ Failed to load live reels from MongoDB Atlas during GET:", err);
      }
    }
    const seen = new Set<string>();
    const uniqueReels = reels.filter((r) => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    res.json(uniqueReels);
  });

  // Like a reel (1 like per user - toggle behavior with user isolation)
  app.post("/api/reels/:id/like", async (req, res) => {
    const reel = reels.find((r) => r.id === req.params.id);
    if (!reel) {
      res.status(404).json({ error: "Reel not found" });
      return;
    }

    if (!reel.likedBy) {
      reel.likedBy = [];
    }

    const username = req.body?.username;
    let userId = req.body?.userId;

    if (!userId || userId === "current_user") {
      if (activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user") {
        userId = activeOriginalUserId;
      } else if (username && username !== "invitado") {
        userId = username;
      } else {
        userId = "current_user";
      }
    }

    // Set of possible identifiers for the current user
    const userIdentifiers = new Set<string>();
    if (userId && userId !== "current_user") userIdentifiers.add(userId);
    if (username && username !== "invitado") userIdentifiers.add(username);
    if (activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user") {
      userIdentifiers.add(activeOriginalUserId);
    }
    // Fallback if no specific user ID exists
    if (userIdentifiers.size === 0) {
      userIdentifiers.add(userId || "current_user");
    }

    // Check if user has already liked
    const alreadyLiked = reel.likedBy.some((id) => userIdentifiers.has(id));

    let isLiked = false;
    if (alreadyLiked) {
      // UNLIKE: Remove all user identifiers for this user
      reel.likedBy = reel.likedBy.filter((id) => !userIdentifiers.has(id));
      isLiked = false;
    } else {
      // LIKE: Add primary user identifier
      const primaryIdentifier =
        (activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user")
          ? activeOriginalUserId
          : (username && username !== "invitado" ? username : (userId || "current_user"));

      reel.likedBy.push(primaryIdentifier);
      isLiked = true;
    }

    reel.likes = reel.likedBy.length;

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.updateOne({ id: reel.id }, { $set: { likes: reel.likes, likedBy: reel.likedBy } });
      } catch (err) {
        console.error("❌ Failed to update likes in MongoDB:", err);
      }
    }

    // Broadcast metric update to all connected sockets
    broadcastToAll({
      type: "reel_updated",
      reelId: reel.id,
      likes: reel.likes,
      likedBy: reel.likedBy,
      commentsCount: reel.comments.length
    });

    res.json({ success: true, likes: reel.likes, likedBy: reel.likedBy, isLiked });
  });

  // Post a comment on a reel
  app.post("/api/reels/:id/comment", async (req, res) => {
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

    const headerUsername = (req.headers["x-user-username"] as string)?.trim();
    const resolvedUsername = username || headerUsername || "usuario";
    const resolvedAvatar =
      avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

    const newComment: Comment = {
      id: "c_" + generateId(),
      username: resolvedUsername,
      avatar: resolvedAvatar,
      text,
      createdAt: new Date().toISOString(),
    };

    reel.comments.push(newComment);

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.updateOne({ id: reel.id }, { $set: { comments: reel.comments } });
      } catch (err) {
        console.error("❌ Failed to update comments in MongoDB:", err);
      }
    }

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

  // Record a view on a reel
  app.post("/api/reels/:id/view", async (req, res) => {
    const reel = reels.find((r) => r.id === req.params.id);
    if (!reel) {
      res.status(404).json({ error: "Reel not found" });
      return;
    }
    reel.views = (reel.views || 0) + 1;

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.updateOne({ id: reel.id }, { $set: { views: reel.views } });
      } catch (err) {
        console.error("❌ Failed to update views in MongoDB:", err);
      }
    }

    res.json({ success: true, views: reel.views });
  });

  // Record a share on a reel
  app.post("/api/reels/:id/share", async (req, res) => {
    const reel = reels.find((r) => r.id === req.params.id);
    if (!reel) {
      res.status(404).json({ error: "Reel not found" });
      return;
    }
    reel.shares = (reel.shares || 0) + 1;

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.updateOne({ id: reel.id }, { $set: { shares: reel.shares } });
      } catch (err) {
        console.error("❌ Failed to update shares in MongoDB:", err);
      }
    }

    res.json({ success: true, shares: reel.shares });
  });

  // Delete Reel (removes from GCS and MongoDB)
  app.delete("/api/reels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const reelIndex = reels.findIndex((r) => r.id === id);
      const reel = reelIndex !== -1 ? reels[reelIndex] : null;

      const deleteReelFiles = async (r: any) => {
        if (!r) return;
        if (r.videoUrl) await deleteFromGCS(r.videoUrl);
        if (r.thumbnailUrl) await deleteFromGCS(r.thumbnailUrl);
        if (Array.isArray(r.images)) {
          for (const imgUrl of r.images) {
            await deleteFromGCS(imgUrl);
          }
        }
      };

      if (reel) {
        await deleteReelFiles(reel);
      } else if (mongoose.connection.readyState === 1) {
        const dbReel = await MongoReel.findOne({ id });
        if (dbReel) {
          await deleteReelFiles(dbReel);
        }
      }

      if (reelIndex !== -1) {
        reels.splice(reelIndex, 1);
      }

      if (mongoose.connection.readyState === 1) {
        await MongoReel.deleteOne({ id });
      }

      console.log(`🗑️ Reel eliminado exitosamente de MongoDB y GCS: ${id}`);
      res.json({ success: true, message: "Publicación eliminada de MongoDB y GCS" });
    } catch (error) {
      console.error("❌ Error al eliminar reel:", error);
      res.status(500).json({ success: false, error: "Error al eliminar publicación" });
    }
  });

  // CJ Dropshipping Freight Options API Route (Calculate shipping to any country)
  app.get("/api/cj/freight-options", async (req, res) => {
    try {
      const vidQuery = (req.query.vid as string || req.query.pid as string || req.query.sku as string || "").trim();
      const pidQuery = (req.query.pid as string || "").trim();
      const destCountry = (req.query.destCountry as string || "US").trim().toUpperCase();
      const startCountry = (req.query.startCountry as string || "CN").trim().toUpperCase();

      if (!vidQuery && !pidQuery) {
        res.status(400).json({ error: "Se requiere un ID de variante (vid), PID o SKU de CJ." });
        return;
      }

      let cjToken = process.env.CJ_ACCESS_TOKEN || "CJ3709637@api@1ecd84b9afb74c7d86227fe82c563898";

      // Helper to execute CJ freight API
      const callFreightApi = async (token: string, targetVid: string) => {
        try {
          // 1. Try freightCalculate
          const res1 = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
            method: "POST",
            headers: {
              "CJ-Access-Token": token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              startCountryCode: startCountry,
              endCountryCode: destCountry,
              products: [{ quantity: 1, vid: targetVid }]
            })
          });
          const data1 = await res1.json();
          if (data1.result && Array.isArray(data1.data) && data1.data.length > 0) {
            return data1.data;
          }

          // 2. Try freightCalculateTip with sku / vid
          const res2 = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculateTip", {
            method: "POST",
            headers: {
              "CJ-Access-Token": token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              reqDTOS: [{
                srcAreaCode: startCountry,
                destAreaCode: destCountry,
                weight: 200,
                volume: 100,
                productProp: ["COMMON"],
                freightTrialSkuList: [{ skuQuantity: 1, vid: targetVid, sku: targetVid }],
                skuList: [targetVid]
              }]
            })
          });
          const data2 = await res2.json();
          if (data2.result && Array.isArray(data2.data) && data2.data.length > 0) {
            return data2.data;
          }
        } catch (e) {
          console.warn("Freight API attempt error:", e);
        }

        return null;
      };

      // Helper to obtain fresh token if needed
      const getFreshToken = async () => {
        const possibleKeys = [
          cjToken,
          cjToken.includes("@api@") ? cjToken.split("@api@")[1] : cjToken,
          "1ecd84b9afb74c7d86227fe82c563898"
        ];
        for (const keyCandidate of possibleKeys) {
          try {
            const authRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: keyCandidate })
            });
            const authData = await authRes.json();
            if (authData.result && authData.data?.accessToken) {
              return authData.data.accessToken;
            }
          } catch (e) {}
        }
        return cjToken;
      };

      // 1. Try with the passed vidQuery
      let rawResults = await callFreightApi(cjToken, vidQuery);

      // 2. If no results, try getting fresh token
      if (!rawResults) {
        const freshToken = await getFreshToken();
        if (freshToken && freshToken !== cjToken) {
          cjToken = freshToken;
          rawResults = await callFreightApi(cjToken, vidQuery);
        }
      }

      // 3. If still no results, resolve real VID by querying CJ Product details for vidQuery or pidQuery
      const lookupId = vidQuery || pidQuery;
      if (!rawResults && lookupId) {
        try {
          const headers = { "CJ-Access-Token": cjToken };
          const prodRes = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(lookupId)}`, { headers });
          const prodData = await prodRes.json();

          if (prodData.result && prodData.data && Array.isArray(prodData.data.variants) && prodData.data.variants.length > 0) {
            const realVid = prodData.data.variants[0].vid || prodData.data.variants[0].variantSku;
            if (realVid) {
              rawResults = await callFreightApi(cjToken, realVid);
            }
          }
        } catch (err) {
          console.warn("CJ Product query lookup for vid failed:", err);
        }
      }

      if (rawResults && rawResults.length > 0) {
        const options = rawResults.map((opt: any) => {
          const carrier = opt.logisticName || opt.option?.enName || opt.channel?.enName || "CJPacket";
          const cost = typeof opt.logisticPrice === "number"
            ? opt.logisticPrice
            : parseFloat(opt.postage || opt.wrapPostage || opt.logisticPrice || "0");
          const aging = opt.logisticAging
            ? `${opt.logisticAging} días`
            : (opt.arrivalTime ? `${opt.arrivalTime} días` : "7-15 días");

          return {
            carrier,
            shippingCost: cost > 0 ? Number(cost.toFixed(2)) : 3.50,
            aging,
            startCountry: `Almacén China (${startCountry})`,
            destCountry
          };
        });

        // Sort by lowest price first
        options.sort((a: any, b: any) => a.shippingCost - b.shippingCost);

        console.log(`✈️ CJ Freight calculated for ${destCountry}: ${options.length} real options found (Cheapest: $${options[0].shippingCost})`);
        res.json({ success: true, options });
        return;
      }

      res.status(404).json({
        error: `No se encontraron tarifas de envío en CJ Dropshipping para el destino ${destCountry}.`,
        destCountry
      });

    } catch (err: any) {
      console.error("Error calculating CJ freight options:", err);
      res.status(500).json({ error: err.message || "Error al calcular flete de CJ" });
    }
  });

  // CJ Dropshipping Product Import API Proxy
  app.get("/api/cj/import-product", async (req, res) => {
    try {
      const { pid, sku, destCountry } = req.query;
      const searchId = ((pid || sku || "") as string).trim();
      const targetCountry = ((destCountry as string) || "US").trim().toUpperCase();

      if (!searchId) {
        res.status(400).json({ error: "Se requiere un ID de producto o SKU de CJ Dropshipping." });
        return;
      }

      let cjToken = process.env.CJ_ACCESS_TOKEN || "CJ3709637@api@1ecd84b9afb74c7d86227fe82c563898";

      // Function to attempt fetching product from CJ with a given token
      const attemptCjFetch = async (token: string) => {
        const headers = { "CJ-Access-Token": token };

        // 1. Query by pid
        let res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(searchId)}`, { headers });
        let data = await res.json();
        if (data.result && data.data) return data;

        // 2. Query by productSku
        res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?productSku=${encodeURIComponent(searchId)}`, { headers });
        data = await res.json();
        if (data.result && data.data) return data;

        // 3. Query by variantSku
        res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?variantSku=${encodeURIComponent(searchId)}`, { headers });
        data = await res.json();
        if (data.result && data.data) return data;

        // 4. List endpoint by pid/sku
        res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list?pid=${encodeURIComponent(searchId)}`, { headers });
        let listData = await res.json();
        if (listData.result && listData.data && listData.data.list && listData.data.list.length > 0) {
          const firstPid = listData.data.list[0].pid;
          if (firstPid) {
            res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(firstPid)}`, { headers });
            data = await res.json();
            if (data.result && data.data) return data;
          }
        }

        // 5. ListV2 search by keyword
        res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/listV2?keyWord=${encodeURIComponent(searchId)}&page=1&size=5`, { headers });
        let v2Data = await res.json();
        if (v2Data.result && v2Data.data && v2Data.data.content && v2Data.data.content.length > 0) {
          const contentItem = v2Data.data.content[0];
          const prodItem = contentItem.productList?.[0];
          if (prodItem && prodItem.id) {
            res = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(prodItem.id)}`, { headers });
            data = await res.json();
            if (data.result && data.data) return data;
          }
        }

        return data;
      };

      // Try initial call with token
      let cjData = await attemptCjFetch(cjToken);

      // If token rejected, try obtaining a fresh token using CJ authentication endpoint
      if (!cjData.result || cjData.code === 1600100 || (cjData.message && cjData.message.includes("token"))) {
        const possibleKeys = [
          cjToken,
          cjToken.includes("@api@") ? cjToken.split("@api@")[1] : cjToken,
          "1ecd84b9afb74c7d86227fe82c563898"
        ];

        for (const apiKeyCandidate of possibleKeys) {
          try {
            const authRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: apiKeyCandidate })
            });
            const authData = await authRes.json();
            if (authData.result && authData.data && authData.data.accessToken) {
              cjToken = authData.data.accessToken;
              cjData = await attemptCjFetch(cjToken);
              if (cjData.result && cjData.data) break;
            }
          } catch (e) {
            // continue
          }
        }
      }

      // If product was found from CJ
      if (cjData.result && cjData.data) {
        const prod = cjData.data;

        // Parse title/name
        let name = prod.productNameEn || prod.productName || "Producto CJ";
        if (typeof name === "string" && name.startsWith("[")) {
          try {
            const parsed = JSON.parse(name);
            if (Array.isArray(parsed) && parsed.length > 0) {
              name = parsed.filter(Boolean).pop() || parsed[0];
            }
          } catch (e) {}
        }

        // Parse description
        let description = (prod.description || "").replace(/<[^>]*>?/gm, "").trim();
        if (!description) description = name;

        // Collect exact CJ images
        const imagesSet: string[] = [];
        if (prod.bigImage) imagesSet.push(prod.bigImage);
        if (Array.isArray(prod.productImageSet)) {
          prod.productImageSet.forEach((img: string) => {
            if (img && !imagesSet.includes(img)) {
              imagesSet.push(img);
            }
          });
        }

        // Parse variants and extract variant images
        const rawVariants = prod.variants || [];
        const variantMap: Record<string, Set<string>> = {};
        const variantList: any[] = [];

        rawVariants.forEach((v: any) => {
          // Extract variant image if available
          const vImg = v.variantImage || v.variantImg || (Array.isArray(v.variantImageSet) ? v.variantImageSet[0] : (typeof v.variantImageSet === 'string' ? v.variantImageSet : "")) || "";

          if (vImg && typeof vImg === 'string' && !imagesSet.includes(vImg)) {
            imagesSet.push(vImg);
          }

          let colorName = "";
          let sizeName = "";

          if (v.variantKey) {
            const parts = v.variantKey.split("-");
            if (parts.length === 2) {
              colorName = parts[0].trim();
              sizeName = parts[1].trim();
              if (!variantMap["Color"]) variantMap["Color"] = new Set();
              if (!variantMap["Talla"]) variantMap["Talla"] = new Set();
              variantMap["Color"].add(colorName);
              variantMap["Talla"].add(sizeName);
            } else {
              colorName = v.variantKey.trim();
              if (!variantMap["Opción"]) variantMap["Opción"] = new Set();
              variantMap["Opción"].add(colorName);
            }
          } else if (v.variantNameEn) {
            colorName = v.variantNameEn.trim();
            if (!variantMap["Estilo"]) variantMap["Estilo"] = new Set();
            variantMap["Estilo"].add(colorName);
          }

          variantList.push({
            vid: v.vid || "",
            name: v.variantNameEn || v.variantKey || v.variantName || colorName || "Variante",
            color: colorName || undefined,
            size: sizeName || undefined,
            price: parseFloat(v.variantSellPrice || v.variantPrice || prod.sellPrice || 12.99),
            imageUrl: vImg || undefined,
            sku: v.variantSku || undefined
          });
        });

        const parsedVariants = Object.keys(variantMap).map((key) => ({
          name: key,
          options: Array.from(variantMap[key]),
        }));

        // Calculate Stock
        let totalStock = 50;
        if (rawVariants.length > 0) {
          const variantWithStock = rawVariants.find((v: any) => v.inventories && v.inventories.length > 0);
          if (variantWithStock) {
            totalStock = variantWithStock.inventories.reduce((sum: number, inv: any) => sum + (inv.totalInventory || 0), 0) || 50;
          }
        }

        // Category mapping
        let category = "Electrónica";
        const catName = (prod.categoryName || "").toLowerCase();
        if (catName.includes("women") || catName.includes("clothing") || catName.includes("ropa")) {
          category = "Ropa Femenina";
        } else if (catName.includes("men")) {
          category = "Ropa Masculina";
        } else if (catName.includes("home") || catName.includes("garden") || catName.includes("hogar")) {
          category = "Hogar";
        } else if (catName.includes("pet") || catName.includes("mascota")) {
          category = "Mascotas";
        } else if (catName.includes("jewelry") || catName.includes("joya")) {
          category = "Joyas";
        } else if (catName.includes("toy") || catName.includes("juguete")) {
          category = "Juguetes";
        } else if (catName.includes("sport") || catName.includes("deporte")) {
          category = "Deportes";
        } else if (catName.includes("shoe") || catName.includes("zapato")) {
          category = "Zapatos";
        } else if (catName.includes("bag") || catName.includes("bolso")) {
          category = "Bolsos";
        }

        // Calculate Freight / Logistics
        const firstVid = rawVariants[0]?.vid || prod.pid;
        let shippingOptions: any[] = [];

        try {
          const freightRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
            method: "POST",
            headers: {
              "CJ-Access-Token": cjToken,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              startCountryCode: "CN",
              endCountryCode: targetCountry,
              products: [{ quantity: 1, vid: firstVid }]
            })
          });
          const freightData = await freightRes.json();
          if (freightData.result && Array.isArray(freightData.data) && freightData.data.length > 0) {
            shippingOptions = freightData.data.map((opt: any) => ({
              carrier: opt.logisticName || opt.option?.enName || "CJPacket",
              shippingCost: typeof opt.logisticPrice === "number" ? opt.logisticPrice : parseFloat(opt.postage || opt.logisticPrice || "3.50"),
              aging: opt.logisticAging ? `${opt.logisticAging} días` : (opt.arrivalTime ? `${opt.arrivalTime} días` : "7-15 días"),
              startCountry: "Almacén China (CN)",
              destCountry: targetCountry
            }));
          }
        } catch (fErr) {
          console.warn("Logistics calculate fallback:", fErr);
        }

        if (shippingOptions.length === 0) {
          shippingOptions = [
            { carrier: "CJPacket Ordinary", shippingCost: 3.50, aging: "8-15 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
            { carrier: "CJPacket Sensitive", shippingCost: 4.20, aging: "7-12 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
            { carrier: "USPS+", shippingCost: 5.10, aging: "5-10 días", startCountry: "Almacén China (CN)", destCountry: targetCountry },
            { carrier: "DHL Express", shippingCost: 18.50, aging: "3-5 días", startCountry: "Almacén China (CN)", destCountry: targetCountry }
          ];
        }

        const primaryLogistics = {
          variantId: firstVid,
          destCountry: targetCountry,
          carrier: shippingOptions[0].carrier,
          shippingCost: shippingOptions[0].shippingCost,
          aging: shippingOptions[0].aging,
          startCountry: shippingOptions[0].startCountry,
          shippingOptions
        };

        return res.json({
          success: true,
          product: {
            cjProductId: prod.pid || searchId,
            cjVariantId: firstVid,
            name,
            description,
            price: parseFloat(prod.sellPrice || rawVariants[0]?.variantSellPrice || 12.99),
            stock: totalStock,
            category,
            images: imagesSet,
            variants: parsedVariants,
            variantList,
            logistics: primaryLogistics
          }
        });
      }

      // NO mock data fallback! Return real error from CJ
      const errorMsg = cjData.message || "No se encontró ningún producto en CJ Dropshipping con ese ID o SKU. Verifica el ID o que el token de la API de CJ sea válido.";
      return res.status(400).json({
        error: errorMsg
      });

    } catch (err: any) {
      console.error("❌ Error in /api/cj/import-product:", err);
      res.status(500).json({ error: err.message || "Error al importar datos de CJ Dropshipping" });
    }
  });

  // Get all e-commerce products
  app.get("/api/products", async (req, res) => {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbProducts = await MongoProduct.find();
        const seenProdIds = new Set<string>();
        const uniqueDbProducts = dbProducts.filter((p) => {
          if (!p.id || seenProdIds.has(p.id)) return false;
          seenProdIds.add(p.id);
          return true;
        });
        products = uniqueDbProducts.map(p => ({
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
          variantList: p.variantList || [],
          category: p.category || "",
          cjVid: p.cjVid || undefined,
          cjPid: p.cjPid || undefined,
          views: p.views || 0
        }));
      } catch (err) {
        console.error("❌ Failed to load live products from MongoDB Atlas during GET:", err);
      }
    }
    const seen = new Set<string>();
    const uniqueProducts = products.filter((p) => {
      if (!p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    res.json(uniqueProducts);
  });

  // Get product by ID
  app.get("/api/products/:id", async (req, res) => {
    if (mongoose.connection.readyState === 1) {
      try {
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
          variantList: p.variantList || [],
          category: p.category || "",
          cjVid: p.cjVid || undefined,
          cjPid: p.cjPid || undefined,
          views: p.views || 0
        }));
      } catch (err) {
        console.error("❌ Failed to sync products on ID fetch:", err);
      }
    }
    const product = products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  });

  // Record a view on a product detail page
  app.post("/api/products/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      const product = products.find((p) => p.id === id);
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      product.views = (product.views || 0) + 1;

      if (mongoose.connection.readyState === 1) {
        try {
          await MongoProduct.updateOne({ id }, { $inc: { views: 1 } });
        } catch (dbErr) {
          console.error("❌ Failed to update product views in MongoDB:", dbErr);
        }
      }

      broadcastToAll({
        type: "product_viewed",
        productId: id,
        views: product.views,
      });

      res.json({ success: true, views: product.views });
    } catch (err: any) {
      console.error("Error recording product view:", err);
      res.status(500).json({ error: "Failed to record view", details: err.message });
    }
  });

  // Helper to resolve the authenticated user for publications and products
  const resolveAuthenticatedUser = async (req: any, fallbackRole = "creator"): Promise<any> => {
    const body = req.body || {};
    const headerUserId = req.headers["x-user-id"];
    const headerUsername = req.headers["x-user-username"];

    const idCandidates: string[] = [
      body.creatorOriginalId,
      body.sellerOriginalId,
      body.originalId,
      body.sellerId !== "current_user" ? body.sellerId : undefined,
      body.creatorId !== "current_user" ? body.creatorId : undefined,
      headerUserId !== "current_user" ? headerUserId : undefined,
      activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user" ? activeOriginalUserId : undefined,
    ].filter((id): id is string => Boolean(id && id !== "user_guest" && id !== "current_user" && id !== "invitado"));

    const usernameCandidates: string[] = [
      body.creatorUsername,
      body.sellerUsername,
      body.username,
      typeof headerUsername === "string" ? headerUsername : undefined,
    ].filter((un): un is string => Boolean(un && un !== "invitado" && un !== "guest" && un !== "current_user"));

    let resolvedUser: any = null;

    // 1. Search in MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      const orClauses: any[] = [];
      if (idCandidates.length > 0) {
        orClauses.push({ id: { $in: idCandidates } });
        orClauses.push({ originalId: { $in: idCandidates } });
      }
      if (usernameCandidates.length > 0) {
        orClauses.push({ username: { $in: usernameCandidates.map(u => u.toLowerCase()) } });
      }
      if (orClauses.length > 0) {
        try {
          resolvedUser = await MongoUser.findOne({ $or: orClauses });
        } catch (err) {
          console.error("Error finding user in MongoDB:", err);
        }
      }
    }

    // 2. Search in MongoDB/getUsers fallback
    if (!resolvedUser) {
      try {
        const currentUsers = await getUsers();
        resolvedUser = currentUsers.find(u =>
          idCandidates.includes(u.id) ||
          (u.originalId && idCandidates.includes(u.originalId)) ||
          (u.username && usernameCandidates.some(un => un.toLowerCase() === u.username.toLowerCase()))
        );
      } catch (e) {}
    }

    // 3. Fallback: If client supplied authenticated user profile
    if (!resolvedUser && usernameCandidates.length > 0) {
      const preferredUsername = usernameCandidates[0].toLowerCase();
      const preferredId = idCandidates[0] || ("user_" + generateId());
      const fallbackName = body.creatorName || body.sellerName || body.name || preferredUsername;
      const fallbackAvatar = body.creatorAvatar || body.sellerAvatar || body.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

      resolvedUser = {
        id: preferredId,
        originalId: preferredId,
        username: preferredUsername,
        name: fallbackName,
        avatar: fallbackAvatar,
        bio: `${fallbackRole === "seller" ? "Vendedor" : "Creador"} en la plataforma`,
        isOnline: true,
        followers: 0,
        following: 0,
        followingUserIds: [],
        savedReelIds: [],
        coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isGuest: false,
        email: body.email || "",
        password: ""
      };

      if (mongoose.connection.readyState === 1) {
        try {
          const newDoc = new MongoUser(resolvedUser);
          await newDoc.save();
        } catch (e) {}
      }
    }

    // 4. Update session pointer activeOriginalUserId
    if (resolvedUser && resolvedUser.id && resolvedUser.id !== "user_guest" && resolvedUser.id !== "current_user") {
      activeOriginalUserId = resolvedUser.id;
    }

    return resolvedUser;
  };

  // Create a new publication (video, image, or carousel)
  app.post("/api/reels", async (req: any, res: any) => {
    try {
      const { videoUrl, thumbnailUrl, description, creatorId, type, images, productId, hlsUrl } = req.body;
      
      const creator = await resolveAuthenticatedUser(req, "creator");

      if (!creator || creator.isGuest || creator.username === "invitado" || creator.username === "guest") {
        res.status(403).json({ error: "Debes iniciar sesión con una cuenta para poder realizar publicaciones." });
        return;
      }

      const resolvedHlsUrl = hlsUrl || (videoUrl ? `/api/hls/stream?url=${encodeURIComponent(videoUrl)}` : undefined);

      const newReel: Reel = {
        id: "reel_" + generateId(),
        videoUrl: videoUrl || "",
        thumbnailUrl: (thumbnailUrl && !thumbnailUrl.includes("1618005182384")) ? thumbnailUrl : "",
        description: description || "",
        creatorId: creator.id,
        creatorName: creator.name || creator.username,
        creatorUsername: creator.username,
        creatorAvatar: creator.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        likes: 0,
        likedBy: [],
        comments: [],
        shares: 0,
        views: 0,
        productId: productId || undefined,
        type: type || "video",
        images: images || [],
        hlsUrl: resolvedHlsUrl
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
      res.status(500).json({ error: "Error al crear la publicación", details: err.message });
    }
  });

  // Create a new product for sale
  app.post("/api/products", async (req: any, res: any) => {
    try {
      const { name, description, price, imageUrl, stock, sellerId, shippingCost, images, videos, variants, variantList, category, cjVid, cjPid } = req.body;
      
      const seller = await resolveAuthenticatedUser(req, "seller");

      if (!seller || seller.isGuest || seller.username === "invitado" || seller.username === "guest") {
        res.status(403).json({ error: "Debes iniciar sesión con una cuenta para poder registrar productos para la venta." });
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
        variantList: variantList || [],
        category: category || "",
        cjVid: cjVid || undefined,
        cjPid: cjPid || undefined,
        views: 0
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
        creatorUsername: seller.username,
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

  // Update an existing product (fields: name, description, price, imageUrl, stock, shippingCost, category, images, variants)
  app.all(["/api/products/:id/update", "/api/products/:id"], async (req: any, res: any, next: any) => {
    // Only handle PUT and POST methods for updating
    if (req.method !== "PUT" && req.method !== "POST") {
      return next();
    }

    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "El ID del producto es obligatorio" });
        return;
      }

      const {
        name,
        description,
        price,
        imageUrl,
        stock,
        shippingCost,
        images,
        videos,
        variants,
        variantList,
        category,
      } = req.body;

      const updateFields: any = {};
      if (name !== undefined) updateFields.name = String(name).trim();
      if (description !== undefined) updateFields.description = String(description).trim();
      if (price !== undefined) updateFields.price = Math.max(0, Number(price) || 0);
      if (imageUrl !== undefined) updateFields.imageUrl = String(imageUrl).trim();
      if (stock !== undefined) updateFields.stock = Math.max(0, parseInt(String(stock), 10) || 0);
      if (shippingCost !== undefined) updateFields.shippingCost = Math.max(0, Number(shippingCost) || 0);
      if (category !== undefined) updateFields.category = String(category).trim();
      if (images !== undefined) updateFields.images = Array.isArray(images) ? images : [];
      if (videos !== undefined) updateFields.videos = Array.isArray(videos) ? videos : [];
      if (variants !== undefined) updateFields.variants = variants;
      if (variantList !== undefined) updateFields.variantList = variantList;

      // Update in memory
      let updatedProduct: any = null;
      const index = products.findIndex((p) => p.id === id);
      if (index !== -1) {
        products[index] = {
          ...products[index],
          ...updateFields,
        };
        updatedProduct = products[index];
      }

      // Update in MongoDB Atlas
      if (mongoose.connection.readyState === 1) {
        try {
          const dbProd = await MongoProduct.findOneAndUpdate(
            { id },
            { $set: updateFields },
            { new: true }
          );
          if (dbProd) {
            const parsedDbProd = dbProd.toObject ? dbProd.toObject() : dbProd;
            updatedProduct = parsedDbProd;
            if (index !== -1) {
              products[index] = parsedDbProd;
            } else {
              products.unshift(parsedDbProd);
            }
          }
          console.log(`💾 Product ${id} updated in MongoDB Atlas`);
        } catch (dbErr) {
          console.error("❌ Failed to update product in MongoDB Atlas:", dbErr);
        }
      }

      if (!updatedProduct) {
        res.status(404).json({ error: "Producto no encontrado en el sistema" });
        return;
      }

      // If imageUrl or name changed, update companion reel in memory and database
      if (imageUrl || name) {
        reels.forEach((r) => {
          if (r.productId === id) {
            if (imageUrl) r.thumbnailUrl = imageUrl;
            if (images && images.length > 0) r.images = images;
          }
        });
        if (mongoose.connection.readyState === 1) {
          const reelUpdates: any = {};
          if (imageUrl) reelUpdates.thumbnailUrl = imageUrl;
          if (images && images.length > 0) reelUpdates.images = images;
          await MongoReel.updateMany({ productId: id }, { $set: reelUpdates }).catch(() => null);
        }
      }

      // Broadcast update across all connected clients in real-time
      broadcastToAll({
        type: "product_updated",
        product: updatedProduct,
      });

      res.json({ success: true, product: updatedProduct });
    } catch (err: any) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: "Error al actualizar el producto", details: err.message });
    }
  });

  // Delete an existing product
  app.all(["/api/products/:id/delete", "/api/products/:id"], async (req: any, res: any, next: any) => {
    // Only handle DELETE and POST methods for deletion
    if (req.method !== "DELETE" && req.method !== "POST") {
      return next();
    }

    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "El ID del producto es obligatorio" });
        return;
      }

      console.log(`🗑️ Deleting product ${id}...`);

      // Remove from memory
      products = products.filter((p) => p.id !== id);

      // Remove from MongoDB Atlas
      if (mongoose.connection.readyState === 1) {
        try {
          await MongoProduct.deleteOne({ id });
          // Also optionally remove companion reels or unlink
          await MongoReel.deleteMany({ productId: id }).catch(() => null);
          console.log(`💾 Product ${id} and companion reels deleted from MongoDB Atlas`);
        } catch (dbErr) {
          console.error("❌ Failed to delete product from MongoDB Atlas:", dbErr);
        }
      }

      // Also remove companion reels from memory
      reels = reels.filter((r) => r.productId !== id);

      // Broadcast deletion across all connected clients in real-time
      broadcastToAll({
        type: "product_deleted",
        productId: id,
      });

      res.json({ success: true, message: "Producto eliminado exitosamente" });
    } catch (err: any) {
      console.error("Error deleting product:", err);
      res.status(500).json({ error: "Error al eliminar el producto", details: err.message });
    }
  });

  // Get cart for a specific user or client
  app.get("/api/cart/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: "UserId is required" });
      return;
    }

    let items: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        const cartDoc = await MongoCart.findOne({ userId });
        if (cartDoc && Array.isArray(cartDoc.items)) {
          items = cartDoc.items;
          cartMemoryStore.set(userId, items);
        } else {
          items = cartMemoryStore.get(userId) || [];
        }
      } catch (err) {
        console.error("❌ Failed to load cart from MongoDB Atlas:", err);
        items = cartMemoryStore.get(userId) || [];
      }
    } else {
      items = cartMemoryStore.get(userId) || [];
    }

    res.json({ userId, items });
  });

  // Save/update cart items for a specific user or client
  app.post("/api/cart/:userId", async (req, res) => {
    const { userId } = req.params;
    const { items } = req.body;
    if (!userId) {
      res.status(400).json({ error: "UserId is required" });
      return;
    }

    const sanitizedItems = Array.isArray(items) ? items : [];
    cartMemoryStore.set(userId, sanitizedItems);

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoCart.findOneAndUpdate(
          { userId },
          { items: sanitizedItems, updatedAt: new Date() },
          { upsert: true, new: true }
        );
        console.log(`💾 Cart synced to MongoDB Atlas for user ${userId} (${sanitizedItems.length} items)`);
      } catch (err) {
        console.error("❌ Failed to save cart to MongoDB Atlas:", err);
      }
    }

    res.json({ success: true, userId, items: sanitizedItems });
  });

  // Delete/clear cart for a specific user or client
  app.delete("/api/cart/:userId", async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: "UserId is required" });
      return;
    }

    cartMemoryStore.set(userId, []);

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoCart.findOneAndUpdate(
          { userId },
          { items: [], updatedAt: new Date() },
          { upsert: true }
        );
        console.log(`💾 Cart cleared in MongoDB Atlas for user ${userId}`);
      } catch (err) {
        console.error("❌ Failed to clear cart in MongoDB Atlas:", err);
      }
    }

    res.json({ success: true, userId, items: [] });
  });

  // Create purchase order (checkout)
  app.post("/api/orders", async (req, res) => {
    const { items, shippingAddress, shippingCost, userId, buyerName, buyerUsername, buyerAvatar, buyerEmail } = req.body;
    if (!items || !items.length) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    let total = 0;
    const orderItems: any[] = [];
    const dbUsers = await getUsers();
    const userMap = new Map<string, any>();
    dbUsers.forEach((u: any) => userMap.set(u.id, u));

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

      const sellerUser = userMap.get(product.sellerId);
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl,
        sellerId: product.sellerId || "current_user",
        sellerName: sellerUser ? sellerUser.name : (product.sellerName || "Vendedor"),
        sellerUsername: sellerUser ? sellerUser.username : undefined,
        carrier: item.selectedCarrier || product.selectedCarrier || "DHL Express",
      });
    }

    total += Number(shippingCost) || 0;

    const assignedCarrier = orderItems[0]?.carrier || "";
    const nowIso = new Date().toISOString();
    const estimatedDate = new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0];

    const buyerUser = userMap.get(userId || activeOriginalUserId);

    let assignedBuyerId = userId || (activeOriginalUserId !== "user_guest" ? activeOriginalUserId : "current_user");
    let assignedBuyerName = buyerName || (buyerUser ? buyerUser.name : "Cliente");
    let assignedBuyerUsername = buyerUsername || (buyerUser ? buyerUser.username : undefined);
    let assignedBuyerAvatar = buyerAvatar || (buyerUser ? buyerUser.avatar : undefined);
    let assignedBuyerEmail = buyerEmail || (buyerUser ? buyerUser.email : undefined);

    let autoCreatedUserSummary: any = null;

    // Check if buyer is guest/unregistered and captured an email
    const cleanBuyerEmail = buyerEmail ? String(buyerEmail).trim().toLowerCase() : "";
    if (cleanBuyerEmail && cleanBuyerEmail.includes("@")) {
      let existingUser = null;
      if (mongoose.connection.readyState === 1) {
        existingUser = await MongoUser.findOne({
          $or: [
            { email: cleanBuyerEmail },
            { email: { $regex: new RegExp(`^${cleanBuyerEmail}$`, "i") } }
          ],
          id: { $ne: "current_user" }
        });
      }

      if (existingUser) {
        assignedBuyerId = existingUser.id;
        assignedBuyerUsername = existingUser.username;
        assignedBuyerName = existingUser.name || buyerName || "Cliente";
        assignedBuyerEmail = existingUser.email || cleanBuyerEmail;
        assignedBuyerAvatar = existingUser.avatar || assignedBuyerAvatar;
      } else {
        // Automatically create account for guest buyer with password "123"
        const emailPrefix = cleanBuyerEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || "cliente";
        let chosenUsername = emailPrefix;
        let suffix = 1;

        if (mongoose.connection.readyState === 1) {
          while (await MongoUser.findOne({ username: chosenUsername, id: { $ne: "current_user" } })) {
            chosenUsername = `${emailPrefix}${suffix}`;
            suffix++;
          }
        }

        const newUserId = "user_" + generateId();
        const createdUserDoc = {
          id: newUserId,
          originalId: newUserId,
          username: chosenUsername,
          name: (buyerName && buyerName.trim() && buyerName.trim().toLowerCase() !== "invitado") ? buyerName.trim() : chosenUsername,
          email: cleanBuyerEmail,
          password: "123", // Password 123 as requested by user
          bio: "Cliente en la plataforma",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          isOnline: true,
          followers: 0,
          following: 0,
          followingUserIds: [],
          savedReelIds: [],
          isGuest: false,
          privacyPolicy: ""
        };

        if (mongoose.connection.readyState === 1) {
          try {
            const mongoUserDoc = new MongoUser(createdUserDoc);
            await mongoUserDoc.save();
            console.log(`👤 Automatically created profile for guest buyer: @${chosenUsername} (${cleanBuyerEmail}) with password "123"`);
          } catch (createErr) {
            console.error("Error creating auto-user in Mongo:", createErr);
          }
        }

        // Simulate sending email to customer
        console.log(`📧 [Servicio de Correo] Mensaje enviado a: ${cleanBuyerEmail}`);
        console.log(`   Asunto: Tu cuenta ha sido creada en la tienda - Acceso y contraseña`);
        console.log(`   Detalle: Bienvenido @${chosenUsername}. Tu contraseña provisional es: 123`);
        console.log(`   Inicia sesión y actualiza tu contraseña por una más segura en tu perfil.`);

        assignedBuyerId = newUserId;
        assignedBuyerUsername = chosenUsername;
        assignedBuyerName = createdUserDoc.name;
        assignedBuyerEmail = cleanBuyerEmail;

        autoCreatedUserSummary = {
          created: true,
          email: cleanBuyerEmail,
          username: chosenUsername,
          name: createdUserDoc.name,
          tempPassword: "123",
          user: {
            ...createdUserDoc,
            id: "current_user",
            originalId: newUserId
          },
          message: "Hemos creado tu perfil en la app con tu correo y contraseña provisional 123. Te enviamos los datos a tu correo. Te recomendamos iniciar sesión para consultar tus pedidos y actualizar tu contraseña por una más segura en tu perfil."
        };
      }
    }

    const newOrder: Order = {
      id: "ord_" + generateId(),
      buyerId: assignedBuyerId,
      buyerName: assignedBuyerName,
      buyerUsername: assignedBuyerUsername,
      buyerAvatar: assignedBuyerAvatar,
      buyerEmail: assignedBuyerEmail,
      items: orderItems,
      total: Math.round((total + Number.EPSILON) * 100) / 100,
      shippingCost: Number(shippingCost) || 0,
      shippingAddress: shippingAddress || "Dirección de Entrega Principal",
      paymentStatus: "paid",
      status: "processing",
      trackingNumber: "",
      carrier: assignedCarrier,
      trackingUrl: "",
      estimatedDelivery: estimatedDate,
      sellerNotes: "Pedido recibido. El vendedor preparará el paquete y registrará el número de guía de paquetería.",
      autoCreatedUser: autoCreatedUserSummary,
      statusHistory: [
        {
          status: "pending",
          label: "Pago aprobado y orden confirmada",
          timestamp: nowIso,
          note: "Transacción aprobada de manera segura.",
        },
        {
          status: "processing",
          label: "En preparación por el vendedor",
          timestamp: nowIso,
          note: assignedCarrier ? `Preparando despacho con paquetería ${assignedCarrier}.` : "El vendedor está preparando el empaque de los artículos.",
          carrier: assignedCarrier,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    orders.unshift(newOrder);

    // Save to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoOrder = new MongoOrder(newOrder);
        await mongoOrder.save();
        console.log(`💾 Saved order ${newOrder.id} to MongoDB Atlas`);
      } catch (dbErr) {
        console.error("❌ Failed to save order to MongoDB Atlas:", dbErr);
      }
    }

    // If userId provided, clear the cart in memory and DB
    if (userId) {
      cartMemoryStore.set(userId, []);
      if (mongoose.connection.readyState === 1) {
        try {
          await MongoCart.findOneAndUpdate({ userId }, { items: [], updatedAt: new Date() });
        } catch (err) {
          console.error("Failed to clear cart on order:", err);
        }
      }
    }

    // Broadcast stock updates
    broadcastToAll({
      type: "stock_updated",
      products: products.map((p) => ({ id: p.id, stock: p.stock }))
    });

    // Broadcast new order event for real-time buyer and seller sync
    broadcastToAll({
      type: "order_created",
      order: newOrder,
    });

    res.json(newOrder);
  });

  // Fetch orders with optional query parameters
  app.get("/api/orders", (req, res) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== "string") {
      res.json(orders);
      return;
    }

    const cleanId = userId.toLowerCase();
    const purchases = orders.filter(
      (o) =>
        o.buyerId === userId ||
        (o.buyerId && o.buyerId.toLowerCase() === cleanId) ||
        (o.buyerUsername && o.buyerUsername.toLowerCase() === cleanId) ||
        (userId === "current_user" && (o.buyerId === activeOriginalUserId || o.buyerId === "current_user" || !o.buyerId))
    );

    const sales = orders.filter((o) =>
      o.items.some(
        (it) =>
          it.sellerId === userId ||
          (it.sellerId && it.sellerId.toLowerCase() === cleanId) ||
          (it.sellerUsername && it.sellerUsername.toLowerCase() === cleanId) ||
          (userId === "current_user" && (it.sellerId === activeOriginalUserId || it.sellerId === "current_user" || !it.sellerId))
      )
    );

    res.json({ orders, purchases, sales });
  });

  // Update tracking number, carrier, and order fulfillment status (Mis Ventas / Gestión de Envíos)
  app.post("/api/orders/:id/update-tracking", async (req, res) => {
    const { id } = req.params;
    const { trackingNumber, carrier, status, trackingUrl, estimatedDelivery, sellerNotes } = req.body;

    const orderIndex = orders.findIndex((o) => o.id === id);
    if (orderIndex === -1) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }

    const currentOrder = orders[orderIndex];
    const nowIso = new Date().toISOString();

    const newStatus = status || currentOrder.status || "processing";
    const newTracking = (trackingNumber !== undefined ? trackingNumber : currentOrder.trackingNumber || "").trim();
    const newCarrier = (carrier !== undefined ? carrier : currentOrder.carrier || "").trim();
    const newTrackingUrl = (trackingUrl !== undefined ? trackingUrl : currentOrder.trackingUrl || "").trim();
    const newEstimated = (estimatedDelivery !== undefined ? estimatedDelivery : currentOrder.estimatedDelivery || "").trim();
    const newNotes = (sellerNotes !== undefined ? sellerNotes : currentOrder.sellerNotes || "").trim();

    // Determine label for history based on status
    let historyLabel = `Actualización de estado a ${newStatus}`;
    if (newStatus === "processing") {
      historyLabel = "En preparación por el vendedor";
    } else if (newStatus === "shipped") {
      historyLabel = `Despachado y en camino (${newCarrier || "Paquetería"})`;
    } else if (newStatus === "delivered") {
      historyLabel = "Pedido entregado con éxito al destinatario";
    } else if (newStatus === "cancelled") {
      historyLabel = "Pedido cancelado";
    }

    const historyEntry = {
      status: newStatus as any,
      label: historyLabel,
      timestamp: nowIso,
      note: newNotes || (newTracking ? `Guía de rastreo: ${newTracking}` : "Actualización realizada por el vendedor"),
      trackingNumber: newTracking,
      carrier: newCarrier,
    };

    const updatedHistory = [...(currentOrder.statusHistory || []), historyEntry];

    const updatedOrder: Order = {
      ...currentOrder,
      status: newStatus as any,
      trackingNumber: newTracking,
      carrier: newCarrier,
      trackingUrl: newTrackingUrl,
      estimatedDelivery: newEstimated,
      sellerNotes: newNotes,
      statusHistory: updatedHistory,
      updatedAt: nowIso,
    };

    orders[orderIndex] = updatedOrder;

    // Update in MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoOrder.findOneAndUpdate(
          { id },
          {
            $set: {
              status: newStatus,
              trackingNumber: newTracking,
              carrier: newCarrier,
              trackingUrl: newTrackingUrl,
              estimatedDelivery: newEstimated,
              sellerNotes: newNotes,
              statusHistory: updatedHistory,
              updatedAt: nowIso,
            },
          },
          { new: true, upsert: true }
        );
        console.log(`💾 Order ${id} tracking updated in MongoDB Atlas (Tracking: ${newTracking}, Status: ${newStatus})`);
      } catch (dbErr) {
        console.error("❌ Failed to update order tracking in MongoDB Atlas:", dbErr);
      }
    }

    // Broadcast update via WebSocket to keep both buyer and seller synchronized in real time
    broadcastToAll({
      type: "order_updated",
      order: updatedOrder,
    });

    res.json({ success: true, order: updatedOrder });
  });

  // Get historical chats with a partner
  app.get("/api/chats/:partnerId", (req, res) => {
    if (activeOriginalUserId === "user_guest") {
      res.status(403).json({ error: "Debes registrarte o iniciar sesión para ver tus chats." });
      return;
    }
    const partnerId = req.params.partnerId;

    const messages = chatMessages.filter((m) => {
      const isFromMe = m.senderId === "current_user" || m.senderId === activeOriginalUserId;
      const isToMe = m.receiverId === "current_user" || m.receiverId === activeOriginalUserId;

      const isFromPartner = m.senderId === partnerId;
      const isToPartner = m.receiverId === partnerId;

      return (isFromMe && isToPartner) || (isFromPartner && isToMe);
    });

    res.json(messages);
  });

  // Get live streams
  app.get("/api/live", (req, res) => {
    res.json(liveSessions);
  });

  // Create a live stream session (Go Live)
  app.post("/api/live", async (req, res) => {
    const { title, creatorId } = req.body;
    
    let lookupId = creatorId;
    if (!lookupId || lookupId === "current_user") {
      lookupId = activeOriginalUserId;
    }
    
    let creator = null;
    if (mongoose.connection.readyState === 1 && lookupId && lookupId !== "user_guest") {
      creator = await MongoUser.findOne({ id: lookupId });
    }

    if (!creator) {
      res.status(403).json({ error: "Un usuario no registrado no puede iniciar transmisiones en vivo." });
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

            const userIdToUpdate = clientUserId === "current_user" ? activeOriginalUserId : clientUserId;

            // Update user online status
            if (mongoose.connection.readyState === 1 && userIdToUpdate !== "user_guest") {
              MongoUser.findOneAndUpdate({ id: userIdToUpdate }, { isOnline: true })
                .then(() => broadcastPresence())
                .catch((err: any) => console.error("Error setting user online in WS:", err));
            } else {
              broadcastPresence();
            }
            break;
          }

          case "private_msg": {
            if (activeOriginalUserId === "user_guest") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Un usuario no registrado no puede enviar mensajes."
              }));
              break;
            }
            const { senderId, receiverId, text } = payload;
            if (!senderId || !receiverId || !text) return;

            const actualSenderId = (senderId === "current_user" && activeOriginalUserId !== "user_guest") ? activeOriginalUserId : senderId;

            const newMsg: ChatMessage = {
              id: "m_" + generateId(),
              senderId: actualSenderId,
              receiverId,
              text,
              timestamp: new Date().toISOString()
            };

            chatMessages.push(newMsg);

            // Send to recipient if connected (check receiverId directly or current_user)
            let sentToRec = false;
            const recSocket = activeClients.get(receiverId);
            if (recSocket && recSocket.readyState === WebSocket.OPEN) {
              recSocket.send(JSON.stringify({
                type: "private_msg",
                message: newMsg
              }));
              sentToRec = true;
            }

            if (!sentToRec && receiverId === activeOriginalUserId) {
              const currentClient = activeClients.get("current_user");
              if (currentClient && currentClient.readyState === WebSocket.OPEN) {
                currentClient.send(JSON.stringify({
                  type: "private_msg",
                  message: newMsg
                }));
              }
            }

            // Acknowledge back to sender
            ws.send(JSON.stringify({
              type: "private_msg_sent",
              message: newMsg
            }));
            break;
          }

          case "live_join": {
            const { streamId, username, isHost } = payload;
            
            if (currentStreamId && currentStreamId !== streamId) {
              handleStreamLeave(ws, currentStreamId);
            }
            currentStreamId = streamId;

            const session = liveSessions.find((s) => s.id === streamId);
            if (session) {
              if (!streamViewersMap.has(streamId)) {
                streamViewersMap.set(streamId, new Set());
              }
              const viewerSet = streamViewersMap.get(streamId)!;
              const isNewViewer = !viewerSet.has(ws);

              if (isHost || clientUserId === session.creatorId) {
                (ws as any).isHostStream = streamId;
              } else {
                (ws as any).isHostStream = false;
              }

              viewerSet.add(ws);
              updateAndBroadcastViewers(streamId);

              // Send system welcome message if new non-host viewer joined
              if (isNewViewer && !(ws as any).isHostStream) {
                const systemMsg = {
                  id: "lc_" + generateId(),
                  username: "System 🤖",
                  avatar: "",
                  text: `👋 ${username || "Un espectador"} se unió a la transmisión.`,
                  createdAt: new Date().toISOString()
                };

                session.chatMessages.push(systemMsg);
                
                broadcastToStream(streamId, {
                  type: "live_chat_msg",
                  streamId,
                  msg: systemMsg
                });
              }
            }
            break;
          }

          case "live_msg": {
            if (activeOriginalUserId === "user_guest") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Un usuario no registrado no puede enviar mensajes de chat en vivo."
              }));
              break;
            }
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
        const userIdToUpdate = clientUserId === "current_user" ? activeOriginalUserId : clientUserId;
        if (mongoose.connection.readyState === 1 && userIdToUpdate !== "user_guest") {
          MongoUser.findOneAndUpdate({ id: userIdToUpdate }, { isOnline: false })
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

  // Helper: Update & broadcast real viewer count
  function updateAndBroadcastViewers(streamId: string) {
    const session = liveSessions.find((s) => s.id === streamId);
    const viewerSet = streamViewersMap.get(streamId);
    
    if (!session) return;

    if (!viewerSet) {
      session.viewersCount = 0;
      broadcastToStream(streamId, {
        type: "live_viewers",
        streamId,
        count: 0
      });
      return;
    }

    // Filter out closed sockets and count audience sockets (non-hosts)
    let audienceCount = 0;
    viewerSet.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        if ((socket as any).isHostStream !== streamId) {
          audienceCount++;
        }
      } else {
        viewerSet.delete(socket);
      }
    });

    session.viewersCount = audienceCount;
    broadcastToStream(streamId, {
      type: "live_viewers",
      streamId,
      count: session.viewersCount
    });
  }

  // Helper: Handle client leaving live stream
  function handleStreamLeave(socket: WebSocket, streamId: string) {
    const viewerSet = streamViewersMap.get(streamId);
    if (viewerSet) {
      viewerSet.delete(socket);
      updateAndBroadcastViewers(streamId);
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

  // Serve PWA manifest file directly
  app.get(["/manifest.json", "/manifest (1).json"], (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    const manifestPath = fs.existsSync(path.join(process.cwd(), "manifest.json"))
      ? path.join(process.cwd(), "manifest.json")
      : path.join(process.cwd(), "public", "manifest.json");
    res.sendFile(manifestPath);
  });

  // Serve app icon assets directly
  app.get(["/app-icon.jpg", "/icon-512.jpg", "/icon-192.jpg"], (req, res) => {
    const iconPath = path.join(process.cwd(), "public", "app-icon.jpg");
    if (fs.existsSync(iconPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(iconPath);
    } else {
      res.status(404).send("Icon not found");
    }
  });

  app.get("/favicon.svg", (req, res) => {
    const svgPath = path.join(process.cwd(), "public", "favicon.svg");
    if (fs.existsSync(svgPath)) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(svgPath);
    } else {
      res.status(404).send("Favicon not found");
    }
  });

  // API 404 handler: Always return JSON, never HTML, for unknown /api routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.path}`, code: "API_ROUTE_NOT_FOUND" });
  });

  // Global API error handler: Catch any unhandled errors in /api routes and return JSON
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API error intercepted:", err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
    res.status(status).json({
      error: err.message || "Error interno del servidor",
      code: err.code || "INTERNAL_ERROR"
    });
  });

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
