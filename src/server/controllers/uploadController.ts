import { Request, Response } from "express";
import mongoose from "mongoose";
import { bucket, bucketName, isGcsAvailable } from "../config/storage";
import { uploadToGCS, deleteFullPublicationMedia } from "../services/mediaStorage";
import { hlsQueue, transcodeVideoToLocalHlsDirect } from "../hlsTranscoder";
import { generateId } from "../utils/helpers";
import { MongoUser, MongoReel, MongoPublicacion, MongoProduct } from "../models";
import { reels, setReels, broadcastToAll } from "../services/state";

/**
 * Upload file to Google Cloud Storage & register in MongoDB.
 * Videos: HLS ONLY uploaded directly to GCS. Zero local storage.
 */
export async function processUploadHlsOnly(req: any, res: any): Promise<void> {
  const pubId = "pub_" + generateId();
  try {
    if (!req.file || !req.file.buffer) {
      res.status(400).json({ error: "No se proporcionó ningún archivo para procesar" });
      return;
    }

    const { title, description, creatorId } = req.body || {};
    const mimeType = (req.file.mimetype || "").toLowerCase();
    const originalName = req.file.originalname || "upload";
    const isVideo =
      mimeType.startsWith("video/") ||
      /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(originalName);

    // ------------------------------------------------------------
    // IMÁGENES / ARCHIVOS NO-VIDEO (GCS EXCLUSIVO)
    // ------------------------------------------------------------
    if (!isVideo) {
      const targetFolder = (req.body?.folder as string)?.trim() || "publicaciones";
      const publicUrl = await uploadToGCS(req.file, targetFolder);

      let createdPub: any = null;
      if (mongoose.connection.readyState === 1) {
        try {
          createdPub = await MongoPublicacion.create({
            id: pubId,
            url: publicUrl,
            imageUrl: publicUrl,
            title: title || originalName,
            description: description || "Imagen subida a la nube",
            creatorId: creatorId || req.body.creatorId || "current_user",
            createdAt: new Date(),
          });
        } catch (dbErr) {
          console.warn("⚠️ Error guardando publicación de imagen en MongoDB:", dbErr);
        }
      }

      res.json({
        success: true,
        message: "Archivo subido exitosamente a Google Cloud Storage y registrado en MongoDB Atlas.",
        url: publicUrl,
        imageUrl: publicUrl,
        hlsUrl: undefined,
        jobId: undefined,
        publicacion: createdPub || { id: pubId, url: publicUrl, imageUrl: publicUrl }
      });
      return;
    }

    // ------------------------------------------------------------
    // VIDEO (HLS ONLY - GCS EXCLUSIVO CON FALLBACK NUBE MONGODB GRIDFS)
    // ------------------------------------------------------------
    const jobId = "hls_" + generateId();
    console.log(`🎬 [Upload Video] Procesando video ${originalName}`);

    let hlsUrl = "";
    let latencyMs = 0;
    let totalSegments = 1;
    let durationSec: number | undefined = undefined;
    let posterUrl = "";

    const gcsReady = await isGcsAvailable();
    if (gcsReady) {
      try {
        const hlsResult = await hlsQueue.enqueueAndWait(
          jobId,
          req.file.buffer,
          originalName,
          bucket,
          bucketName,
          {
            publicacionId: pubId
          }
        );

        hlsUrl = hlsResult.masterM3u8Url;
        posterUrl = hlsResult.posterUrl || "";
        latencyMs = hlsResult.latencyMs;
        totalSegments = hlsResult.totalSegments;
        durationSec = hlsResult.durationSec;
      } catch (queueErr: any) {
        console.warn("⚠️ [HLS] Cola HLS falló, intentando transcodificación directa a GCS:", queueErr?.message);
        try {
          hlsUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, originalName);
        } catch {}
      }
    }

    // If GCS was unavailable or upload to GCS failed, store video in MongoDB Atlas GridFS (persistent cloud storage, zero local disk)
    if (!hlsUrl || !hlsUrl.startsWith("https://storage.googleapis.com/")) {
      console.log(`☁️ [Video Cloud Storage] Almacenando video en la nube en MongoDB Atlas GridFS: ${originalName}`);
      const { saveMediaToMongoGridFS } = await import("../services/mongoGridFs");
      const gridVideo = await saveMediaToMongoGridFS(req.file.buffer, originalName, req.file.mimetype || "video/mp4");
      hlsUrl = gridVideo.url;
      posterUrl = gridVideo.url;
    }

    console.log(`✅ [Upload Video] Video procesado y almacenado en la nube con éxito: ${hlsUrl}`);

    if (!posterUrl) {
      posterUrl = hlsUrl.replace(/\/(?:master|index)\.m3u8.*$/, "/poster.jpg");
    }

    // Save publication in MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoPublicacion.create({
          id: pubId,
          url: hlsUrl,
          hlsUrl,
          title: originalName,
          description: req.body.description || "Video subido a la nube",
          creatorId: req.body.creatorId || "current_user",
          createdAt: new Date(),
        });
      } catch (dbErr) {
        console.warn("⚠️ Error guardando publicación en MongoDB:", dbErr);
      }
    }

    res.json({
      success: true,
      message: "Video procesado y subido a almacenamiento en la nube correctamente.",
      url: hlsUrl,
      hlsUrl,
      thumbnailUrl: posterUrl,
      jobId,
      publicacion: { id: pubId, url: hlsUrl, hlsUrl, thumbnailUrl: posterUrl },
      hlsStats: {
        latencyMs,
        totalSegments,
        durationSec
      }
    });
  } catch (error: any) {
    console.error("❌ [Upload Video] Error en el proceso de upload:", error);
    res.status(500).json({
      error: "Error al procesar y subir archivo a Google Cloud Storage",
      details: error?.message || "Error desconocido"
    });
  }
}

