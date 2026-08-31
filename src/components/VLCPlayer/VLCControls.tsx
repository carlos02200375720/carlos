import React from "react";
import {
  Play,
  Pause,
  Sliders,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Zap
} from "lucide-react";
import { VLCConeIcon } from "./VLCConeIcon";
import { VLCPlaybackSettings, VLCAudioSettings, HLSStreamStats } from "./types";
import { motion, AnimatePresence } from "motion/react";

interface VLCControlsProps {
  isVisible: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent?: number;
  playbackSettings: VLCPlaybackSettings;
  audioSettings: VLCAudioSettings;
  streamStats?: HLSStreamStats;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onOpenMenu: () => void;
  onToggleLock: () => void;
  onToggleMute: () => void;
  onJump: (seconds: number) => void;
  onCycleAspectRatio: () => void;
  onCycleSpeed: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  title?: string;
  creatorName?: string;
  isFeedMode?: boolean; // When rendered inside reels feed
}

export const VLCControls: React.FC<VLCControlsProps> = ({
  isVisible,
  isPlaying,
  currentTime,
  duration,
  bufferedPercent = 0,
  playbackSettings,
  audioSettings,
  streamStats,
  onPlayPause,
  onSeek,
  onOpenMenu,
  onToggleLock,
  onToggleMute,
  onJump,
  onCycleAspectRatio,
  onCycleSpeed,
  onToggleFullscreen,
  isFullscreen,
  title,
  creatorName,
  isFeedMode = false,
}) => {
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // If player is locked, only render the unlock button
  if (playbackSettings.isLocked) {
    return (
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4">
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={onToggleLock}
            className="p-3 bg-black/70 backdrop-blur-md border border-white/20 rounded-full text-amber-400 hover:text-white hover:bg-black/90 shadow-xl transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Desbloquear pantalla"
          >
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Desbloquear</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-25 flex flex-col justify-between pointer-events-none bg-gradient-to-b from-black/70 via-transparent to-black/80 p-3 sm:p-4 select-none"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between w-full pointer-events-auto pt-1">
            {/* Left: VLC Brand, Title & Streaming Protocol Badge */}
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/15">
                <VLCConeIcon size={18} />
                <span className="text-xs font-black text-[#ff8800] tracking-wider uppercase">VLC</span>
              </div>
              
              {streamStats?.isHLS && (
                <div
                  onClick={onOpenMenu}
                  className="hidden sm:flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold backdrop-blur-md cursor-pointer hover:bg-emerald-500/30 transition-colors"
                  title="Streaming Adaptativo HLS y Red CDN activa"
                >
                  <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                  <span>HLS {streamStats.currentQuality}</span>
                </div>
              )}

              {title && (
                <div className="truncate text-xs font-medium text-white/90 max-w-[140px] sm:max-w-xs drop-shadow-md">
                  {title}
                </div>
              )}
            </div>

            {/* Right: Quick buttons */}
            <div className="flex items-center space-x-1.5">
              {/* Playback speed quick pill */}
              <button
                onClick={onCycleSpeed}
                className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/15 text-white hover:text-[#ff8800] text-[11px] font-mono font-bold transition-colors cursor-pointer"
                title="Cambiar velocidad"
              >
                {playbackSettings.playbackRate}x
              </button>

              {/* Aspect ratio quick pill */}
              <button
                onClick={onCycleAspectRatio}
                className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/15 text-white hover:text-[#ff8800] text-[11px] font-mono font-bold transition-colors cursor-pointer uppercase"
                title="Cambiar relación de aspecto"
              >
                {playbackSettings.aspectRatio}
              </button>

              {/* Settings Menu trigger */}
              <button
                onClick={onOpenMenu}
                className="p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/15 text-white hover:text-[#ff8800] transition-colors cursor-pointer"
                title="Ajustes VLC & HLS Streaming"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause & Quick Jump (For non-feed or desktop view) */}
          {!isFeedMode && (
            <div className="flex items-center justify-center space-x-8 pointer-events-auto">
              <button
                onClick={() => onJump(-10)}
                className="p-3 bg-black/50 hover:bg-black/75 text-white rounded-full transition-transform active:scale-95 cursor-pointer backdrop-blur-sm"
                title="Retroceder 10s"
              >
                <Rewind className="w-6 h-6" />
              </button>

              <button
                onClick={onPlayPause}
                className="p-4 bg-[#ff8800] hover:bg-[#ff7700] text-black rounded-full transition-transform active:scale-90 cursor-pointer shadow-lg shadow-[#ff8800]/30 flex items-center justify-center"
                title={isPlaying ? "Pausar" : "Reproducir"}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 fill-black" />
                ) : (
                  <Play className="w-8 h-8 fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => onJump(10)}
                className="p-3 bg-black/50 hover:bg-black/75 text-white rounded-full transition-transform active:scale-95 cursor-pointer backdrop-blur-sm"
                title="Avanzar 10s"
              >
                <FastForward className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Bottom Bar (Seek bar + Time + Extra controls) */}
          <div className="w-full flex flex-col space-y-2 pointer-events-auto pb-1">
            {/* Scrubber Progress Bar with HLS Buffer indicator */}
            <div className="w-full flex items-center space-x-2">
              <span className="text-[11px] font-mono font-medium text-white/90 min-w-[35px]">
                {formatTime(currentTime)}
              </span>

              <div
                className="flex-1 h-3 flex items-center cursor-pointer group relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPos = (e.clientX - rect.left) / rect.width;
                  onSeek(clickPos * duration);
                }}
              >
                {/* Track background */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden relative group-hover:h-1.5 transition-all">
                  {/* Ahead Downloaded Buffer (HLS chunks loaded in cache) */}
                  <div
                    className="h-full bg-white/40 absolute left-0 top-0 rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
                  />
                  {/* Filled played track */}
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-[#ff8800] relative rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {/* Scrubbing thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-[#ff8800] border-2 border-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <span className="text-[11px] font-mono font-medium text-white/70 min-w-[35px]">
                {formatTime(duration)}
              </span>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between">
              {/* Left: Play/Pause in Feed Mode & Audio toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={onPlayPause}
                  className="p-1.5 text-white hover:text-[#ff8800] transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>

                <button
                  onClick={onToggleMute}
                  className="p-1.5 text-white hover:text-[#ff8800] transition-colors cursor-pointer flex items-center gap-1"
                >
                  {audioSettings.isMuted ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-white" />
                  )}
                  {audioSettings.volume > 100 && !audioSettings.isMuted && (
                    <span className="text-[9px] font-mono font-bold text-[#ff8800]">
                      {audioSettings.volume}%
                    </span>
                  )}
                </button>

                {playbackSettings.hardwareAcceleration && (
                  <span className="hidden sm:inline-flex items-center text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                    HW Dec
                  </span>
                )}
              </div>

              {/* Right: Lock & Fullscreen */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={onToggleLock}
                  className="p-1.5 text-white/80 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Bloquear controles"
                >
                  <Unlock className="w-4 h-4" />
                </button>

                {onToggleFullscreen && (
                  <button
                    onClick={onToggleFullscreen}
                    className="p-1.5 text-white/80 hover:text-[#ff8800] transition-colors cursor-pointer"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
