import { bucket, bucketName, isGcsAvailable } from "../config/storage";

const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper: Upload file exclusively to GCS (with HLS stream conversion for all videos). No local storage allowed.
export const uploadToGCS = async (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  let originalName = file.originalname.replace(/\s+/g, "_");
  const mimeType = file.mimetype.toLowerCase();

  const isVideo = mimeType.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(originalName);
  if (isVideo) {
    console.log(`🎬 [Upload] Transcodificando video a formato HLS exclusivo (.m3u8) para GCS: ${originalName}...`);
    const { transcodeVideoToHLS } = await import("../hlsTranscoder");
    const hlsRes = await transcodeVideoToHLS(file.buffer, generateId(), bucket, bucketName);
    return hlsRes.masterM3u8Url;
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
    try {
      const blob = bucket.file(`${folder}/${uniqueName}`);

      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype || "application/octet-stream",
          cacheControl: "public, max-age=86400",
        },
      });

      blobStream.on("error", (err: any) => {
        console.error(`❌ [Upload] Error subiendo archivo a Google Cloud Storage (${bucketName}):`, err);
        reject(new Error(`Fallo al subir a Google Cloud Storage: ${err?.message || "Error desconocido"}`));
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    } catch (createErr: any) {
      console.error(`❌ [Upload] No se pudo inicializar stream de GCS (${createErr.message})`);
      reject(createErr);
    }
  });
};

// Helper: Upload base64 data URL exclusively to GCS. No local storage allowed.
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

  return new Promise<string>((resolve, reject) => {
    try {
      const blob = bucket.file(`${folder}/${filename}`);

      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: { contentType: mimeType },
      });

      blobStream.on("error", (err: any) => {
        console.error(`❌ [Upload] Error base64 en GCS (${err.message})`);
        reject(new Error(`Fallo al subir imagen de perfil a Google Cloud Storage: ${err?.message || "Error desconocido"}`));
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(buffer);
    } catch (createErr: any) {
      console.error(`❌ [Upload] No se pudo inicializar stream base64 de GCS (${createErr.message})`);
      reject(createErr);
    }
  });
}

// Helper: Delete file from GCS exclusively by URL
export async function deleteFromGCS(fileUrl?: string): Promise<void> {
  try {
    if (!fileUrl || typeof fileUrl !== "string") return;
    if (!fileUrl.includes(`storage.googleapis.com/${bucketName}/`)) return;

    const prefix = `storage.googleapis.com/${bucketName}/`;
    const idx = fileUrl.indexOf(prefix);
    if (idx !== -1) {
      const filePath = decodeURIComponent(fileUrl.substring(idx + prefix.length));
      const file = bucket.file(filePath);
      const [exists] = await file.exists().catch(() => [false]);
      if (exists) {
        await file.delete().catch(() => {});
        console.log(`🗑️ Archivo eliminado de GCS (${bucketName}): ${filePath}`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error al eliminar archivo de GCS:", err);
  }
}

// Helper: Complete multi-target publication cleanup in GCS exclusively
export async function deleteFullPublicationMedia(
  mediaList: (string | undefined | null)[]
): Promise<{ gcsCleaned: number; localCleaned: number }> {
  let gcsCleaned = 0;
  const uniqueUrls = Array.from(
    new Set(
      mediaList.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    )
  );

  for (const rawUrl of uniqueUrls) {
    const url = rawUrl.trim();
    try {
      if (url.includes("hls/") || url.endsWith(".m3u8")) {
        const { deleteHlsStreamBatch } = await import("../hlsTranscoder");
        const res = await deleteHlsStreamBatch(bucket, url);
        if (res.success) {
          gcsCleaned += res.deletedCount;
        }
      } else {
        await deleteFromGCS(url);
        if (url.includes("storage.googleapis.com")) {
          gcsCleaned++;
        }
      }
    } catch (err) {
      console.warn(`⚠️ [Delete Media] Warning deleting media ${url}:`, err);
    }
  }

  return { gcsCleaned, localCleaned: 0 };
}
