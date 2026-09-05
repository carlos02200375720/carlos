/**
 * Video Preloader Utility
 * Provides a conservative preload strategy for an adjacent reel in the feed.
 */

class VideoPreloader {
  private warmupVideo: HTMLVideoElement | null = null;
  private cachedUrls = new Set<string>();

  public subscribe(_listener: () => void): () => void {
    return () => {};
  }

  public getVideoSrc(url?: string): string {
    return url || "";
  }

  public isCached(url?: string): boolean {
    if (!url) return false;
    return this.cachedUrls.has(url);
  }

  /**
   * Preload video buffer for the next index in the feed
   */
  public preloadNext(videoUrl?: string) {
    if (!videoUrl || typeof document === "undefined") return;
    this.cachedUrls.add(videoUrl);

    try {
      if (!this.warmupVideo) {
        this.warmupVideo = document.createElement("video");
        this.warmupVideo.muted = true;
        this.warmupVideo.playsInline = true;
        this.warmupVideo.setAttribute("aria-hidden", "true");
        this.warmupVideo.style.display = "none";
      }

      this.warmupVideo.preload = "metadata";
      if (this.warmupVideo.src !== videoUrl) {
        this.warmupVideo.src = videoUrl;
        this.warmupVideo.load();
      }
    } catch {
      // Graceful fallback if video creation is restricted
    }
  }

  public updateQueue(videoUrls: string[], currentIndex: number) {
    const nextUrl = videoUrls[currentIndex + 1];
    if (nextUrl) {
      this.preloadNext(nextUrl);
    }
  }

  public clearAll() {
    if (this.warmupVideo) {
      try {
        this.warmupVideo.pause();
        this.warmupVideo.src = "";
        this.warmupVideo.load();
      } catch {}
      this.warmupVideo = null;
    }
    this.cachedUrls.clear();
  }
}

export const videoPreloader = new VideoPreloader();

