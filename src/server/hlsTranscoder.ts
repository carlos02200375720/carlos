import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { Bucket } from "@google-cloud/storage";

const execAsync = promisify(exec);

export interface TranscodeHlsResult {
  masterM3u8Url: string;
  variantUrls: string[];
  totalSegments: number;
  bucketPath: string;
  durationSec?: number;
  latencyMs: number;
}

export interface H264OptimizationResult {
  buffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  compressionRatioPercent: number;
  durationMs: number;
  codec: string;
}

/**
 * Direct local HLS transcode generator.
 * Produces pure HLS stream (.m3u8 playlist + .ts chunks) directly in uploads/hls/<videoId>/
 * completely avoiding MP4 storage.
 */
export async function transcodeVideoToLocalHlsDirect(
  videoBuffer: Buffer,
  videoId: string
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `hls_direct_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, "input_media");
  const localHlsDir = path.join(process.cwd(), "uploads", "hls", videoId);

  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.mkdir(localHlsDir, { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);

  try {
    const playlistPath = path.join(localHlsDir, "index.m3u8");
    const segmentPattern = path.join(localHlsDir, "segment_%03d.ts");

    const cmd = [
      "ffmpeg -y -i",
      `"${inputFilePath}"`,
      "-map 0:v:0 -map 0:a?",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 26",
      `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
      "-g 60 -keyint_min 60 -sc_threshold 0",
      "-c:a aac -b:a 128k -ar 44100 -ac 2",
      `-f hls -hls_time 3 -hls_playlist_type vod -hls_list_size 0`,
      `-hls_segment_filename "${segmentPattern}"`,
      `"${playlistPath}"`
    ].join(" ");

    await execAsync(cmd, { timeout: 180000 });

    const masterContent = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=720x1280,NAME="Adaptive 720p"\nindex.m3u8\n`;
    await fs.promises.writeFile(path.join(localHlsDir, "master.m3u8"), masterContent);

    return `/uploads/hls/${videoId}/index.m3u8`;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function optimizeVideoToH264(videoBuffer: Buffer, videoId: string): Promise<H264OptimizationResult> {
  const startTime = Date.now();
  const tmpDir = path.join(os.tmpdir(), `hls_opt_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, "input_media");
  const outputFilePath = path.join(tmpDir, "output_stream");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);
  const originalSize = videoBuffer.length;
  try {
    const cmd = ["ffmpeg -y -i", `"${inputFilePath}"`, "-map 0:v:0 -map 0:a? -threads 0", "-c:v libx264 -preset ultrafast -profile:v high -level:v 4.1 -pix_fmt yuv420p", "-crf 24 -maxrate 2500k -bufsize 5000k", `-vf "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"`, "-g 60 -keyint_min 30 -c:a aac -b:a 128k -ar 44100 -ac 2", `"${outputFilePath}"`].join(" ");
    await execAsync(cmd, { timeout: 120000 });
    const buffer = await fs.promises.readFile(outputFilePath);
    const optimizedSize = buffer.length;
    return { buffer, originalSize, optimizedSize, compressionRatioPercent: Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100)), durationMs: Date.now() - startTime, codec: "H.264 / HLS Stream" };
  } catch (err: any) {
    console.warn(`[HLS Transcoder] Fallback: ${err?.message || err}`);
    return { buffer: videoBuffer, originalSize, optimizedSize: originalSize, compressionRatioPercent: 0, durationMs: Date.now() - startTime, codec: "Original (Fallback)" };
  } finally { await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined); }
}

export interface HlsJob { id: string; reelId?: string; publicacionId?: string; sourceName: string; status: "queued" | "transcoding" | "uploading_cdn" | "completed" | "failed"; progress: number; queuedAt: number; startedAt?: number; completedAt?: number; durationMs?: number; totalSegments?: number; masterM3u8Url?: string; error?: string; }

type HlsTask = {
  job: HlsJob;
  videoBuffer: Buffer;
  bucket: Bucket;
  bucketName: string;
  onComplete?: (result: TranscodeHlsResult) => Promise<void> | void;
  onError?: (err: Error) => void;
};

