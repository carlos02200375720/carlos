import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoCart } from "../models";
import { cartMemoryStore } from "../services/state";

/**
 * GET /api/cart/:userId
 * Get cart for a specific user or client
 */
export async function getCart(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "UserId is required" });
    return;
  }

  let items: any[] = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const cartDoc = await MongoCart.findOne({ userId });
      if (cartDoc && Array.isArray(cartDoc.items)) {
        items = cartDoc.items;
        cartMemoryStore.set(userId, items);
      } else {
        items = cartMemoryStore.get(userId) || [];
      }
    } catch (err) {
      console.error("❌ Failed to load cart from MongoDB Atlas:", err);
      items = cartMemoryStore.get(userId) || [];
    }
  } else {
    items = cartMemoryStore.get(userId) || [];
  }

  res.json({ userId, items });
}

/**
 * POST /api/cart/:userId
 * Save/update cart items for a specific user or client
 */
export async function updateCart(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  const { items } = req.body;
  if (!userId) {
    res.status(400).json({ error: "UserId is required" });
    return;
  }

  const sanitizedItems = Array.isArray(items) ? items : [];
  cartMemoryStore.set(userId, sanitizedItems);

  if (mongoose.connection.readyState === 1) {
    try {
      await MongoCart.findOneAndUpdate(
        { userId },
        { items: sanitizedItems, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      console.log(`💾 Cart synced to MongoDB Atlas for user ${userId} (${sanitizedItems.length} items)`);
    } catch (err) {
      console.error("❌ Failed to save cart to MongoDB Atlas:", err);
    }
  }

  res.json({ success: true, userId, items: sanitizedItems });
}

/**
 * DELETE /api/cart/:userId
 * Delete/clear cart for a specific user or client
 */
export async function clearCart(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;
  if (!userId) {
    res.status(400).json({ error: "UserId is required" });
    return;
  }

  cartMemoryStore.set(userId, []);

  if (mongoose.connection.readyState === 1) {
    try {
      await MongoCart.findOneAndUpdate(
        { userId },
        { items: [], updatedAt: new Date() },
        { upsert: true }
      );
      console.log(`💾 Cart cleared in MongoDB Atlas for user ${userId}`);
    } catch (err) {
      console.error("❌ Failed to clear cart in MongoDB Atlas:", err);
    }
  }

  res.json({ success: true, userId, items: [] });
}
