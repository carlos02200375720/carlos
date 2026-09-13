import mongoose from "mongoose";

const ReelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, videoUrl: { type: String }, thumbnailUrl: { type: String }, description: { type: String }, creatorId: { type: String }, creatorName: { type: String }, creatorUsername: { type: String }, creatorAvatar: { type: String }, likes: { type: Number, default: 0 }, likedBy: { type: [String], default: [] },
  comments: [{ id: { type: String }, username: { type: String }, avatar: { type: String }, text: { type: String }, createdAt: { type: String } }],
  shares: { type: Number, default: 0 }, saves: { type: Number, default: 0 }, views: { type: Number, default: 0 }, productId: { type: String }, type: { type: String, default: "video" }, images: { type: [String], default: [] }, hlsUrl: { type: String }, aspectRatio: { type: String, default: "vertical" }
});

export const MongoReel = (mongoose.models.Reel || mongoose.model("Reel", ReelSchema)) as any;
