import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import Hls from "hls.js";

export interface AndroidVideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  unmute: () => void;
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
  aspectRatio?: 'vertical' | 'horizontal' | 'square';
  onClick?: () => void;
  onDoubleTap?: () => void;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onMuteChange?: (isMuted: boolean) => void;
  onAspectRatioDetected?: (aspect: 'vertical' | 'horizontal' | 'square', ratio: number) => void;
}

/**
 * Android Native Video Player Component
 * Optimized for Android Chrome and Android WebView (Capacitor/Cordova)
 * Handles native HTML5 MP4 playback with AAC audio decoding and HLS fallback.
 * Dynamically supports Vertical (100% full bleed above nav bar), Horizontal (16:9 landscape), and Square (1:1).
 */
export const AndroidVideoPlayer = forwardRef<AndroidVideoPlayerHandle, AndroidVideoPlayerProps>(
  (
    {
      src,
      hlsUrl,
      poster,
      autoPlay = true,
      loop = true,
      muted = false,
      isCurrent = true,
      className = "",
      aspectRatio,
      onClick,
      onDoubleTap,
      onEnded,
      onPlay,
      onPause,
      onMuteChange,
      onAspectRatioDetected,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [showTapIndicator, setShowTapIndicator] = useState(false);
    const [detectedAspect, setDetectedAspect] = useState<'vertical' | 'horizontal' | 'square'>(
      aspectRatio || 'vertical'
    );
    const lastTapTimeRef = useRef<number>(0);

    // Evaluate effective aspect ratio: prop takes precedence if specified, otherwise auto-detected
    const effectiveAspect = aspectRatio || detectedAspect || 'vertical';

    // Auto-detect video dimensions and aspect ratio
    const checkVideoDimensions = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth || 0;
      const h = video.videoHeight || 0;
      if (w > 0 && h > 0) {
        const ratio = w / h;
        let detected: 'vertical' | 'horizontal' | 'square' = 'vertical';
        if (ratio < 0.85) {
          detected = 'vertical';
        } else if (ratio > 1.18) {
          detected = 'horizontal';
        } else {
          detected = 'square';
        }
        setDetectedAspect(detected);
        onAspectRatioDetected?.(detected, ratio);
      }
    }, [onAspectRatioDetected]);

    // Sync external muted prop
    useEffect(() => {
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.muted = muted;
        if (!muted) {
          videoRef.current.volume = 1.0;
        }
      }
    }, [muted]);

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
          if (!next) {
            videoRef.current.volume = 1.0;
            videoRef.current.play().catch(() => {});
          }
          setIsMuted(next);
          onMuteChange?.(next);
        }
      },
      unmute: () => {
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
          setIsMuted(false);
          videoRef.current.play().catch(() => {});
          onMuteChange?.(false);
        }
      },
    }));

    // Choose proper media source (Direct MP4 vs HLS .m3u8)
    const mediaSource = React.useMemo(() => {
      // Prioritize direct mp4 / webm source for native audio reproduction
      if (src && (src.includes(".mp4") || src.includes(".webm") || src.startsWith("blob:") || !hlsUrl)) {
        return src.trim();
      }
      if (hlsUrl && hlsUrl.includes(".m3u8")) {
        return hlsUrl.trim();
      }
      return (src || hlsUrl || "").trim();
    }, [src, hlsUrl]);

    // Media Setup & Lifecycle
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !mediaSource) return;

      // Clean up any existing HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isM3u8 = mediaSource.includes(".m3u8");

      if (isM3u8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(mediaSource);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCurrent) {
            video.muted = isMuted;
            video.play().catch(() => {
              // If browser blocks audio autoplay on mobile, mute and retry
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => {});
            });
          }
        });
      } else {
        video.src = mediaSource;
        if (isCurrent) {
          video.muted = isMuted;
          if (!isMuted) {
            video.volume = 1.0;
          }
          const p = video.play();
          if (p !== undefined) {
            p.then(() => setIsPlaying(true)).catch(() => {
              // Autoplay with sound restricted by mobile browser policy: fallback to muted play
              video.muted = true;
              setIsMuted(true);
              onMuteChange?.(true);
              video.play().then(() => setIsPlaying(true)).catch(() => {});
            });
          }
        }
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [mediaSource]);

    // Synchronize play/pause with isCurrent state
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isCurrent) {
        video.muted = isMuted;
        if (!isMuted) video.volume = 1.0;
        const p = video.play();
        if (p !== undefined) {
          p.then(() => setIsPlaying(true)).catch(() => {
            // Autoplay with audio restricted by browser: mute and play
            video.muted = true;
            setIsMuted(true);
            onMuteChange?.(true);
            video.play().then(() => setIsPlaying(true)).catch(() => {});
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

      // Single tap
      const video = videoRef.current;
      if (video) {
        // If muted due to browser autoplay policy, tapping the video immediately enables audio!
        if (video.muted || isMuted) {
          video.muted = false;
          video.volume = 1.0;
          setIsMuted(false);
          onMuteChange?.(false);
          video.play().catch(() => {});
          setShowTapIndicator(true);
          setTimeout(() => setShowTapIndicator(false), 600);
          return;
        }

        if (onClick) {
          onClick();
        } else {
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
        className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black ${className}`}
        onClick={handleTap}
        id="android-video-player-container"
      >
        {/* Ambient Blurred Backdrop for Horizontal and Square Videos to eliminate harsh black voids */}
        {effectiveAspect !== "vertical" && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 filter blur-3xl scale-125 select-none"
            aria-hidden="true"
          >
            {poster ? (
              <img src={poster} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-900 via-slate-800 to-black" />
            )}
          </div>
        )}

        {/* Dynamic Video Frame: Vertical (100% full bleed above nav), Horizontal (16:9 edge-to-edge), or Square (1:1) */}
        <div
          className={
            effectiveAspect === "vertical"
              ? "w-full h-full flex items-center justify-center relative overflow-hidden"
              : effectiveAspect === "horizontal"
              ? "w-full max-h-[calc(100vh-120px)] relative z-10 flex items-center justify-center my-auto px-0 rounded-none overflow-hidden"
              : "w-full max-w-[min(94vw,calc(100vh-160px))] aspect-square relative z-10 mx-auto flex items-center justify-center my-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          }
        >
          <video
            ref={videoRef}
            poster={poster}
            loop={loop}
            muted={isMuted}
            playsInline
            disablePictureInPicture
            webkit-playsinline="true"
            preload="auto"
            className={
              effectiveAspect === "vertical"
                ? "w-full h-full object-cover"
                : effectiveAspect === "horizontal"
                ? "w-full max-h-full aspect-video object-cover rounded-none shadow-none"
                : "w-full h-full object-cover"
            }
            onLoadedMetadata={checkVideoDimensions}
            onLoadedData={checkVideoDimensions}
            onEnded={onEnded}
            onPlay={() => {
              checkVideoDimensions();
              setIsPlaying(true);
              onPlay?.();
            }}
            onPause={() => {
              setIsPlaying(false);
              onPause?.();
            }}
          />
        </div>

        {/* Tap Feedback Indicator for Android */}
        {showTapIndicator && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white scale-105 transition-transform shadow-lg">
              {isPlaying ? <Play className="w-8 h-8 fill-white" /> : <Pause className="w-8 h-8 fill-white" />}
            </div>
          </div>
        )}
      </div>
    );
  }
);

AndroidVideoPlayer.displayName = "AndroidVideoPlayer";
