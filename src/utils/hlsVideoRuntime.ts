import Hls from "hls.js";
import { apiFetch } from "../config";

type ReelMedia = { videoUrl?: string; hlsUrl?: string };
type VideoState = {
  hls: Hls | null;
  originalSrc: string;
  hlsSrc: string;
};

const originalToHls = new Map<string, string>();
const attached = new WeakMap<HTMLVideoElement, VideoState>();
const processors = new WeakMap<HTMLVideoElement, () => void>();
const observed = new WeakSet<HTMLVideoElement>();
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
    const reels: ReelMedia[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.reels)
        ? data.reels
        : [];

    for (const reel of reels) {
      const videoUrl = reel.videoUrl?.trim();
      const hlsUrl = reel.hlsUrl?.trim();
      if (videoUrl && hlsUrl && hlsUrl.includes(".m3u8")) {
        originalToHls.set(normalize(videoUrl), hlsUrl);
      }
    }

    document.querySelectorAll<HTMLVideoElement>("video").forEach(prepareVideo);
  } catch {
    // The original MP4 remains the safe fallback if the manifest lookup fails.
  }
}

function restoreOriginal(video: HTMLVideoElement, state: VideoState) {
  if (!state.originalSrc) return;
  const current = video.currentSrc || video.src;
  if (current === state.originalSrc) return;

  try {
    video.src = state.originalSrc;
    video.load();
  } catch {
    // Keep the browser's current media source if restoration is not possible.
  }
}

function cleanup(video: HTMLVideoElement, restore = false) {
  const state = attached.get(video);
  if (!state) return;

  state.hls?.destroy();
  attached.delete(video);

  if (restore) restoreOriginal(video, state);
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
    // A little more forward buffer absorbs short network/CPU hiccups without
    // keeping enough media around to recreate the original multi-video pressure.
    backBufferLength: 6,
    maxBufferLength: 20,
    maxMaxBufferLength: 40,
    maxBufferHole: 0.5,
    // Start conservatively at 360p. ABR can move up once it has real bandwidth data.
    startLevel: 0,
    capLevelToPlayerSize: true,
    abrEwmaDefaultEstimate: 650000,
    abrBandWidthFactor: 0.8,
    abrBandWidthUpFactor: 0.7,
    maxStarvationDelay: 2,
    maxLoadingDelay: 4,
    fragLoadingMaxRetry: 3,
    fragLoadingRetryDelay: 500,
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

    cleanup(video, true);
  });
}

function prepareVideo(video: HTMLVideoElement) {
  const existingProcessor = processors.get(video);
  if (existingProcessor) {
    existingProcessor();
    return;
  }

  const process = () => {
    const src = video.currentSrc || video.src;
    if (!src) return;

    const hlsSrc = src.includes(".m3u8")
      ? src
      : originalToHls.get(normalize(src));

    if (hlsSrc) attachHls(video, hlsSrc);
  };

  processors.set(video, process);

  video.addEventListener("loadedmetadata", process, { passive: true });
  video.addEventListener("play", process, { passive: true });

  if (!observed.has(video) && typeof IntersectionObserver !== "undefined") {
    observed.add(video);
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.target !== video) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            video.preload = "metadata";
            process();
          } else if (entry.intersectionRatio <= 0.05) {
            try {
              video.pause();
            } catch {}
            video.preload = "none";
            cleanup(video, true);
          }
        }
      },
      { threshold: [0, 0.05, 0.55, 1] }
    );
    observer.observe(video);
  }

  process();
}

export function startHlsVideoRuntime() {
  if (started || typeof window === "undefined") return;
  started = true;

  const scan = () => {
    document.querySelectorAll<HTMLVideoElement>("video").forEach(prepareVideo);
  };

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

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}