class HlsTranscoderQueue {
  private queue: HlsTask[] = [];
  private jobsMap = new Map<string, HlsJob>();
  private maxConcurrent = 1;
  private activeWorkers = 0;

  public telemetry = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    totalSegmentsGenerated: 0,
    averageLatencyMs: 0,
    latencies: [] as number[],
    recentJobs: [] as HlsJob[],
  };

  public enqueue(
    jobId: string,
    videoBuffer: Buffer,
    sourceName: string,
    bucket: Bucket,
    bucketName: string,
    options?: {
      reelId?: string;
      publicacionId?: string;
      onComplete?: (result: TranscodeHlsResult) => Promise<void> | void;
      onError?: (err: Error) => void;
    }
  ): HlsJob {
    const job: HlsJob = {
      id: jobId,
      reelId: options?.reelId,
      publicacionId: options?.publicacionId,
      sourceName,
      status: "queued",
      progress: 5,
      queuedAt: Date.now(),
    };

    this.jobsMap.set(jobId, job);
    this.telemetry.totalJobs++;
    this.telemetry.recentJobs.unshift(job);
    if (this.telemetry.recentJobs.length > 50) this.telemetry.recentJobs.pop();

    this.queue.push({
      job,
      videoBuffer,
      bucket,
      bucketName,
      onComplete: options?.onComplete,
      onError: options?.onError,
    });

    console.log(`📥 [HLS Queue] Enqueued background job ${jobId} for "${sourceName}". Queue size: ${this.queue.length}`);
    this.processNext();

    return job;
  }

  public enqueueAndWait(
    jobId: string,
    videoBuffer: Buffer,
    sourceName: string,
    bucket: Bucket,
    bucketName: string,
    options?: {
      reelId?: string;
      publicacionId?: string;
      onComplete?: (result: TranscodeHlsResult) => Promise<void> | void;
      onError?: (err: Error) => void;
    }
  ): Promise<TranscodeHlsResult> {
    return new Promise<TranscodeHlsResult>((resolve, reject) => {
      const wrappedOnComplete = async (result: TranscodeHlsResult) => {
        try {
          if (options?.onComplete) {
            await options.onComplete(result);
          }
        } finally {
          resolve(result);
        }
      };

      const wrappedOnError = (err: Error) => {
        try {
          if (options?.onError) {
            options.onError(err);
          }
        } finally {
          reject(err);
        }
      };

      this.enqueue(jobId, videoBuffer, sourceName, bucket, bucketName, {
        ...options,
        onComplete: wrappedOnComplete,
        onError: wrappedOnError,
      });
    });
  }

  public getJob(id: string) { return this.jobsMap.get(id); }
  public getAllJobs() { return Array.from(this.jobsMap.values()).sort((a, b) => b.queuedAt - a.queuedAt); }
  public getTelemetry() { return { ...this.telemetry, activeWorkers: this.activeWorkers, queueLength: this.queue.length }; }

  private async processNext() {
    if (this.activeWorkers >= this.maxConcurrent || !this.queue.length) return;
    const task = this.queue.shift(); if (!task) return; this.activeWorkers++;
    const { job, videoBuffer, bucket, bucketName, onComplete, onError } = task;
    job.status = "transcoding"; job.startedAt = Date.now(); job.progress = 15;
    try {
      const result = await transcodeVideoToHLS(videoBuffer, job.id, bucket, bucketName, p => { job.progress = p; if (p >= 80) job.status = "uploading_cdn"; });
      job.status = "completed"; job.progress = 100; job.completedAt = Date.now(); job.durationMs = job.completedAt - (job.startedAt || job.queuedAt); job.totalSegments = result.totalSegments; job.masterM3u8Url = result.masterM3u8Url;
      this.telemetry.completedJobs++; this.telemetry.totalSegmentsGenerated += result.totalSegments; this.telemetry.latencies.push(job.durationMs); if (this.telemetry.latencies.length > 100) this.telemetry.latencies.shift(); this.telemetry.averageLatencyMs = Math.round(this.telemetry.latencies.reduce((a, b) => a + b, 0) / this.telemetry.latencies.length);
      await onComplete?.(result);
    } catch (err: any) {
      job.status = "failed"; job.error = err?.message || String(err); job.completedAt = Date.now(); job.durationMs = job.completedAt - (job.startedAt || job.queuedAt); this.telemetry.failedJobs++; onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally { this.activeWorkers--; setImmediate(() => this.processNext()); }
  }
}

