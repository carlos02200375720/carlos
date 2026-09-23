import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, FastForward, Check, Sparkles, Smartphone, Monitor, Apple } from "lucide-react";
import Hls from "hls.js";
import { getMediaUrl } from "../../../../config";

export interface NativeVideoPlayerHandle {
  getVideoElement: () => HTMLVideoElement | null;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (vol: number) => void;
  seek: (seconds: number) => void;
  toggleFullscreen: () => void;
  togglePiP: () => Promise<void>;
}

export interface NativeVideoPlayerProps {
  src: string;
  hlsUrl?: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "auto" | "metadata" | "none";
  isCurrent?: boolean;
  isFeedMode?: boolean; // When true (like Reels / TikTok feed), minimal overlay and tap-to-pause
  title?: string;
  creatorName?: string;
  defaultAspectRatio?: "cover" | "contain" | "fit" | "fill";
  className?: string;
  style?: React.CSSProperties;
  onPlay?: () => void;
  onPause?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onCanPlay?: () => void;
  onLoadedData?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => void;
  onLoadedMetadata?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onClick?: () => void;
  onDoubleClickCenter?: () => void;
}

// Device detection helper
export function getDeviceInfo() {
  if (typeof window === "undefined" || !navigator) {
    return { isIOS: false, isAndroid: false, isMobile: false, isSafari: false, platformName: "Web" };
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const platformName = isIOS ? "iOS Native" : isAndroid ? "Android Native" : "HTML5 Web";

  return { isIOS, isAndroid, isMobile, isSafari, platformName };
}

export const NativeVideoPlayer = forwardRef<NativeVideoPlayerHandle, NativeVideoPlayerProps>(
  (
    {
      src,
      hlsUrl,
      poster,
      autoPlay = false,
      loop = true,
      muted = false,
      preload = "metadata",
      isCurrent = true,
      isFeedMode = false,
      title,
      creatorName,
      defaultAspectRatio = "cover",
      className = "",
      style,
      onPlay,
      onPause,
      onWaiting,
      onPlaying,
      onCanPlay,
      onLoadedData,
      onError,
      onLoadedMetadata,
      onTimeUpdate,
      onEnded,
      onClick,
      onDoubleClickCenter,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    const [deviceInfo] = useState(() => getDeviceInfo());
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isMuted, setIsMuted] = useState(muted);
    const [volume, setVolumeState] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [bufferedEnd, setBufferedEnd] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPiPActive, setIsPiPActive] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [showControls, setShowControls] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [aspectMode, setAspectMode] = useState<"cover" | "contain">(
      defaultAspectRatio === "contain" || defaultAspectRatio === "fit" ? "contain" : "cover"
    );

    useEffect(() => {
      if (defaultAspectRatio === "contain" || defaultAspectRatio === "fit") {
        setAspectMode("contain");
      } else if (defaultAspectRatio === "cover" || defaultAspectRatio === "fill") {
        setAspectMode("cover");
      }
    }, [defaultAspectRatio]);

    const detectAndApplyAspect = useCallback(() => {
      if (videoRef.current) {
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        if (vw > 0 && vh > 0) {
          if (vw >= vh) {
            setAspectMode("contain");
          } else if (defaultAspectRatio === "cover" || defaultAspectRatio === "fill" || !defaultAspectRatio) {
            setAspectMode("cover");
          }
        }
      }
    }, [defaultAspectRatio]);

    useEffect(() => {
      detectAndApplyAspect();
    }, [src, hlsUrl, detectAndApplyAspect]);

    const lastTapRef = useRef<number>(0);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getVideoElement: () => videoRef.current,
        play: async () => {
          if (videoRef.current) {
            try {
              await videoRef.current.play();
            } catch {
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                await videoRef.current.play().catch(() => {});
              }
            }
          }
        },
        pause: () => {
          if (videoRef.current) {
            videoRef.current.pause();
          }
        },
        togglePlay: () => {
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  setIsMuted(true);
                  videoRef.current.play().catch(() => {});
                }
              });
            } else {
              videoRef.current.pause();
            }
          }
        },
        toggleMute: () => {
          if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
          }
        },
        setVolume: (vol: number) => {
          if (videoRef.current) {
            const clamped = Math.max(0, Math.min(1, vol));
            videoRef.current.volume = clamped;
            videoRef.current.muted = clamped === 0;
            setVolumeState(clamped);
            setIsMuted(clamped === 0);
          }
        },
        seek: (sec: number) => {
          if (videoRef.current && isFinite(sec)) {
            videoRef.current.currentTime = Math.max(0, Math.min(sec, duration || 0));
          }
        },
        toggleFullscreen: () => {
          handleToggleFullscreen();
        },
        togglePiP: async () => {
          await handleTogglePiP();
        },
      }),
      [duration]
    );

    useEffect(() => {
      setIsMuted(muted);
      if (videoRef.current) {
        videoRef.current.muted = muted;
      }
    }, [muted]);

    const formatTime = (secs: number) => {
      if (!secs || isNaN(secs) || !isFinite(secs)) return "0:00";
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const triggerShowControls = useCallback(() => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (!showSpeedMenu) {
          setShowControls(false);
        }
      }, 3000);
    }, [showSpeedMenu]);

    useEffect(() => {
      if (typeof window !== "undefined" && "mediaSession" in navigator && isCurrent) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: title || "Video",
            artist: creatorName || "Universal Feed",
            album: "Reels & Media",
            artwork: poster ? [{ src: poster, sizes: "512x512", type: "image/jpeg" }] : [],
          });

          navigator.mediaSession.setActionHandler("play", () => {
            videoRef.current?.play().catch(() => {});
          });
          navigator.mediaSession.setActionHandler("pause", () => {
            videoRef.current?.pause();
          });
          navigator.mediaSession.setActionHandler("seekbackward", () => {
            if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          });
          navigator.mediaSession.setActionHandler("seekforward", () => {
            if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
          });
        } catch {
          // safe fallback
        }
      }
    }, [title, creatorName, poster, isCurrent]);

    const targetSource = React.useMemo(() => {
      if (hlsUrl && hlsUrl.trim().length > 0 && hlsUrl.includes(".m3u8")) {
        return getMediaUrl(hlsUrl.trim());
      }
      if (src && src.includes(".m3u8")) {
        return getMediaUrl(src.trim());
      }
      if (src && src.startsWith("blob:")) {
        return src.trim();
      }
      const trimmed = (src || hlsUrl || "").trim();
      return trimmed.length > 0 ? getMediaUrl(trimmed) : null;
    }, [src, hlsUrl]);

    const isM3u8 = Boolean(targetSource && targetSource.includes(".m3u8"));

    // Only the active Reel owns an HLS/media source. Inactive players release
    // their source and HLS instance so the browser does not keep decoding/buffering
    // every Reel in the feed.
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !targetSource) return;

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (!isCurrent) {
        video.pause();
        video.removeAttribute("src");
        video.load();
        return;
      }

      const canPlayNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

      if (isM3u8 && (canPlayNativeHls === "probably" || canPlayNativeHls === "maybe" || deviceInfo.isIOS)) {
        video.src = targetSource;
      } else if (isM3u8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 20,
          maxMaxBufferLength: 40,
          backBufferLength: 10,
          maxBufferHole: 1.0,
          capLevelToPlayerSize: true,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
          fragLoadingMaxRetry: 5,
        });
        hlsRef.current = hls;
        hls.loadSource(targetSource);
        hls.attachMedia(video);

        let retryCount = 0;
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount < 2) {
              retryCount++;
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
              hlsRef.current = null;
              if (targetSource) {
                video.src = targetSource;
                video.load();
                if (isCurrent) video.play().catch(() => {});
              }
            }
          }
        });
      } else {
        video.src = targetSource;
      }

      video.muted = isMuted;
      video.volume = isMuted ? 0 : volume;

      return () => {
        video.pause();
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        video.removeAttribute("src");
        video.load();
      };
    }, [targetSource, isM3u8, deviceInfo.isIOS, isCurrent]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isCurrent) {
        video.muted = isMuted;
        video.volume = isMuted ? 0 : volume;
        if (autoPlay) {
          const p = video.play();
          if (p !== undefined) {
            p.catch(() => {
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => {});
            });
          }
        }
      } else {
        video.pause();
      }
    }, [isCurrent, autoPlay, isMuted, volume]);

    const handleToggleFullscreen = () => {
      const container = containerRef.current;
      const video = videoRef.current;
      if (!container || !video) return;

      // @ts-ignore
      if (video.webkitEnterFullscreen && deviceInfo.isIOS) {
        // @ts-ignore
        video.webkitEnterFullscreen();
        return;
      }

      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => {});
        } else { // @ts-ignore
          if (container.webkitRequestFullscreen) { // @ts-ignore
            container.webkitRequestFullscreen();
          }
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else { // @ts-ignore
          if (document.webkitExitFullscreen) { // @ts-ignore
            document.webkitExitFullscreen();
          }
        }
        setIsFullscreen(false);
      }
    };

    useEffect(() => {
      const onFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener("fullscreenchange", onFullscreenChange);
      document.addEventListener("webkitfullscreenchange", onFullscreenChange);
      return () => {
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      };
    }, []);

    const handleTogglePiP = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        if (document.pictureInPictureElement === video) {
          await document.exitPictureInPicture();
          setIsPiPActive(false);
        } else if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          setIsPiPActive(true);
        } else { // @ts-ignore
          if (video.webkitSetPresentationMode) { // @ts-ignore
            const mode = video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture"; // @ts-ignore
            video.webkitSetPresentationMode(mode);
          }
        }
      } catch (err) {
        console.warn("PiP not supported or failed:", err);
      }
    };

    const handleContainerClick = (e: React.MouseEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_THRESHOLD = 300;

      if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD) {
        lastTapRef.current = 0;
        if (onDoubleClickCenter) {
          onDoubleClickCenter();
        } else {
          handleToggleFullscreen();
        }
        return;
      }
      lastTapRef.current = now;

      if (onClick) {
        onClick();
      } else if (isFeedMode) {
        const video = videoRef.current;
        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      } else {
        triggerShowControls();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          break;
        case "m":
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case "f":
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case "arrowleft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case "arrowright":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          break;
        case "arrowup":
          e.preventDefault();
          const upVol = Math.min(1, video.volume + 0.1);
          video.volume = upVol;
          video.muted = false;
          setVolumeState(upVol);
          setIsMuted(false);
          break;
        case "arrowdown":
          e.preventDefault();
          const downVol = Math.max(0, video.volume - 0.1);
          video.volume = downVol;
          setVolumeState(downVol);
          if (downVol === 0) {
            video.muted = true;
            setIsMuted(true);
          }
          break;
      }
    };

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolumeState(newVol);
      if (videoRef.current) {
        videoRef.current.volume = newVol;
        videoRef.current.muted = newVol === 0;
        setIsMuted(newVol === 0);
      }
    };

    const handleSpeedSelect = (speed: number) => {
      setPlaybackRate(speed);
      if (videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setShowSpeedMenu(false);
    };

    const isHorizontal = aspectMode === "contain";

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
        style={style}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={triggerShowControls}
        onMouseLeave={() => !showSpeedMenu && setShowControls(false)}
        onTouchStart={triggerShowControls}
        onClick={handleContainerClick}
      >
        <video
          ref={videoRef}
          src={!isM3u8 && targetSource ? targetSource : undefined}
          className={`w-full h-full block relative z-10 ${isHorizontal ? "object-contain" : "object-cover"}`}
          poster={poster && poster.trim().length > 0 ? getMediaUrl(poster.trim()) : undefined}
          playsInline
          autoPlay={autoPlay}
          loop={loop}
          muted={isMuted}
          preload={preload}
          // @ts-ignore
          webkit-playsinline="true"
          x5-video-player-type="h5-page"
          x5-video-orientation="portrait"
          x5-playsinline="true"
          onPlay={() => {
            setIsPlaying(true);
            setIsBuffering(false);
            detectAndApplyAspect();
            onPlay?.();
          }}
          onPause={() => {
            setIsPlaying(false);
            setIsBuffering(false);
            onPause?.();
          }}
          onWaiting={() => {
            if (isPlaying) {
              setIsBuffering(true);
            }
            onWaiting?.();
          }}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            detectAndApplyAspect();
            onPlaying?.();
          }}
          onCanPlay={() => {
            setIsBuffering(false);
            detectAndApplyAspect();
            onCanPlay?.();
          }}
          onLoadedData={() => {
            setIsBuffering(false);
            detectAndApplyAspect();
            onLoadedData?.();
          }}
          onError={(e) => {
            setIsBuffering(false);
            onError?.(e);
          }}
          onLoadedMetadata={() => {
            setIsBuffering(false);
            detectAndApplyAspect();
            if (videoRef.current) {
              const dur = videoRef.current.duration;
              setDuration(dur || 0);
              onLoadedMetadata?.(dur || 0);
            }
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              const cur = videoRef.current.currentTime;
              const dur = videoRef.current.duration || duration;
              if (cur > 0) {
                setIsBuffering(false);
              }
              setCurrentTime(cur);
              if (videoRef.current.buffered.length > 0) {
                setBufferedEnd(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
              }
              onTimeUpdate?.(cur, dur);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setIsBuffering(false);
            onEnded?.();
          }}
        />

        {isBuffering && !isFeedMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin drop-shadow-md" />
          </div>
        )}

        {!isPlaying && !isBuffering && !isFeedMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/45 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-2xl transition-transform transform scale-100 hover:scale-110">
              <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
            </div>
          </div>
        )}

        {!isFeedMode && (
          <div
            className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-10 pb-3 px-4 transition-opacity duration-300 ${
              showControls || !isPlaying ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-1.5 bg-white/20 rounded-full mb-3 cursor-pointer group/seek flex items-center">
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/35 rounded-full"
                style={{ width: `${duration > 0 ? (bufferedEnd / duration) * 100 : 0}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeekChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Buscar"
              />
            </div>

            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    const v = videoRef.current;
                    if (!v) return;
                    if (v.paused) v.play().catch(() => {});
                    else v.pause();
                  }}
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                  title={isPlaying ? "Pausar (Espacio)" : "Reproducir (Espacio)"}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white translate-x-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors hidden sm:block"
                  title="Retroceder 10s"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-1.5 group/vol">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.muted = !videoRef.current.muted;
                        setIsMuted(videoRef.current.muted);
                      }
                    }}
                    className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                    title={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
                  >
                    {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-white/30 rounded-lg accent-white cursor-pointer transition-opacity opacity-70 group-hover/vol:opacity-100"
                    title="Volumen"
                  />
                </div>

                <span className="font-mono text-[11px] text-white/80 select-none pl-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center space-x-2 relative">
                <button
                  type="button"
                  onClick={() => setAspectMode((prev) => (prev === "cover" ? "contain" : "cover"))}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-mono transition-colors"
                  title="Cambiar relación de aspecto"
                >
                  {aspectMode === "cover" ? "Ajustar" : "Rellenar"}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-mono transition-colors"
                    title="Velocidad de reproducción"
                  >
                    {playbackRate}x
                  </button>

                  {showSpeedMenu && (
                    <div className="absolute bottom-9 right-0 bg-neutral-900/95 backdrop-blur-md border border-white/15 rounded-lg py-1 shadow-2xl z-40 min-w-[80px]">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s, sIdx) => (
                        <button
                          key={`${s}-${sIdx}`}
                          type="button"
                          onClick={() => handleSpeedSelect(s)}
                          className={`w-full px-3 py-1 text-left text-xs flex items-center justify-between hover:bg-white/15 transition-colors ${
                            playbackRate === s ? "text-amber-400 font-bold" : "text-white"
                          }`}
                        >
                          <span>{s}x</span>
                          {playbackRate === s && <Check className="w-3 h-3 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTogglePiP}
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors hidden sm:block"
                  title="Ventana flotante (PiP)"
                >
                  <Sparkles className="w-4 h-4 text-white/90" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                  title={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

NativeVideoPlayer.displayName = "NativeVideoPlayer";
