import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    text: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
  },
  { timestamps: true }
);

export const MongoChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
