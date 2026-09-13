import { bucket, bucketName } from "../config/storage";
import { optimizeVideoToH264 } from "../hlsTranscoder";

const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper: Upload file to GCS (with H.264 mobile optimization for all videos)
export const uploadToGCS = async (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  let originalName = file.originalname.replace(/\s+/g, "_");
  const mimeType = file.mimetype.toLowerCase();

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
      if (mimeType.includes("png")) originalName += ".png";
      else if (mimeType.includes("webp")) originalName += ".webp";
      else if (mimeType.includes("gif")) originalName += ".gif";
      else if (mimeType.includes("svg")) originalName += ".svg";
      else if (mimeType.includes("avif")) originalName += ".avif";
      else if (mimeType.includes("heic")) originalName += ".heic";
      else if (mimeType.includes("heif")) originalName += ".heif";
      else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) originalName += ".jpeg";
      else originalName += ".jpeg";
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

    blobStream.on("error", (err) => reject(err));
    blobStream.on("finish", () => {
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
      resolve(publicUrl);
    });
    blobStream.end(file.buffer);
  });
};

// Helper: Upload base64 data URL to GCS
export async function uploadBase64ToGCS(base64Str: string, folder: string = "profiles"): Promise<string> {
  if (!base64Str || !base64Str.startsWith("data:")) return base64Str;

  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return base64Str;

  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  let extension = "jpg";
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime.includes("png")) extension = "png";
  else if (lowerMime.includes("webp")) extension = "webp";
  else if (lowerMime.includes("gif")) extension = "gif";
  else if (lowerMime.includes("svg")) extension = "svg";
  else if (lowerMime.includes("avif")) extension = "avif";
  else if (lowerMime.includes("heic")) extension = "heic";
  else if (lowerMime.includes("heif")) extension = "heif";
  else if (lowerMime.includes("jpeg") || lowerMime.includes("jpg")) extension = "jpeg";

  const filename = `${Date.now()}-${generateId()}.${extension}`;
  const blob = bucket.file(`${folder}/${filename}`);

  return new Promise<string>((resolve, reject) => {
    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: { contentType: mimeType },
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
export async function deleteFromGCS(fileUrl?: string): Promise<void> {
  try {
    if (!fileUrl || typeof fileUrl !== "string" || !fileUrl.includes(`storage.googleapis.com/${bucketName}/`)) return;

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
