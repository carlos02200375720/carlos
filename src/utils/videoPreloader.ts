/**
 * Video Preload & Local Memory Buffer Cache Engine
 * Keeps a continuous sliding window of up to 10 upcoming videos pre-downloaded
 * into device memory (RAM / Blob URLs) so Reels playback is completely instant and smooth.
 */

class VideoPreloader {
  private cache = new Map<string, { blobUrl: string; timestamp: number }>();
  private activeControllers = new Map<string, AbortController>();
  private inFlight = new Set<string>();
  private listeners = new Set<() => void>();
  private maxCacheSize = 15; // Keep active window of up to 15 video blobs in RAM
  private isProcessing = false;
  private queue: string[] = [];

  // Subscribe to cache updates (triggers React re-render when a video finishes downloading to RAM)
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error("Error in video cache listener:", err);
      }
    });
  }

  // Get cached blob: URL from device RAM, or fallback to original URL
  public getVideoSrc(url?: string): string {
    if (!url) return "";
    const cached = this.cache.get(url);
    if (cached) {
      return cached.blobUrl;
    }
    return url;
  }

  public isCached(url?: string): boolean {
    if (!url) return false;
    return this.cache.has(url);
  }

  // Update target queue for next 10 videos from the current active reel index
  public updateQueue(videoUrls: string[], currentIndex: number) {
    if (!videoUrls || videoUrls.length === 0) return;

    // Filter valid URLs
    const validUrls = videoUrls.filter((u) => u && typeof u === "string" && (u.startsWith("http") || u.startsWith("blob:")));

    // Select the current video + next 9 videos (total 10 in priority window)
    const targetUrls: string[] = [];
    const count = Math.min(10, validUrls.length);

    for (let i = 0; i < count; i++) {
      const idx = (currentIndex + i) % validUrls.length;
      const url = validUrls[idx];
      if (url && !targetUrls.includes(url)) {
        targetUrls.push(url);
      }
    }

    this.queue = targetUrls;
    this.cleanupOld(targetUrls);
    this.processQueue();
  }

  // Clean up videos that are no longer in the priority window to free RAM
  private cleanupOld(keepUrls: string[]) {
    if (this.cache.size <= this.maxCacheSize) return;

    const keepSet = new Set(keepUrls);
    for (const [url, item] of this.cache.entries()) {
      if (!keepSet.has(url)) {
        try {
          URL.revokeObjectURL(item.blobUrl);
        } catch {
          // ignore
        }
        this.cache.delete(url);
      }
      if (this.cache.size <= this.maxCacheSize) break;
    }
  }

  // Sequentially or in small batches download videos to local memory
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // Grab the next URL that isn't cached or in flight
        const nextUrl = this.queue.shift();
        if (!nextUrl || this.cache.has(nextUrl) || this.inFlight.has(nextUrl) || nextUrl.startsWith("blob:")) {
          continue;
        }

        await this.downloadVideoToMemory(nextUrl);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async downloadVideoToMemory(url: string): Promise<void> {
    this.inFlight.add(url);
    const controller = new AbortController();
    this.activeControllers.set(url, controller);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        // If HTTP status is not 2xx, fallback to standard streaming
        return;
      }

      const blob = await response.blob();
      // Ensure it is typed as video/mp4 blob
      const videoBlob = blob.type.startsWith("video/") 
        ? blob 
        : new Blob([blob], { type: "video/mp4" });

      const blobUrl = URL.createObjectURL(videoBlob);
      this.cache.set(url, {
        blobUrl,
        timestamp: Date.now(),
      });

      // Notify components that this video is now instantly ready in RAM
      this.notify();
    } catch (err: any) {
      if (err.name !== "AbortError") {
        // Silent fallback to direct URL
      }
    } finally {
      this.inFlight.delete(url);
      this.activeControllers.delete(url);
    }
  }

  // Clear all cached memory blobs (e.g. on unmount or logout)
  public clearAll() {
    this.activeControllers.forEach((ctrl) => ctrl.abort());
    this.activeControllers.clear();
    this.inFlight.clear();
    this.cache.forEach((item) => {
      try {
        URL.revokeObjectURL(item.blobUrl);
      } catch {
        // ignore
      }
    });
    this.cache.clear();
    this.queue = [];
  }
}

export const videoPreloader = new VideoPreloader();
