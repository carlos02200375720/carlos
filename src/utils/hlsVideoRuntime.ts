import Hls from "hls.js";
import { apiFetch } from "../config";

type ReelMedia = { videoUrl?: string; hlsUrl?: string };

const originalToHls = new Map<string, string>();
const attached = new WeakMap<HTMLVideoElement, { hls: Hls | null; originalSrc: string; hlsSrc: string }>();
let started = false;
let reelsLoaded = false;

function normalize(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url.trim();
  }
}

async function loadReelManifestMap() {
  if (reelsLoaded || typeof window === "undefined") return;
  reelsLoaded = true;
  try {
    const response = await apiFetch("/api/reels", undefined, 15000);
    if (!response.ok) return;
    const data = await response.json();
    const reels: ReelMedia[] = Array.isArray(data) ? data : Array.isArray(data?.reels) ? data.reels : [];
    for (const reel of reels) {
      if (reel.videoUrl && reel.hlsUrl && reel.hlsUrl.includes(".m3u8")) {
        originalToHls.set(normalize(reel.videoUrl), reel.hlsUrl.trim());
      }
    }
    document.querySelectorAll<HTMLVideoElement>("video").forEach(prepareVideo);
  } catch {
    // The normal MP4 player remains the safe fallback if the manifest lookup fails.
  }
}

function cleanup(video: HTMLVideoElement) {
  const state = attached.get(video);
  if (!state) return;
  state.hls?.destroy();
  attached.delete(video);
}

function attachHls(video: HTMLVideoElement, hlsSrc: string) {
  const current = attached.get(video);
  if (current?.hlsSrc === hlsSrc) return;
  cleanup(video);

  const originalSrc = video.currentSrc || video.src;
  if (!originalSrc) return;

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    attached.set(video, { hls: null, originalSrc, hlsSrc });
    video.src = hlsSrc;
    video.preload = "metadata";
    return;
  }

  if (!Hls.isSupported()) return;

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 8,
    maxBufferLength: 12,
    maxMaxBufferLength: 24,
    startLevel: -1,
    capLevelToPlayerSize: true,
    abrEwmaDefaultEstimate: 1000000,
    abrBandWidthFactor: 0.75,
    abrBandWidthUpFactor: 0.7,
  });

  attached.set(video, { hls, originalSrc, hlsSrc });
  hls.loadSource(hlsSrc);
  hls.attachMedia(video);

  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      hls.startLoad();
      return;
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      hls.recoverMediaError();
      return;
    }
    cleanup(video);
    video.src = originalSrc;
    video.load();
  });
}

function prepareVideo(video: HTMLVideoElement) {
  if (video.dataset.hlsRuntime === "1") return;
  video.dataset.hlsRuntime = "1";

  const process = () => {
    const src = video.currentSrc || video.src;
    if (!src) return;
    const hlsSrc = src.includes(".m3u8") ? src : originalToHls.get(normalize(src));
    if (hlsSrc) attachHls(video, hlsSrc);
  };

  video.addEventListener("loadedmetadata", process, { passive: true });
  video.addEventListener("play", process, { passive: true });

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target !== video) continue;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
        video.preload = "metadata";
        process();
      } else if (entry.intersectionRatio <= 0.05) {
        video.pause();
        video.preload = "none";
      }
    }
  }, { threshold: [0, 0.05, 0.55, 1] });
  observer.observe(video);

  process();
}

export function startHlsVideoRuntime() {
  if (started || typeof window === "undefined") return;
  started = true;

  const scan = () => document.querySelectorAll<HTMLVideoElement>("video").forEach(prepareVideo);
  scan();
  loadReelManifestMap();

  const mutationObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLVideoElement) prepareVideo(node);
          node.querySelectorAll<HTMLVideoElement>("video").forEach(prepareVideo);
        });
      }
      if (mutation.type === "attributes" && mutation.target instanceof HTMLVideoElement) {
        prepareVideo(mutation.target);
      }
    }
  });
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
}
