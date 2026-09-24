import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { Bucket } from "@google-cloud/storage";
import { bucket, bucketName, isGcsAvailable } from "./config/storage";
import ffmpegStatic from "ffmpeg-static";

const execAsync = promisify(exec);

/**
 * Dynamically resolves the ffmpeg binary executable.
 * Prioritizes process.env.FFMPEG_PATH, then bundled ffmpeg-static binary,
 * then standard system paths, and falls back to "ffmpeg".
 */
export function getFfmpegBinary(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const staticPath = (typeof ffmpegStatic === "string" ? ffmpegStatic : (ffmpegStatic as any)?.default) || "";
  if (staticPath && fs.existsSync(staticPath)) {
    return staticPath;
  }
  const candidates = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "ffmpeg";
}

export interface TranscodeHlsResult {
  masterM3u8Url: string;
  variantUrls: string[];
  totalSegments: number;
  bucketPath: string;
  durationSec?: number;
  latencyMs: number;
  posterUrl?: string;
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
 * Direct HLS transcode generator.
 * Produces pure HLS stream (.m3u8 playlist + .ts chunks) in memory / temporary directory
 * and deploys directly to Google Cloud Storage.
 */

/**
 * Persists a transcode output directory in Google Cloud Storage.
 * Local files are never persisted on disk; only GCS public URLs are returned.
 */
async function persistDirectHlsToGcs(transcodeOutputDir: string, videoId: string): Promise<string> {
  const gcsReady = await isGcsAvailable();
  if (!gcsReady) {
    throw new Error("Google Cloud Storage no está disponible. No se puede publicar el stream HLS sin conexión a GCS.");
  }

  const files = await fs.promises.readdir(transcodeOutputDir);
  const destinationFolder = `hls/${videoId}`;
  await Promise.all(files.map(async (fileName) => {
    const filePath = path.join(transcodeOutputDir, fileName);
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === ".m3u8" ? "application/vnd.apple.mpegurl" :
      ext === ".ts" ? "video/mp2t" :
      ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
      "application/octet-stream";
    const cacheControl =
      ext === ".ts" ? "public, max-age=31536000, immutable" :
      ext === ".m3u8" ? "public, max-age=60" :
      "public, max-age=86400";
    await bucket.file(`${destinationFolder}/${fileName}`).save(
      await fs.promises.readFile(filePath),
      { resumable: false, metadata: { contentType, cacheControl } }
    );
  }));

  return `https://storage.googleapis.com/${bucketName}/${destinationFolder}/index.m3u8`;
}
export async function transcodeVideoToLocalHlsDirect(
  videoBuffer: Buffer,
  videoId: string,
  originalName: string = "video.mp4"
): Promise<string> {
  const ext = path.extname(originalName) || ".mp4";
  const tmpDir = path.join(os.tmpdir(), `hls_direct_${videoId}_${Date.now()}`);
  const inputFilePath = path.join(tmpDir, `input_media${ext}`);
  const transcodeOutputDir = path.join(tmpDir, "hls_output");

  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.mkdir(transcodeOutputDir, { recursive: true });
  await fs.promises.writeFile(inputFilePath, videoBuffer);

  const playlistPath = path.join(transcodeOutputDir, "index.m3u8");
  const segmentPattern = path.join(transcodeOutputDir, "segment_%03d.ts");
  const ffmpegBin = getFfmpegBinary();

  try {
    const cmd = [
      `"${ffmpegBin}" -y -i`,
      `"${inputFilePath}"`,
      "-map 0:v:0? -map 0:a:0? -sn -dn",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -crf 26",
      `-vf "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1"`,
      "-r 30 -g 60 -keyint_min 60 -sc_threshold 0",
      "-force_key_frames " + "\"expr:gte(t,n_forced*2)\"",
      "-avoid_negative_ts make_zero -fflags +genpts",
      "-c:a aac -b:a 128k -ar 44100 -ac 2",
      "-nostats -loglevel warning",
      "-f hls -hls_time 2 -hls_playlist_type vod -hls_list_size 0 -hls_flags independent_segments",
      `-hls_segment_filename "${segmentPattern}"`,
      `"${playlistPath}"`
    ].join(" ");

    await execAsync(cmd, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });

    if (fs.existsSync(playlistPath) && (await fs.promises.stat(playlistPath)).size > 0) {
      const masterContent = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=720x1280,NAME="Adaptive 720p"\nindex.m3u8\n`;
      await fs.promises.writeFile(path.join(transcodeOutputDir, "master.m3u8"), masterContent);
      return await persistDirectHlsToGcs(transcodeOutputDir, videoId);
    }
  } catch (err1: any) {
    console.warn(`⚠️ [HLS Direct] Primary segmentation failed (${err1.message}). Trying normalized 2-pass fallback...`);
  }

  const normalizedMp4 = path.join(tmpDir, "normalized.mp4");
  try {
    const normalizeCmd = [
      `"${ffmpegBin}" -y -i`,
      `"${inputFilePath}"`,
      "-map 0:v:0? -map 0:a:0? -sn -dn",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -r 30",
      "-c:a aac -b:a 128k -ar 44100 -ac 2",
      "-movflags +faststart",
      "-nostats -loglevel warning",
      `"${normalizedMp4}"`
    ].join(" ");

    await execAsync(normalizeCmd, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });

    const segmentCmd = [
      `"${ffmpegBin}" -y -i`,
      `"${normalizedMp4}"`,
      "-c copy",
      "-f hls -hls_time 2 -hls_playlist_type vod -hls_list_size 0 -hls_flags independent_segments",
      `-hls_segment_filename "${segmentPattern}"`,
      `"${playlistPath}"`
    ].join(" ");

    await execAsync(segmentCmd, { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });

    if (fs.existsSync(playlistPath) && (await fs.promises.stat(playlistPath)).size > 0) {
      const masterContent = `#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=720x1280,NAME="Adaptive 720p"\nindex.m3u8\n`;
      await fs.promises.writeFile(path.join(transcodeOutputDir, "master.m3u8"), masterContent);
      // Generate poster.jpg from the video
      const posterPath = path.join(transcodeOutputDir, "poster.jpg");
      await execAsync(`"${ffmpegBin}" -y -ss 00:00:00.500 -i "${normalizedMp4}" -vframes 1 -q:v 2 "${posterPath}"`).catch(() => {});
      if (!fs.existsSync(posterPath)) {
        await execAsync(`"${ffmpegBin}" -y -i "${normalizedMp4}" -vframes 1 -q:v 2 "${posterPath}"`).catch(() => {});
      }
      return await persistDirectHlsToGcs(transcodeOutputDir, videoId);
    }
  } catch (err2: any) {
    console.warn(`⚠️ [HLS Direct] Secondary normalization failed (${err2.message}). Creating single-segment stream fail-safe...`);
  }

