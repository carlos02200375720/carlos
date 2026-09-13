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

export interface HlsJob { id: string; reelId?: string; publicacionId?: string; sourceName: string; status: "queued" | "transcoding" | "uploading_cdn" | "completed" | "failed"; progress: number; queuedAt: number; startedAt?: number; completedAt?: number; durationMs?: number; totalSegments?: number; masterM3u8Url?: string; error?: string; }

type HlsTask = { job: HlsJob; videoBuffer: Buffer; bucket: Bucket; bucketName: string; onComplete?: (result: TranscodeHlsResult) => Promise<void> | void; onError?: (err: Error) => void; resolve?: (result: TranscodeHlsResult) => void; reject?: (err: Error) => void };

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
        if (options?.onComplete) {
          await options.onComplete(result);
        }
        resolve(result);
      };

      const wrappedOnError = (err: Error) => {
        if (options?.onError) {
          options.onError(err);
        }
        reject(err);
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
    const { job, videoBuffer, bucket, bucketName, onComplete, onError, resolve, reject } = task;
    job.status = "transcoding"; job.startedAt = Date.now(); job.progress = 15;
    try {
      const result = await transcodeVideoToHLS(videoBuffer, job.id, bucket, bucketName, p => { job.progress = p; if (p >= 80) job.status = "uploading_cdn"; });
      job.status = "completed"; job.progress = 100; job.completedAt = Date.now(); job.durationMs = job.completedAt - (job.startedAt || job.queuedAt); job.totalSegments = result.totalSegments; job.masterM3u8Url = result.masterM3u8Url;
      this.telemetry.completedJobs++; this.telemetry.totalSegmentsGenerated += result.totalSegments; this.telemetry.latencies.push(job.durationMs); if (this.telemetry.latencies.length > 100) this.telemetry.latencies.shift(); this.telemetry.averageLatencyMs = Math.round(this.telemetry.latencies.reduce((a, b) => a + b, 0) / this.telemetry.latencies.length);
      await onComplete?.(result); resolve?.(result);
    } catch (err: any) {
      job.status = "failed"; job.error = err?.message || String(err); job.completedAt = Date.now(); job.durationMs = job.completedAt - (job.startedAt || job.queuedAt); this.telemetry.failedJobs++; onError?.(err instanceof Error ? err : new Error(String(err))); reject?.(err instanceof Error ? err : new Error(String(err)));
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
  const inputFilePath = path.join(tmpDir, "input_source.mp4");
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
      "-c:v libx264 -preset ultrafast -crf 26 -g 60 -keyint_min 60 -sc_threshold 0",
      "-c:a aac -b:a 192k -ar 44100 -ac 2",
      `-f hls -hls_time ${segmentDuration} -hls_playlist_type vod -hls_list_size 0`,
      `-hls_segment_filename "${segmentPattern}"`,
      `"${playlistPath}"`
    ].join(" ");

    if (onProgress) onProgress(40);

    await execAsync(ffmpegCmd, { timeout: 60000 });
    console.log(`✅ [HLS Pre-Transcoder] Local HLS segmentation finished for ${videoId}`);

    const masterContent = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=720x1280,NAME="Adaptive 720p"\nindex.m3u8\n`;
    await fs.promises.writeFile(path.join(outputDir, "master.m3u8"), masterContent);

    if (onProgress) onProgress(75);

    const files = await fs.promises.readdir(outputDir);
    console.log(`📦 [HLS Pre-Transcoder] Uploading ${files.length} HLS files directly to GCS bucket "${bucketName}"...`);

    const destinationFolder = `hls/${videoId}`;
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

    const masterM3u8Url = `https://storage.googleapis.com/${bucketName}/${destinationFolder}/index.m3u8`;
    const segmentCount = files.filter((f) => f.endsWith(".ts")).length;
    const totalLatencyMs = Date.now() - startTime;

    console.log(`🚀 [HLS Pre-Transcoder] Successfully deployed direct static HLS stream: ${masterM3u8Url} (${segmentCount} segments) in ${totalLatencyMs}ms`);

    return {
      masterM3u8Url,
      variantUrls: [masterM3u8Url],
      totalSegments: segmentCount,
      bucketPath: destinationFolder,
      durationSec: undefined,
      latencyMs: totalLatencyMs,
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Batch Cleanup Function: Delete all HLS segments (.ts), playlists (.m3u8), and master file
 * from Google Cloud Storage in a single bulk operation.
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

    console.log(`🧹 [HLS Cleanup] Performing bulk deletion of all HLS files under GCS prefix "${prefix}/"...`);
    await bucket.deleteFiles({
      prefix: `${prefix}/`,
      force: true
    });

    console.log(`✨ [HLS Cleanup] Successfully removed HLS batch files from GCS prefix "${prefix}"`);

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
