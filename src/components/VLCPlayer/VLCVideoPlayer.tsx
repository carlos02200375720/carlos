import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import Hls from "hls.js";
import { VLCPlaybackSettings, VLCAudioSettings, VLCGestureState, VLCAspectRatio, HLSQualityLevel, HLSStreamStats } from "./types";
import { vlcAudioEngine } from "./vlcAudioEngine";
import { VLCOSD } from "./VLCOSD";
import { VLCControls } from "./VLCControls";
import { VLCMenuModal } from "./VLCMenuModal";

export interface VLCVideoPlayerHandle {
  play: () => Promise<void> | void;
  pause: () => void;
  seek: (seconds: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setQualityLevel: (levelId: number) => void;
  getStreamStats: () => HLSStreamStats;
}

export interface VLCVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "auto" | "metadata" | "none";
  isCurrent?: boolean;
  isFeedMode?: boolean; // When rendered in vertical reels/stories feed
  title?: string;
  creatorName?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
  onDoubleClickCenter?: () => void;
  onClick?: () => void;
  className?: string;
  defaultAspectRatio?: VLCAspectRatio;
  hlsUrl?: string; // Optional direct master playlist URL (.m3u8)
}

export const VLCVideoPlayer = forwardRef<VLCVideoPlayerHandle, VLCVideoPlayerProps>(
  (
    {
      src,
      poster,
      autoPlay = false,
      loop = true,
      muted = false,
      preload = "auto",
      isCurrent = true,
      isFeedMode = false,
      title,
      creatorName,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onLoadedMetadata,
      onWaiting,
      onPlaying,
      onDoubleClickCenter,
      onClick,
      className = "",
      defaultAspectRatio = "fill",
      hlsUrl,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);

    // VLC Playback Settings state
    const [playbackSettings, setPlaybackSettings] = useState<VLCPlaybackSettings>({
      playbackRate: 1.0,
      aspectRatio: defaultAspectRatio,
      hardwareAcceleration: true,
      brightness: 100, // 0 - 100%
      sleepTimerMinutes: null,
      isLocked: false,
      showOSD: false,
      hlsQualityLevel: -1, // -1 = Auto
    });

    // VLC Audio Settings state (with 200% boost capability)
    const [audioSettings, setAudioSettings] = useState<VLCAudioSettings>({
      volume: muted ? 0 : 100,
      isMuted: muted,
      equalizerPreset: "flat",
      audioDelayMs: 0,
    });

    // HLS Adaptive Streaming State & Quality Ladder
    const [availableQualities, setAvailableQualities] = useState<HLSQualityLevel[]>([]);
    const [streamStats, setStreamStats] = useState<HLSStreamStats>({
      isHLS: false,
      currentQuality: "Auto",
      bitrateKbps: 0,
      bufferLengthSec: 0,
      droppedFrames: 0,
      cdnStatus: "active",
      autoLevel: true,
    });
    const [bufferedPercent, setBufferedPercent] = useState<number>(0);

    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [gestureState, setGestureState] = useState<VLCGestureState | null>(null);
    const [osdNotification, setOsdNotification] = useState<string | null>(null);
    const [jumpAnim, setJumpAnim] = useState<"forward" | "backward" | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

    const showNotification = useCallback((msg: string) => {
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
      setOsdNotification(msg);
      notificationTimerRef.current = setTimeout(() => {
        setOsdNotification(null);
      }, 1800);
    }, []);

    // Resolve target streaming source: prefer static .m3u8 if supplied, otherwise fallback to direct MP4 video
    const targetSource = React.useMemo(() => {
      if (hlsUrl && hlsUrl.trim().length > 0 && hlsUrl.includes(".m3u8")) return hlsUrl.trim();
      if (src && src.includes(".m3u8")) return src.trim();
      return src;
    }, [src, hlsUrl]);

    // Initialize HLS.js or Native HLS Streaming
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !targetSource) return;

      // Clean up previous HLS instance if exists
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const isM3u8 = targetSource.includes(".m3u8");
      const canPlayNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

      if (isM3u8 && Hls.isSupported()) {
        console.log(`⚡ [VLC Player] Initializing HLS.js Static Adaptive Streaming Engine for:`, targetSource);

        const hls = new Hls({
          maxBufferLength: 15, // Keep buffer lightweight (15s) for instant response
          maxMaxBufferLength: 30,
          backBufferLength: 15,
          enableWorker: true,
          lowLatencyMode: false,
          startLevel: -1, // Auto level bitrate selection
          capLevelToPlayerSize: false,
          manifestLoadingTimeOut: 10000,
          fragLoadingTimeOut: 15000,
        });

        hlsRef.current = hls;
        hls.attachMedia(video);

        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(targetSource);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          console.log(`✅ [VLC Player] HLS Manifest parsed with ${data.levels.length} quality levels`);
          const qualities: HLSQualityLevel[] = [
            { id: -1, label: "Auto (Adaptativo)", height: 0, bitrate: 0 },
            ...data.levels.map((lvl, index) => ({
              id: index,
              label: lvl.height ? `${lvl.height}p ${lvl.height >= 720 ? "HD" : "SD"}` : `Nivel ${index + 1}`,
              height: lvl.height || 0,
              bitrate: lvl.bitrate || 0,
            })),
          ];
          setAvailableQualities(qualities);
          setStreamStats((prev) => ({
            ...prev,
            isHLS: true,
            cdnStatus: "active",
          }));

          if (autoPlay && isCurrent) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const currentLvl = hls.levels[data.level];
          if (currentLvl) {
            const bitrateKbps = Math.round(currentLvl.bitrate / 1000);
            const qualName = currentLvl.height ? `${currentLvl.height}p` : `L${data.level}`;
            setStreamStats((prev) => ({
              ...prev,
              currentQuality: hls.autoLevelEnabled ? `Auto (${qualName})` : qualName,
              bitrateKbps,
              autoLevel: hls.autoLevelEnabled,
            }));
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (video && video.buffered.length > 0) {
            const current = video.currentTime;
            let forwardBuffer = 0;
            for (let i = 0; i < video.buffered.length; i++) {
              if (video.buffered.start(i) <= current && current <= video.buffered.end(i)) {
                forwardBuffer = video.buffered.end(i) - current;
                break;
              }
            }
            setStreamStats((prev) => ({
              ...prev,
              bufferLengthSec: Math.round(forwardBuffer * 10) / 10,
            }));
          }
        });

        let networkErrorCount = 0;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                networkErrorCount++;
                if (networkErrorCount <= 2) {
                  console.warn("⚠️ [VLC Player] HLS Network error, attempting recovery...");
                  hls.startLoad();
                } else {
                  console.warn("⚠️ [VLC Player] Multiple HLS network errors, falling back directly to MP4 source.");
                  hls.destroy();
                  hlsRef.current = null;
                  video.src = src;
                  video.load();
                  if (autoPlay && isCurrent) video.play().catch(() => {});
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn("⚠️ [VLC Player] HLS Media buffer error, attempting media recovery...");
                hls.recoverMediaError();
                break;
              default:
                console.error("❌ [VLC Player] Fatal HLS unrecoverable error, switching to direct video element fallback.");
                hls.destroy();
                hlsRef.current = null;
                video.src = src;
                video.load();
                if (autoPlay && isCurrent) video.play().catch(() => {});
                break;
            }
          }
        });

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (isM3u8 && canPlayNativeHls) {
        // Native HLS for Safari / iOS AVPlayer
        console.log(`🍎 [VLC Player] Using Native AVPlayer HLS Engine for iOS/Safari:`, targetSource);
        video.src = targetSource;
        setStreamStats({
          isHLS: true,
          currentQuality: "Native iOS AVPlayer",
          bitrateKbps: 2400,
          bufferLengthSec: 15,
          droppedFrames: 0,
          cdnStatus: "active",
          autoLevel: true,
        });
      } else {
        // Direct MP4 playback
        video.src = targetSource;
        setStreamStats({
          isHLS: false,
          currentQuality: "Direct MP4 (Hardware Accelerated)",
          bitrateKbps: 1800,
          bufferLengthSec: 5,
          droppedFrames: 0,
          cdnStatus: "direct",
          autoLevel: false,
        });
      }
    }, [targetSource, autoPlay, isCurrent, src]);

    // Sync external muted prop
    useEffect(() => {
      if (muted !== audioSettings.isMuted) {
        setAudioSettings((prev) => ({
          ...prev,
          isMuted: muted,
        }));
      }
    }, [muted]);

    // Attach VLC Audio Engine & handle volume/equalizer
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      vlcAudioEngine.attachElement(video);
      vlcAudioEngine.setVolume(video, audioSettings.volume, audioSettings.isMuted);
      vlcAudioEngine.setEqualizer(video, audioSettings.equalizerPreset);
    }, [audioSettings]);

    // Handle Playback rate
    useEffect(() => {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = playbackSettings.playbackRate;
      }
    }, [playbackSettings.playbackRate]);

    // Handle Quality selection switch in Hls instance
    const handleSetQualityLevel = useCallback((levelId: number) => {
      if (hlsRef.current) {
        if (levelId === -1) {
          hlsRef.current.currentLevel = -1; // Auto
          showNotification("VLC Calidad: Automático (HLS Adaptativo)");
        } else {
          hlsRef.current.currentLevel = levelId;
          const selectedLvl = hlsRef.current.levels[levelId];
          const name = selectedLvl?.height ? `${selectedLvl.height}p` : `Nivel ${levelId}`;
          showNotification(`VLC Calidad fija: ${name}`);
        }
        setPlaybackSettings((prev) => ({ ...prev, hlsQualityLevel: levelId }));
      }
    }, [showNotification]);

    // Update buffer visualization from video.buffered ranges
    const updateBufferState = useCallback(() => {
      const video = videoRef.current;
      if (!video || !video.duration || video.buffered.length === 0) {
        setBufferedPercent(0);
        return;
      }
      const current = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= current && current <= video.buffered.end(i)) {
          const end = video.buffered.end(i);
          setBufferedPercent((end / video.duration) * 100);
          return;
        }
      }
    }, []);

    // Handle Sleep Timer
    useEffect(() => {
      if (!playbackSettings.sleepTimerMinutes) return;
      const ms = playbackSettings.sleepTimerMinutes * 60 * 1000;
      const timer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
          showNotification("VLC: Temporizador de apagado activado");
        }
      }, ms);
      return () => clearTimeout(timer);
    }, [playbackSettings.sleepTimerMinutes, showNotification]);

    // Expose handle methods
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          return videoRef.current.play();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seek: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(0, Math.min(seconds, duration));
        }
      },
      getVideoElement: () => videoRef.current,
      toggleMute: () => {
        setAudioSettings((prev) => ({ ...prev, isMuted: !prev.isMuted }));
      },
      setVolume: (vol: number) => {
        setAudioSettings((prev) => ({
          ...prev,
          volume: vol,
          isMuted: vol === 0,
        }));
      },
      setQualityLevel: handleSetQualityLevel,
      getStreamStats: () => streamStats,
    }));

    const triggerControlsAutoHide = useCallback(() => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }, []);

    // Gesture tracking variables for VLC mobile touch system
    const touchStartRef = useRef<{
      x: number;
      y: number;
      time: number;
      zone: "left" | "right" | "center";
      startBrightness: number;
      startVolume: number;
      startTime: number;
      isDragging: boolean;
      direction: "vertical" | "horizontal" | null;
    } | null>(null);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (playbackSettings.isLocked) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const width = rect.width;

      const zone = x < width * 0.4 ? "left" : x > width * 0.6 ? "right" : "center";

      touchStartRef.current = {
        x,
        y,
        time: Date.now(),
        zone,
        startBrightness: playbackSettings.brightness,
        startVolume: audioSettings.volume,
        startTime: videoRef.current?.currentTime || 0,
        isDragging: false,
        direction: null,
      };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (playbackSettings.isLocked || !touchStartRef.current) return;
      const touch = e.touches[0];
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;
      const deltaX = currentX - touchStartRef.current.x;
      const deltaY = currentY - touchStartRef.current.y;

      if (!touchStartRef.current.direction) {
        if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
          touchStartRef.current.direction = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
          touchStartRef.current.isDragging = true;
        }
      }

      if (touchStartRef.current.direction === "vertical") {
        const height = rect.height;
        const normalizedDelta = -deltaY / (height * 0.7);

        if (touchStartRef.current.zone === "left") {
          // Left side: Brightness
          const newBrightness = Math.round(
            Math.max(10, Math.min(100, touchStartRef.current.startBrightness + normalizedDelta * 100))
          );
          setPlaybackSettings((prev) => ({ ...prev, brightness: newBrightness }));
          setGestureState({
            type: "brightness",
            value: newBrightness,
            displayLabel: `Brillo: ${newBrightness}%`,
          });
        } else if (touchStartRef.current.zone === "right") {
          // Right side: Volume
          const newVolume = Math.round(
            Math.max(0, Math.min(200, touchStartRef.current.startVolume + normalizedDelta * 150))
          );
          setAudioSettings((prev) => ({
            ...prev,
            volume: newVolume,
            isMuted: newVolume === 0,
          }));
          setGestureState({
            type: "volume",
            value: newVolume,
            displayLabel: newVolume > 100 ? `Audio Boost: ${newVolume}%` : `Volumen: ${newVolume}%`,
            subLabel: newVolume > 100 ? "⚡ VLC 200% Amplificación" : undefined,
          });
        }
      } else if (touchStartRef.current.direction === "horizontal") {
        // Horizontal: Seek
        const width = rect.width;
        const seekDeltaSeconds = (deltaX / width) * 45;
        const targetSeek = Math.max(0, Math.min(duration, touchStartRef.current.startTime + seekDeltaSeconds));

        const formatTime = (secs: number) => {
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          return `${m}:${s < 10 ? "0" : ""}${s}`;
        };

        setGestureState({
          type: "seek",
          value: targetSeek,
          displayLabel: `${formatTime(targetSeek)} / ${formatTime(duration)}`,
          subLabel: `${seekDeltaSeconds > 0 ? "+" : ""}${Math.round(seekDeltaSeconds)}s`,
        });

        if (videoRef.current) {
          videoRef.current.currentTime = targetSeek;
          setCurrentTime(targetSeek);
        }
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      setGestureState(null);

      if (!start) return;

      const wasDragging = start.isDragging;
      if (wasDragging) return;

      const now = Date.now();
      const timeDiff = now - (lastTapRef.current?.time || 0);

      if (timeDiff < 300 && lastTapRef.current) {
        const tapX = start.x;
        const rect = containerRef.current?.getBoundingClientRect();
        const width = rect?.width || 300;

        if (tapX < width * 0.3) {
          handleJump(-10);
        } else if (tapX > width * 0.7) {
          handleJump(10);
        } else {
          if (onDoubleClickCenter) {
            onDoubleClickCenter();
          } else {
            handlePlayPause();
          }
        }
        lastTapRef.current = null;
        return;
      }

      lastTapRef.current = { time: now, x: start.x, y: start.y };

      if (onClick) {
        onClick();
      }
      triggerControlsAutoHide();
    };

    const handlePlayPause = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().catch(() => {});
        setIsPlaying(true);
        showNotification("VLC: Reproduciendo");
      } else {
        video.pause();
        setIsPlaying(false);
        showNotification("VLC: Pausado");
      }
      triggerControlsAutoHide();
    };

    const handleJump = (seconds: number) => {
      const video = videoRef.current;
      if (!video) return;
      const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
      video.currentTime = newTime;
      setCurrentTime(newTime);
      setJumpAnim(seconds > 0 ? "forward" : "backward");
      setTimeout(() => setJumpAnim(null), 500);
    };

    const handleCycleAspectRatio = () => {
      const ratios: VLCAspectRatio[] = ["fill", "fit", "16:9", "4:3", "original"];
      const currentIdx = ratios.indexOf(playbackSettings.aspectRatio);
      const nextRatio = ratios[(currentIdx + 1) % ratios.length];
      setPlaybackSettings((prev) => ({ ...prev, aspectRatio: nextRatio }));
      showNotification(`VLC Relación: ${nextRatio.toUpperCase()}`);
    };

    const handleCycleSpeed = () => {
      const speeds = [1.0, 1.25, 1.5, 2.0, 0.5, 0.75];
      const currentIdx = speeds.indexOf(playbackSettings.playbackRate);
      const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
      setPlaybackSettings((prev) => ({ ...prev, playbackRate: nextSpeed }));
      showNotification(`VLC Velocidad: ${nextSpeed}x`);
    };

    const handleToggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    };

    // Calculate aspect ratio class
    const getAspectRatioClass = () => {
      switch (playbackSettings.aspectRatio) {
        case "fit":
          return "object-contain";
        case "fill":
          return "object-cover";
        case "16:9":
          return "object-cover aspect-video";
        case "4:3":
          return "object-cover aspect-4/3";
        case "original":
          return "object-none";
        default:
          return "object-cover";
      }
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full bg-black overflow-hidden select-none flex items-center justify-center ${className}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (e.detail === 2) {
            if (onDoubleClickCenter) {
              onDoubleClickCenter();
            } else {
              handlePlayPause();
            }
          } else {
            triggerControlsAutoHide();
          }
        }}
        id="vlc-mobile-player"
      >
        {/* VLC Video Screen Filter (For Brightness adjustments) */}
        <div
          className="absolute inset-0 bg-black pointer-events-none z-10 transition-opacity"
          style={{ opacity: 1 - playbackSettings.brightness / 100 }}
        />

        {/* Video Element */}
        <video
          ref={videoRef}
          poster={poster}
          autoPlay={autoPlay}
          loop={loop}
          muted={audioSettings.isMuted}
          playsInline
          // @ts-ignore
          webkit-playsinline="true"
          // @ts-ignore
          x5-playsinline="true"
          // @ts-ignore
          x5-video-player-type="h5-page"
          disablePictureInPicture={false}
          disableRemotePlayback={false}
          controls={false}
          preload={preload}
          onPlay={() => {
            setIsPlaying(true);
            onPlay?.();
          }}
          onPause={() => {
            setIsPlaying(false);
            onPause?.();
          }}
          onWaiting={() => onWaiting?.()}
          onPlaying={() => onPlaying?.()}
          onEnded={() => onEnded?.()}
          onProgress={updateBufferState}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration || 0;
            setDuration(dur);
            updateBufferState();
            onLoadedMetadata?.(dur);
          }}
          onTimeUpdate={(e) => {
            const curr = e.currentTarget.currentTime || 0;
            const dur = e.currentTarget.duration || 0;
            setCurrentTime(curr);
            setDuration(dur);
            updateBufferState();
            onTimeUpdate?.(curr, dur);
          }}
          className={`w-full h-full block cursor-pointer transition-transform ${getAspectRatioClass()} ${
            playbackSettings.hardwareAcceleration ? "transform-gpu" : ""
          }`}
        />

        {/* VLC On-Screen Display (OSD) */}
        <VLCOSD
          gesture={gestureState}
          notification={osdNotification}
          isLocked={playbackSettings.isLocked}
          jumpAnim={jumpAnim}
        />

        {/* VLC Floating Controls (HUD) */}
        <VLCControls
          isVisible={showControls && !gestureState}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          bufferedPercent={bufferedPercent}
          playbackSettings={playbackSettings}
          audioSettings={audioSettings}
          streamStats={streamStats}
          onPlayPause={handlePlayPause}
          onSeek={(time) => {
            if (videoRef.current) {
              videoRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
          onOpenMenu={() => setIsMenuOpen(true)}
          onToggleLock={() => {
            setPlaybackSettings((prev) => ({ ...prev, isLocked: !prev.isLocked }));
            showNotification(playbackSettings.isLocked ? "VLC: Pantalla Desbloqueada" : "VLC: Pantalla Bloqueada");
          }}
          onToggleMute={() => {
            setAudioSettings((prev) => ({ ...prev, isMuted: !prev.isMuted }));
          }}
          onJump={handleJump}
          onCycleAspectRatio={handleCycleAspectRatio}
          onCycleSpeed={handleCycleSpeed}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          title={title}
          creatorName={creatorName}
          isFeedMode={isFeedMode}
        />

        {/* VLC Settings Menu Modal with Adaptive HLS & CDN Controls */}
        <VLCMenuModal
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          playbackSettings={playbackSettings}
          audioSettings={audioSettings}
          videoUrl={targetSource}
          qualities={availableQualities}
          streamStats={streamStats}
          onSelectQuality={handleSetQualityLevel}
          onUpdatePlaybackSettings={(newSettings) =>
            setPlaybackSettings((prev) => ({ ...prev, ...newSettings }))
          }
          onUpdateAudioSettings={(newSettings) =>
            setAudioSettings((prev) => ({ ...prev, ...newSettings }))
          }
        />
      </div>
    );
  }
);

VLCVideoPlayer.displayName = "VLCVideoPlayer";
