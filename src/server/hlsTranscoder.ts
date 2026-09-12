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

export async function optimizeVideoToH264(videoBuffer: Buffer, videoId: string): Promise<H264OptimizationResult> {
  const startTime = Date.now();
  const tmpDir = path.join(os.tmpdir(), `h264_opt_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, "input_source.mp4");
  const outputFilePath = path.join(tmpDir, "output_h264_faststart.mp4");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);
  const originalSize = videoBuffer.length;

  try {
    const ffmpegCmd = [
      "ffmpeg -y -i", `"${inputFilePath}"`,
      "-map 0:v:0 -map 0:a? -threads 0",
      "-c:v libx264 -preset ultrafast -profile:v high -level:v 4.1",
      "-pix_fmt yuv420p -crf 24 -maxrate 2500k -bufsize 5000k",
      `-vf "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"`,
      "-g 60 -keyint_min 30 -movflags +faststart",
      "-c:a aac -b:a 128k -ar 44100 -ac 2",
      `"${outputFilePath}"`
    ].join(" ");
    await execAsync(ffmpegCmd, { timeout: 120000 });
    const optimizedBuffer = await fs.promises.readFile(outputFilePath);
    const optimizedSize = optimizedBuffer.length;
    return {
      buffer: optimizedBuffer,
      originalSize,
      optimizedSize,
      compressionRatioPercent: Math.max(0, Math.round(((originalSize - optimizedSize) / originalSize) * 100)),
      durationMs: Date.now() - startTime,
      codec: "H.264 / AVC (libx264, yuv420p, +faststart)"
    };
  } catch (err: any) {
    console.warn(`[H.264 Transcoder] Falling back to original video: ${err?.message || err}`);
    return {
      buffer: videoBuffer,
      originalSize,
      optimizedSize: originalSize,
      compressionRatioPercent: 0,
      durationMs: Date.now() - startTime,
      codec: "Original (Fallback)"
    };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface HlsJob {
  id: string;
  reelId?: string;
  publicacionId?: string;
  sourceName: string;
  status: "queued" | "transcoding" | "uploading_cdn" | "completed" | "failed";
  progress: number;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  totalSegments?: number;
  masterM3u8Url?: string;
  error?: string;
}

class HlsTranscoderQueue {
  private queue: Array<{
    job: HlsJob;
    videoBuffer: Buffer;
    bucket: Bucket;
    bucketName: string;
    onComplete?: (result: TranscodeHlsResult) => Promise<void> | void;
    onError?: (err: Error) => void;
  }> = [];
  private jobsMap = new Map<string, HlsJob>();
  private maxConcurrent = 2;
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

  public enqueue(jobId: string, videoBuffer: Buffer, sourceName: string, bucket: Bucket, bucketName: string, options?: {
    reelId?: string;
    publicacionId?: string;
    onComplete?: (result: TranscodeHlsResult) => Promise<void> | void;
    onError?: (err: Error) => void;
  }): HlsJob {
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
    this.queue.push({ job, videoBuffer, bucket, bucketName, onComplete: options?.onComplete, onError: options?.onError });
    this.processNext();
    return job;
  }

  public getJob(id: string): HlsJob | undefined { return this.jobsMap.get(id); }
  public getAllJobs(): HlsJob[] { return Array.from(this.jobsMap.values()).sort((a, b) => b.queuedAt - a.queuedAt); }
  public getTelemetry() { return { ...this.telemetry, activeWorkers: this.activeWorkers, queueLength: this.queue.length }; }

  private async processNext() {
    if (this.activeWorkers >= this.maxConcurrent || this.queue.length === 0) return;
    const task = this.queue.shift();
    if (!task) return;
    this.activeWorkers++;
    const { job, videoBuffer, bucket, bucketName, onComplete, onError } = task;
    job.status = "transcoding";
    job.startedAt = Date.now();
    job.progress = 20;

    try {
      const result = await transcodeVideoToHLS(videoBuffer, job.id, bucket, bucketName, progress => {
        job.progress = progress;
        if (progress > 80) job.status = "uploading_cdn";
      });
      job.status = "completed";
      job.progress = 100;
      job.completedAt = Date.now();
      job.durationMs = job.completedAt - (job.startedAt || job.queuedAt);
      job.totalSegments = result.totalSegments;
      job.masterM3u8Url = result.masterM3u8Url;
      this.telemetry.completedJobs++;
      this.telemetry.totalSegmentsGenerated += result.totalSegments;
      this.telemetry.latencies.push(job.durationMs);
      if (this.telemetry.latencies.length > 100) this.telemetry.latencies.shift();
      this.telemetry.averageLatencyMs = Math.round(this.telemetry.latencies.reduce((a, b) => a + b, 0) / this.telemetry.latencies.length);
      await onComplete?.(result);
    } catch (err: any) {
      job.status = "failed";
      job.error = err?.message || String(err);
      job.completedAt = Date.now();
      job.durationMs = job.completedAt - (job.startedAt || job.queuedAt);
      this.telemetry.failedJobs++;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.activeWorkers--;
      setImmediate(() => this.processNext());
    }
  }
}

export const hlsQueue = new HlsTranscoderQueue();

const HLS_VARIANTS = [
  { name: "360p", width: 360, height: 640, videoBitrate: "500k", maxrate: "650k", bufsize: "1000k", bandwidth: 650000 },
  { name: "540p", width: 540, height: 960, videoBitrate: "900k", maxrate: "1100k", bufsize: "1800k", bandwidth: 1150000 },
  { name: "720p", width: 720, height: 1280, videoBitrate: "1500k", maxrate: "1800k", bufsize: "3000k", bandwidth: 1650000 },
] as const;

function buildAdaptiveFfmpegCommand(inputFilePath: string, outputDir: string, segmentDuration: number): string {
  const splitLabels = HLS_VARIANTS.map(v => `[v${v.name}]`).join("");
  const scaledLabels = HLS_VARIANTS.map(v => `[${v.name}]`).join("");
  const filter = `[0:v:0]split=${HLS_VARIANTS.length}${splitLabels};` + HLS_VARIANTS.map(v => `[v${v.name}]scale=${v.width}:${v.height}:force_original_aspect_ratio=decrease:force_divisible_by=2[${v.name}]`).join(";");
  const maps = HLS_VARIANTS.map((v, i) => `-map "[${v.name}]" -map 0:a? -c:v:${i} libx264 -preset veryfast -profile:v main -pix_fmt yuv420p -b:v:${i} ${v.videoBitrate} -maxrate:v:${i} ${v.maxrate} -bufsize:v:${i} ${v.bufsize} -g:v:${i} 60 -keyint_min:v:${i} 60 -sc_threshold:v:${i} 0 -c:a:${i} aac -b:a:${i} 96k -ar:a:${i} 44100 -ac:a:${i} 2`).join(" ");
  const outputs = HLS_VARIANTS.map((v, i) => `-f hls -hls_time ${segmentDuration} -hls_playlist_type vod -hls_list_size 0 -hls_flags independent_segments -hls_segment_filename "${path.join(outputDir, v.name, "segment_%03d.ts")}" "${path.join(outputDir, v.name, "index.m3u8")}"`).join(" ");
  return [
    "ffmpeg -y -i", `"${inputFilePath}"`,
    `-filter_complex "${filter}"`,
    maps,
    "-var_stream_map", `"${HLS_VARIANTS.map((v, i) => `v:${i},a:${i}`).join(" ")}"`,
    outputs
  ].join(" ");
}

export async function transcodeVideoToHLS(videoBuffer: Buffer, videoId: string, bucket: Bucket, bucketName: string, onProgress?: (progress: number) => void): Promise<TranscodeHlsResult> {
  const startTime = Date.now();
  const tmpDir = path.join(os.tmpdir(), `hls_job_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, "input_source.mp4");
  const outputDir = path.join(tmpDir, "output_hls");
  await fs.promises.mkdir(outputDir, { recursive: true });
  for (const variant of HLS_VARIANTS) await fs.promises.mkdir(path.join(outputDir, variant.name), { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);
  onProgress?.(20);

  try {
    const segmentDuration = 3;
    const ffmpegCmd = buildAdaptiveFfmpegCommand(inputFilePath, outputDir, segmentDuration);
    onProgress?.(35);
    await execAsync(ffmpegCmd, { timeout: 180000 });
    onProgress?.(60);

    const masterLines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];
    for (const variant of HLS_VARIANTS) {
      masterLines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},AVERAGE-BANDWIDTH=${Math.round(variant.bandwidth * 0.85)},RESOLUTION=${variant.width}x${variant.height},CODECS=\"avc1.4d401f,mp4a.40.2\",NAME=\"${variant.name}\"`);
      masterLines.push(`${variant.name}/index.m3u8`);
    }
    const masterPath = path.join(outputDir, "master.m3u8");
    await fs.promises.writeFile(masterPath, masterLines.join("\n") + "\n", "utf8");

    const localFiles: string[] = [];
    async function collect(dir: string, relative = "") {
      for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        const rel = path.join(relative, entry.name);
        if (entry.isDirectory()) await collect(absolute, rel);
        else localFiles.push(rel);
      }
    }
    await collect(outputDir);

    const destinationFolder = `hls/${videoId}`;
    let uploadedCount = 0;
    onProgress?.(65);

    await Promise.all(localFiles.map(async relativeFile => {
      const localPath = path.join(outputDir, relativeFile);
      const destination = `${destinationFolder}/${relativeFile.replace(/\\/g, "/")}`;
      const gcsFile = bucket.file(destination);
      const isPlaylist = relativeFile.endsWith(".m3u8");
      const isSegment = relativeFile.endsWith(".ts");
      const fileBuffer = await fs.promises.readFile(localPath);
      await new Promise<void>((resolve, reject) => {
        const stream = gcsFile.createWriteStream({
          resumable: false,
          metadata: {
            contentType: isPlaylist ? "application/vnd.apple.mpegurl" : isSegment ? "video/mp2t" : "application/octet-stream",
            cacheControl: isSegment ? "public, max-age=31536000, immutable" : "public, max-age=60",
          },
        });
        stream.once("error", reject);
        stream.once("finish", resolve);
        stream.end(fileBuffer);
      });
      uploadedCount++;
      onProgress?.(65 + Math.round((uploadedCount / localFiles.length) * 30));
    }));

    const masterM3u8Url = `https://storage.googleapis.com/${bucketName}/${destinationFolder}/master.m3u8`;
    const variantUrls = HLS_VARIANTS.map(v => `https://storage.googleapis.com/${bucketName}/${destinationFolder}/${v.name}/index.m3u8`);
    const totalSegments = localFiles.filter(f => f.endsWith(".ts")).length;
    const latencyMs = Date.now() - startTime;
    onProgress?.(100);
    return { masterM3u8Url, variantUrls, totalSegments, bucketPath: destinationFolder, latencyMs };
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function deleteHlsStreamBatch(bucket: Bucket, hlsUrlOrVideoId: string): Promise<{ success: boolean; deletedCount: number; prefix: string }> {
  try {
    let prefix = "";
    if (hlsUrlOrVideoId.includes("hls/")) {
      const match = hlsUrlOrVideoId.match(/hls\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) prefix = `hls/${match[1]}`;
    } else if (hlsUrlOrVideoId.startsWith("hls_")) {
      prefix = `hls/${hlsUrlOrVideoId}`;
    }
    if (!prefix) return { success: false, deletedCount: 0, prefix: "" };
    await bucket.deleteFiles({ prefix: `${prefix}/`, force: true });
    return { success: true, deletedCount: 1, prefix };
  } catch (err) {
    console.error(`[HLS Cleanup] Failed:`, err);
    return { success: false, deletedCount: 0, prefix: "" };
  }
}

export async function getOrGenerateDynamicHLS(videoUrl: string): Promise<{ masterM3u8: string; files: Map<string, Buffer> }> {
  const masterM3u8 = `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,NAME="Direct Stream"\n${videoUrl}\n`;
  return { masterM3u8, files: new Map([["index.m3u8", Buffer.from(masterM3u8, "utf8")]]) };
}
