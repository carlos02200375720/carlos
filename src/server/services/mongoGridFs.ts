import mongoose from "mongoose";
import { Readable } from "stream";

let gridFsBucket: mongoose.mongo.GridFSBucket | null = null;

export function getGridFsBucket(): mongoose.mongo.GridFSBucket {
  if (!gridFsBucket || !mongoose.connection.db) {
    if (!mongoose.connection.db) {
      throw new Error("MongoDB Atlas no está conectado para operaciones de GridFS.");
    }
    gridFsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "mediaFiles",
    });
  }
  return gridFsBucket;
}

/**
 * Saves binary media directly into MongoDB Atlas remote database via GridFS.
 * Zero local disk storage used.
 */
export async function saveMediaToMongoGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string = "application/octet-stream"
): Promise<{ id: string; url: string; contentType: string; size: number }> {
  const bucket = getGridFsBucket();
  const cleanName = filename.replace(/\s+/g, "_");

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(cleanName, {
      metadata: {
        contentType,
        createdAt: new Date(),
        size: buffer.length,
      },
    });

    uploadStream.on("error", (err) => {
      console.error("❌ [MongoDB GridFS] Error subiendo archivo a MongoDB Atlas:", err);
      reject(err);
    });

    uploadStream.on("finish", () => {
      const fileId = uploadStream.id.toString();
      const url = `/api/media/${fileId}/${encodeURIComponent(cleanName)}`;
      console.log(`☁️ [MongoDB GridFS] Archivo guardado exitosamente en MongoDB Atlas: ${url} (${buffer.length} bytes)`);
      resolve({
        id: fileId,
        url,
        contentType,
        size: buffer.length,
      });
    });

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Streams media from MongoDB Atlas GridFS with range request support for smooth video streaming.
 */
export async function streamMediaFromMongoGridFS(
  fileIdStr: string,
  req: any,
  res: any
): Promise<void> {
  try {
    const bucket = getGridFsBucket();
    const objectId = new mongoose.mongo.ObjectId(fileIdStr);

    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      res.status(404).type("text/plain").send("Media not found in MongoDB Atlas");
      return;
    }

    const file = files[0];
    const totalSize = file.length;
    const contentType = (file.metadata as any)?.contentType || (file as any).contentType || "application/octet-stream";

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
        return;
      }

      const chunksize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      res.setHeader("Content-Length", chunksize);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const downloadStream = bucket.openDownloadStream(objectId, {
        start,
        end: end + 1,
      });
      downloadStream.pipe(res);
    } else {
      res.status(200);
      res.setHeader("Content-Length", totalSize);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const downloadStream = bucket.openDownloadStream(objectId);
      downloadStream.pipe(res);
    }
  } catch (err: any) {
    console.error("❌ [MongoDB GridFS] Error al reproducir media:", err);
    res.status(500).type("text/plain").send("Error streaming media from MongoDB Atlas");
  }
}
