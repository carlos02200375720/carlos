import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoReel } from "../models";
import { Comment } from "../../types";
import { generateId } from "../utils/helpers";
import { formatReelDTO } from "../utils/reelUtils";
import { getCanonicalReelsFromMongo, saveCanonicalReelToMongo } from "../services/reelService";
import { resolveAuthenticatedUser, hasSellerPermission } from "./userController";
import {
  reels,
  setReels,
  activeOriginalUserId,
  broadcastToAll,
} from "../services/state";

/**
 * GET /api/reels
 * Get all canonical reels (single source of truth directly from MongoReel)
 */
export async function getReels(req: Request, res: Response): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1) {
      const canonicalReels = await getCanonicalReelsFromMongo();
      if (canonicalReels.length > 0) {
        setReels(canonicalReels);
      }
    }
    const currentReels = reels;
    const seen = new Set<string>();
    const uniqueReels = currentReels
      .map((r) => formatReelDTO(r))
      .filter((r) => {
        if (!r.id || seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
    res.json(uniqueReels);
  } catch (err: any) {
    console.error("❌ Error in GET /api/reels:", err);
    res.status(500).json({ error: "Error al obtener reels", details: err.message });
  }
}

/**
 * POST /api/reels/:id/like
 * Like a reel (1 like per user - toggle behavior with user isolation)
 */
export async function likeReel(req: Request, res: Response): Promise<void> {
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

  const userIdentifiers = new Set<string>();
  if (userId && userId !== "current_user") userIdentifiers.add(userId);
  if (username && username !== "invitado") userIdentifiers.add(username);
  if (activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user") {
    userIdentifiers.add(activeOriginalUserId);
  }
  if (userIdentifiers.size === 0) {
    userIdentifiers.add(userId || "current_user");
  }

  const alreadyLiked = reel.likedBy.some((id) => userIdentifiers.has(id));

  let isLiked = false;
  if (alreadyLiked) {
    reel.likedBy = reel.likedBy.filter((id) => !userIdentifiers.has(id));
    isLiked = false;
  } else {
    const primaryIdentifier =
      activeOriginalUserId && activeOriginalUserId !== "user_guest" && activeOriginalUserId !== "current_user"
        ? activeOriginalUserId
        : username && username !== "invitado"
        ? username
        : userId || "current_user";

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

  broadcastToAll({
    type: "reel_updated",
    reelId: reel.id,
    likes: reel.likes,
    likedBy: reel.likedBy,
    commentsCount: reel.comments.length,
  });

  res.json({ success: true, likes: reel.likes, likedBy: reel.likedBy, isLiked });
}

/**
 * POST /api/reels/:id/comment
 * Post a comment on a reel
 */
export async function commentReel(req: Request, res: Response): Promise<void> {
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

  broadcastToAll({
    type: "reel_updated",
    reelId: reel.id,
    likes: reel.likes,
    commentsCount: reel.comments.length,
    newComment: newComment,
  });

  res.json(newComment);
}

/**
 * POST /api/reels/:id/view
 * Record a view on a reel
 */
export async function viewReel(req: Request, res: Response): Promise<void> {
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
}

/**
 * POST /api/reels/:id/share
 * Record a share on a reel
 */
export async function shareReel(req: Request, res: Response): Promise<void> {
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
}

/**
 * POST /api/reels
 * Create a new publication (video, image, or carousel)
 */
export async function createReel(req: any, res: any): Promise<void> {
  try {
    const {
      title,
      videoUrl,
      thumbnailUrl,
      description,
      type,
      images,
      media,
      productId,
      taggedProductId,
      hlsUrl,
      aspectRatio,
    } = req.body;

    const creator = await resolveAuthenticatedUser(req, "creator");

    if (!creator || creator.isGuest || creator.username === "invitado" || creator.username === "guest") {
      res.status(403).json({ error: "Debes iniciar sesión con una cuenta para poder realizar publicaciones." });
      return;
    }

    if (!hasSellerPermission(creator)) {
      res.status(403).json({ error: "Tu cuenta no tiene permiso para publicar. Solicita al superadministrador que active el permiso de vendedor." });
      return;
    }

    const resolvedHlsUrl = hlsUrl || undefined;

    const rawReelData = {
      id: "reel_" + generateId(),
      title: (title || "").trim(),
      videoUrl: videoUrl || "",
      thumbnailUrl: thumbnailUrl && !thumbnailUrl.includes("1618005182384") ? thumbnailUrl : "",
      description: description || "",
      creatorId: creator.id,
      creatorName: creator.name || creator.username,
      creatorUsername: creator.username,
      creatorAvatar:
        creator.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      productId: productId || taggedProductId || undefined,
      type:
        type ||
        (productId || taggedProductId
          ? "product"
          : videoUrl
          ? "video"
          : images?.length > 1
          ? "carousel"
          : "image"),
      images: images || [],
      media: media || undefined,
      hlsUrl: resolvedHlsUrl,
      aspectRatio: aspectRatio || "vertical",
    };

    const newReel = await saveCanonicalReelToMongo(rawReelData);

    // Add to memory list
    const currentReels = [newReel, ...reels];
    const unique = currentReels.filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx);
    setReels(unique);

    console.log(`💾 Saved publication ${newReel.id} to MongoReel in Atlas`);

    broadcastToAll({
      type: "reel_created",
      reel: newReel,
    });

    res.status(201).json({ success: true, reel: newReel });
  } catch (err: any) {
    console.error("Error creating publication:", err);
    res.status(500).json({ error: "Error al crear la publicación", details: err.message });
  }
}
