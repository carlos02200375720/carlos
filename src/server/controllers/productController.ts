import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoProduct, MongoReel } from "../models";
import { Product } from "../../types";
import { generateId } from "../utils/helpers";
import { createCompanionReelForProduct } from "../utils/reelUtils";
import { saveCanonicalReelToMongo } from "../services/reelService";
import { resolveAuthenticatedUser, hasSellerPermission } from "./userController";
import {
  products,
  setProducts,
  reels,
  setReels,
  broadcastToAll,
} from "../services/state";

/**
 * GET /api/products
 * Get all e-commerce products
 */
export async function getProducts(req: Request, res: Response): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      const dbProducts = await MongoProduct.find();
      const seenProdIds = new Set<string>();
      const uniqueDbProducts = dbProducts.filter((p) => {
        if (!p.id || seenProdIds.has(p.id)) return false;
        seenProdIds.add(p.id);
        return true;
      });
      const parsed = uniqueDbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        price: p.price,
        imageUrl: p.imageUrl || "",
        stock: p.stock !== undefined ? p.stock : 10,
        sellerId: p.sellerId || "current_user",
        rating: p.rating || 5,
        shippingCost: p.shippingCost || 0,
        images: p.images || [],
        videos: p.videos || [],
        variants: p.variants || [],
        variantList: p.variantList || [],
        category: p.category || "",
        cjVid: p.cjVid || undefined,
        cjPid: p.cjPid || undefined,
        views: p.views || 0,
      }));
      setProducts(parsed);
    } catch (err) {
      console.error("❌ Failed to load live products from MongoDB Atlas during GET:", err);
    }
  }
  const seen = new Set<string>();
  const uniqueProducts = products.filter((p) => {
    if (!p.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  res.json(uniqueProducts);
}

/**
 * GET /api/products/:id
 * Get product by ID directly from MongoDB Atlas or memory
 */
export async function getProductById(req: Request, res: Response): Promise<void> {
  const targetId = req.params.id;

  // 1. If MongoDB is connected, query directly for this specific product first
  if (mongoose.connection.readyState === 1) {
    try {
      const dbProduct = await MongoProduct.findOne({
        $or: [{ id: targetId }, { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined }].filter(Boolean),
      });

      if (dbProduct) {
        const parsed: Product = {
          id: dbProduct.id,
          name: dbProduct.name,
          description: dbProduct.description || "",
          price: dbProduct.price,
          imageUrl: dbProduct.imageUrl || "",
          stock: dbProduct.stock !== undefined ? dbProduct.stock : 10,
          sellerId: dbProduct.sellerId || "current_user",
          rating: dbProduct.rating || 5,
          shippingCost: dbProduct.shippingCost || 0,
          images: dbProduct.images || [],
          videos: dbProduct.videos || [],
          variants: dbProduct.variants || [],
          variantList: dbProduct.variantList || [],
          category: dbProduct.category || "",
          cjVid: dbProduct.cjVid || undefined,
          cjPid: dbProduct.cjPid || undefined,
          views: dbProduct.views || 0,
        };

        // Cache into in-memory state if not present or update it
        const exists = products.some((p) => p.id === parsed.id);
        if (!exists) {
          setProducts([parsed, ...products]);
        }
        res.json(parsed);
        return;
      }
    } catch (err) {
      console.error("❌ Failed to query product by ID from MongoDB Atlas:", err);
    }
  }

  // 2. Check in-memory products fallback
  const product = products.find((p) => p.id === targetId || (p as any)._id === targetId);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
}

/**
 * POST /api/products/:id/view
 * Record a view on a product detail page
 */
export async function viewProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const product = products.find((p) => p.id === id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    product.views = (product.views || 0) + 1;

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoProduct.updateOne({ id }, { $inc: { views: 1 } });
      } catch (dbErr) {
        console.error("❌ Failed to update product views in MongoDB:", dbErr);
      }
    }

    broadcastToAll({
      type: "product_viewed",
      productId: id,
      views: product.views,
    });

    res.json({ success: true, views: product.views });
  } catch (err: any) {
    console.error("Error recording product view:", err);
    res.status(500).json({ error: "Failed to record view", details: err.message });
  }
}

/**
 * POST /api/products
 * Create a new product for sale
 */
export async function createProduct(req: any, res: any): Promise<void> {
  try {
    const {
      name,
      description,
      price,
      imageUrl,
      stock,
      shippingCost,
      images,
      videos,
      variants,
      variantList,
      category,
      cjVid,
      cjPid,
    } = req.body;

    const seller = await resolveAuthenticatedUser(req, "seller");

    if (!seller || seller.isGuest || seller.username === "invitado" || seller.username === "guest") {
      res.status(403).json({ error: "Debes iniciar sesión con una cuenta para poder registrar productos para la venta." });
      return;
    }
    if (!hasSellerPermission(seller)) {
      res.status(403).json({ error: "Tu cuenta no tiene permiso para gestionar productos. Solicita al superadministrador que active el permiso de vendedor." });
      return;
    }

    const newProduct: Product = {
      id: "prod_" + generateId(),
      name: name || "Producto sin nombre",
      description: description || "",
      price: Number(price) || 0,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80",
      stock: Number(stock) || 0,
      sellerId: seller.id,
      rating: 5,
      shippingCost: Number(shippingCost) || 0,
      images: images || [],
      videos: videos || [],
      variants: variants || [],
      variantList: variantList || [],
      category: category || "",
      cjVid: cjVid || undefined,
      cjPid: cjPid || undefined,
      views: 0,
    };

    setProducts([newProduct, ...products]);

    if (mongoose.connection.readyState === 1) {
      try {
        const mongoProduct = new MongoProduct(newProduct);
        await mongoProduct.save();
        console.log(`💾 Saved new product ${newProduct.id} to MongoDB Atlas`);
      } catch (dbErr) {
        console.error("❌ Failed to save product to MongoDB Atlas:", dbErr);
      }
    }

    const companionReel = createCompanionReelForProduct(newProduct, seller);
    const newReel = await saveCanonicalReelToMongo(companionReel);

    const updatedReels = [newReel, ...reels].filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx);
    setReels(updatedReels);
    console.log(`💾 Saved companion reel ${newReel.id} for product ${newProduct.id} to MongoReel in Atlas`);

    broadcastToAll({
      type: "product_created",
      product: newProduct,
    });

    broadcastToAll({
      type: "reel_created",
      reel: newReel,
    });

    res.status(201).json({ success: true, product: newProduct, reel: newReel });
  } catch (err: any) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to create product", details: err.message });
  }
}

