import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

export function getValidBucketName(): string {
  const raw = (process.env.BUCKET_NAME || "").trim();
  if (raw && !raw.startsWith("{") && !raw.includes("service_account") && raw.length <= 63) return raw;
  return "mall-1bucket";
}

export function createStorageClient(): Storage {
  const googleJsonPath = path.join(process.cwd(), "google.json");
  const mallJsonPath = path.join(process.cwd(), "mall-1bucket.json");
  let googleJsonFromEnv = process.env.GOOGLE;
  if (!googleJsonFromEnv && process.env.BUCKET_NAME?.trim().startsWith("{")) {
    googleJsonFromEnv = process.env.BUCKET_NAME.trim();
  }
  if (fs.existsSync(googleJsonPath)) return new Storage({ keyFilename: googleJsonPath });
  if (fs.existsSync(mallJsonPath)) return new Storage({ keyFilename: mallJsonPath });
  if (googleJsonFromEnv) {
    try {
      const credentials = JSON.parse(googleJsonFromEnv);
      return new Storage({
        credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
        projectId: credentials.project_id,
      });
    } catch (error) {
      console.error("❌ Error parsing GOOGLE env var JSON:", error);
    }
  }
  return new Storage();
}

export const bucketName = getValidBucketName();
export const storage = createStorageClient();
export const bucket = storage.bucket(bucketName);
