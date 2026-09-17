import mongoose from "mongoose";
import { MongoReel } from "../models/Reel";
import { MongoPublicacion } from "../models/Publicacion";
import { MongoUser } from "../models/User";
import { formatReelDTO } from "../utils/reelUtils";
import { Reel } from "../../types";

let migrationRan = false;

/**
 * Builds a fast lookup map for MongoDB users by id, username, and _id string.
 */
export async function buildUserMap(): Promise<Map<string, any>> {
  const userMap = new Map<string, any>();
  if (mongoose.connection.readyState !== 1) {
    return userMap;
  }
  try {
    const dbUsers = await MongoUser.find();
    dbUsers.forEach((u: any) => {
      if (u.id) userMap.set(u.id, u);
      if (u.username) userMap.set(u.username.toLowerCase(), u);
      if (u._id) userMap.set(u._id.toString(), u);
    });
  } catch (err) {
    console.warn("⚠️ [reelService] Could not build userMap from MongoUser:", err);
  }
  return userMap;
}

/**
 * Migrates any legacy publications from `MongoPublicacion` into `MongoReel`.
 * Guarantees that MongoReel is the single canonical source of truth for all reels.
 */
export async function syncLegacyPublicacionesToMongoReel(userMap?: Map<string, any>): Promise<number> {
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  try {
    const legacyPubs = await MongoPublicacion.find();
    if (!legacyPubs || legacyPubs.length === 0) {
      return 0;
    }

    const resolvedUserMap = userMap || (await buildUserMap());
    let migratedCount = 0;

    for (const pub of legacyPubs) {
      const pubId = pub.id || pub._id?.toString();
      if (!pubId) continue;

      const canonicalId = pubId.startsWith("reel_") ? pubId : `reel_${pubId}`;
      const pubUrl = pub.url || "";
      const pubHlsUrl = pub.hlsUrl || "";

      const existing = await MongoReel.findOne({
        $or: [
          { id: canonicalId },
          { id: pubId },
          ...(pubUrl ? [{ videoUrl: pubUrl }, { hlsUrl: pubUrl }, { thumbnailUrl: pubUrl }] : []),
          ...(pubHlsUrl ? [{ hlsUrl: pubHlsUrl }, { videoUrl: pubHlsUrl }] : [])
        ]
      });

      if (existing) {
        continue;
      }

      const isVideo = Boolean(
        pubHlsUrl ||
        /\.(m3u8|mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts)$/i.test(pubUrl) ||
        pubUrl.includes("/videos/") ||
        pubUrl.includes("hls_")
      );

      const creator = resolvedUserMap.get(pub.creatorId) ||
        (pub.creatorId ? resolvedUserMap.get(pub.creatorId.toLowerCase()) : null);

      const canonicalReel = formatReelDTO({
        id: canonicalId,
        title: pub.title || "",
        description: pub.description || "",
        videoUrl: isVideo ? (pubHlsUrl || pubUrl) : "",
        hlsUrl: pubHlsUrl || (pubUrl.includes(".m3u8") ? pubUrl : undefined),
        thumbnailUrl: !isVideo ? pubUrl : (pub.thumbnailUrl || ""),
        type: isVideo ? "video" : "image",
        images: !isVideo && pubUrl ? [pubUrl] : [],
        creatorId: creator ? creator.id : (pub.creatorId || "creator"),
        creatorName: creator ? creator.name : "Creador",
        creatorUsername: creator ? creator.username : undefined,
        creatorAvatar: creator?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        likes: pub.likes || 0,
        views: pub.views || 0,
        createdAt: pub.createdAt || new Date()
      }, resolvedUserMap);

      await MongoReel.findOneAndUpdate(
        { id: canonicalReel.id },
        { $set: canonicalReel },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      migratedCount++;
    }

    if (migratedCount > 0) {
      console.log(`📦 [reelService] Sincronizadas y migradas ${migratedCount} publicaciones legacy de MongoPublicacion a MongoReel exitosamente.`);
    }

    return migratedCount;
  } catch (err) {
    console.error("❌ [reelService] Error sincronizando publicaciones legacy:", err);
    return 0;
  }
}

/**
 * Fetches the canonical list of reels directly from MongoReel,
 * normalizing every item with formatReelDTO.
 */
export async function getCanonicalReelsFromMongo(userMap?: Map<string, any>): Promise<Reel[]> {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  // Ensure legacy publications are available in the canonical collection.
  // This is intentionally re-entrant so publications created after server startup
  // are also migrated when either client refreshes the feed.
  if (!migrationRan) {
    migrationRan = true;
  }
  await syncLegacyPublicacionesToMongoReel(userMap);

  const resolvedUserMap = userMap || (await buildUserMap());
  const dbReels = await MongoReel.find().sort({ _id: -1 });

  const seenReelIds = new Set<string>();
  const uniqueDbReels = dbReels.filter((r: any) => {
    if (!r.id || seenReelIds.has(r.id)) return false;
    seenReelIds.add(r.id);
    return true;
  });

  return uniqueDbReels.map((r: any) => formatReelDTO(r, resolvedUserMap));
}

/**
 * Saves a publication or reel transactionally to MongoReel.
 * Throws if MongoDB is unavailable or the write fails, preventing ghost publications.
 */
export async function saveCanonicalReelToMongo(reelData: any, userMap?: Map<string, any>): Promise<Reel> {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB no está conectado; la publicación no fue guardada.");
  }

  const formattedReel = formatReelDTO(reelData, userMap);

  await MongoReel.findOneAndUpdate(
    { id: formattedReel.id },
    { $set: formattedReel },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  console.log(`💾 [reelService] Transaccionalmente guardado Reel ${formattedReel.id} en MongoReel`);
  return formattedReel;
}

/**
 * Fetches publications for a specific user directly from MongoReel.
 */
export async function getUserCanonicalReelsFromMongo(
  userIdentifiers: Set<string>,
  userMap?: Map<string, any>
): Promise<Reel[]> {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const idList = Array.from(userIdentifiers).filter(Boolean);
  if (idList.length === 0) return [];

  const dbReels = await MongoReel.find({
    $or: [
      { creatorId: { $in: idList } },
      { creatorUsername: { $in: idList.map(i => i.toLowerCase()) } }
    ]
  }).sort({ _id: -1 });

  const resolvedUserMap = userMap || (await buildUserMap());
  const seenIds = new Set<string>();
  const unique = dbReels.filter((r: any) => {
    if (!r.id || seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  return unique.map((r: any) => {
    const dto = formatReelDTO(r, resolvedUserMap);
    if ((!r.thumbnailUrl || r.thumbnailUrl.includes("1618005182384") || r.thumbnailUrl.endsWith(".m3u8")) && dto.thumbnailUrl && r._id) {
      MongoReel.updateOne({ _id: r._id }, { $set: { thumbnailUrl: dto.thumbnailUrl } }).catch(() => {});
    }
    return dto;
  });
}
