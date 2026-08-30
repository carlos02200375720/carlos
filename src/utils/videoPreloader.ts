/**
 * Video Preload & Smooth Buffer Cache Engine
 * Preloads upcoming videos in the background to ensure instant playback.
 */

class VideoPreloader {
  private preloadedUrls = new Set<string>();
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

  private processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.queue.forEach((url) => {
        if (this.preloadedUrls.has(url)) return;

        // Pre-warm media decoder buffer using pool of background video elements
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
            this.preloadedUrls.add(url);
          } catch {
            // ignore
          }
        }
      });
    } finally {
      this.isProcessing = false;
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
    this.queue = [];
  }
}

export const videoPreloader = new VideoPreloader();