  try {
    const singleTsPath = path.join(transcodeOutputDir, "segment_000.ts");
    const transcodeSingleCmd = [
      `"${ffmpegBin}" -y -i`,
      `"${inputFilePath}"`,
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac",
      "-f mpegts",
      `"${singleTsPath}"`
    ].join(" ");

    await execAsync(transcodeSingleCmd, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 });

    if (!fs.existsSync(singleTsPath)) {
      throw new Error("FFmpeg no pudo generar el segmento MPEG-TS");
    }

    const stat = await fs.promises.stat(singleTsPath);
    if (stat.size <= 0) {
      throw new Error("FFmpeg generó un segmento MPEG-TS vacío");
    }

    const simpleM3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:60\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:60.0,\nsegment_000.ts\n#EXT-X-ENDLIST\n`;
    await fs.promises.writeFile(playlistPath, simpleM3u8);
    await fs.promises.writeFile(path.join(transcodeOutputDir, "master.m3u8"), simpleM3u8);

    const posterPath = path.join(transcodeOutputDir, "poster.jpg");
    await execAsync(`"${ffmpegBin}" -y -i "${singleTsPath}" -vframes 1 -q:v 2 "${posterPath}"`).catch(() => {});

    return await persistDirectHlsToGcs(transcodeOutputDir, videoId);
  } catch (finalErr: any) {
    console.error(`🚨 [HLS Direct] Final fail-safe error:`, finalErr);
    throw finalErr instanceof Error ? finalErr : new Error(String(finalErr));
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
    const ffmpegBin = getFfmpegBinary();
    const cmd = [`"${ffmpegBin}" -y -i`, `"${inputFilePath}"`, "-map 0:v:0 -map 0:a? -threads 0", "-c:v libx264 -preset ultrafast -profile:v high -level:v 4.1 -pix_fmt yuv420p", "-crf 24 -maxrate 2500k -bufsize 5000k", `-vf "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"`, "-g 60 -keyint_min 30 -c:a aac -b:a 128k -ar 44100 -ac 2", `"${outputFilePath}"`].join(" ");
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
  const inputFilePath = path.join(tmpDir, "input_media.mp4");
  const outputDir = path.join(tmpDir, "output_hls");

  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });
    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.writeFile(inputFilePath, videoBuffer);

    if (onProgress) onProgress(20);

    console.log(`🎬 [HLS Pre-Transcoder] Starting HLS segmentation for video ${videoId}...`);

    const segmentDuration = 2;
    const ffmpegBin = getFfmpegBinary();

    // Generate multi-bitrate variant 1: 720p
    const playlist720 = path.join(outputDir, "720p.m3u8");
    const segmentPattern720 = path.join(outputDir, "720p_%03d.ts");
    const cmd720 = [
      `"${ffmpegBin}" -y -i`,
      `"${inputFilePath}"`,
      "-map 0:v:0? -map 0:a:0? -sn -dn",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -b:v 1800k -maxrate 2200k -bufsize 3600k",
      `-vf "scale=w='min(720,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1"`,
      "-r 30 -g 60 -keyint_min 60 -sc_threshold 0",
      "-force_key_frames " + "\"expr:gte(t,n_forced*2)\"",
      "-avoid_negative_ts make_zero -fflags +genpts",
      "-c:a aac -b:a 128k -ar 44100 -ac 2",
      "-nostats -loglevel warning",
      `-f hls -hls_time ${segmentDuration} -hls_playlist_type vod -hls_list_size 0 -hls_flags independent_segments`,
      `-hls_segment_filename "${segmentPattern720}"`,
      `"${playlist720}"`
    ].join(" ");

    // Generate multi-bitrate variant 2: 480p
    const playlist480 = path.join(outputDir, "480p.m3u8");
    const segmentPattern480 = path.join(outputDir, "480p_%03d.ts");
    const cmd480 = [
      `"${ffmpegBin}" -y -i`,
      `"${inputFilePath}"`,
      "-map 0:v:0? -map 0:a:0? -sn -dn",
      "-c:v libx264 -preset ultrafast -pix_fmt yuv420p -b:v 800k -maxrate 1000k -bufsize 1600k",
      `-vf "scale=w='min(480,iw)':h='min(854,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1"`,
      "-r 30 -g 60 -keyint_min 60 -sc_threshold 0",
      "-force_key_frames " + "\"expr:gte(t,n_forced*2)\"",
      "-avoid_negative_ts make_zero -fflags +genpts",
      "-c:a aac -b:a 96k -ar 44100 -ac 2",
      "-nostats -loglevel warning",
      `-f hls -hls_time ${segmentDuration} -hls_playlist_type vod -hls_list_size 0 -hls_flags independent_segments`,
      `-hls_segment_filename "${segmentPattern480}"`,
      `"${playlist480}"`
    ].join(" ");

    if (onProgress) onProgress(35);

    try {
      await execAsync(cmd720, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });
      if (onProgress) onProgress(55);
      await execAsync(cmd480, { timeout: 180000, maxBuffer: 50 * 1024 * 1024 });
    } catch (variantErr: any) {
      console.warn(`⚠️ [HLS Transcoder] Dual-variant error (${variantErr.message}). Ensuring at least 720p exists...`);
      if (!fs.existsSync(playlist720)) {
        throw variantErr;
      }
    }

    console.log(`✅ [HLS Pre-Transcoder] Local multi-bitrate HLS segmentation finished for ${videoId}`);

    const has480 = fs.existsSync(playlist480);
    const masterLines = [
      "#EXTM3U",
      "#EXT-X-VERSION:4",
      '#EXT-X-STREAM-INF:BANDWIDTH=1800000,RESOLUTION=720x1280,NAME="720p"',
      "720p.m3u8",
    ];
    if (has480) {
      masterLines.push(
        '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=480x854,NAME="480p"',
        "480p.m3u8"
      );
    }
    const masterContent = masterLines.join("\n") + "\n";
    await fs.promises.writeFile(path.join(outputDir, "master.m3u8"), masterContent);
    // Write index.m3u8 as backward-compatible alias to master
    await fs.promises.writeFile(path.join(outputDir, "index.m3u8"), masterContent);

    const posterPath = path.join(outputDir, "poster.jpg");
    await execAsync(`"${ffmpegBin}" -y -ss 00:00:00.500 -i "${inputFilePath}" -frames:v 1 -q:v 3 "${posterPath}"`, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).catch(() => undefined);

    if (onProgress) onProgress(75);

    const files = await fs.promises.readdir(outputDir);
    const destinationFolder = `hls/${videoId}`;

    let masterM3u8Url = "";
    let posterUrl = "";
    let usedGcs = false;

    const gcsReady = await isGcsAvailable();
    if (!gcsReady) {
      throw new Error("Google Cloud Storage no está disponible. No se puede subir el stream HLS.");
    }

    if (files.length === 0) {
      throw new Error("No se generaron archivos HLS durante la transcodificación.");
    }

    console.log(`📦 [HLS Pre-Transcoder] Subiendo ${files.length} archivos HLS multi-bitrate a Google Cloud Storage "${bucketName}"...`);
    let uploadedCount = 0;

    const uploadPromises = files.map(async (fileName) => {
      const filePath = path.join(outputDir, fileName);
      const isPlaylist = fileName.endsWith(".m3u8");
      const isSegment = fileName.endsWith(".ts");
      const isPoster = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg");

      const destination = `${destinationFolder}/${fileName}`;
      const gcsFile = bucket.file(destination);

      const contentType = isPlaylist
        ? "application/vnd.apple.mpegurl"
        : isSegment
        ? "video/mp2t"
        : isPoster
        ? "image/jpeg"
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
        stream.on("error", (err: any) => reject(err));
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
    masterM3u8Url = `https://storage.googleapis.com/${bucketName}/${destinationFolder}/master.m3u8`;
    posterUrl = `https://storage.googleapis.com/${bucketName}/${destinationFolder}/poster.jpg`;
    console.log(`🚀 [HLS Pre-Transcoder] Video HLS desplegado exclusivamente en GCS: ${masterM3u8Url}`);

    const segmentCount = files.filter((f) => f.endsWith(".ts")).length;
    const totalLatencyMs = Date.now() - startTime;

    return {
      masterM3u8Url,
      variantUrls: [masterM3u8Url],
      totalSegments: Math.max(1, segmentCount),
      bucketPath: destinationFolder,
      durationSec: undefined,
      latencyMs: totalLatencyMs,
      posterUrl: posterUrl || undefined,
    };
  } catch (ffmpegErr: any) {
    console.error(`❌ [HLS Pre-Transcoder] Error en transcodificación o subida a GCS:`, ffmpegErr);
    throw ffmpegErr;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Batch Cleanup Function: Delete all HLS segments (.ts), playlists (.m3u8), and master file
 * from Google Cloud Storage in a single bulk operation. No local disk storage used.
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

    try {
      console.log(`🧹 [HLS Cleanup] Eliminando archivos HLS de GCS en prefijo "${prefix}/"...`);
      await bucket.deleteFiles({
        prefix: `${prefix}/`,
        force: true
      });
      console.log(`✨ [HLS Cleanup] Archivos HLS eliminados de GCS con éxito: "${prefix}"`);
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
