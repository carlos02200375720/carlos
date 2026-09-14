import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { Bucket } from "@google-cloud/storage";
import { User, Reel, Product, Order } from "../types";
import { transcodeVideoToLocalHlsDirect } from "./hlsTranscoder";

export interface AndroidRouterDependencies {
  MongoUser: any;
  MongoProduct: any;
  MongoReel: any;
  MongoOrder: any;
  MongoPublicacion: any;
  getUsers?: () => Promise<User[]>;
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
  bucket?: Bucket;
  bucketName?: string;
  hlsQueue?: {
    enqueueAndWait: (
      jobId: string,
      videoBuffer: Buffer,
      sourceName: string,
      bucket: Bucket,
      bucketName: string,
      options?: {
        reelId?: string;
        publicacionId?: string;
        onComplete?: (result: any) => Promise<void> | void;
        onError?: (err: Error) => void;
      }
    ) => Promise<any>;
  };
}

export function createAndroidRouter(deps: AndroidRouterDependencies): Router {
  const router = Router();
  const {
    MongoUser,
    MongoProduct,
    MongoReel,
    MongoOrder,
    MongoPublicacion,
    getUsers,
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
    bucket,
    bucketName,
    hlsQueue,
  } = deps;

  // Dedicated Android middleware
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).isAndroid = true;
    res.setHeader("X-Platform-Engine", "MallSocial-Android-V1");
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

  // Android: Real Users list from MongoDB Atlas
  router.get("/users", async (req: Request, res: Response) => {
    try {
      if (getUsers) {
        const users = await getUsers();
        if (users && users.length > 0) {
          res.json(users);
          return;
        }
      }

      if (mongoose.connection.readyState === 1) {
        const dbUsers = await MongoUser.find({
          id: { $nin: ["current_user", "user_guest"] },
          username: { $ne: "invitado" },
        });

        const users: User[] = dbUsers.map((u: any) => ({
          id: u.id,
          originalId: u._id ? u._id.toString() : u.id,
          username: u.username,
          name: u.name,
          avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: u.bio || "",
          coverPhoto: u.coverPhoto || "",
          isOnline: u.isOnline !== undefined ? u.isOnline : false,
          followers: u.followers || 0,
          following: u.following || 0,
          followingUserIds: u.followingUserIds || [],
          savedReelIds: u.savedReelIds || [],
          isGuest: false,
          email: u.email || "",
        }));

        res.json(users);
        return;
      }

      res.json([]);
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error fetching users:", err);
      res.status(500).json({ error: "Error al obtener usuarios de MongoDB", details: err.message });
    }
  });

  // Android: Current user status / auto session resolution
  router.get("/users/current_user", async (req: Request, res: Response) => {
    try {
      const headerUsername = req.headers["x-user-username"] as string;
      const headerUserId = req.headers["x-user-id"] as string;

      let targetUser = null;
      if (mongoose.connection.readyState === 1) {
        if (headerUsername && headerUsername !== "invitado" && headerUsername !== "guest") {
          targetUser = await MongoUser.findOne({
            $or: [
              { username: headerUsername.toLowerCase() },
              { username: headerUsername },
              { email: headerUsername.toLowerCase() },
            ],
          });
        } else if (headerUserId) {
          targetUser = await MongoUser.findOne({
            $or: [{ id: headerUserId }, { _id: mongoose.isValidObjectId(headerUserId) ? headerUserId : undefined }],
          });
        }

        // Fallback to first real active user in Atlas if none specified
        if (!targetUser) {
          targetUser = await MongoUser.findOne({
            id: { $nin: ["current_user", "user_guest"] },
            username: { $ne: "invitado" },
          });
        }
      }

      if (targetUser) {
        const userObj: User = {
          id: targetUser.id,
          originalId: targetUser._id ? targetUser._id.toString() : targetUser.id,
          username: targetUser.username,
          name: targetUser.name,
          bio: targetUser.bio || "",
          avatar: targetUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          coverPhoto: targetUser.coverPhoto || "",
          followers: targetUser.followers || 0,
          following: targetUser.following || 0,
          followingUserIds: targetUser.followingUserIds || [],
          savedReelIds: targetUser.savedReelIds || [],
          isGuest: false,
          isOnline: true,
          email: targetUser.email || "",
        };
        res.json({ success: true, user: userObj });
        return;
      }

      res.json({
        success: true,
        user: {
          id: "current_user",
          username: "invitado",
          name: "Invitado",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: "Modo explorador",
          isOnline: true,
          followers: 0,
          following: 0,
          followingUserIds: [],
          savedReelIds: [],
          isGuest: true,
        },
      });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en current_user:", err);
      res.status(500).json({ error: "Error al obtener usuario actual", details: err.message });
    }
  });

  // Android Auth: Switch or restore user session
  router.post("/users/current/switch", async (req: Request, res: Response) => {
    try {
      const { targetUsername, password } = req.body;
      if (!targetUsername) {
        res.status(400).json({ error: "Nombre de usuario requerido" });
        return;
      }

      const cleanUsername = String(targetUsername).trim().toLowerCase().replace("@", "");
      let user = null;

      if (mongoose.connection.readyState === 1) {
        user = await MongoUser.findOne({
          $or: [
            { username: cleanUsername },
            { username: targetUsername },
            { email: cleanUsername },
            { id: targetUsername },
          ],
        });
      }

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado en Atlas" });
        return;
      }

      const formattedUser: User = {
        id: user.id,
        originalId: user._id ? user._id.toString() : user.id,
        username: user.username,
        name: user.name,
        bio: user.bio || "",
        avatar: user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        coverPhoto: user.coverPhoto || "",
        followers: user.followers || 0,
        following: user.following || 0,
        followingUserIds: user.followingUserIds || [],
        savedReelIds: user.savedReelIds || [],
        isGuest: false,
        isOnline: true,
        email: user.email || "",
      };

      res.json({ success: true, user: formattedUser });
    } catch (err: any) {
      res.status(500).json({ error: "Error al cambiar sesión", details: err.message });
    }
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
        res.status(404).json({ error: "Usuario no encontrado en MongoDB Atlas" });
        return;
      }

      const expectedPassword = targetUser.password || "";
      if (expectedPassword && password && expectedPassword !== password) {
        res.status(401).json({ error: "Contraseña incorrecta. Verifica tus datos de acceso." });
        return;
      }

      const androidUser: User = {
        id: targetUser.id,
        originalId: targetUser._id ? targetUser._id.toString() : targetUser.id,
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

      console.log(`📱 [Android Gateway] Usuario autenticado exitosamente en Atlas: @${androidUser.username}`);
      res.json({ success: true, user: androidUser, token: `android_token_${generateId()}` });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en login:", err);
      res.status(500).json({ error: "Error interno en servidor Android", details: err.message });
    }
  });

  // Android Auth: Register
  router.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, name, email, password, avatar } = req.body;
      if (!username || !name) {
        res.status(400).json({ error: "Nombre de usuario y nombre son obligatorios" });
        return;
      }

      const cleanUsername = String(username).trim().toLowerCase().replace("@", "");

      if (mongoose.connection.readyState === 1) {
        const existing = await MongoUser.findOne({
          $or: [{ username: cleanUsername }, { email: email?.toLowerCase() }],
        });
        if (existing) {
          res.status(409).json({ error: "El nombre de usuario o correo ya está registrado" });
          return;
        }
      }

      const newUserId = "user_" + generateId();
      const newUser: User = {
        id: newUserId,
        originalId: newUserId,
        username: cleanUsername,
        name: name.trim(),
        avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        bio: "Nuevo creador en MallSocial",
        followers: 0,
        following: 0,
        followingUserIds: [],
        savedReelIds: [],
        isGuest: false,
        isOnline: true,
        email: email || "",
      };

      if (mongoose.connection.readyState === 1) {
        const mongoUser = new MongoUser({
          ...newUser,
          password: password || "",
        });
        await mongoUser.save();
      }

      console.log(`📱 [Android Gateway] Nuevo usuario registrado en Atlas: @${newUser.username}`);
      res.json({ success: true, user: newUser, token: `android_token_${generateId()}` });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en registro:", err);
      res.status(500).json({ error: "Error al registrar usuario en Android", details: err.message });
    }
  });

  // Android: Update profile
  router.post("/users/current/update", async (req: Request, res: Response) => {
    try {
      const { userId, name, bio, avatar } = req.body;
      const targetId = userId || req.headers["x-user-id"];

      if (!targetId) {
        res.status(400).json({ error: "ID de usuario requerido para actualización" });
        return;
      }

      const updateFields: any = {};
      if (name) updateFields.name = name.trim();
      if (bio !== undefined) updateFields.bio = bio.trim();
      if (avatar) updateFields.avatar = avatar;

      let updated = null;
      if (mongoose.connection.readyState === 1) {
        updated = await MongoUser.findOneAndUpdate(
          { $or: [{ id: targetId }, { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined }] },
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

  // Android: Get user by ID / username
  router.get("/users/:id", async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      let user = null;
      if (mongoose.connection.readyState === 1) {
        user = await MongoUser.findOne({
          $or: [
            { id: targetId },
            { username: targetId.toLowerCase() },
            { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined },
          ],
        });
      }

      if (user) {
        res.json({
          success: true,
          user: {
            id: user.id,
            originalId: user._id ? user._id.toString() : user.id,
            username: user.username,
            name: user.name,
            bio: user.bio || "",
            avatar: user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            coverPhoto: user.coverPhoto || "",
            followers: user.followers || 0,
            following: user.following || 0,
            followingUserIds: user.followingUserIds || [],
            savedReelIds: user.savedReelIds || [],
            isGuest: false,
            isOnline: true,
          },
        });
        return;
      }
      res.status(404).json({ error: "Usuario no encontrado" });
    } catch (err: any) {
      res.status(500).json({ error: "Error al buscar usuario", details: err.message });
    }
  });

  // Android: Get all publications and reels created by a specific user
  router.get("/users/:id/publications", async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      let userPubs: any[] = [];
      let userReels: any[] = [];

      if (mongoose.connection.readyState === 1) {
        const userDoc = await MongoUser.findOne({
          $or: [
            { id: targetId },
            { username: targetId.toLowerCase() },
            { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined },
          ],
        });

        const matchIds = [targetId];
        const matchUsernames: string[] = [];
        if (userDoc) {
          matchIds.push(userDoc.id);
          if (userDoc._id) matchIds.push(userDoc._id.toString());
          if (userDoc.username) matchUsernames.push(userDoc.username);
        }

        userPubs = await MongoPublicacion.find({
          $or: [
            { creatorId: { $in: matchIds } },
            { creatorUsername: { $in: matchUsernames } },
          ],
        }).sort({ _id: -1 });

        userReels = await MongoReel.find({
          $or: [
            { creatorId: { $in: matchIds } },
            { creatorUsername: { $in: matchUsernames } },
          ],
        }).sort({ _id: -1 });
      }

      res.json({
        success: true,
        reels: userReels,
        publicaciones: userPubs,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Error al obtener publicaciones del usuario", details: err.message });
    }
  });

  // Android Feed / Reels endpoint: Returns real reels from MongoDB Atlas directly
  router.get("/reels", async (req: Request, res: Response) => {
    try {
      let currentReels = getReels();
      if (mongoose.connection.readyState === 1) {
        const dbUsers = await MongoUser.find();
        const userMap = new Map<string, any>();
        dbUsers.forEach((u: any) => {
          userMap.set(u.id, u);
          if (u.username) userMap.set(u.username.toLowerCase(), u);
          if (u._id) userMap.set(u._id.toString(), u);
        });

        const dbReels = await MongoReel.find().sort({ _id: -1 }).limit(100);
        if (dbReels.length > 0) {
          currentReels = dbReels.map((r: any) => {
            const creator =
              userMap.get(r.creatorId) ||
              (r.creatorUsername ? userMap.get(r.creatorUsername.toLowerCase()) : null);

            return {
              id: r.id,
              videoUrl: r.videoUrl || "",
              thumbnailUrl: r.thumbnailUrl || "",
              description: r.description || "",
              creatorId: creator ? creator.id : (r.creatorId || "creator"),
              creatorName: creator ? creator.name : (r.creatorName || "Creador"),
              creatorUsername: creator ? creator.username : (r.creatorUsername || "creador"),
              creatorAvatar: creator ? creator.avatar : (r.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"),
              likes: r.likes || 0,
              likedBy: r.likedBy || [],
              comments: r.comments || [],
              saves: r.saves || 0,
              views: r.views || 0,
              hlsUrl: r.hlsUrl || undefined,
              taggedProductId: r.taggedProductId || r.productId || undefined,
              aspectRatio: r.aspectRatio || "vertical",
            };
          });
        }
      }

      // Return clean array for direct client consumption
      res.json(currentReels);
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error loading reels:", err);
      res.status(500).json({ error: "Error al cargar feed de Android", details: err.message });
    }
  });

  // Android Publish / Create Reel
  router.post("/reels", async (req: Request, res: Response) => {
    try {
      const { videoUrl, thumbnailUrl, description, creatorId, creatorName, creatorUsername, creatorAvatar, taggedProductId, aspectRatio } = req.body;
      if (!videoUrl) {
        res.status(400).json({ error: "URL del video es obligatoria" });
        return;
      }

      let resolvedCreatorId = creatorId;
      let resolvedCreatorName = creatorName;
      let resolvedCreatorUsername = creatorUsername;
      let resolvedCreatorAvatar = creatorAvatar;

      if (mongoose.connection.readyState === 1 && (!resolvedCreatorUsername || resolvedCreatorUsername === "creador")) {
        const author = await MongoUser.findOne({
          $or: [{ id: resolvedCreatorId }, { username: req.headers["x-user-username"] }],
        });
        if (author) {
          resolvedCreatorId = author.id;
          resolvedCreatorName = author.name;
          resolvedCreatorUsername = author.username;
          resolvedCreatorAvatar = author.avatar;
        }
      }

      const newReel: Reel = {
        id: "reel_" + generateId(),
        videoUrl,
        thumbnailUrl: thumbnailUrl || "",
        description: description || "",
        creatorId: resolvedCreatorId || "creator",
        creatorName: resolvedCreatorName || "Creador",
        creatorUsername: resolvedCreatorUsername || "creador",
        creatorAvatar: resolvedCreatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        likes: 0,
        likedBy: [],
        comments: [],
        shares: 0,
        saves: 0,
        views: 0,
        productId: taggedProductId,
        aspectRatio: aspectRatio || "vertical",
      };

      if (mongoose.connection.readyState === 1) {
        const mongoReel = new MongoReel(newReel);
        await mongoReel.save();

        // Also record in publicacions collection for user portfolio
        try {
          const newPub = new MongoPublicacion({
            id: "pub_" + generateId(),
            url: videoUrl,
            title: description || "Video Reel",
            description: description || "",
            creatorId: resolvedCreatorId || "creator",
            creatorUsername: resolvedCreatorUsername || "creador",
            createdAt: new Date(),
          });
          await newPub.save();
        } catch {}
      }

      const updatedReels = [newReel, ...getReels()];
      setReels(updatedReels);

      broadcastToAll({
        type: "new_reel",
        reel: newReel,
        platform: "android",
      });

      console.log(`📱 [Android Gateway] Reel publicado exitosamente en Atlas: ${newReel.id} por @${resolvedCreatorUsername}`);
      res.json({ success: true, reel: newReel });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error al publicar reel:", err);
      res.status(500).json({ error: "Error al publicar reel", details: err.message });
    }
  });

  // Android Like Reel
  router.post("/reels/:id/like", async (req: Request, res: Response) => {
    try {
      const reelId = req.params.id;
      const { userId } = req.body;
      const targetUserId = userId || req.headers["x-user-id"] || "current_user";

      let likes = 0;
      let likedBy: string[] = [];

      if (mongoose.connection.readyState === 1) {
        const reel = await MongoReel.findOne({ id: reelId });
        if (reel) {
          const set = new Set<string>(reel.likedBy || []);
          if (set.has(targetUserId)) {
            set.delete(targetUserId);
          } else {
            set.add(targetUserId);
          }
          likedBy = Array.from(set);
          likes = likedBy.length;
          await MongoReel.updateOne({ id: reelId }, { $set: { likes, likedBy } });
        }
      }

      res.json({ success: true, likes, likedBy });
    } catch (err: any) {
      res.status(500).json({ error: "Error al dar like", details: err.message });
    }
  });

  // Android Comment on Reel
  router.post("/reels/:id/comment", async (req: Request, res: Response) => {
    try {
      const reelId = req.params.id;
      const { userId, username, avatar, text } = req.body;
      if (!text) {
        res.status(400).json({ error: "Texto del comentario es requerido" });
        return;
      }

      const newComment = {
        id: "com_" + generateId(),
        userId: userId || "user",
        username: username || "usuario",
        avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      if (mongoose.connection.readyState === 1) {
        await MongoReel.updateOne({ id: reelId }, { $push: { comments: newComment } });
      }

      res.json(newComment);
    } catch (err: any) {
      res.status(500).json({ error: "Error al agregar comentario", details: err.message });
    }
  });

  // Android Delete Publication / Reel
  router.delete(["/reels/:id", "/publicaciones/:id"], async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      if (!targetId) {
        res.status(400).json({ error: "ID de publicación requerido" });
        return;
      }

      console.log(`🗑️ [Android Gateway] Eliminando publicación / reel ${targetId}...`);

      const isObjectId = mongoose.Types.ObjectId.isValid(targetId) && String(targetId).length === 24;
      const mongoQuery = isObjectId ? { $or: [{ id: targetId }, { _id: targetId }] } : { id: targetId };

      if (mongoose.connection.readyState === 1) {
        try {
          await MongoReel.deleteMany(mongoQuery);
          await MongoPublicacion.deleteMany(mongoQuery);
        } catch (dbErr) {
          console.error("Error al eliminar de MongoDB:", dbErr);
        }
      }

      // Update in-memory reels
      const current = getReels();
      setReels(current.filter((r) => r.id !== targetId));

      broadcastToAll({
        type: "reel_deleted",
        reelId: targetId,
      });

      res.json({ success: true, deletedId: targetId });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error deleting reel:", err);
      res.status(500).json({ error: "Error al eliminar publicación", details: err.message });
    }
  });

  // Android Upload
  router.post("/upload", uploadSingleSafe("file"), async (req: any, res: Response) => {
    const pubId = "pub_" + generateId();
    try {
      if (!req.file) {
        res.status(400).json({ error: "No se proporcionó ningún archivo" });
        return;
      }

      const originalName = req.file.originalname || "upload";
      const mimeType = (req.file.mimetype || "").toLowerCase();
      const isVideo = mimeType.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(originalName);

      const creatorId = req.body?.creatorId || req.headers["x-user-id"] || "creator";
      const creatorUsername = req.body?.creatorUsername || req.headers["x-user-username"] || "creador";

      if (!isVideo) {
        console.log(`📱 [Android Gateway] Subiendo archivo no-video desde Android: ${originalName}`);
        const publicUrl = await uploadToGCS(req.file, "android_media");

        if (mongoose.connection.readyState === 1) {
          try {
            const newPub = new MongoPublicacion({
              id: pubId,
              url: publicUrl,
              title: req.body?.title || originalName,
              description: req.body?.description || "Publicado desde Android",
              creatorId,
              creatorUsername,
              createdAt: new Date(),
            });
            await newPub.save();
          } catch {}
        }

        return res.json({
          success: true,
          platform: "android",
          url: publicUrl,
          publicacionId: pubId,
        });
      }

      // Video branch: Android uses the same HLS pipeline and always returns HLS
      const jobId = "hls_" + generateId();
      console.log(`📱 [Android Gateway] Procesando video HLS-only desde Android: ${originalName}`);

      let hlsUrl = "";
      if (hlsQueue) {
        try {
          const hlsResult = await hlsQueue.enqueueAndWait(
            jobId,
            req.file.buffer,
            originalName,
            bucket,
            bucketName,
            { publicacionId: pubId }
          );
          hlsUrl = hlsResult.masterM3u8Url;
        } catch (queueErr) {
          console.warn("⚠️ [Android Gateway] Cola HLS falló, usando transcodificación local directa:", queueErr);
        }
      }

      if (!hlsUrl) {
        hlsUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, originalName);
      }

      if (mongoose.connection.readyState === 1) {
        try {
          const newPub = new MongoPublicacion({
            id: pubId,
            url: hlsUrl,
            hlsUrl,
            title: req.body?.title || originalName,
            description: req.body?.description || "Publicado desde Android",
            creatorId,
            creatorUsername,
            createdAt: new Date(),
          });
          await newPub.save();
        } catch {}
      }

      return res.json({
        success: true,
        platform: "android",
        url: hlsUrl,
        hlsUrl,
        publicacionId: pubId,
      });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en upload:", err);

      try {
        if (req.file?.buffer) {
          let emergencyUrl = "";
          try {
            emergencyUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, req.file.originalname || "video.mp4");
          } catch {
            const { saveToLocalStorage } = await import("./services/mediaStorage");
            emergencyUrl = await saveToLocalStorage(req.file.buffer, "android_media", req.file.originalname || "video.mp4");
          }
          console.log(`🛡️ [Android Gateway] Fallback media stream generated: ${emergencyUrl}`);

          return res.json({
            success: true,
            platform: "android",
            url: emergencyUrl,
            hlsUrl: emergencyUrl.endsWith(".m3u8") ? emergencyUrl : undefined,
            videoUrl: emergencyUrl,
            publicacionId: pubId,
          });
        }
      } catch (fbErr) {
        console.error("❌ Android emergency fallback failed:", fbErr);
      }

      res.status(400).json({ error: "Error al procesar archivo en Android", details: err?.message || "Error desconocido" });
    }
  });

  // Android Shop: Products from MongoDB Atlas
  router.get("/products", async (req: Request, res: Response) => {
    try {
      let prods = getProducts();
      if (mongoose.connection.readyState === 1) {
        const dbUsers = await MongoUser.find();
        const userMap = new Map<string, any>();
        dbUsers.forEach((u: any) => {
          userMap.set(u.id, u);
          if (u.username) userMap.set(u.username.toLowerCase(), u);
          if (u._id) userMap.set(u._id.toString(), u);
        });

        const dbProds = await MongoProduct.find();
        if (dbProds.length > 0) {
          prods = dbProds.map((p: any) => {
            const seller =
              userMap.get(p.sellerId) ||
              (p.sellerUsername ? userMap.get(p.sellerUsername.toLowerCase()) : null);

            return {
              id: p.id,
              name: p.name,
              description: p.description || "",
              price: p.price,
              imageUrl: p.imageUrl || "",
              stock: p.stock !== undefined ? p.stock : 10,
              sellerId: seller ? seller.id : (p.sellerId || "seller"),
              sellerName: seller ? seller.name : (p.sellerName || "Vendedor"),
              sellerUsername: seller ? seller.username : (p.sellerUsername || "vendedor"),
              rating: p.rating || 5,
              category: p.category || "General",
              images: p.images || [],
              videos: p.videos || [],
              variants: p.variants || [],
            };
          });
        }
      }
      res.json(prods);
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error fetching products:", err);
      res.status(500).json({ error: "Error al obtener productos en Android", details: err.message });
    }
  });

  // Android: Toggle save/unsave (reel or product)
  router.post("/users/current/save", async (req: Request, res: Response) => {
    try {
      const { reelId, productId, id, userId, username } = req.body;
      const targetItemId = reelId || productId || id;
      if (!targetItemId) {
        res.status(400).json({ error: "ID de publicación o producto requerido" });
        return;
      }

      let currentUserObj: any = null;
      if (mongoose.connection.readyState === 1) {
        const candidates = [userId, username, req.headers["x-user-id"], req.headers["x-user-username"]].filter(
          (c) => c && c !== "user_guest" && c !== "current_user" && c !== "invitado"
        );
        if (candidates.length > 0) {
          currentUserObj = await MongoUser.findOne({
            $or: candidates.flatMap((c) => [
              { id: c },
              { username: c },
              { username: typeof c === "string" ? c.toLowerCase() : c }
            ])
          });
        }
      }

      if (!currentUserObj) {
        res.json({ success: true, saved: true, savedReelIds: [targetItemId] });
        return;
      }

      if (!currentUserObj.savedReelIds) {
        currentUserObj.savedReelIds = [];
      }

      const index = currentUserObj.savedReelIds.indexOf(targetItemId);
      let saved = false;
      if (index > -1) {
        currentUserObj.savedReelIds.splice(index, 1);
      } else {
        currentUserObj.savedReelIds.push(targetItemId);
        saved = true;
      }

      if (mongoose.connection.readyState === 1) {
        await MongoUser.updateOne(
          { id: currentUserObj.id },
          { $set: { savedReelIds: currentUserObj.savedReelIds } }
        );
      }

      res.json({ success: true, saved, savedReelIds: currentUserObj.savedReelIds });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error en save:", err);
      res.status(500).json({ error: "Error al guardar elemento", details: err.message });
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

      console.log(`📱 [Android Gateway] Orden creada desde Android en Atlas: ${newOrder.id} ($${newOrder.total})`);
      res.json({ success: true, order: newOrder });
    } catch (err: any) {
      console.error("❌ [Android Gateway] Error al registrar orden:", err);
      res.status(500).json({ error: "Error al crear orden en Android", details: err.message });
    }
  });

  return router;
}
