import React, { useState, useEffect } from "react";
import { Play } from "lucide-react";
import { Reel } from "../../../types";

interface AndroidPublicationCoverProps {
  reel: Reel;
  className?: string;
}

export default function AndroidPublicationCover({ reel, className = "" }: AndroidPublicationCoverProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    // 1. Direct valid thumbnail URL
    if (
      reel.thumbnailUrl &&
      typeof reel.thumbnailUrl === "string" &&
      !reel.thumbnailUrl.toLowerCase().endsWith(".m3u8") &&
      !reel.thumbnailUrl.includes("photo-1618005182384")
    ) {
      return reel.thumbnailUrl;
    }

    // 2. First valid image in images list
    if (
      reel.images &&
      reel.images.length > 0 &&
      typeof reel.images[0] === "string" &&
      !reel.images[0].toLowerCase().endsWith(".m3u8") &&
      !reel.images[0].includes("photo-1618005182384")
    ) {
      return reel.images[0];
    }

    // 3. Infer HLS poster image from upload path
    const targetUrl = reel.hlsUrl || reel.videoUrl || "";
    const hlsMatch = targetUrl.match(/\/uploads\/hls\/([a-zA-Z0-9_-]+)\//);
    if (hlsMatch) {
      return `/uploads/hls/${hlsMatch[1]}/poster.jpg`;
    }

    return null;
  });

  const [hasError, setHasError] = useState(false);
  const [useNativeVideo, setUseNativeVideo] = useState(false);

  useEffect(() => {
    if (thumbUrl && !hasError) return;

    const rawUrl = reel.videoUrl || reel.hlsUrl;
    if (!rawUrl) return;

    // Direct MP4 / WebM / MOV / standard video files can render first frame with preload="metadata"
    const isDirectVideo = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(rawUrl);
    if (isDirectVideo) {
      setUseNativeVideo(true);
      return;
    }

    // Check if we can infer poster path from HLS
    const hlsMatch = rawUrl.match(/\/uploads\/hls\/([a-zA-Z0-9_-]+)\//);
    if (hlsMatch && !thumbUrl) {
      setThumbUrl(`/uploads/hls/${hlsMatch[1]}/poster.jpg`);
      setHasError(false);
      return;
    }

    // Canvas frame capture from video element
    if (typeof document !== "undefined" && isDirectVideo) {
      let isCancelled = false;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.volume = 0;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = rawUrl;

      const captureFrame = () => {
        if (isCancelled) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(video.videoWidth || 480, 480);
          canvas.height = Math.min(video.videoHeight || 640, 640);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            if (dataUrl && dataUrl.length > 100) {
              setThumbUrl(dataUrl);
              setHasError(false);
            }
          }
        } catch {
          // CORS fallback
        }
      };

      const handleLoadedData = () => {
        video.currentTime = 0.05;
      };

      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("seeked", captureFrame);
      video.load();

      return () => {
        isCancelled = true;
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.removeEventListener("loadeddata", handleLoadedData);
          video.removeEventListener("seeked", captureFrame);
          video.removeAttribute("src");
          video.load();
        } catch {}
      };
    }
  }, [reel.videoUrl, reel.hlsUrl, thumbUrl, hasError]);

  if (thumbUrl && !hasError) {
    return (
      <img
        src={thumbUrl}
        alt={reel.description || reel.title || "Publicación"}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover select-none bg-slate-950 transition-transform duration-300 group-hover:scale-105 ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (useNativeVideo && (reel.videoUrl || reel.hlsUrl)) {
    const vUrl = reel.videoUrl || reel.hlsUrl;
    return (
      <video
        src={`${vUrl}#t=0.001`}
        preload="metadata"
        muted
        playsInline
        className={`w-full h-full object-cover pointer-events-none select-none bg-slate-950 ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-full h-full bg-gradient-to-b from-slate-800 to-slate-950 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden select-none ${className}`}
    >
      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-1.5 shadow-md">
        <Play className="w-4 h-4 fill-white translate-x-0.5" />
      </div>
      <p className="text-[10px] text-white/80 font-bold line-clamp-2 leading-tight px-1">
        {reel.title || reel.description || "Video"}
      </p>
    </div>
  );
}
