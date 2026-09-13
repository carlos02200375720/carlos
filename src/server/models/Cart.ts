import mongoose from "mongoose";

const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [{ product: { type: mongoose.Schema.Types.Mixed, required: true }, quantity: { type: Number, required: true, default: 1 } }],
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

export const MongoCart = (mongoose.models.Cart || mongoose.model("Cart", CartSchema)) as any;
