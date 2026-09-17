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
  const PORT = 3000;

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

  // Serve uploaded media files with proper HLS & video streaming headers
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use(
    "/uploads",
    (req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    }
  );

  // Dynamic on-demand poster extractor for HLS folders
  app.get("/uploads/hls/:folder/poster.jpg", async (req, res, next) => {
    try {
      const folder = req.params.folder;
      const posterPath = path.join(uploadsDir, "hls", folder, "poster.jpg");
      if (fs.existsSync(posterPath)) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.sendFile(posterPath);
      }
      const dirPath = path.join(uploadsDir, "hls", folder);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".ts"));
        if (files.length > 0) {
          files.sort();
          const targetTs = path.join(dirPath, files[0]);
          const { getFfmpegBinary } = await import("./src/server/hlsTranscoder");
          const ffmpegBin = getFfmpegBinary();
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);
          await execAsync(`"${ffmpegBin}" -y -i "${targetTs}" -vframes 1 -q:v 2 "${posterPath}"`).catch(() => {});
          if (fs.existsSync(posterPath)) {
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            return res.sendFile(posterPath);
          }
        }
      }
    } catch {
      // ignore
    }
    next();
  });

  app.use(
    "/uploads",
    express.static(uploadsDir, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".m3u8")) {
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else if (filePath.endsWith(".ts")) {
          res.setHeader("Content-Type", "video/mp2t");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

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
