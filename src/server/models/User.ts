import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
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
  guestToken: { type: String, sparse: true, unique: true, index: true },
  deviceInfo: { type: String, default: "" },
  platform: { type: String, default: "web" },
  lastSeenAt: { type: Date, default: Date.now },
  firstVisitAt: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 },
  password: { type: String },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  privacyPolicy: { type: String, default: "" },
  canSell: { type: Boolean, default: false }
}, { timestamps: true });

// TTL Index in MongoDB Atlas:
// Automatically deletes guest documents after 60 days (5,184,000 seconds) of inactivity.
// If the guest user visits before 60 days, lastSeenAt is updated, resetting the countdown.
// Only applies to unregistered guests (isGuest: true with guestToken).
UserSchema.index(
  { lastSeenAt: 1 },
  {
    expireAfterSeconds: 60 * 24 * 60 * 60, // 60 days = 5,184,000 seconds
    partialFilterExpression: { isGuest: true, guestToken: { $exists: true } },
    background: true
  }
);

export const MongoUser = (mongoose.models.User || mongoose.model("User", UserSchema)) as any;
