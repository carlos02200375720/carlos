import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, name: { type: String, required: true }, description: { type: String }, price: { type: Number, required: true }, imageUrl: { type: String }, stock: { type: Number, default: 0 }, sellerId: { type: String }, rating: { type: Number, default: 5 }, shippingCost: { type: Number, default: 0 }, images: { type: [String], default: [] }, videos: { type: [String], default: [] },
  variants: [{ name: { type: String }, options: { type: [String] } }],
  variantList: [{ vid: { type: String }, name: { type: String }, color: { type: String }, size: { type: String }, price: { type: Number }, imageUrl: { type: String }, sku: { type: String } }],
  category: { type: String }, cjVid: { type: String }, cjPid: { type: String }, views: { type: Number, default: 0 }
});

export const MongoProduct = (mongoose.models.Product || mongoose.model("Product", ProductSchema)) as any;
