/**
 * Video Preload & Adaptive HLS Chunk Buffer Engine
 * Preloads upcoming video segments (.m3u8 manifests and .ts chunks) in the background
 * to ensure instantaneous, stutter-free playback when swiping between reels.
 */

class VideoPreloader {
  private preloadedUrls = new Set<string>();
  private preloadedSegments = new Set<string>();
  private prefetchElements = new Map<string, HTMLVideoElement>();
  private maxPrefetchPool = 4;
  private queue: string[] = [];
  private isProcessing = false;

  public subscribe(_listener: () => void): () => void {
    return () => {};
  }

  public getVideoSrc(url?: string): string {
    return url || "";
  }

  public isCached(url?: string): boolean {
    if (!url) return false;
    return this.preloadedUrls.has(url);
  }

  public updateQueue(videoUrls: string[], currentIndex: number) {
    if (!videoUrls || videoUrls.length === 0) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const validUrls = videoUrls.filter(
      (u) => u && typeof u === "string" && (u.startsWith("http") || u.startsWith("blob:") || u.startsWith("/"))
    );

    // Target the next 2 videos ahead and 1 behind for swipe readiness
    const targetUrls: string[] = [];
    const windowOffsets = [0, 1, 2, -1];

    windowOffsets.forEach((offset) => {
      const idx = (currentIndex + offset + validUrls.length) % validUrls.length;
      const url = validUrls[idx];
      if (url && !targetUrls.includes(url)) {
        targetUrls.push(url);
      }
    });

    this.queue = targetUrls;
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (const url of this.queue) {
        if (this.preloadedUrls.has(url)) continue;

        if (url.includes(".m3u8") || url.includes("/api/hls")) {
          // HLS adaptive preloading: Prefetch manifest and initial 2 TS chunks
          await this.preloadHlsManifestAndChunks(url);
          this.preloadedUrls.add(url);
        } else {
          // Direct MP4 preloading using background video elements
          this.preloadMp4Element(url);
          this.preloadedUrls.add(url);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async preloadHlsManifestAndChunks(m3u8Url: string) {
    try {
      const res = await fetch(m3u8Url, { cache: "default" });
      if (!res.ok) return;

      const manifestText = await res.text();
      const lines = manifestText.split("\n");
      const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf("/") + 1);

      // Find first 2 segment (.ts) or child playlist URLs
      const targetSegments: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const fullSegmentUrl = trimmed.startsWith("http") ? trimmed : `${baseUrl}${trimmed}`;
          targetSegments.push(fullSegmentUrl);
          if (targetSegments.length >= 2) break;
        }
      }

      // Prefetch initial segment chunks so browser caches them with immutable headers
      for (const segUrl of targetSegments) {
        if (!this.preloadedSegments.has(segUrl)) {
          this.preloadedSegments.add(segUrl);
          fetch(segUrl, { cache: "force-cache" }).catch(() => {});
        }
      }
    } catch {
      // ignore network errors in background preloader
    }
  }

  private preloadMp4Element(url: string) {
    if (!this.prefetchElements.has(url)) {
      try {
        if (this.prefetchElements.size >= this.maxPrefetchPool) {
          const oldestKey = this.prefetchElements.keys().next().value;
          if (oldestKey) {
            const oldEl = this.prefetchElements.get(oldestKey);
            if (oldEl) {
              oldEl.src = "";
              oldEl.load();
            }
            this.prefetchElements.delete(oldestKey);
          }
        }

        const bgVideo = document.createElement("video");
        bgVideo.preload = "auto";
        bgVideo.muted = true;
        bgVideo.playsInline = true;
        bgVideo.src = url;
        bgVideo.load();

        this.prefetchElements.set(url, bgVideo);
      } catch {
        // ignore
      }
    }
  }

  public clearAll() {
    this.prefetchElements.forEach((el) => {
      try {
        el.src = "";
        el.load();
      } catch {
        // ignore
      }
    });
    this.prefetchElements.clear();
    this.preloadedUrls.clear();
    this.preloadedSegments.clear();
    this.queue = [];
  }
}

export const videoPreloader = new VideoPreloader();
