import { Router } from "express";
import mongoose from "mongoose";
import { uploadSingleSafe } from "../middleware/upload";
import * as userController from "../controllers/userController";
import * as reelController from "../controllers/reelController";
import * as productController from "../controllers/productController";
import * as cjController from "../controllers/cjController";
import * as cartController from "../controllers/cartController";
import * as orderController from "../controllers/orderController";
import * as chatController from "../controllers/chatController";
import * as liveController from "../controllers/liveController";
import * as uploadController from "../controllers/uploadController";
import * as settingsController from "../controllers/settingsController";
import { getMongoStatus, connectToMongoDB } from "../config/database";

export function createApiRouter(): Router {
  const router = Router();

  // Health check with detailed MongoDB diagnostic status
  router.get("/health", (req, res) => {
    const mongoStatus = getMongoStatus();
    res.json({
      status: "ok",
      server: "mall-social-cloudrun",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongoConnected: mongoose.connection.readyState === 1,
      mongoConfigured: mongoStatus.configured,
      mongoError: mongoStatus.error,
    });
  });

  // Reconnect MongoDB trigger endpoint
  router.post(["/reconnect-mongo", "/db/reconnect"], async (req, res) => {
    try {
      await connectToMongoDB();
      const status = getMongoStatus();
      res.json({
        success: status.connected,
        status,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // HLS telemetry
  router.get("/hls/telemetry", uploadController.getHlsTelemetry);

  // Upload & Media Signed URL routes (Direct GCS upload architecture)
  router.get(["/v1/media/upload-url", "/media/upload-url"], uploadController.generateUploadSignedUrl);
  router.post(["/v1/posts", "/posts", "/v1/publicaciones", "/publicaciones"], uploadController.createPost);
  router.get(["/v1/feed", "/feed"], uploadController.getFeed);

  router.post("/upload", uploadSingleSafe("file"), uploadController.processUploadHlsOnly);
  router.post("/upload-avatar", uploadSingleSafe("avatar"), uploadController.uploadAvatar);
  router.post("/upload-cover", uploadSingleSafe("cover"), uploadController.uploadCover);
  router.post(["/products/upload-image", "/upload-product-image"], uploadSingleSafe("image"), uploadController.uploadProductImage);
  router.delete("/publicaciones/:id", uploadController.deletePublicationMedia);
  router.delete("/reels/:id", uploadController.deletePublicationMedia);

  // Users routes
  router.get("/users", userController.getAllUsers);
  router.get("/users/:id", userController.getUserById);
  router.get("/users/:id/publications", userController.getUserPublications);
  router.delete("/users/:id", userController.adminDeleteUser);
  router.post("/users/:id/permission", userController.updateUserSellerPermission);
  router.post("/users/current/save", userController.toggleSaveReel);
  router.post("/users/:targetUserId/follow", userController.toggleFollow);
  router.post("/users/current/update", userController.updateCurrentUser);
  router.post("/users/register", userController.registerUser);
  router.post("/users/current/switch", userController.switchUser);
  router.post("/users/current/logout", userController.logoutUser);

  // Reels routes
  router.get("/reels", reelController.getReels);
  router.post("/reels", reelController.createReel);
  router.post("/reels/:id/like", reelController.likeReel);
  router.post("/reels/:id/comment", reelController.commentReel);
  router.post("/reels/:id/view", reelController.viewReel);
  router.post("/reels/:id/share", reelController.shareReel);

  // CJ Dropshipping routes
  router.get("/cj/freight-options", cjController.getFreightOptions);
  router.get("/cj/import-product", cjController.importProduct);

  // Products routes
  router.get("/products", productController.getProducts);
  router.get("/products/:id", productController.getProductById);
  router.post("/products", productController.createProduct);
  router.post("/products/:id/view", productController.viewProduct);
  router.all(["/products/:id/update", "/products/:id"], productController.updateProduct);
  router.all(["/products/:id/delete", "/products/:id"], productController.deleteProduct);

  // Cart routes
  router.get("/cart/:userId", cartController.getCart);
  router.post("/cart/:userId", cartController.updateCart);
  router.delete("/cart/:userId", cartController.clearCart);

  // Orders routes
  router.post("/orders", orderController.createOrder);
  router.get("/orders", orderController.getOrders);
  router.post("/orders/:id/update-tracking", orderController.updateTracking);

  // Chat routes
  router.get("/chats/:partnerId", chatController.getChatMessages);

  // Live streaming routes
  router.get("/live", liveController.getLiveSessions);
  router.post("/live", liveController.createLiveSession);
  router.post("/live/:id/end", liveController.endLiveSession);

  // App Settings & Default Assets routes (Admin controlled)
  router.get("/admin/default-assets", settingsController.getDefaultAssets);
  router.get("/app-settings/defaults", settingsController.getDefaultAssets);
  router.post("/admin/default-assets", settingsController.updateDefaultAssets);
  router.post("/admin/default-assets/reset", settingsController.resetDefaultAssets);

  return router;
}
