import { Request, Response } from "express";
import mongoose from "mongoose";
import { User, Reel } from "../../types";
import { MongoUser, MongoReel, MongoProduct } from "../models";
import { generateId } from "../utils/helpers";
import { uploadBase64ToGCS } from "../services/mediaStorage";
import { getCachedDefaultAvatar, getCachedDefaultCoverPhoto } from "./settingsController";
import { formatReelDTO } from "../utils/reelUtils";
import { getUserCanonicalReelsFromMongo } from "../services/reelService";
import {
  activeOriginalUserId,
  setActiveOriginalUserId,
  pendingRegistrations,
  products,
  reels,
  orders,
  broadcastToAll,
} from "../services/state";

/**
 * Get all real users directly from MongoDB Atlas (excluding guests)
 */
export async function getUsers(): Promise<User[]> {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbUsers = await MongoUser.find({
        id: { $nin: ["current_user", "user_guest", "creator", "creador"] },
        username: { $nin: ["invitado", "creador", "creator"] }
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

/**
 * Helper to resolve the authenticated user for publications and products
 */
export async function resolveAuthenticatedUser(req: any, fallbackRole = "creator"): Promise<any> {
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

  // 2. Search in getUsers fallback
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
  }

  // 4. Update session pointer activeOriginalUserId
  if (resolvedUser && resolvedUser.id && resolvedUser.id !== "user_guest" && resolvedUser.id !== "current_user") {
    setActiveOriginalUserId(resolvedUser.id);
  }

  return resolvedUser;
}

/**
 * GET /api/users
 */
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  const dbUsers = await getUsers();
  res.json(dbUsers);
}

/**
 * GET /api/users/:id
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  const rawParam = (req.params.id || "").trim();
  const cleanParam = rawParam.toLowerCase().replace("@", "");

  // The test profile 'creador' has been deleted and must return 404
  if (cleanParam === "creador" || cleanParam === "creator") {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }

  const dbUsers = await getUsers();

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
    // Direct MongoDB lookup
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

    if (!user) {
      user = dbUsers.find(
        (u) =>
          u.id === rawParam ||
          u.username?.toLowerCase() === cleanParam ||
          u.id?.toLowerCase() === cleanParam ||
          (u.originalId && u.originalId === rawParam)
      );
    }

    // Fallback in reels
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
      if (
        sourceReel &&
        sourceReel.creatorId !== "creator" &&
        sourceReel.creatorId !== "creador" &&
        sourceReel.creatorUsername !== "creador" &&
        sourceReel.creatorUsername !== "creator"
      ) {
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
          username: sourceReel.creatorUsername || sourceReel.creatorName?.toLowerCase().replace(/\s+/g, "") || rawParam,
          name: sourceReel.creatorName || "Usuario",
          avatar: sourceReel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: creatorMongoUser?.bio || "Perfil en la plataforma",
          followers: creatorMongoUser?.followers || 0,
          following: creatorMongoUser?.following || 0,
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

    // Fallback in products
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

  let userReels: Reel[] = [];
  if (mongoose.connection.readyState === 1) {
    try {
      userReels = await getUserCanonicalReelsFromMongo(userIdentifiers);
    } catch (err) {
      console.warn("⚠️ Failed to load user reels directly from MongoReel:", err);
    }
  }

  if (userReels.length === 0) {
    const seenReel = new Set<string>();
    userReels = reels
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
  }

  // Purchases
  const userPurchases = orders.filter((o) => {
    if (user.id === "current_user") {
      return o.buyerId === "current_user" || (activeOriginalUserId && o.buyerId === activeOriginalUserId) || !o.buyerId;
    }
    return (
      userIdentifiers.has(o.buyerId || "") ||
      (o.buyerUsername && userIdentifiers.has(o.buyerUsername.toLowerCase()))
    );
  });

  // Sales
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
}

/**
 * GET /api/users/:id/publications
 */
export async function getUserPublications(req: Request, res: Response): Promise<void> {
  try {
    const targetId = (req.params.id || "").trim();
    const userIdentifiers = new Set<string>();
    if (targetId) {
      userIdentifiers.add(targetId);
      userIdentifiers.add(targetId.toLowerCase());
    }

    if (mongoose.connection.readyState === 1) {
      const userDoc = await MongoUser.findOne({
        $or: [
          { id: targetId },
          { username: targetId.toLowerCase() },
        ],
      });
      if (userDoc) {
        if (userDoc.id) userIdentifiers.add(userDoc.id);
        if (userDoc.originalId) userIdentifiers.add(userDoc.originalId);
        if (userDoc._id) userIdentifiers.add(userDoc._id.toString());
        if (userDoc.username) {
          userIdentifiers.add(userDoc.username);
          userIdentifiers.add(userDoc.username.toLowerCase());
        }
      }
    }

    let userReels: Reel[] = [];
    if (mongoose.connection.readyState === 1) {
      userReels = await getUserCanonicalReelsFromMongo(userIdentifiers);
    }

    if (userReels.length === 0) {
      userReels = reels
        .filter(
          (r) =>
            userIdentifiers.has(r.creatorId) ||
            (r.creatorUsername && userIdentifiers.has(r.creatorUsername.toLowerCase()))
        )
        .map((r) => formatReelDTO(r));
    }

    res.json({
      reels: userReels,
      publicaciones: userReels,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener publicaciones", details: err.message });
  }
}

/**
 * POST /api/users/current/save
 */
export async function toggleSaveReel(req: Request, res: Response): Promise<void> {
  const { reelId, productId, id, userId, username } = req.body;
  const targetItemId = reelId || productId || id;
  if (!targetItemId) {
    res.status(400).json({ error: "ID de publicación o producto requerido." });
    return;
  }

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

  const index = currentUserObj.savedReelIds.indexOf(targetItemId);
  let saved = false;
  if (index > -1) {
    currentUserObj.savedReelIds.splice(index, 1);
  } else {
    currentUserObj.savedReelIds.push(targetItemId);
    saved = true;
  }

  if (mongoose.connection.readyState === 1) {
    await MongoUser.findOneAndUpdate(
      { id: currentUserObj.id },
      { savedReelIds: currentUserObj.savedReelIds }
    );
  }

  // Update saves count on target reel if it's a reel
  const reel = reels.find((r) => r.id === targetItemId);
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

    broadcastToAll({
      type: "reel_updated",
      reelId: reel.id,
      likes: reel.likes,
      saves: reel.saves,
      commentsCount: reel.comments.length
    });
  }

  res.json({ success: true, saved, saves: newSavesCount, savedReelIds: currentUserObj.savedReelIds });
}

/**
 * POST /api/users/:targetUserId/follow
 */
export async function toggleFollow(req: Request, res: Response): Promise<void> {
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
    currentUserObj.followingUserIds.splice(index, 1);
    currentUserObj.following = Math.max(0, (currentUserObj.following || 1) - 1);
    if (targetUserObj) {
      targetUserObj.followers = Math.max(0, (targetUserObj.followers || 1) - 1);
    }
    isFollowing = false;
  } else {
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
}

/**
 * POST /api/users/current/update
 */
export async function updateCurrentUser(req: Request, res: Response): Promise<void> {
  const { name, username, bio, avatar, coverPhoto, password, privacyPolicy, userId, currentUsername } = req.body;
  const headerUsername = (req.headers["x-user-username"] as string)?.trim().toLowerCase();
  const headerUserId = (req.headers["x-user-id"] as string)?.trim();
  let currentUserObj: any = null;

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

  setActiveOriginalUserId(currentUserObj.id);

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
}

/**
 * POST /api/users/register
 */
export async function registerUser(req: Request, res: Response): Promise<void> {
  const { name, username, bio, avatar, coverPhoto, password, email } = req.body;
  if (!name || !username) {
    res.status(400).json({ error: "Nombre completo y nombre de usuario son obligatorios." });
    return;
  }
  if (!email || !email.trim()) {
    res.status(400).json({ error: "El correo electrónico es un requisito obligatorio." });
    return;
  }

  const cleanUsername = String(username).replace(/\s+/g, "").toLowerCase().replace("@", "");
  const cleanEmail = String(email).trim().toLowerCase();

  const lockKey = `${cleanUsername}:${cleanEmail}`;
  if (pendingRegistrations.has(lockKey) || pendingRegistrations.has(cleanEmail) || pendingRegistrations.has(cleanUsername)) {
    res.status(409).json({ error: "⚠️ Ya hay una solicitud de registro en proceso con este correo o usuario. Por favor espera." });
    return;
  }
  pendingRegistrations.add(lockKey);
  pendingRegistrations.add(cleanEmail);
  pendingRegistrations.add(cleanUsername);

  try {
    if (mongoose.connection.readyState === 1) {
      await MongoUser.deleteMany({
        $or: [
          { id: "current_user" },
          { id: "usuario_actual" },
          { id: "user_guest" },
          { id: "usuario_invitado" }
        ]
      });

      const existing = await MongoUser.findOne({
        $or: [
          { username: cleanUsername },
          { email: cleanEmail }
        ]
      });

      if (existing) {
        if (existing.email && existing.email.toLowerCase() === cleanEmail) {
          res.status(409).json({ error: "⚠️ Este correo electrónico ya está registrado con otra cuenta." });
          return;
        }
        res.status(409).json({ error: "⚠️ El nombre de usuario ya está registrado." });
        return;
      }
    }

    let resolvedAvatar = avatar || getCachedDefaultAvatar();
    let resolvedCoverPhoto = coverPhoto || getCachedDefaultCoverPhoto();

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

    const newUserId = "user_" + generateId();
    const newUser: User = {
      id: newUserId,
      originalId: newUserId,
      name: String(name).trim(),
      username: cleanUsername,
      email: cleanEmail,
      bio: bio || "Nuevo creador de contenido en la plataforma",
      avatar: resolvedAvatar,
      coverPhoto: resolvedCoverPhoto,
      followers: 0,
      following: 0,
      isOnline: true,
      password: password || "",
      isGuest: false
    };

    if (mongoose.connection.readyState === 1) {
      const mongoUser = new MongoUser(newUser);
      await mongoUser.save();
      console.log(`💾 Successfully registered exactly 1 user @${newUser.username} (${newUser.email}) with id=${newUser.id} in MongoDB Atlas!`);
      setActiveOriginalUserId(newUser.id);
    }

    const returnedUser = {
      ...newUser,
      id: newUser.id,
      originalId: newUser.id,
      isGuest: false
    };

    res.status(201).json({ success: true, user: returnedUser });
  } catch (err: any) {
    if (err.code === 11000) {
      console.warn("⚠️ Duplicate key collision caught in MongoDB registration:", err.message);
      res.status(409).json({ error: "⚠️ Este usuario o correo electrónico ya existe en la base de datos." });
      return;
    }
    console.error("❌ Error registering user:", err);
    res.status(500).json({ error: "Error al registrar el usuario", details: err.message });
  } finally {
    pendingRegistrations.delete(lockKey);
    pendingRegistrations.delete(cleanEmail);
    pendingRegistrations.delete(cleanUsername);
  }
}

/**
 * POST /api/users/current/switch
 */
export async function switchUser(req: Request, res: Response): Promise<void> {
  try {
    const { targetUsername, password, isSessionRestore } = req.body;
    if (!targetUsername) {
      res.status(400).json({ error: "Target username is required" });
      return;
    }

    const cleanUsername = String(targetUsername).trim().toLowerCase().replace("@", "");

    let targetUser: any = null;
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

    const expectedPassword = targetUser.password || "";
    if (!isSessionRestore && expectedPassword && expectedPassword !== password) {
      res.status(401).json({ error: "La contraseña ingresada es incorrecta. Por favor verifícala." });
      return;
    }

    setActiveOriginalUserId(targetUser.id);

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
}

/**
 * POST /api/users/current/logout
 */
export async function logoutUser(req: Request, res: Response): Promise<void> {
  try {
    setActiveOriginalUserId("user_guest");
    console.log(`🔄 Session logged out on server. Reset activeOriginalUserId to user_guest`);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (routeErr: any) {
    console.error("❌ Exception caught in user/logout endpoint:", routeErr);
    res.status(500).json({ error: "Internal server error on logout", details: routeErr.message });
  }
}

/**
 * DELETE /api/users/:id
 * Administrative deletion of a user profile
 */
export async function adminDeleteUser(req: Request, res: Response): Promise<void> {
  try {
    const rawId = (req.params.id || "").trim();
    if (!rawId) {
      res.status(400).json({ error: "ID de usuario requerido" });
      return;
    }
    const cleanId = rawId.toLowerCase().replace("@", "");

    if (mongoose.connection.readyState === 1) {
      await MongoUser.deleteMany({
        $or: [
          { id: rawId },
          { id: cleanId },
          { username: rawId },
          { username: cleanId }
        ]
      });
    }

    console.log(`🛡️ Admin deleted user ${rawId}`);
    res.json({ success: true, message: `Usuario ${rawId} eliminado exitosamente` });
  } catch (err: any) {
    console.error("❌ Error deleting user as admin:", err);
    res.status(500).json({ error: "Error al eliminar usuario", details: err.message });
  }
}
