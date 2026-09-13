import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, buyerId: { type: String }, buyerName: { type: String }, buyerUsername: { type: String }, buyerAvatar: { type: String }, buyerEmail: { type: String },
  items: [{ productId: { type: String, required: true }, name: { type: String, required: true }, price: { type: Number, required: true }, quantity: { type: Number, required: true }, imageUrl: { type: String }, sellerId: { type: String }, sellerName: { type: String }, sellerUsername: { type: String }, carrier: { type: String } }],
  total: { type: Number, required: true }, shippingCost: { type: Number, default: 0 }, shippingAddress: { type: String, required: true }, paymentStatus: { type: String, default: "paid" }, status: { type: String, default: "processing" }, trackingNumber: { type: String, default: "" }, carrier: { type: String, default: "" }, trackingUrl: { type: String, default: "" }, estimatedDelivery: { type: String, default: "" }, sellerNotes: { type: String, default: "" },
  statusHistory: [{ status: { type: String }, label: { type: String }, timestamp: { type: String }, note: { type: String }, trackingNumber: { type: String }, carrier: { type: String } }],
  createdAt: { type: String }, updatedAt: { type: String }
}, { strict: false });

export const MongoOrder = (mongoose.models.Order || mongoose.model("Order", OrderSchema)) as any;