/**
 * GET /api/hls/telemetry
 */
export function getHlsTelemetry(req: Request, res: Response): void {
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
}

/**
 * DELETE /api/reels/:id & DELETE /api/publicaciones/:id
 */
export async function deletePublicationMedia(req: Request, res: Response): Promise<void> {
  try {
    const targetId = req.params.id;
    if (!targetId) {
      res.status(400).json({ error: "ID is required" });
      return;
    }

    console.log(`🗑️ [Batch Cleanup] Deleting publication / reel ${targetId}...`);

    const isObjectId = mongoose.Types.ObjectId.isValid(targetId) && String(targetId).length === 24;
    const mongoQuery = isObjectId ? { $or: [{ id: targetId }, { _id: targetId }] } : { id: targetId };

    let existingReel = reels.find(r => r.id === targetId);
    let existingPub: any = null;
    if (mongoose.connection.readyState === 1) {
      try {
        if (!existingReel) existingReel = await MongoReel.findOne(mongoQuery);
        existingPub = await MongoPublicacion.findOne(mongoQuery);

        if (existingReel && !existingPub && (existingReel.hlsUrl || existingReel.videoUrl)) {
          const matchUrl = existingReel.hlsUrl || existingReel.videoUrl;
          existingPub = await MongoPublicacion.findOne({
            $or: [{ hlsUrl: matchUrl }, { url: matchUrl }]
          });
        }
        if (existingPub && !existingReel && (existingPub.hlsUrl || existingPub.url)) {
          const matchUrl = existingPub.hlsUrl || existingPub.url;
          existingReel = await MongoReel.findOne({
            $or: [{ hlsUrl: matchUrl }, { videoUrl: matchUrl }]
          });
        }
      } catch {}
    }

    const mediaToDelete = [
      existingReel?.videoUrl,
      existingReel?.hlsUrl,
      existingReel?.thumbnailUrl,
      existingPub?.url,
      existingPub?.hlsUrl,
      existingPub?.thumbnailUrl,
      ...(Array.isArray(existingReel?.images) ? existingReel.images : []),
      ...(Array.isArray(existingPub?.images) ? existingPub.images : []),
    ];

    // 1. Batch delete all GCS and local media files
    const cleanupStats = await deleteFullPublicationMedia(mediaToDelete);

    const deleteIds = Array.from(new Set([targetId, existingReel?.id, existingPub?.id].filter(Boolean)));
    const validMediaUrls = mediaToDelete.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    const mediaQuery = validMediaUrls.length > 0 ? [
      { videoUrl: { $in: validMediaUrls } },
      { url: { $in: validMediaUrls } },
      { hlsUrl: { $in: validMediaUrls } }
    ] : [];

    // 2. Remove from MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.deleteMany({
          $or: [mongoQuery, { id: { $in: deleteIds } }, ...mediaQuery]
        });
        await MongoPublicacion.deleteMany({
          $or: [mongoQuery, { id: { $in: deleteIds } }, ...mediaQuery]
        });
        console.log(`💾 Deleted ${deleteIds.join(", ")} from MongoDB`);
      } catch (dbErr) {
        console.error("Error deleting from MongoDB:", dbErr);
      }
    }

    // 3. Remove from in-memory reels array
    const updatedReels = reels.filter(r => !deleteIds.includes(r.id) && !validMediaUrls.includes(r.videoUrl || ""));
    setReels(updatedReels);

    // 4. Broadcast deletion to all clients
    deleteIds.forEach((delId) => {
      broadcastToAll({
        type: "reel_deleted",
        reelId: delId
      });
    });

    res.json({
      success: true,
      message: `Publicación eliminada correctamente del proyecto completo (MongoDB, GCS y almacenamiento local).`,
      deletedId: targetId,
      cleanupStats,
    });
  } catch (err: any) {
    console.error("❌ Error deleting publication with batch cleanup:", err);
    res.status(500).json({ error: "Failed to delete publication", details: err.message });
  }
}

