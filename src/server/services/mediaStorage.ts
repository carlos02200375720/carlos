import fs from "fs";
import path from "path";
import { bucket, bucketName } from "../config/storage";

const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper: Save buffer to local uploads directory
export async function saveToLocalStorage(
  buffer: Buffer,
  folder: string,
  fileName: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads", folder);
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const cleanName = fileName.replace(/\s+/g, "_");
  const uniqueName = `${Date.now()}-${generateId()}-${cleanName}`;
  const filePath = path.join(uploadsDir, uniqueName);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/${folder}/${uniqueName}`;
}

// Helper: Upload file to GCS (with HLS stream conversion for all videos) with local storage fallback
export const uploadToGCS = async (file: Express.Multer.File, folder: string = "publicaciones"): Promise<string> => {
  let originalName = file.originalname.replace(/\s+/g, "_");
  const mimeType = file.mimetype.toLowerCase();

  const isVideo = mimeType.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(originalName);
  if (isVideo) {
    try {
      console.log(`🎬 [Upload] Transcodificando video a formato HLS exclusivo (.m3u8): ${originalName}...`);
      const { transcodeVideoToHLS } = await import("../hlsTranscoder");
      const hlsRes = await transcodeVideoToHLS(file.buffer, generateId(), bucket, bucketName);
      return hlsRes.masterM3u8Url;
    } catch (hlsErr: any) {
      console.warn("⚠️ [Upload] Fallback a transcodificación HLS local directa:", hlsErr.message);
      const { transcodeVideoToLocalHlsDirect } = await import("../hlsTranscoder");
      return await transcodeVideoToLocalHlsDirect(file.buffer, generateId());
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
    try {
      const blob = bucket.file(`${folder}/${uniqueName}`);

      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype || "application/octet-stream",
          cacheControl: "public, max-age=86400",
        },
      });

      blobStream.on("error", async (err: any) => {
        console.warn(`⚠️ [Upload] Error en GCS (${err.message}). Guardando en almacenamiento local...`);
        try {
          const localUrl = await saveToLocalStorage(file.buffer, folder, originalName);
          resolve(localUrl);
        } catch (saveErr) {
          reject(err);
        }
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    } catch (createErr: any) {
      console.warn(`⚠️ [Upload] No se pudo inicializar stream de GCS (${createErr.message}). Guardando localmente...`);
      saveToLocalStorage(file.buffer, folder, originalName)
        .then(resolve)
        .catch(reject);
    }
  });
};

// Helper: Upload base64 data URL to GCS with local storage fallback
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

      blobStream.on("error", async (err: any) => {
        console.warn(`⚠️ [Upload] Error base64 en GCS (${err.message}). Guardando en almacenamiento local...`);
        try {
          const localUrl = await saveToLocalStorage(buffer, folder, filename);
          resolve(localUrl);
        } catch (saveErr) {
          reject(err);
        }
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${blob.name}`;
        resolve(publicUrl);
      });

      blobStream.end(buffer);
    } catch (createErr: any) {
      console.warn(`⚠️ [Upload] No se pudo inicializar stream base64 de GCS (${createErr.message}). Guardando localmente...`);
      saveToLocalStorage(buffer, folder, filename)
        .then(resolve)
        .catch(reject);
    }
  });
}

// Helper: Delete file from GCS or local storage by URL
export async function deleteFromGCS(fileUrl?: string): Promise<void> {
  try {
    if (!fileUrl || typeof fileUrl !== "string") return;

    if (fileUrl.startsWith("/uploads/")) {
      const localFilePath = path.join(process.cwd(), fileUrl);
      if (fs.existsSync(localFilePath)) {
        await fs.promises.unlink(localFilePath).catch(() => {});
        console.log(`🗑️ Archivo local eliminado: ${localFilePath}`);
      }
      return;
    }

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
