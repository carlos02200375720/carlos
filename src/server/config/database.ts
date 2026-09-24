import mongoose from "mongoose";
import { MongoUser, MongoProduct, MongoReel, MongoOrder, MongoPublicacion } from "../models";
import { Product, Order } from "../../types";
import {
  setProducts,
  getProducts,
  setReels,
  getReels,
  setOrders,
} from "../services/state";
import {
  getCanonicalReelsFromMongo,
  saveCanonicalReelToMongo,
  syncLegacyPublicacionesToMongoReel,
} from "../services/reelService";

/**
 * Connect to MongoDB Atlas and load/seed users, products, reels, and orders.
 */
export async function connectToMongoDB(): Promise<void> {
  let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log("⚠️ MONGO_URI / MONGODB_URI environment variable is missing. Running with in-memory database fallback.");
    return;
  }

  // Strip outer quotes if present
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
    if (cleanPass.startsWith('<') && cleanPass.endsWith('>')) {
      cleanPass = cleanPass.slice(1, -1);
    }
    try {
      const decodedPass = decodeURIComponent(cleanPass);
      cleanPass = encodeURIComponent(decodedPass);
    } catch {
      if (cleanPass.includes('@')) {
        cleanPass = cleanPass.replace(/@/g, '%40');
      }
    }
    mongoUri = `${protocol}${username}:${cleanPass}@${host}${rest}`;
  } else {
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

    // Delete any guest/ghost users or test profiles from the database
    console.log("🧹 Purging any leftover guest/ghost/anonymous profiles and test creator profiles from database...");
    await MongoUser.deleteMany({
      $or: [
        { id: "user_guest" },
        { id: "current_user" },
        { id: "usuario_actual" },
        { id: "usuario_invitado" },
        { username: "invitado" },
        { username: "current_user" },
        { username: "usuario_actual" },
        { username: "creador" },
        { username: "creator" },
        { id: "creator" },
        { id: "creador" },
        { name: /^creador$/i },
        { name: /^creator$/i },
        { isGuest: true }
      ]
    });

    // Permanently purge any test reel or test publicacion from creador/creator
    await MongoReel.deleteMany({
      $or: [
        { id: "reel_pub_vatdfyio3" },
        { creatorId: "creator" },
        { creatorId: "creador" },
        { creatorUsername: "creador" },
        { creatorUsername: "creator" },
        { creatorName: /^creador$/i },
        { creatorName: /^creator$/i },
        { videoUrl: { $regex: /hls_7a5hkwg34/ } },
        { hlsUrl: { $regex: /hls_7a5hkwg34/ } }
      ]
    });
    await MongoPublicacion.deleteMany({
      $or: [
        { id: "pub_vatdfyio3" },
        { creatorId: "creator" },
        { creatorId: "creador" },
        { usuarioNombre: /^creador$/i },
        { url: { $regex: /hls_7a5hkwg34/ } },
        { hlsUrl: { $regex: /hls_7a5hkwg34/ } }
      ]
    });
    console.log("🧹 Guest/anonymous profiles and test creator content purged successfully!");

    // Deduplicate any duplicate users by email or username in Atlas
    const allUsersInDb = await MongoUser.find();
    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();
    for (const u of allUsersInDb) {
      const email = (u.email || "").trim().toLowerCase();
      const username = (u.username || "").trim().toLowerCase();
      let isDuplicate = false;
      if (email && email.includes("@")) {
        if (seenEmails.has(email)) {
          isDuplicate = true;
        } else {
          seenEmails.add(email);
        }
      }
      if (username) {
        if (seenUsernames.has(username)) {
          isDuplicate = true;
        } else {
          seenUsernames.add(username);
        }
      }
      if (isDuplicate) {
        console.log(`🧹 Removing duplicate user from Atlas: id=${u.id}, username=@${u.username}, email=${u.email}`);
        await MongoUser.deleteOne({ _id: u._id });
      }
    }

    // Migrate and sanitize any remaining base64 avatars in MongoDB Atlas to GCS URLs
    try {
      const { sanitizeBase64AvatarsInMongo } = await import("../services/state");
      await sanitizeBase64AvatarsInMongo();
    } catch (migrErr) {
      console.warn("Notice: Base64 avatar migration check:", migrErr);
    }

    console.log("📦 Loading existing users from MongoDB...");
    const dbUsers = await MongoUser.find();
    console.log(`📦 Loaded ${dbUsers.length} users successfully from MongoDB Atlas!`);

    // Load products from MongoDB Atlas.
    // An empty collection is a valid state: products deleted by the administrator
    // must not be recreated from in-memory/default data on server restart.
    const productCount = await MongoProduct.countDocuments();
    if (productCount === 0) {
      setProducts([]);
      console.log("📦 MongoDB product catalog is empty; preserving the empty catalog.");
    } else {
      console.log("📦 Loading products from MongoDB...");
      const dbProducts = await MongoProduct.find();
      const seenProdIds = new Set<string>();
      const uniqueDbProducts = dbProducts.filter((p) => {
        if (!p.id || seenProdIds.has(p.id)) return false;
        seenProdIds.add(p.id);
        return true;
      });
      const loadedProducts: Product[] = uniqueDbProducts.map((p) => ({
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
        views: p.views || 0,
      }));
      setProducts(loadedProducts);
      console.log(`📦 Loaded ${loadedProducts.length} unique products successfully from MongoDB Atlas!`);
    }

    // 1. Sync and migrate any legacy MongoPublicacion documents into MongoReel
    console.log("📦 Checking and migrating any legacy MongoPublicacion documents into MongoReel...");
    await syncLegacyPublicacionesToMongoReel();

    // Clean up any old rainbow placeholder thumbnails from MongoDB
    await MongoReel.updateMany(
      { thumbnailUrl: { $regex: "1618005182384" } },
      { $set: { thumbnailUrl: "" } }
    ).catch(() => {});

    // 2. Load canonical reels directly from MongoReel in Atlas
    const canonicalDbReels = await getCanonicalReelsFromMongo();
    if (canonicalDbReels.length > 0) {
      setReels(canonicalDbReels);
      console.log(`📦 Loaded ${canonicalDbReels.length} canonical reels successfully from MongoReel in Atlas!`);
    } else {
      console.log("🌱 Seeding default reels to MongoReel in Atlas...");
      for (const r of getReels()) {
        await saveCanonicalReelToMongo(r);
      }
      const reloadedReels = await getCanonicalReelsFromMongo();
      setReels(reloadedReels);
      console.log("🌱 Seeding canonical reels completed!");
    }

    // Load or Seed Orders from MongoDB Atlas
    console.log("📦 Loading orders from MongoDB...");
    const orderCount = await MongoOrder.countDocuments();
    if (orderCount === 0) {
      console.log("🌱 Seeding realistic demo purchase and sale orders to MongoDB...");
      const now = Date.now();
      const currentProducts = getProducts();
      const demoOrders: Order[] = [
        {
          id: "ord_demo_compra",
          buyerId: "current_user",
          buyerName: "Carlos Gómez",
          buyerUsername: "carlosg",
          buyerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
          items: [
            {
              productId: currentProducts[0]?.id || "prod_1",
              name: currentProducts[0]?.name || "Auriculares Inalámbricos Pro",
              price: currentProducts[0]?.price || 89.99,
              quantity: 1,
              imageUrl: currentProducts[0]?.imageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
              sellerId: "seller_official",
              sellerName: "Tech Store Oficial",
              sellerUsername: "techstore",
              carrier: "DHL Express"
            }
          ],
          total: (currentProducts[0]?.price || 89.99) + 5.99,
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
              productId: currentProducts[1]?.id || currentProducts[0]?.id || "prod_2",
              name: currentProducts[1]?.name || currentProducts[0]?.name || "Smartwatch Deportivo Ultra",
              price: currentProducts[1]?.price || 129.50,
              quantity: 2,
              imageUrl: currentProducts[1]?.imageUrl || currentProducts[0]?.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
              sellerId: "current_user",
              sellerName: "Carlos Gómez",
              sellerUsername: "carlosg",
              carrier: "FedEx"
            }
          ],
          total: (currentProducts[1]?.price || 129.50) * 2 + 7.50,
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
      setOrders(demoOrders);
      console.log(`🌱 Seeding orders completed (${demoOrders.length} orders)!`);
    } else {
      const dbOrders = await MongoOrder.find().sort({ createdAt: -1 });
      const seenOrderIds = new Set<string>();
      const loadedOrders: Order[] = dbOrders
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
      setOrders(loadedOrders);
      console.log(`📦 Loaded ${loadedOrders.length} orders successfully from MongoDB Atlas!`);
    }
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB Atlas:", error);
  }
}