/**
 * POST /api/upload-avatar & /upload-avatar
 */
export async function uploadAvatar(req: any, res: any): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se subió archivo" });
      return;
    }

    const userId = req.body.userId || "current_user";
    console.log(`🚀 Iniciando subida de avatar para el usuario: ${userId}`);
    const publicUrl = await uploadToGCS(req.file, "avatars");
    console.log(`✅ Avatar subido con éxito a GCS: ${publicUrl}`);

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
}

/**
 * POST /api/upload-cover & /upload-cover
 */
export async function uploadCover(req: any, res: any): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se subió archivo" });
      return;
    }

    const userId = req.body.userId || "current_user";
    console.log(`🚀 Iniciando subida de portada para el usuario: ${userId}`);
    const publicUrl = await uploadToGCS(req.file, "covers");
    console.log(`✅ Portada subida con éxito a GCS: ${publicUrl}`);

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
}

/**
 * POST /api/products/upload-image & /upload-product-image
 * Upload product media directly to Google Cloud Storage (elegan-bucket) under 'productos/'
 * and register/update in MongoDB Atlas.
 */
export async function uploadProductImage(req: any, res: any): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No se proporcionó ningún archivo de imagen para el producto." });
      return;
    }

    console.log(`🛍️ [Product Upload] Subiendo foto de producto a GCS (elegan-bucket/productos)...`);
    const publicUrl = await uploadToGCS(file, "productos");
    console.log(`✅ [Product Upload] Foto subida exitosamente: ${publicUrl}`);

    const productId = req.body?.productId;
    let updatedProduct: any = null;

    if (productId && mongoose.connection.readyState === 1) {
      try {
        const isObjectId = mongoose.Types.ObjectId.isValid(productId) && String(productId).length === 24;
        const query = isObjectId ? { $or: [{ id: productId }, { _id: productId }] } : { id: productId };
        updatedProduct = await MongoProduct.findOneAndUpdate(
          query,
          { $set: { imageUrl: publicUrl } },
          { returnDocument: "after" }
        );
      } catch (dbErr: any) {
        console.warn("⚠️ Aviso al actualizar imagen de producto en MongoDB:", dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Imagen de producto almacenada con éxito en Google Cloud Storage.",
      imageUrl: publicUrl,
      url: publicUrl,
      product: updatedProduct || undefined,
    });
  } catch (err: any) {
    console.error("❌ Error al subir imagen de producto:", err);
    res.status(500).json({ error: "Error al subir la imagen del producto", details: err.message });
  }
}

