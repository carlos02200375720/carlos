import mongoose from "mongoose";

const ReelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  thumbnailUrl: { type: String, default: "" },
  description: { type: String, default: "" },
  creatorId: { type: String },
  creatorName: { type: String },
  creatorUsername: { type: String },
  creatorAvatar: { type: String },
  likes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] },
  comments: [{ id: { type: String }, username: { type: String }, avatar: { type: String }, text: { type: String }, createdAt: { type: String } }],
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  productId: { type: String },
  type: { type: String, default: "video" },
  images: { type: [String], default: [] },
  media: [{
    type: { type: String, enum: ["video", "image"], default: "video" },
    url: { type: String },
    hlsUrl: { type: String },
    thumbnailUrl: { type: String }
  }],
  hlsUrl: { type: String },
  aspectRatio: { type: String, default: "vertical" }
});

export const MongoReel = (mongoose.models.Reel || mongoose.model("Reel", ReelSchema)) as any;
