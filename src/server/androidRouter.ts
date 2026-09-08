import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { User, Reel, Product, Order } from "../types";

export interface AndroidRouterDependencies {
  MongoUser: any;
  MongoProduct: any;
  MongoReel: any;
  MongoOrder: any;
  MongoPublicacion: any;
  getReels: () => Reel[];
  setReels: (reels: Reel[]) => void;
  getProducts: () => Product[];
  getOrders: () => Order[];
  setOrders: (orders: Order[]) => void;
  uploadToGCS: (file: Express.Multer.File, folder?: string) => Promise<string>;
  uploadSingleSafe: (fieldName: string) => any;
  uploadBase64ToGCS: (base64Str: string, folder?: string) => Promise<string>;
  broadcastToAll: (data: any) => void;
  generateId: () => string;
}

export function createAndroidRouter(deps: AndroidRouterDependencies): Router {
  const router = Router();
  const {
    MongoUser,
    MongoProduct,
    MongoReel,
    MongoOrder,
    MongoPublicacion,
    getReels,
    setReels,
    getProducts,
    getOrders,
    setOrders,
    uploadToGCS,
    uploadSingleSafe,
    uploadBase64ToGCS,
    broadcastToAll,
    generateId,
  } = deps;

  // Dedicated Android middleware
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).isAndroid = true;
    res.setHeader("X-Platform-Engine", "MallSocial-Android-V1");
    console.log(`📱 [Android Gateway] ${req.method} ${req.originalUrl || req.url}`);
    next();
  });

  // Health and Android Engine Status
  router.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      platform: "android",
      engine: "MallSocial Android Backend Gateway",
      timestamp: new Date().toISOString(),
      mongoConnected: mongoose.connection.readyState === 1,
    });
  });

  // Android Auth: Login
  router.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username) {
        res.status(400).json({ error: "El nombre de usuario o correo es requerido" });
        return;
      }

      const cleanUsername = String(username).trim().toLowerCase().replace("@", "");
      let targetUser = null;

      if (mongoose.connection.readyState === 1) {
        targetUser = await MongoUser.findOne({
          $or: [
            { username: cleanUsername },
            { username: username },
            { username: { $regex: new RegExp(`^${cleanUsername}$`, "i") } },
            { email: cleanUsername },
            { email: String(username).trim().toLowerCase() },
            { id: username },
          ],
          id: { $ne: "current_user" },
        });
      }

      if (!targetUser) {
        res.status(404).json({ error: "Usuario no encontrado en el servidor" });
        return;
      }

      const expectedPassword = targetUser.password || "";
      if (expectedPassword && password && expectedPassword !== password) {
        res.status(401).json({ error: "Contraseña incorrecta. Verifica tus datos de acceso." });
        return;
      }

      const androidUser: User = {
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
        isOnline: true,
        email: targetUser.email || "",
      };

      console.log(`📱 [Android Gateway] Usuario autenticado exitosamente: @${androidUser.username}`);
      res.json({ success: true, user: androidUser, token: `android_token_${generateId()}` });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en login:", err);
      res.status(500).json({ error: "Error interno en servidor Android", details: err.message });
    }
  });

  // Android Auth: Register
  router.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, username, email, password, bio, avatar } = req.body;
      if (!name || !username || !email) {
        res.status(400).json({ error: "Nombre, usuario y correo electrónico son requeridos" });
        return;
      }

      const cleanUsername = String(username).replace(/\s+/g, "").toLowerCase();
      const cleanEmail = String(email).trim().toLowerCase();

      if (mongoose.connection.readyState === 1) {
        const existing = await MongoUser.findOne({
          $or: [{ username: cleanUsername }, { email: cleanEmail }],
          id: { $ne: "current_user" },
        });

        if (existing) {
          res.status(400).json({ error: "El usuario o correo electrónico ya está registrado en el sistema." });
          return;
        }
      }

      let resolvedAvatar = avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";
      if (avatar && avatar.startsWith("data:")) {
        try {
          resolvedAvatar = await uploadBase64ToGCS(avatar, "avatars");
        } catch (e) {
          console.warn("Could not upload avatar base64 to GCS:", e);
        }
      }

      const newUserId = "user_" + generateId();
      const newUser = {
        id: newUserId,
        name,
        username: cleanUsername,
        email: cleanEmail,
        password: password || "",
        bio: bio || "Usuario registrado desde la app Android",
        avatar: resolvedAvatar,
        followers: 0,
        following: 0,
        isOnline: true,
        platform: "android",
      };

      if (mongoose.connection.readyState === 1) {
        const mongoUser = new MongoUser(newUser);
        await mongoUser.save();
      }

      const androidUser: User = {
        ...newUser,
        id: "current_user",
        originalId: newUserId,
        isGuest: false,
      };

      console.log(`📱 [Android Gateway] Nuevo usuario registrado en Android: @${androidUser.username}`);
      res.json({ success: true, user: androidUser, token: `android_token_${generateId()}` });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en registro:", err);
      res.status(500).json({ error: "Error en registro de Android", details: err.message });
    }
  });

  // Android Profile Update
  router.post("/users/current/update", async (req: Request, res: Response) => {
    try {
      const { name, bio, avatar, userId } = req.body;
      const targetId = userId || (req.headers["x-user-id"] as string);

      if (!targetId || targetId === "user_guest" || targetId === "invitado") {
        res.status(401).json({ error: "Sesión no autorizada" });
        return;
      }

      let resolvedAvatar = avatar;
      if (avatar && avatar.startsWith("data:")) {
        try {
          resolvedAvatar = await uploadBase64ToGCS(avatar, "avatars");
        } catch {}
      }

      const updateFields: any = {};
      if (name) updateFields.name = name;
      if (bio !== undefined) updateFields.bio = bio;
      if (resolvedAvatar) updateFields.avatar = resolvedAvatar;

      let updated = null;
      if (mongoose.connection.readyState === 1) {
        updated = await MongoUser.findOneAndUpdate(
          { $or: [{ id: targetId }, { _id: targetId }] },
          { $set: updateFields },
          { new: true }
        );
      }

      console.log(`📱 [Android Gateway] Perfil actualizado para ${targetId}`);
      res.json({ success: true, user: updated || { id: targetId, ...updateFields } });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error al actualizar perfil:", err);
      res.status(500).json({ error: "Error al actualizar perfil", details: err.message });
    }
  });

  // Android Feed / Reels endpoint
  router.get("/reels", async (req: Request, res: Response) => {
    try {
      let currentReels = getReels();
      if (mongoose.connection.readyState === 1) {
        const dbReels = await MongoReel.find().sort({ _id: -1 }).limit(50);
        if (dbReels.length > 0) {
          currentReels = dbReels.map((r: any) => ({
            id: r.id,
            videoUrl: r.videoUrl || "",
            thumbnailUrl: r.thumbnailUrl || "",
            description: r.description || "",
            creatorId: r.creatorId || "current_user",
            creatorName: r.creatorName || "Creador Android",
            creatorUsername: r.creatorUsername || "creador",
            creatorAvatar: r.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            likes: r.likes || 0,
            likedBy: r.likedBy || [],
            comments: r.comments || [],
            saves: r.saves || 0,
            views: r.views || 0,
            hlsUrl: r.hlsUrl,
            taggedProductId: r.taggedProductId || r.productId,
          }));
        }
      }

      res.json({ success: true, platform: "android", count: currentReels.length, reels: currentReels });
    } catch (err: any) {
      res.status(500).json({ error: "Error al cargar feed de Android", details: err.message });
    }
  });

  // Android Publish / Create Reel
  router.post("/reels", async (req: Request, res: Response) => {
    try {
      const { videoUrl, thumbnailUrl, description, creatorId, creatorName, creatorUsername, creatorAvatar, taggedProductId } = req.body;
      if (!videoUrl) {
        res.status(400).json({ error: "URL del video es obligatoria" });
        return;
      }

      const newReel: Reel = {
        id: "reel_" + generateId(),
        videoUrl,
        thumbnailUrl: thumbnailUrl || "",
        description: description || "",
        creatorId: creatorId || "current_user",
        creatorName: creatorName || "Creador Android",
        creatorUsername: creatorUsername || "creador",
        creatorAvatar: creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        likes: 0,
        likedBy: [],
        comments: [],
        shares: 0,
        saves: 0,
        views: 0,
        productId: taggedProductId,
      };

      if (mongoose.connection.readyState === 1) {
        const mongoReel = new MongoReel(newReel);
        await mongoReel.save();
      }

      const updatedReels = [newReel, ...getReels()];
      setReels(updatedReels);

      broadcastToAll({
        type: "new_reel",
        reel: newReel,
        platform: "android",
      });

      console.log(`📱 [Android Gateway] Reel publicado exitosamente: ${newReel.id}`);
      res.json({ success: true, reel: newReel });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error al publicar reel:", err);
      res.status(500).json({ error: "Error al publicar reel", details: err.message });
    }
  });

  // Android Upload
  router.post("/upload", uploadSingleSafe("file"), async (req: any, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      console.log(`📱 [Android Gateway] Subiendo archivo desde Android: ${req.file.originalname}`);
      const publicUrl = await uploadToGCS(req.file, "android_media");
      const pubId = "android_pub_" + generateId();

      if (mongoose.connection.readyState === 1) {
        try {
          const newPub = new MongoPublicacion({
            id: pubId,
            url: publicUrl,
            title: req.body?.title || req.file.originalname,
            description: req.body?.description || "Publicado desde Android",
            creatorId: req.body?.creatorId || "current_user",
          });
          await newPub.save();
        } catch {}
      }

      res.json({
        success: true,
        platform: "android",
        url: publicUrl,
        publicacionId: pubId,
      });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en upload:", err);
      res.status(500).json({ error: "Error al procesar archivo en Android", details: err.message });
    }
  });

  // Android Shop: Products
  router.get("/products", async (req: Request, res: Response) => {
    try {
      let prods = getProducts();
      if (mongoose.connection.readyState === 1) {
        const dbProds = await MongoProduct.find();
        if (dbProds.length > 0) {
          prods = dbProds.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || "",
            price: p.price,
            imageUrl: p.imageUrl || "",
            stock: p.stock || 10,
            sellerId: p.sellerId || "current_user",
            rating: p.rating || 5,
            category: p.category || "General",
          }));
        }
      }
      res.json({ success: true, platform: "android", products: prods });
    } catch (err: any) {
      res.status(500).json({ error: "Error al obtener productos en Android", details: err.message });
    }
  });

  // Android Shop: Create Order
  router.post("/orders", async (req: Request, res: Response) => {
    try {
      const { items, total, userId, userName, userEmail } = req.body;
      const newOrder: Order = {
        id: "ord_android_" + generateId(),
        buyerId: userId || "current_user",
        buyerName: userName || "Usuario Android",
        buyerEmail: userEmail || "android@mallsocial.app",
        items: items || [],
        total: total || 0,
        shippingAddress: req.body?.address || "Dirección Android Móvil",
        status: "processing",
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
      };

      if (mongoose.connection.readyState === 1) {
        const mongoOrder = new MongoOrder(newOrder);
        await mongoOrder.save();
      }

      const allOrders = [newOrder, ...getOrders()];
      setOrders(allOrders);

      broadcastToAll({
        type: "new_order",
        order: newOrder,
        platform: "android",
      });

      console.log(`📱 [Android Gateway] Orden creada desde Android: ${newOrder.id} ($${newOrder.total})`);
      res.json({ success: true, order: newOrder });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error al registrar orden:", err);
      res.status(500).json({ error: "Error al crear orden en Android", details: err.message });
    }
  });

  return router;
}
