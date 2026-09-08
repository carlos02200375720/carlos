import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw } from "lucide-react";
import Hls from "hls.js";

export interface AndroidVideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
}

export interface AndroidVideoPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  isCurrent?: boolean;
  className?: string;
  onClick?: () => void;
  onDoubleTap?: () => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
}

/**
 * Android Native Video Player Component
 * Optimized for Android Chrome and Android WebView (Capacitor/Cordova)
 * Handles HLS playback via hls.js with native fallback and GPU acceleration.
 */
export const AndroidVideoPlayer = forwardRef<AndroidVideoPlayerHandle, AndroidVideoPlayerProps>(
  (
    {
      src,
      hlsUrl,
      poster,
      autoPlay = false,
      loop = true,
      muted = true,
      isCurrent = true,
      className = "",
      onClick,
      onDoubleTap,
      onEnded,
      onPlay,
      onPause,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [showTapIndicator, setShowTapIndicator] = useState(false);
    const lastTapTimeRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
      play: async () => {
        if (videoRef.current) {
          try {
            await videoRef.current.play();
            setIsPlaying(true);
          } catch {}
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      togglePlay: () => {
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            videoRef.current.pause();
            setIsPlaying(false);
          }
        }
      },
      toggleMute: () => {
        if (videoRef.current) {
          const next = !videoRef.current.muted;
          videoRef.current.muted = next;
          setIsMuted(next);
        }
      },
    }));

    // HLS and Media Stream Setup
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const mediaSource = hlsUrl || src;
      if (!mediaSource) return;

      // Clean up any existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isHls = mediaSource.includes(".m3u8") || (hlsUrl && hlsUrl.length > 0);

      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(mediaSource);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCurrent && autoPlay) {
            video.play().catch(() => {});
          }
        });
      } else {
        video.src = mediaSource;
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [src, hlsUrl]);

    // Synchronize play/pause with isCurrent state
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isCurrent) {
        video.muted = isMuted;
        const p = video.play();
        if (p !== undefined) {
          p.then(() => setIsPlaying(true)).catch(() => {
            // Autoplay with sound blocked on mobile: mute and play
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, [isCurrent]);

    const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTapTimeRef.current < DOUBLE_TAP_DELAY) {
        // Double tap
        lastTapTimeRef.current = 0;
        if (onDoubleTap) {
          onDoubleTap();
          return;
        }
      }
      lastTapTimeRef.current = now;

      // Single tap toggle play
      if (onClick) {
        onClick();
      } else {
        const video = videoRef.current;
        if (video) {
          if (video.paused) {
            video.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            video.pause();
            setIsPlaying(false);
          }
          setShowTapIndicator(true);
          setTimeout(() => setShowTapIndicator(false), 600);
        }
      }
    };

    return (
      <div
        className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-black ${className}`}
        onClick={handleTap}
        id="android-video-player-container"
      >
        <video
          ref={videoRef}
          poster={poster}
          loop={loop}
          muted={isMuted}
          playsInline
          disablePictureInPicture
          webkit-playsinline="true"
          preload="metadata"
          className="w-full h-full object-cover"
          onEnded={onEnded}
          onPlay={() => {
            setIsPlaying(true);
            onPlay?.();
          }}
          onPause={() => {
            setIsPlaying(false);
            onPause?.();
          }}
        />

        {/* Tap Feedback Indicator for Android */}
        {showTapIndicator && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white scale-105 transition-transform">
              {isPlaying ? <Play className="w-8 h-8 fill-white" /> : <Pause className="w-8 h-8 fill-white" />}
            </div>
          </div>
        )}
      </div>
    );
  }
);

AndroidVideoPlayer.displayName = "AndroidVideoPlayer";
