import { Request, Response } from "express";
import mongoose from "mongoose";
import { bucket, bucketName } from "../config/storage";
import { uploadToGCS, saveToLocalStorage, deleteFullPublicationMedia } from "../services/mediaStorage";
import { hlsQueue, transcodeVideoToLocalHlsDirect } from "../hlsTranscoder";
import { generateId } from "../utils/helpers";
import { MongoUser, MongoReel, MongoPublicacion } from "../models";
import { reels, setReels, broadcastToAll } from "../services/state";

/**
 * Upload file to Google Cloud Storage & register in MongoDB.
 * Videos: HLS ONLY. The original video is never persisted to GCS.
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
    // IMÁGENES / ARCHIVOS NO-VIDEO
    // ------------------------------------------------------------
    if (!isVideo) {
      let publicUrl = "";
      try {
        publicUrl = await uploadToGCS(req.file, "publicaciones");
      } catch (imgErr) {
        console.warn("⚠️ Error subiendo imagen a GCS, usando almacenamiento local:", imgErr);
        publicUrl = await saveToLocalStorage(req.file.buffer, "publicaciones", originalName);
      }

      res.json({
        success: true,
        message: "Archivo subido exitosamente.",
        url: publicUrl,
        hlsUrl: undefined,
        jobId: undefined,
        publicacion: { id: pubId, url: publicUrl }
      });
      return;
    }

    // ------------------------------------------------------------
    // VIDEO (HLS ONLY)
    // ------------------------------------------------------------
    const jobId = "hls_" + generateId();
    console.log(`🎬 [HLS ONLY] Procesando video ${originalName}`);

    let hlsUrl = "";
    let latencyMs = 0;
    let totalSegments = 1;
    let durationSec: number | undefined = undefined;

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
      latencyMs = hlsResult.latencyMs;
      totalSegments = hlsResult.totalSegments;
      durationSec = hlsResult.durationSec;
    } catch (queueErr: any) {
      console.warn("⚠️ [HLS ONLY] Cola HLS falló, ejecutando transcodificación directa local:", queueErr?.message);
      hlsUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, originalName);
    }

    if (!hlsUrl) {
      hlsUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, originalName);
    }

    console.log(`✅ [HLS ONLY] HLS generado: ${hlsUrl}`);

    const posterUrl = `/uploads/hls/${pubId}/poster.jpg`;

    res.json({
      success: true,
      message: "Video convertido a HLS correctamente.",
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
    console.error("❌ [HLS ONLY] Error en el proceso de upload:", error);

    if (req.file?.buffer) {
      try {
        const mimeType = (req.file.mimetype || "").toLowerCase();
        const originalName = req.file.originalname || "upload";
        const isVideo =
          mimeType.startsWith("video/") ||
          /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(originalName);

        if (isVideo) {
          let emergencyUrl = "";
          try {
            emergencyUrl = await transcodeVideoToLocalHlsDirect(req.file.buffer, pubId, originalName);
          } catch (tErr) {
            emergencyUrl = await saveToLocalStorage(req.file.buffer, "videos", originalName);
          }
          res.json({
            success: true,
            message: "Video procesado exitosamente.",
            url: emergencyUrl,
            hlsUrl: emergencyUrl.endsWith(".m3u8") ? emergencyUrl : undefined,
            videoUrl: emergencyUrl,
            jobId: "job_emergency_" + generateId(),
            publicacion: null
          });
          return;
        } else {
          const localImgUrl = await saveToLocalStorage(req.file.buffer, "publicaciones", originalName);
          res.json({
            success: true,
            message: "Archivo subido exitosamente.",
            url: localImgUrl,
            jobId: undefined,
            publicacion: null
          });
          return;
        }
      } catch (fatalErr: any) {
        console.error("❌ Fatal fallback error:", fatalErr);
      }
    }

    res.status(400).json({
      error: "No se pudo procesar el archivo recibido. Por favor, verifica el archivo e inténtalo nuevamente.",
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
