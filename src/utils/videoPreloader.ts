/**
 * Conservative Reel preloader.
 * Only fetches metadata for the adjacent item; playback/buffering is owned by the
 * focused player. This avoids a hidden video competing for bandwidth/decoder time.
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
    return !!url && this.cachedUrls.has(url);
  }

  public preloadNext(videoUrl?: string) {
    if (!videoUrl || typeof document === "undefined") return;

    // A single hidden <video> is used only for metadata. Never call play() and never
    // use preload="auto" here: the visible Reel owns actual buffering.
    try {
      if (!this.warmupVideo) {
        this.warmupVideo = document.createElement("video");
        this.warmupVideo.muted = true;
        this.warmupVideo.playsInline = true;
        this.warmupVideo.preload = "metadata";
        this.warmupVideo.setAttribute("aria-hidden", "true");
        this.warmupVideo.style.display = "none";
      }

      if (this.warmupVideo.src !== videoUrl) {
        this.warmupVideo.src = videoUrl;
        this.warmupVideo.load();
      }
      this.cachedUrls.add(videoUrl);
    } catch {
      // Safe fallback on restricted WebViews.
    }
  }

  public updateQueue(videoUrls: string[], currentIndex: number) {
    const nextUrl = videoUrls[currentIndex + 1];
    if (nextUrl) this.preloadNext(nextUrl);
  }

  public clearAll() {
    if (this.warmupVideo) {
      try {
        this.warmupVideo.pause();
        this.warmupVideo.removeAttribute("src");
        this.warmupVideo.load();
      } catch {}
      this.warmupVideo = null;
    }
    this.cachedUrls.clear();
  }
}

export const videoPreloader = new VideoPreloader();
