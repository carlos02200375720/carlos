import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  name: { type: String, required: true },
  avatar: { type: String }, bio: { type: String },
  isOnline: { type: Boolean, default: false }, followers: { type: Number, default: 0 }, following: { type: Number, default: 0 },
  followingUserIds: { type: [String], default: [] }, savedReelIds: { type: [String], default: [] }, coverPhoto: { type: String },
  isGuest: { type: Boolean, default: false }, password: { type: String }, email: { type: String, default: "" }, privacyPolicy: { type: String, default: "" }
});

export const MongoUser = (mongoose.models.User || mongoose.model("User", UserSchema)) as any;
