import { bucket, bucketName, isGcsAvailable } from "../config/storage";
import { saveMediaToMongoGridFS } from "./mongoGridFs";

const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper: Upload file exclusively to Cloud Storage (GCS primary, MongoDB Atlas GridFS secondary). No local storage allowed.
export const uploadToGCS = async (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  let originalName = file.originalname.replace(/\s+/g, "_");
  const mimeType = file.mimetype.toLowerCase();

  const isVideo = mimeType.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(originalName);
  const gcsReady = await isGcsAvailable();

  if (isVideo) {
    if (gcsReady) {
      try {
        console.log(`🎬 [Upload] Transcodificando video a formato HLS exclusivo (.m3u8) para GCS: ${originalName}...`);
        const { transcodeVideoToHLS } = await import("../hlsTranscoder");
        const hlsRes = await transcodeVideoToHLS(file.buffer, generateId(), bucket, bucketName);
        return hlsRes.masterM3u8Url;
      } catch (hlsErr: any) {
        console.warn(`⚠️ [Upload] Fallo en HLS a GCS (${hlsErr?.message}). Almacenando en MongoDB Atlas GridFS...`);
      }
    }
    // GCS unavailable or failed: store directly in MongoDB Atlas remote cloud
    console.log(`☁️ [Upload] Guardando video en la nube en MongoDB Atlas GridFS: ${originalName}`);
    const gridRes = await saveMediaToMongoGridFS(file.buffer, originalName, file.mimetype || "video/mp4");
    return gridRes.url;
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

  // Attempt GCS first if reachable
  if (gcsReady) {
    try {
      const gcsUrl = await new Promise<string>((resolve, reject) => {
        const extMatch = originalName.match(/\.[a-zA-Z0-9]+$/);
        const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
        const uniqueName = `${Date.now()}_${generateId()}${ext}`;
        const blob = bucket.file(`${folder}/${uniqueName}`);

        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: {
            contentType: file.mimetype || "application/octet-stream",
            cacheControl: "public, max-age=31536000",
          },
        });

        blobStream.on("error", (err: any) => reject(err));
        blobStream.on("finish", () => {
          resolve(`https://storage.googleapis.com/${bucketName}/${blob.name}`);
        });

        blobStream.end(file.buffer);
      });
      return gcsUrl;
    } catch (gcsErr: any) {
      console.warn(`⚠️ [Upload] GCS upload failed (${gcsErr.message}). Falling back to MongoDB Atlas GridFS...`);
    }
  }

  // Cloud secondary: MongoDB Atlas GridFS (persistent cloud database, zero local files)
  console.log(`☁️ [Upload] Guardando imagen en la nube en MongoDB Atlas GridFS: ${originalName}`);
  const gridRes = await saveMediaToMongoGridFS(file.buffer, originalName, file.mimetype || "image/jpeg");
  return gridRes.url;
};

// Helper: Upload base64 data URL exclusively to cloud storage. No local storage allowed.
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

  const filename = `${Date.now()}_${generateId()}.${extension}`;

  const gcsReady = await isGcsAvailable();
  if (gcsReady) {
    try {
      const gcsUrl = await new Promise<string>((resolve, reject) => {
        const blob = bucket.file(`${folder}/${filename}`);
        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: {
            contentType: mimeType,
            cacheControl: "public, max-age=31536000",
          },
        });

        blobStream.on("error", (err: any) => reject(err));
        blobStream.on("finish", () => {
          resolve(`https://storage.googleapis.com/${bucketName}/${blob.name}`);
        });

        blobStream.end(buffer);
      });
      return gcsUrl;
    } catch (err: any) {
      console.warn(`⚠️ [Upload Base64] GCS upload failed (${err?.message}). Usando MongoDB Atlas GridFS...`);
    }
  }

  // MongoDB Atlas GridFS cloud storage
  try {
    const gridRes = await saveMediaToMongoGridFS(buffer, filename, mimeType);
    return gridRes.url;
  } catch {
    return base64Str;
  }
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