export const hlsQueue = new HlsTranscoderQueue();

/**
 * Pre-transcode video to HLS at upload time and upload only HLS playlists/segments.
 * The source MP4 exists only in the temporary processing directory and is removed
 * when transcoding finishes.
 */
export async function transcodeVideoToHLS(
  videoBuffer: Buffer,
  videoId: string,
  bucket: Bucket,
  bucketName: string,
  onProgress?: (progress: number) => void
): Promise<TranscodeHlsResult> {
  const startTime = Date.now();
  const tmpDir = path.join(os.tmpdir(), `hls_job_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, "input_media");
  const outputDir = path.join(tmpDir, "output_hls");

  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);

  if (onProgress) onProgress(20);

  try {
    console.log(`🎬 [HLS Pre-Transcoder] Starting HLS segmentation for video ${videoId}...`);

    const segmentDuration = 3;
    const playlistPath = path.join(outputDir, "index.m3u8");
    const segmentPattern = path.join(outputDir, "segment_%03d.ts");

    const ffmpegCmd = [
      "ffmpeg -y -i",
      `"${inputFilePath}"`,
      "-map 0:v:0 -map 0:a?",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 26",
      `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
      "-g 60 -keyint_min 60 -sc_threshold 0",
      "-c:a aac -b:a 192k -ar 44100 -ac 2",
      `-f hls -hls_time ${segmentDuration} -hls_playlist_type vod -hls_list_size 0`,
      `-hls_segment_filename "${segmentPattern}"`,
      `"${playlistPath}"`
    ].join(" ");

    if (onProgress) onProgress(40);

    await execAsync(ffmpegCmd, { timeout: 300000 });
    console.log(`✅ [HLS Pre-Transcoder] Local HLS segmentation finished for ${videoId}`);

    const masterContent = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=720x1280,NAME="Adaptive 720p"\nindex.m3u8\n`;
    await fs.promises.writeFile(path.join(outputDir, "master.m3u8"), masterContent);

    if (onProgress) onProgress(75);

    const files = await fs.promises.readdir(outputDir);
    const destinationFolder = `hls/${videoId}`;

    let masterM3u8Url = "";
    let usedGcs = false;

    // Try GCS first if bucket is available, else fallback cleanly to local storage
    try {
      console.log(`📦 [HLS Pre-Transcoder] Attempting upload of ${files.length} HLS files to GCS bucket "${bucketName}"...`);
      let uploadedCount = 0;

      const uploadPromises = files.map(async (fileName) => {
        const filePath = path.join(outputDir, fileName);
        const isPlaylist = fileName.endsWith(".m3u8");
        const isSegment = fileName.endsWith(".ts");

        const destination = `${destinationFolder}/${fileName}`;
        const gcsFile = bucket.file(destination);

        const contentType = isPlaylist
          ? "application/x-mpegURL"
          : isSegment
          ? "video/MP2T"
          : "application/octet-stream";

        const cacheControl = isSegment
          ? "public, max-age=31536000, immutable"
          : "public, max-age=60";

        const fileBuffer = await fs.promises.readFile(filePath);

        return new Promise<void>((resolve, reject) => {
          const stream = gcsFile.createWriteStream({
            resumable: false,
            metadata: {
              contentType,
              cacheControl,
            },
          });
          stream.on("error", reject);
          stream.on("finish", () => {
            uploadedCount++;
            if (onProgress) {
              const uploadProgress = 75 + Math.round((uploadedCount / files.length) * 20);
              onProgress(uploadProgress);
            }
            resolve();
          });
          stream.end(fileBuffer);
        });
      });

      await Promise.all(uploadPromises);
      usedGcs = true;
      masterM3u8Url = `https://storage.googleapis.com/${bucketName}/${destinationFolder}/index.m3u8`;
      console.log(`🚀 [HLS Pre-Transcoder] Successfully deployed direct static HLS stream to GCS: ${masterM3u8Url}`);
    } catch (gcsErr: any) {
      console.warn(`⚠️ [HLS Pre-Transcoder] GCS upload unavailable (${gcsErr.message}). Switching to local persistent storage fallback...`);

      const localHlsDir = path.join(process.cwd(), "uploads", "hls", videoId);
      await fs.promises.mkdir(localHlsDir, { recursive: true });

      for (const fileName of files) {
        await fs.promises.copyFile(
          path.join(outputDir, fileName),
          path.join(localHlsDir, fileName)
        );
      }

      masterM3u8Url = `/uploads/hls/${videoId}/index.m3u8`;
      console.log(`🚀 [HLS Pre-Transcoder] Successfully deployed local persistent HLS stream: ${masterM3u8Url}`);
    }

    const segmentCount = files.filter((f) => f.endsWith(".ts")).length;
    const totalLatencyMs = Date.now() - startTime;

    return {
      masterM3u8Url,
      variantUrls: [masterM3u8Url],
      totalSegments: segmentCount,
      bucketPath: usedGcs ? destinationFolder : `uploads/hls/${videoId}`,
      durationSec: undefined,
      latencyMs: totalLatencyMs,
    };
  } catch (ffmpegErr: any) {
    console.warn(`⚠️ [HLS Pre-Transcoder] Encountered issue during primary HLS processing: ${ffmpegErr.message}. Fallback to direct local HLS generation...`);

    const localHlsUrl = await transcodeVideoToLocalHlsDirect(videoBuffer, videoId);

    return {
      masterM3u8Url: localHlsUrl,
      variantUrls: [localHlsUrl],
      totalSegments: 1,
      bucketPath: `uploads/hls/${videoId}`,
      durationSec: undefined,
      latencyMs: Date.now() - startTime,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Batch Cleanup Function: Delete all HLS segments (.ts), playlists (.m3u8), and master file
 * from Google Cloud Storage or local storage in a single bulk operation.
 */
export async function deleteHlsStreamBatch(
  bucket: Bucket,
  hlsUrlOrVideoId: string
): Promise<{ success: boolean; deletedCount: number; prefix: string }> {
  try {
    let prefix = "";
    if (hlsUrlOrVideoId.includes("hls/")) {
      const match = hlsUrlOrVideoId.match(/hls\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        prefix = `hls/${match[1]}`;
      }
    } else if (hlsUrlOrVideoId.startsWith("hls_")) {
      prefix = `hls/${hlsUrlOrVideoId}`;
    }

    if (!prefix) {
      console.warn(`[HLS Cleanup] No valid HLS prefix found for ${hlsUrlOrVideoId}`);
      return { success: false, deletedCount: 0, prefix: "" };
    }

    // Check and clean local uploads directory if present
    const localDir = path.join(process.cwd(), "uploads", prefix);
    if (fs.existsSync(localDir)) {
      await fs.promises.rm(localDir, { recursive: true, force: true }).catch(() => {});
      console.log(`🧹 [HLS Cleanup] Removed local HLS files from ${localDir}`);
    }

    try {
      console.log(`🧹 [HLS Cleanup] Performing bulk deletion of all HLS files under GCS prefix "${prefix}/"...`);
      await bucket.deleteFiles({
        prefix: `${prefix}/`,
        force: true
      });
      console.log(`✨ [HLS Cleanup] Successfully removed HLS batch files from GCS prefix "${prefix}"`);
    } catch (gcsDelErr: any) {
      console.warn(`⚠️ [HLS Cleanup] GCS batch delete skipped: ${gcsDelErr.message}`);
    }

    return {
      success: true,
      deletedCount: 1,
      prefix,
    };
  } catch (err: any) {
    console.error(`❌ [HLS Cleanup] Failed to delete HLS batch for ${hlsUrlOrVideoId}:`, err);
    return { success: false, deletedCount: 0, prefix: "" };
  }
}
