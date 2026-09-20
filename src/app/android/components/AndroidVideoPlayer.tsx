import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import Hls from "hls.js";
import { getMediaUrl } from "../../../config";

export interface AndroidVideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  unmute: () => void;
}

export interface AndroidVideoPlayerProps {
  /** Video source URL (HLS playlist .m3u8 or media stream) */
  src?: string;
  /** HLS playlist URL (.m3u8) */
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
  onVideoReady?: (video: HTMLVideoElement | null) => void;
}

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
      onVideoReady,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(muted);
    const [showTapIndicator, setShowTapIndicator] = useState(false);
    const [detectedAspect, setDetectedAspect] = useState<'vertical' | 'horizontal' | 'square'>(aspectRatio || 'vertical');
    const lastTapTimeRef = useRef<number>(0);
    const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const playInProgressRef = useRef(false);
    const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastProgressTimeRef = useRef<number>(0);
    const stallCountRef = useRef<number>(0);

    const clearStallTimer = () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    const handleWaitingOrStalled = () => {
      clearStallTimer();
      if (!isCurrentRef.current) return;
      stallTimerRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v || !isCurrentRef.current) return;
        if (v.paused) {
          v.play().catch(() => {});
        }
      }, 1500);
    };

    // Keep callback refs stable to prevent unneeded re-renders or effect re-runs
    const onMuteChangeRef = useRef(onMuteChange);
    onMuteChangeRef.current = onMuteChange;

    const onVideoReadyRef = useRef(onVideoReady);
    onVideoReadyRef.current = onVideoReady;

    const onAspectRatioDetectedRef = useRef(onAspectRatioDetected);
    onAspectRatioDetectedRef.current = onAspectRatioDetected;

    const onPlayRef = useRef(onPlay);
    onPlayRef.current = onPlay;

    const onPauseRef = useRef(onPause);
    onPauseRef.current = onPause;

    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    const onClickRef = useRef(onClick);
    onClickRef.current = onClick;

    const onDoubleTapRef = useRef(onDoubleTap);
    onDoubleTapRef.current = onDoubleTap;

    const isCurrentRef = useRef(isCurrent);
    isCurrentRef.current = isCurrent;

    const autoPlayRef = useRef(autoPlay);
    autoPlayRef.current = autoPlay;

    const safePlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video || !isCurrentRef.current) return;
      if (!video.paused) {
        setIsPlaying(true);
        return;
      }
      if (playInProgressRef.current) return;
      playInProgressRef.current = true;

      try {
        await video.play();
        setIsPlaying(true);
      } catch (err: any) {
        // If autoplay with sound was blocked by browser, mute and retry silently
        if (err?.name === "NotAllowedError" || !video.muted) {
          video.muted = true;
          video.defaultMuted = true;
          setIsMuted(true);
          onMuteChangeRef.current?.(true);
          try {
            await video.play();
            setIsPlaying(true);
          } catch {}
        }
      } finally {
        playInProgressRef.current = false;
      }
    }, []);

    const checkVideoDimensions = useCallback(() => {
      const video = videoRef.current;
      if (!video?.videoWidth || !video?.videoHeight) return;
      const ratio = video.videoWidth / video.videoHeight;
      const detected: 'vertical' | 'horizontal' | 'square' = ratio < 0.85 ? 'vertical' : ratio > 1.18 ? 'horizontal' : 'square';
      setDetectedAspect(p => (p === detected ? p : detected));
      onAspectRatioDetectedRef.current?.(detected, ratio);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getVideoElement: () => videoRef.current,
        play: safePlay,
        pause: () => {
          videoRef.current?.pause();
          setIsPlaying(false);
        },
        togglePlay: () => {
          const v = videoRef.current;
          if (!v) return;
          if (v.paused) safePlay();
          else {
            v.pause();
            setIsPlaying(false);
          }
        },
        toggleMute: () => {
          const v = videoRef.current;
          if (!v) return;
          const next = !v.muted;
          v.muted = next;
          setIsMuted(next);
          onMuteChangeRef.current?.(next);
          if (!next) safePlay();
        },
        unmute: () => {
          const v = videoRef.current;
          if (!v) return;
          v.muted = false;
          v.volume = 1;
          setIsMuted(false);
          onMuteChangeRef.current?.(false);
          safePlay();
        },
      }),
      [safePlay]
    );

    useEffect(() => {
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.muted = muted;
        videoRef.current.defaultMuted = muted;
        videoRef.current.volume = muted ? 0 : 1;
      }
    }, [muted]);

    // Compute safe target source: prefers .m3u8 if available, falls back to direct video
    const targetSource = React.useMemo(() => {
      const cleanHls = typeof hlsUrl === "string" ? getMediaUrl(hlsUrl.trim()) : "";
      const cleanSrc = typeof src === "string" ? getMediaUrl(src.trim()) : "";
      if (cleanHls && cleanHls.includes(".m3u8")) return cleanHls;
      if (cleanSrc && cleanSrc.includes(".m3u8")) return cleanSrc;
      if (cleanSrc) return cleanSrc;
      if (cleanHls) return cleanHls;
      return "";
    }, [src, hlsUrl]);

    useEffect(() => {
      setDetectedAspect(aspectRatio || 'vertical');
    }, [targetSource, aspectRatio]);

    const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
      if (videoRef.current !== el) {
        videoRef.current = el;
        onVideoReadyRef.current?.(el);
      }
    }, []);

    // Load media source (HLS or standard video) safely - ONLY re-executes when targetSource changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (!targetSource) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        setIsPlaying(false);
        return;
      }

      const isM3u8 = targetSource.includes(".m3u8");

      if (isM3u8) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            nudgeMaxRetry: 10,
            nudgeOffset: 0.1,
            startFragPrefetch: true,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 500,
          });
          hlsRef.current = hls;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (isCurrentRef.current && autoPlayRef.current) {
              safePlay();
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR || data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL) {
              // Allow HLS.js internal nudge mechanism to handle buffer holes seamlessly
              return;
            }

            if (!data.fatal) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
              hlsRef.current = null;
              if (video) {
                video.src = targetSource;
                video.load();
                if (isCurrentRef.current && autoPlayRef.current) {
                  safePlay();
                }
              }
            }
          });

          hls.loadSource(targetSource);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = targetSource;
          if (isCurrentRef.current && autoPlayRef.current) {
            safePlay();
          }
        } else {
          video.src = targetSource;
          if (isCurrentRef.current && autoPlayRef.current) {
            safePlay();
          }
        }
      } else {
        if (!video.src || !video.src.includes(targetSource)) {
          video.src = targetSource;
          video.load();
        }
        if (isCurrentRef.current && autoPlayRef.current) {
          safePlay();
        }
      }

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [targetSource, safePlay]);

    // Handle isCurrent focus and autoplay sync separately without tearing down HLS
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isCurrent) {
        video.muted = isMuted;
        video.defaultMuted = isMuted;
        video.volume = isMuted ? 0 : 1;
        if (autoPlay) {
          safePlay();
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, [isCurrent, autoPlay, isMuted, safePlay]);

    useEffect(() => () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      clearStallTimer();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      videoRef.current?.pause();
    }, []);

    const handleEnded = () => {
      if (loop) {
        const video = videoRef.current;
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => {});
          setIsPlaying(true);
        }
      }
      onEndedRef.current?.();
    };

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        lastTapTimeRef.current = 0;
        onDoubleTapRef.current?.();
        return;
      }
      lastTapTimeRef.current = now;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) safePlay();
        else if (onClickRef.current) onClickRef.current();
        else {
          video.pause();
          setIsPlaying(false);
        }
        setShowTapIndicator(true);
        tapTimerRef.current = setTimeout(() => setShowTapIndicator(false), 450);
      }, 280);
    };

    const effectiveAspect = detectedAspect;
    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black ${className}`} onClick={handleTap}>
        {effectiveAspect !== 'vertical' && poster && (
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-110 pointer-events-none" aria-hidden="true" />
        )}
        <div
          className={
            effectiveAspect === 'vertical'
              ? 'w-full h-full flex items-center justify-center relative overflow-hidden'
              : effectiveAspect === 'horizontal'
              ? 'w-full max-h-[calc(100vh-120px)] relative z-10 flex items-center justify-center my-auto overflow-hidden'
              : 'w-full max-w-[min(94vw,calc(100vh-160px))] aspect-square relative z-10 mx-auto flex items-center justify-center my-auto overflow-hidden'
          }
        >
          <video
            ref={handleVideoRef}
            poster={poster ? getMediaUrl(poster) : undefined}
            autoPlay={autoPlay && isCurrent}
            loop={loop}
            muted={isMuted}
            playsInline
            disablePictureInPicture
            webkit-playsinline="true"
            preload="auto"
            className={
              effectiveAspect === 'vertical'
                ? 'w-full h-full object-cover'
                : effectiveAspect === 'horizontal'
                ? 'w-full max-h-full aspect-video object-contain'
                : 'w-full h-full object-contain'
            }
            onLoadedMetadata={checkVideoDimensions}
            onLoadedData={checkVideoDimensions}
            onCanPlay={() => {
              checkVideoDimensions();
              if (isCurrentRef.current && videoRef.current?.paused && autoPlayRef.current) safePlay();
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              lastProgressTimeRef.current = v.currentTime;
              stallCountRef.current = 0;
              clearStallTimer();
              if (loop && v.duration && isFinite(v.duration) && v.currentTime >= v.duration - 0.15) {
                v.currentTime = 0;
                if (isCurrentRef.current && autoPlayRef.current) {
                  v.play().catch(() => {});
                }
              }
            }}
            onWaiting={handleWaitingOrStalled}
            onStalled={handleWaitingOrStalled}
            onPlaying={() => {
              const v = videoRef.current;
              if (v) lastProgressTimeRef.current = v.currentTime;
              stallCountRef.current = 0;
              clearStallTimer();
              setIsPlaying(true);
            }}
            onEnded={handleEnded}
            onPlay={() => {
              setIsPlaying(true);
              onPlayRef.current?.();
            }}
            onPause={() => {
              setIsPlaying(false);
              clearStallTimer();
              onPauseRef.current?.();
            }}
          />
        </div>
        {showTapIndicator && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
              {isPlaying ? <Play className="w-8 h-8 fill-white" /> : <Pause className="w-8 h-8 fill-white" />}
            </div>
          </div>
        )}
      </div>
    );
  }
);
AndroidVideoPlayer.displayName = 'AndroidVideoPlayer';
