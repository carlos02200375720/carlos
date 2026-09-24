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

  // Check file paths first
  if (fs.existsSync(eleganJsonPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(eleganJsonPath, "utf-8"));
      return new Storage({ keyFilename: eleganJsonPath, projectId: creds.project_id || "carlos-garcia-509521" });
    } catch {
      return new Storage({ keyFilename: eleganJsonPath });
    }
  }
  if (fs.existsSync(eleganBucketsJsonPath)) {
    return new Storage({ keyFilename: eleganBucketsJsonPath });
  }

  // Check environment variables
  let googleJsonFromEnv =
    process.env.GOOGLE_CREDENTIALS ||
    process.env.GOOGLE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GOOGLE ||
    process.env.GCS_CREDENTIALS ||
    process.env.GCP_SERVICE_ACCOUNT;

  if (!googleJsonFromEnv && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const rawGac = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    if (rawGac.startsWith("{")) {
      googleJsonFromEnv = rawGac;
    } else if (fs.existsSync(rawGac)) {
      return new Storage({ keyFilename: rawGac });
    }
  }

  if (!googleJsonFromEnv && process.env.BUCKET_NAME?.trim().startsWith("{")) {
    googleJsonFromEnv = process.env.BUCKET_NAME.trim();
  }

  if (googleJsonFromEnv) {
    try {
      let rawJson = googleJsonFromEnv.trim();
      // Handle base64 encoded JSON if user encoded it
      if (!rawJson.startsWith("{") && !rawJson.startsWith("[")) {
        try {
          const decoded = Buffer.from(rawJson, "base64").toString("utf-8");
          if (decoded.trim().startsWith("{")) {
            rawJson = decoded.trim();
          }
        } catch {}
      }
      const credentials = JSON.parse(rawJson);
      const privateKey = (credentials.private_key || "").replace(/\\n/g, "\n");

      console.log(`🔑 Google Cloud Storage client initialized with service account: ${credentials.client_email || "service-account"}`);
      return new Storage({
        credentials: {
          client_email: credentials.client_email,
          private_key: privateKey,
        },
        projectId: credentials.project_id || "carlos-garcia-509521",
      });
    } catch (error) {
      console.error("❌ Error parsing Google credentials JSON from environment variable:", error);
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

