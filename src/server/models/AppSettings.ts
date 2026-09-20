import mongoose, { Schema } from "mongoose";

export interface IAppSettings {
  key: string;
  defaultAvatar: string;
  defaultCoverPhoto: string;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    defaultAvatar: {
      type: String,
      default: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
    },
    defaultCoverPhoto: {
      type: String,
      default: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const MongoAppSettings =
  (mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema)) as any;