/**
 * GET /api/v1/media/upload-url & /api/media/upload-url
 * Generates a V4 PUT signed URL for Google Cloud Storage so the client can upload directly to GCS.
 */
export async function generateUploadSignedUrl(req: Request, res: Response): Promise<void> {
  try {
    const folder = (req.query.folder as string)?.trim() || "publicaciones";
    const fileType = (req.query.file_type as string)?.trim() || (req.query.contentType as string)?.trim() || "image/jpeg";
    const fileNameParam = (req.query.file_name as string)?.trim() || (req.query.filename as string)?.trim();

    // Determine extension
    let extension = "";
    if (fileNameParam && fileNameParam.includes(".")) {
      extension = fileNameParam.split(".").pop() || "";
    }
    if (!extension) {
      extension = fileType.split("/").pop()?.split(";")[0]?.trim() || "bin";
    }
    if (extension === "jpeg") extension = "jpg";

    const uniqueKey = `${folder}/${Date.now()}-${generateId()}.${extension}`;
    const fileBlob = bucket.file(uniqueKey);

    const [signedUrl] = await fileBlob.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: fileType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueKey}`;

    res.json({
      upload_url: signedUrl,
      public_url: publicUrl,
      file_key: uniqueKey,
      bucket: bucketName,
      expiresInMinutes: 15,
      method: "PUT",
    });
  } catch (err: any) {
    console.error("❌ Error generating GCS signed URL:", err);
    res.status(500).json({
      error: "Error al generar URL firmada de Google Cloud Storage",
      details: err.message || "Error desconocido",
    });
  }
}

/**
 * POST /api/v1/posts & /api/posts & /api/v1/publicaciones & /api/publicaciones
 * Saves a new post to MongoDB and registers in the feed after direct GCS upload.
 */
export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    const {
      caption,
      media_url,
      media_type,
      title,
      description,
      creatorId,
      creatorUsername,
      creatorName,
      creatorAvatar,
      thumbnailUrl,
      hlsUrl
    } = req.body || {};

    if (!media_url) {
      res.status(400).json({ error: "media_url es requerido para crear una publicación" });
      return;
    }

    const resolvedCaption = caption || description || title || "";
    const resolvedType = media_type || (media_url.endsWith(".m3u8") || media_url.includes("video") ? "video" : "image");
    const postId = "pub_" + generateId();
    const createdAt = new Date();

    let resolvedCreatorId = creatorId || (req.headers["x-user-id"] as string) || "current_user";
    let resolvedCreatorUsername = creatorUsername || (req.headers["x-user-username"] as string) || "usuario";
    let resolvedCreatorName = creatorName || resolvedCreatorUsername;
    let resolvedCreatorAvatar = creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

    // Attempt to lookup creator in Mongo if possible
    if (mongoose.connection.readyState === 1 && resolvedCreatorId) {
      try {
        const foundUser = await MongoUser.findOne({
          $or: [{ id: resolvedCreatorId }, { username: resolvedCreatorUsername }],
        });
        if (foundUser) {
          resolvedCreatorId = foundUser.id;
          resolvedCreatorUsername = foundUser.username;
          resolvedCreatorName = foundUser.name || foundUser.username;
          if (foundUser.avatar) resolvedCreatorAvatar = foundUser.avatar;
        }
      } catch {}
    }

    let insertedMongoId = postId;

    // 1. Save in MongoPublicacion
    if (mongoose.connection.readyState === 1) {
      try {
        const pubDoc = await MongoPublicacion.create({
          id: postId,
          url: media_url,
          hlsUrl: hlsUrl || (resolvedType === "video" ? media_url : undefined),
          title: title || resolvedCaption,
          description: resolvedCaption,
          creatorId: resolvedCreatorId,
          createdAt: createdAt,
          caption: resolvedCaption,
          media_url: media_url,
          media_type: resolvedType,
        });
        if (pubDoc?._id) {
          insertedMongoId = pubDoc._id.toString();
        }
      } catch (dbErr) {
        console.warn("⚠️ Error saving post to MongoPublicacion:", dbErr);
      }
    }

    // 2. Also register in MongoReel so that it integrates seamlessly into reels, home feeds, and profile
    const reelData = {
      id: postId,
      title: title || resolvedCaption,
      description: resolvedCaption,
      videoUrl: resolvedType === "video" ? media_url : "",
      thumbnailUrl: thumbnailUrl || (resolvedType === "image" ? media_url : ""),
      creatorId: resolvedCreatorId,
      creatorUsername: resolvedCreatorUsername,
      creatorName: resolvedCreatorName,
      creatorAvatar: resolvedCreatorAvatar,
      type: resolvedType,
      images: resolvedType === "image" ? [media_url] : [],
      media: [{
        type: resolvedType,
        url: media_url,
        hlsUrl: hlsUrl || (resolvedType === "video" ? media_url : undefined),
        thumbnailUrl: thumbnailUrl || (resolvedType === "image" ? media_url : undefined),
      }],
      hlsUrl: hlsUrl || (resolvedType === "video" ? media_url : undefined),
      likes: 0,
      likedBy: [],
      views: 0,
      shares: 0,
      saves: 0,
      comments: [],
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoReel.findOneAndUpdate({ id: postId }, reelData, { upsert: true, returnDocument: "after" });
      } catch (reelErr) {
        console.warn("⚠️ Error registering post in MongoReel:", reelErr);
      }
    }

    // Update in-memory state & broadcast to all connected clients
    const currentReels = [reelData as any, ...reels];
    const uniqueReels = currentReels.filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx);
    setReels(uniqueReels);

    broadcastToAll({
      type: "reel_created",
      reel: reelData,
    });

    res.status(201).json({
      id: insertedMongoId,
      status: "success",
      post: {
        id: postId,
        _id: insertedMongoId,
        caption: resolvedCaption,
        media_url: media_url,
        media_type: resolvedType,
        created_at: createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("❌ Error creating post:", err);
    res.status(500).json({ error: "Error al guardar publicación en la base de datos", details: err.message });
  }
}

/**
 * GET /api/v1/feed & /api/feed
 * Retrieves published posts sorted chronologically by creation date descending.
 */
export async function getFeed(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    let posts: any[] = [];

    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await MongoPublicacion.find().sort({ createdAt: -1 }).limit(limit).lean();
        if (docs && docs.length > 0) {
          posts = docs.map((doc: any) => ({
            _id: doc._id?.toString() || doc.id,
            id: doc.id || doc._id?.toString(),
            caption: doc.description || doc.title || doc.caption || "",
            media_url: doc.url || doc.media_url || doc.hlsUrl || "",
            media_type: doc.media_type || (doc.url?.endsWith(".m3u8") || doc.url?.includes("video") ? "video" : "image"),
            created_at: doc.createdAt || new Date(),
            creatorId: doc.creatorId,
            thumbnailUrl: doc.thumbnailUrl,
            hlsUrl: doc.hlsUrl,
          }));
        }
      } catch (err) {
        console.warn("⚠️ Error fetching from MongoPublicacion:", err);
      }
    }

    // Blend with in-memory reels if posts is empty
    if (posts.length === 0) {
      posts = reels.slice(0, limit).map((r) => ({
        _id: r.id,
        id: r.id,
        caption: r.description || r.title || "",
        media_url: r.videoUrl || r.hlsUrl || (r.images && r.images[0]) || r.thumbnailUrl || "",
        media_type: r.type === "image" || r.type === "carousel" ? "image" : "video",
        created_at: (r as any).createdAt || new Date(),
        creatorId: r.creatorId,
        creatorUsername: r.creatorUsername,
        creatorAvatar: r.creatorAvatar,
        thumbnailUrl: r.thumbnailUrl,
        hlsUrl: r.hlsUrl,
      }));
    }

    res.json({ posts });
  } catch (err: any) {
    console.error("❌ Error fetching feed:", err);
    res.status(500).json({ error: "Error al obtener feed", details: err.message });
  }
}
