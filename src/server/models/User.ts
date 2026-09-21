import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true },
  avatar: { type: String },
  bio: { type: String },
  isOnline: { type: Boolean, default: false },
  followers: { type: Number, default: 0 },
  following: { type: Number, default: 0 },
  followingUserIds: { type: [String], default: [] },
  savedReelIds: { type: [String], default: [] },
  coverPhoto: { type: String },
  isGuest: { type: Boolean, default: false },
  password: { type: String },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true, index: true },
  privacyPolicy: { type: String, default: "" },
  canSell: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });

export const MongoUser = (mongoose.models.User || mongoose.model("User", UserSchema)) as any;
