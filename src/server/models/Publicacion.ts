import mongoose from "mongoose";

const PublicacionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, url: { type: String, required: true }, hlsUrl: { type: String },
  title: { type: String }, description: { type: String }, createdAt: { type: Date, default: Date.now }, creatorId: { type: String }
});

export const MongoPublicacion = (mongoose.models.Publicacion || mongoose.model("Publicacion", PublicacionSchema)) as any;
