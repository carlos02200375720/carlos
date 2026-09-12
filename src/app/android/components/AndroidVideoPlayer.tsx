import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
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
  onVideoReady?: (video: HTMLVideoElement | null) => void;
}

/**
 * Reel video player optimized for Android Chrome/WebView.
 *
 * Important performance rules:
 * - Prefer the server-generated HLS stream when available instead of downloading the
 *   original MP4 progressively.
 * - Never preload the full video. Reels only need metadata until they become current.
 * - Keep only the active reel playing.
 * - Use a normal VOD HLS buffer; lowLatencyMode is for live streams and wastes work here.
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

    const effectiveAspect = aspectRatio || detectedAspect || 'vertical';

    const checkVideoDimensions = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      const ratio = w / h;
      const detected: 'vertical' | 'horizontal' | 'square' = ratio < 0.85 ? 'vertical' : ratio > 1.18 ? 'horizontal' : 'square';
      setDetectedAspect(detected);
      onAspectRatioDetected?.(detected, ratio);
    }, [onAspectRatioDetected]);

    const safePlay = useCallback(async () => {
      const video = videoRef.current;
      if (!video || !isCurrent) return;
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        video.muted = true;
        setIsMuted(true);
        onMuteChange?.(true);
        try {
          await video.play();
          setIsPlaying(true);
        } catch {}
      }
    }, [isCurrent, onMuteChange]);

    useImperativeHandle(ref, () => ({
      getVideoElement: () => videoRef.current,
      play: safePlay,
      pause: () => {
        videoRef.current?.pause();
        setIsPlaying(false);
      },
      togglePlay: () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) safePlay();
        else {
          video.pause();
          setIsPlaying(false);
        }
      },
      toggleMute: () => {
        const video = videoRef.current;
        if (!video) return;
        const next = !video.muted;
        video.muted = next;
        setIsMuted(next);
        onMuteChange?.(next);
        if (!next) safePlay();
      },
      unmute: () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = false;
        video.volume = 1;
        setIsMuted(false);
        onMuteChange?.(false);
        safePlay();
      },
    }), [safePlay, onMuteChange]);

    useEffect(() => {
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.muted = muted;
        videoRef.current.defaultMuted = muted;
      }
    }, [muted]);

    const handleVideoRef = useCallback((el: HTMLVideoElement | null) => {
      videoRef.current = el;
      onVideoReady?.(el);
    }, [onVideoReady]);

    // Prefer HLS over the original MP4. The backend already creates an HLS rendition.
    const mediaSource = React.useMemo(() => {
      if (hlsUrl?.trim().includes('.m3u8')) return hlsUrl.trim();
      return (src || '').trim();
    }, [src, hlsUrl]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !mediaSource) return;

      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();

      const isM3u8 = mediaSource.includes('.m3u8');

      if (isM3u8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          // Keep a modest back buffer but enough forward buffer to absorb short
          // network/CPU hiccups without recreating multi-video memory pressure.
          backBufferLength: 6,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          maxBufferHole: 0.5,
          // Start at the smallest rendition so the first segment arrives quickly;
          // ABR upgrades after it has measured the real connection.
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
        hlsRef.current = hls;
        hls.loadSource(mediaSource);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCurrent && autoPlay) safePlay();
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        });
      } else {
        video.src = mediaSource;
        if (isCurrent && autoPlay) safePlay();
      }

      return () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
        video.pause();
        // Releasing the source prevents an old reel from retaining decoded/buffered data.
        video.removeAttribute('src');
        video.load();
      };
    }, [mediaSource, isCurrent, autoPlay, safePlay]);

    // Only the focused reel may play. When it leaves focus, immediately release playback.
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (isCurrent) {
        video.muted = isMuted;
        if (autoPlay) safePlay();
      } else {
        video.pause();
        setIsPlaying(false);
        video.removeAttribute('src');
        video.load();
      }
    }, [isCurrent, autoPlay, isMuted, safePlay]);

    useEffect(() => () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      videoRef.current?.pause();
    }, []);

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        lastTapTimeRef.current = 0;
        onDoubleTap?.();
        return;
      }
      lastTapTimeRef.current = now;

      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) safePlay();
        else if (onClick) onClick();
        else {
          video.pause();
          setIsPlaying(false);
        }
        setShowTapIndicator(true);
        tapTimerRef.current = setTimeout(() => setShowTapIndicator(false), 450);
      }, 280);
    };

    return (
      <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black ${className}`} onClick={handleTap}>
        {effectiveAspect !== 'vertical' && poster && (
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-110 pointer-events-none" aria-hidden="true" />
        )}

        <div className={effectiveAspect === 'vertical' ? 'w-full h-full flex items-center justify-center relative overflow-hidden' : effectiveAspect === 'horizontal' ? 'w-full max-h-[calc(100vh-120px)] relative z-10 flex items-center justify-center my-auto overflow-hidden' : 'w-full max-w-[min(94vw,calc(100vh-160px))] aspect-square relative z-10 mx-auto flex items-center justify-center my-auto rounded-2xl overflow-hidden'}>
          <video
            ref={handleVideoRef}
            poster={poster}
            autoPlay={autoPlay && isCurrent}
            loop={loop}
            muted={isMuted}
            playsInline
            disablePictureInPicture
            webkit-playsinline="true"
            // Metadata only until the reel is actually focused.
            preload={isCurrent ? 'metadata' : 'none'}
            className={effectiveAspect === 'vertical' ? 'w-full h-full object-cover' : effectiveAspect === 'horizontal' ? 'w-full max-h-full aspect-video object-cover' : 'w-full h-full object-cover'}
            onLoadedMetadata={checkVideoDimensions}
            onLoadedData={checkVideoDimensions}
            onCanPlay={() => {
              checkVideoDimensions();
              if (isCurrent && videoRef.current?.paused && autoPlay) safePlay();
            }}
            onWaiting={() => setIsPlaying(false)}
            onPlaying={() => setIsPlaying(true)}
            onEnded={onEnded}
            onPlay={() => { setIsPlaying(true); onPlay?.(); }}
            onPause={() => { setIsPlaying(false); onPause?.(); }}
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