/**
 * PUT/POST /api/products/:id/update or /api/products/:id
 * Update an existing product
 */
export async function updateProduct(req: any, res: any, next: any): Promise<void> {
  if (req.method !== "PUT" && req.method !== "POST") {
    return next();
  }

  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "El ID del producto es obligatorio" });
      return;
    }

    const {
      name,
      description,
      price,
      imageUrl,
      stock,
      shippingCost,
      images,
      videos,
      variants,
      variantList,
      category,
    } = req.body;

    const seller = await resolveAuthenticatedUser(req, "seller");
    if (!seller || !hasSellerPermission(seller)) {
      res.status(403).json({ error: "Tu cuenta no tiene permiso para gestionar productos." });
      return;
    }

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = String(name).trim();
    if (description !== undefined) updateFields.description = String(description).trim();
    if (price !== undefined) updateFields.price = Math.max(0, Number(price) || 0);
    if (imageUrl !== undefined) updateFields.imageUrl = String(imageUrl).trim();
    if (stock !== undefined) updateFields.stock = Math.max(0, parseInt(String(stock), 10) || 0);
    if (shippingCost !== undefined) updateFields.shippingCost = Math.max(0, Number(shippingCost) || 0);
    if (category !== undefined) updateFields.category = String(category).trim();
    if (images !== undefined) updateFields.images = Array.isArray(images) ? images : [];
    if (videos !== undefined) updateFields.videos = Array.isArray(videos) ? videos : [];
    if (variants !== undefined) updateFields.variants = variants;
    if (variantList !== undefined) updateFields.variantList = variantList;

    let updatedProduct: any = null;
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        ...updateFields,
      };
      updatedProduct = products[index];
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const dbProd = await MongoProduct.findOneAndUpdate(
          { id },
          { $set: updateFields },
          { returnDocument: "after" }
        );
        if (dbProd) {
          const parsedDbProd = dbProd.toObject ? dbProd.toObject() : dbProd;
          updatedProduct = parsedDbProd;
          if (index !== -1) {
            products[index] = parsedDbProd;
          } else {
            setProducts([parsedDbProd, ...products]);
          }
        }
        console.log(`💾 Product ${id} updated in MongoDB Atlas`);
      } catch (dbErr) {
        console.error("❌ Failed to update product in MongoDB Atlas:", dbErr);
      }
    }

    if (!updatedProduct) {
      res.status(404).json({ error: "Producto no encontrado en el sistema" });
      return;
    }

    if (imageUrl || name) {
      reels.forEach((r) => {
        if (r.productId === id) {
          if (imageUrl) r.thumbnailUrl = imageUrl;
          if (images && images.length > 0) r.images = images;
        }
      });
      if (mongoose.connection.readyState === 1) {
        const reelUpdates: any = {};
        if (imageUrl) reelUpdates.thumbnailUrl = imageUrl;
        if (images && images.length > 0) reelUpdates.images = images;
        await MongoReel.updateMany({ productId: id }, { $set: reelUpdates }).catch(() => null);
      }
    }

    broadcastToAll({
      type: "product_updated",
      product: updatedProduct,
    });

    res.json({ success: true, product: updatedProduct });
  } catch (err: any) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Error al actualizar el producto", details: err.message });
  }
}

/**
 * DELETE/POST /api/products/:id/delete or /api/products/:id
 * Delete an existing product
 */
export async function deleteProduct(req: any, res: any, next: any): Promise<void> {
  if (req.method !== "DELETE" && req.method !== "POST") {
    return next();
  }

  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: "El ID del producto es obligatorio" });
      return;
    }

    const seller = await resolveAuthenticatedUser(req, "seller");
    if (!seller || !hasSellerPermission(seller)) {
      res.status(403).json({ error: "Tu cuenta no tiene permiso para gestionar productos." });
      return;
    }

    console.log(`🗑️ Deleting product ${id}...`);

    setProducts(products.filter((p) => p.id !== id));

    if (mongoose.connection.readyState === 1) {
      try {
        await MongoProduct.deleteOne({ id });
        await MongoReel.deleteMany({ productId: id }).catch(() => null);
        console.log(`💾 Product ${id} and companion reels deleted from MongoDB Atlas`);
      } catch (dbErr) {
        console.error("❌ Failed to delete product from MongoDB Atlas:", dbErr);
      }
    }

    setReels(reels.filter((r) => r.productId !== id));

    broadcastToAll({
      type: "product_deleted",
      productId: id,
    });

    res.json({ success: true, message: "Producto eliminado exitosamente" });
  } catch (err: any) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Error al eliminar el producto", details: err.message });
  }
}
