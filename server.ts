import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createHttpServer } from "http";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import { connectToMongoDB } from "./src/server/config/database";
import { createAndroidRouter } from "./src/server/androidRouter";
import { createApiRouter } from "./src/server/routes/apiRoutes";
import { setupWebSocket } from "./src/server/services/websocketService";
import { uploadSingleSafe } from "./src/server/middleware/upload";
import {
  processUploadHlsOnly,
  uploadAvatar,
  uploadCover,
} from "./src/server/controllers/uploadController";
import { getUsers } from "./src/server/controllers/userController";
import {
  MongoUser,
  MongoProduct,
  MongoReel,
  MongoOrder,
  MongoPublicacion,
} from "./src/server/models";
import {
  reels,
  setReels,
  products,
  setProducts,
  orders,
  setOrders,
  broadcastToAll,
} from "./src/server/services/state";
import { uploadToGCS, uploadBase64ToGCS } from "./src/server/services/mediaStorage";
import { generateId } from "./src/server/utils/helpers";
import { bucket, bucketName } from "./src/server/config/storage";
import { hlsQueue } from "./src/server/hlsTranscoder";

// Load environment variables
dotenv.config();

async function startServer() {
  // Connect to MongoDB asynchronously to avoid blocking server boot on port 3000
  connectToMongoDB().catch((err) => {
    console.error("❌ Error running connectToMongoDB asynchronously:", err);
  });

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // CORS middleware to allow requests from Cloud Run domain and client origins
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-username, x-user-id, *"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // High-performance streaming proxy for HLS streams and GCS media.
  // Directly pipes .m3u8 playlists and .ts chunks to the client with full CORS headers
  // so Hls.js / MSE in Chrome, Firefox, Edge and Android can decode segments smoothly.
  const streamGcsFile = async (req: express.Request, res: express.Response, gcsRelativePath: string) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.sendStatus(204);

    const cleanPath = String(gcsRelativePath || "").replace(/^\/+/, "");
    if (!cleanPath || cleanPath.includes("..")) {
      return res.status(404).type("text/plain").send("Media resource not found");
    }

    // Check if the file exists on local disk (under uploads or public)
    const localUploadPath = path.join(process.cwd(), "uploads", cleanPath);
    const localPublicPath = path.join(process.cwd(), "public", cleanPath);
    const resolvedLocal = fs.existsSync(localUploadPath)
      ? localUploadPath
      : fs.existsSync(localPublicPath)
      ? localPublicPath
      : null;

    if (resolvedLocal) {
      const ext = path.extname(resolvedLocal).toLowerCase();
      if (ext === ".m3u8") {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (ext === ".ts") {
        res.setHeader("Content-Type", "video/mp2t");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (ext === ".mp4") {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (ext === ".webm") {
        res.setHeader("Content-Type", "video/webm");
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
      res.setHeader("Accept-Ranges", "bytes");
      if (req.method === "HEAD") return res.status(200).end();
      return res.sendFile(resolvedLocal);
    }

    try {
      const gcsFile = bucket.file(cleanPath);
      const isHlsPlaylist = cleanPath.endsWith(".m3u8");
      const isHlsSegment = cleanPath.endsWith(".ts");

      // HLS resources have immutable, known content types. Avoid an
      // exists() + getMetadata() RPC before every playlist/segment request;
      // those extra GCS round trips were becoming the bottleneck as the
      // feed generated more segment requests.
      if (isHlsPlaylist) {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      } else if (isHlsSegment) {
        res.setHeader("Content-Type", "video/mp2t");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (cleanPath.endsWith(".png")) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (cleanPath.endsWith(".webp")) {
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (cleanPath.endsWith(".mp4") || cleanPath.endsWith(".m4v")) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (cleanPath.endsWith(".webm")) {
        res.setHeader("Content-Type", "video/webm");
        res.setHeader("Cache-Control", "public, max-age=86400");
      } else if (cleanPath.endsWith(".mov")) {
        res.setHeader("Content-Type", "video/quicktime");
        res.setHeader("Cache-Control", "public, max-age=86400");
      }

      res.setHeader("Accept-Ranges", "bytes");
      if (req.method === "HEAD") return res.status(200).end();

      // HLS playlists/segments are streamed directly. No metadata lookup is
      // needed, and the storage stream reports missing objects as errors.
      const stream = gcsFile.createReadStream();
      stream.on("error", (err: any) => {
        console.error(`Error streaming GCS resource (${cleanPath}):`, err?.message || err);
        if (!res.headersSent) {
          const status = err?.code === 404 ? 404 : 502;
          res.status(status).type("text/plain").send(
            status === 404 ? "Media resource not found" : "Google Cloud Storage unavailable"
          );
        } else {
          res.destroy(err);
        }
      });
      stream.pipe(res);
    }
    } catch (err) {
      console.error(`Error streaming GCS resource (${cleanPath}):`, err);
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("Google Cloud Storage unavailable");
      }
    }
  };

  // Dedicated HLS streaming route: /api/hls/*
  app.use("/api/hls", (req, res) => {
    const subPath = String(req.path || "").replace(/^\/+/, "");
    return streamGcsFile(req, res, `hls/${subPath}`);
  });

  // User media is stored in Google Cloud Storage.
  // Pipes directly to client with CORS headers to eliminate browser blocking
  app.use("/uploads", (req, res) => {
    const subPath = String(req.path || "").replace(/^\/+/, "");
    return streamGcsFile(req, res, subPath);
  });

  // Dedicated Android API Router
  app.use(
    "/api/android",
    createAndroidRouter({
      MongoUser,
      MongoProduct,
      MongoReel,
      MongoOrder,
      MongoPublicacion,
      getUsers,
      getReels: () => reels,
      setReels: (newReels) => { setReels(newReels); },
      getProducts: () => products,
      setProducts: (newProducts) => { setProducts(newProducts); },
      getOrders: () => orders,
      setOrders: (newOrders) => { setOrders(newOrders); },
      uploadToGCS,
      uploadSingleSafe,
      uploadBase64ToGCS,
      broadcastToAll,
      generateId,
      bucket,
      bucketName,
      hlsQueue,
    })
  );

  // Main Modular API Router
  app.use("/api", createApiRouter());
  app.use("/v1", createApiRouter());

  // Cloud Media Streaming from MongoDB Atlas GridFS (persistent cloud database, zero local files)
  app.get(["/api/media/:fileId", "/api/media/:fileId/:filename", "/media/:fileId", "/media/:fileId/:filename"], async (req, res) => {
    try {
      const { streamMediaFromMongoGridFS } = await import("./src/server/services/mongoGridFs");
      await streamMediaFromMongoGridFS(req.params.fileId, req, res);
    } catch (err: any) {
      console.error("❌ Error en streaming de MongoDB GridFS:", err);
      res.status(500).type("text/plain").send("Error streaming cloud media");
    }
  });

  // Root-level aliases for legacy clients & Android compatibility
  app.get("/health", (req, res) => {
    res.json({ status: "ok", server: "mall-social-cloudrun", timestamp: new Date().toISOString() });
  });
  app.post("/upload", uploadSingleSafe("file"), processUploadHlsOnly);
  app.post("/upload-avatar", uploadSingleSafe("avatar"), uploadAvatar);
  app.post("/upload-cover", uploadSingleSafe("cover"), uploadCover);

  // Serve PWA manifest file directly from web module
  app.get("/manifest.json", (req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    const webManifest = path.join(process.cwd(), "src", "app", "web", "manifest.json");
    const distManifest = path.join(process.cwd(), "dist", "manifest.json");
    const manifestPath = fs.existsSync(webManifest) ? webManifest : distManifest;
    res.sendFile(manifestPath);
  });

  // Serve app icon assets directly
  app.get(["/app-icon.jpg", "/icon-512.jpg", "/icon-192.jpg"], (req, res) => {
    const iconPath = path.join(process.cwd(), "public", "app-icon.jpg");
    if (fs.existsSync(iconPath)) {
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(iconPath);
    } else {
      res.status(404).send("Icon not found");
    }
  });

  app.get("/favicon.svg", (req, res) => {
    const svgPath = path.join(process.cwd(), "public", "favicon.svg");
    if (fs.existsSync(svgPath)) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(svgPath);
    } else {
      res.status(404).send("Favicon not found");
    }
  });

  // API 404 handler: Always return JSON, never HTML, for unknown /api routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Ruta API no encontrada: ${req.method} ${req.path}`, code: "API_ROUTE_NOT_FOUND" });
  });

  // Global API error handler: Catch any unhandled errors in /api routes and return JSON
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API error intercepted:", err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
    res.status(status).json({
      error: err.message || "Error interno del servidor",
      code: err.code || "INTERNAL_ERROR",
    });
  });

  // Create the HTTP server
  const httpServer = createHttpServer(app);

  // Setup WebSocket server
  setupWebSocket(httpServer);

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
