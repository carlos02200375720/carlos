import React, { useCallback, useEffect, useRef } from "react";
import Hls from "hls.js";

interface ReelHlsVideoProps {
  hlsUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  isActive: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLVideoElement>) => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onRegister?: (element: HTMLVideoElement | null) => void;
}

export const ReelHlsVideo = React.memo(function ReelHlsVideo({
  hlsUrl,
  videoUrl,
  posterUrl,
  isActive,
  isPlaying,
  isMuted,
  className,
  style,
  onClick,
  onDoubleClick,
  onLoadedMetadata,
  onRegister,
}: ReelHlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    onRegister?.(element);
  }, [onRegister]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.pause();
    video.removeAttribute("src");
    video.load();

    const source = hlsUrl?.trim();
    const fallback = videoUrl?.trim();

    if (source && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 6,
        maxBufferLength: 20,
        capLevelToPlayerSize: true,
      });

      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy();
          hlsRef.current = null;
        }
      });
      hls.loadSource(source);
      hls.attachMedia(video);
    } else if (source && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source;
    } else if (fallback) {
      video.src = fallback;
    }

    return () => {
      video.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
      onRegister?.(null);
    };
  }, [hlsUrl, videoUrl, onRegister]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = isMuted ? 0 : 1;

    if (!isActive || !isPlaying) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    playPromise?.catch((error) => {
      if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") {
        console.warn("Reel playback failed:", error);
      }
    });
  }, [isActive, isPlaying, isMuted]);

  return (
    <video
      ref={setVideoRef}
      poster={posterUrl}
      autoPlay={isActive}
      playsInline
      loop
      muted={isMuted}
      preload="none"
      className={className}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onLoadedMetadata={onLoadedMetadata}
    />
  );
});
