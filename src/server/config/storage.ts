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

let gcsWorkingState: boolean | null = null;
let lastGcsCheck = 0;

/**
 * Checks if Google Cloud Storage is reachable and authenticated.
 * Caches result for 5 minutes to prevent redundant network timeouts.
 */
export async function isGcsAvailable(): Promise<boolean> {
  const now = Date.now();
  if (gcsWorkingState !== null && (now - lastGcsCheck < 300000)) {
    return gcsWorkingState;
  }

  try {
    const testFile = bucket.file("_ping_check.txt");
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            stream.destroy();
          } catch {}
          reject(new Error("GCS connection timeout"));
        }
      }, 3000);

      const stream = testFile.createWriteStream({ resumable: false });
      stream.on("error", (err: any) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
      stream.on("finish", () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      });
      stream.end("ping");
    });
    gcsWorkingState = true;
    lastGcsCheck = now;
    return true;
  } catch (err: any) {
    gcsWorkingState = false;
    lastGcsCheck = now;
    console.warn(`⚠️ [Storage] Google Cloud Storage no está disponible o las credenciales no son válidas (${err?.message || "error"}). No se permite almacenamiento local.`);
    return false;
  }
}

