import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

export function getValidBucketName(): string {
  const raw = (process.env.BUCKET_NAME || "").trim();
  if (raw && !raw.startsWith("{") && !raw.includes("service_account") && raw.length <= 63) return raw;
  return "elegan-bucket";
}

export function createStorageClient(): Storage {
  const eleganJsonPath = path.join(process.cwd(), "elegan-cuenta-servicio.json");
  const eleganBucketsJsonPath = path.join(process.cwd(), "elegan-buckets.json");
  let googleJsonFromEnv = process.env.GOOGLE;
  if (!googleJsonFromEnv && process.env.BUCKET_NAME?.trim().startsWith("{")) {
    googleJsonFromEnv = process.env.BUCKET_NAME.trim();
  }
  if (fs.existsSync(eleganJsonPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(eleganJsonPath, "utf-8"));
      return new Storage({ keyFilename: eleganJsonPath, projectId: creds.project_id || "carlos-garcia-509521" });
    } catch {
      return new Storage({ keyFilename: eleganJsonPath });
    }
  }
  if (fs.existsSync(eleganBucketsJsonPath)) return new Storage({ keyFilename: eleganBucketsJsonPath });
  if (googleJsonFromEnv) {
    try {
      const credentials = JSON.parse(googleJsonFromEnv);
      return new Storage({
        credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
        projectId: credentials.project_id || "carlos-garcia-509521",
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

/**
 * GCS is always enabled as the primary storage flow.
 * Direct uploads and streaming to Google Cloud Storage are attempted without blocking pre-checks.
 */
export async function isGcsAvailable(): Promise<boolean> {
  return true;
}

