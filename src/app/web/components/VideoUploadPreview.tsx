import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Trash2, 
  RefreshCw, 
  Film, 
  Clock, 
  Maximize2, 
  HardDrive, 
  Sparkles, 
  CheckCircle2,
  Image as ImageIcon
} from "lucide-react";

interface VideoUploadPreviewProps {
  file: File;
  coverFile?: File | null;
  onRemove: () => void;
  onChangeFile?: () => void;
  compact?: boolean;
}

export default function VideoUploadPreview({
  file,
  coverFile,
  onRemove,
  onChangeFile,
  compact = false,
}: VideoUploadPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(() => {
    if (file && typeof window !== "undefined" && window.URL?.createObjectURL) {
      try {
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Generate object URL and revoke cleanly on unmount or file change
  useEffect(() => {
    if (!file || typeof window === "undefined" || !window.URL?.createObjectURL) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setDimensions(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Object URL for custom cover thumbnail
  const coverUrl = useMemo(() => {
    if (!coverFile || typeof window === "undefined" || !window.URL?.createObjectURL) return null;
    try {
      return URL.createObjectURL(coverFile);
    } catch {
      return null;
    }
  }, [coverFile]);

  useEffect(() => {
    return () => {
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
      }
    };
  }, [coverUrl]);

  // Handle video metadata
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
    setDimensions({
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const targetTime = parseFloat(e.target.value);
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const aspectLabel = useMemo(() => {
    if (!dimensions || dimensions.width === 0 || dimensions.height === 0) return "Auto";
    const ratio = dimensions.height / dimensions.width;
    if (ratio >= 1.5) return "9:16 Vertical (Ideal Reel)";
    if (ratio <= 0.7) return "16:9 Panorámico";
    if (ratio >= 0.9 && ratio <= 1.1) return "1:1 Cuadrado";
    if (ratio > 1.1 && ratio < 1.5) return "4:5 Vertical";
    return `${dimensions.width}×${dimensions.height}`;
  }, [dimensions]);

  if (compact) {
    return (
      <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <Film className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
              {file.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            title="Eliminar video"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Video Player & Info Compact */}
        <div className="flex items-start space-x-3">
          <div 
            onClick={togglePlay}
            className="w-20 h-28 bg-slate-950 rounded-lg overflow-hidden relative shrink-0 cursor-pointer group shadow-sm flex items-center justify-center border border-slate-300"
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted={isMuted}
                playsInline
                loop
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                <Film className="w-6 h-6 animate-pulse" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white opacity-80" />
              ) : (
                <Play className="w-5 h-5 text-white fill-white opacity-90" />
              )}
            </div>
            <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-mono text-white px-1 rounded">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1 text-[11px] text-slate-600">
            <p className="font-medium flex items-center space-x-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Duración: <strong>{formatTime(duration)}</strong></span>
            </p>
            <p className="font-medium flex items-center space-x-1">
              <HardDrive className="w-3 h-3 text-slate-400" />
              <span>Peso: <strong>{formatFileSize(file.size)}</strong></span>
            </p>
            {dimensions && (
              <p className="font-medium flex items-center space-x-1">
                <Maximize2 className="w-3 h-3 text-slate-400" />
                <span className="truncate">Resolución: <strong>{dimensions.width}×{dimensions.height}</strong></span>
              </p>
            )}
            <div className="pt-1">
              {onChangeFile && (
                <button
                  type="button"
                  onClick={onChangeFile}
                  className="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Cambiar video</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header with Title and Action Buttons */}
      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center space-x-2 truncate">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div className="truncate text-left">
            <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {formatFileSize(file.size)} • {file.type || "video/mp4"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {onChangeFile && (
            <button
              type="button"
              onClick={onChangeFile}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
              title="Seleccionar otro archivo"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Cambiar</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
            title="Quitar video"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Preview Container with Responsive Reel Player */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
        {/* Visual Video Player Card (5 cols on desktop) */}
        <div className="sm:col-span-5 flex flex-col items-center">
          <div 
            onClick={togglePlay}
            onMouseEnter={() => setShowControls(true)}
            className="w-full max-w-[240px] aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden relative cursor-pointer shadow-lg border-2 border-slate-800/80 group flex items-center justify-center"
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted={isMuted}
                playsInline
                loop
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                <Film className="w-10 h-10 animate-pulse" />
              </div>
            )}

            {/* Video overlay badge */}
            <div className="absolute top-2.5 left-2.5 z-10">
              <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-amber-400 border border-amber-400/20 shadow-sm flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Vista Previa Reel</span>
              </span>
            </div>

            {/* Audio Mute Button */}
            <button
              type="button"
              onClick={toggleMute}
              className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 flex items-center justify-center text-white border border-white/20 transition-all cursor-pointer shadow-md"
              title={isMuted ? "Activar audio" : "Silenciar audio"}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            {/* Central Play/Pause Watermark Button */}
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            }`}>
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl transform group-hover:scale-105 transition-transform">
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 fill-white translate-x-0.5" />
                )}
              </div>
            </div>

            {/* Bottom Timeline Controls */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 transition-opacity duration-200 ${
                showControls ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {/* Progress Scrub Bar */}
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-amber-500 mb-2"
              />

              <div className="flex items-center justify-between text-[10px] font-mono text-white/90">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5">
            Toca el video para reproducir o pausar
          </span>
        </div>

        {/* Technical & Content Summary Details (7 cols on desktop) */}
        <div className="sm:col-span-7 space-y-3 text-left w-full">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
              <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Resumen del Video Cargado</span>
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Video Válido</span>
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Duración</span>
                <p className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{formatTime(duration)} min ({Math.round(duration)}s)</span>
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Peso en Disco</span>
                <p className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                  <span>{formatFileSize(file.size)}</span>
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Resolución</span>
                <p className="text-xs font-bold text-slate-800 flex items-center space-x-1 truncate">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">
                    {dimensions ? `${dimensions.width} × ${dimensions.height}` : "Detectando..."}
                  </span>
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] font-medium text-slate-400 block mb-0.5">Aspecto / Formato</span>
                <p className="text-xs font-bold text-slate-800 truncate" title={aspectLabel}>
                  {aspectLabel}
                </p>
              </div>
            </div>

            {/* Cover Status */}
            {coverUrl ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center space-x-2.5">
                <img
                  src={coverUrl}
                  alt="Portada"
                  className="w-9 h-9 object-cover rounded-lg border border-amber-400 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-slate-900 truncate">Portada Personalizada activa</p>
                  <p className="text-[10px] text-amber-800 font-medium truncate">{coverFile?.name}</p>
                </div>
              </div>
            ) : (
              <div className="p-2 bg-slate-100/80 rounded-xl text-[10px] text-slate-500 flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Se generará automáticamente un fotograma como miniatura del video.</span>
              </div>
            )}

            {/* Mobile Optimization Ready Note */}
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
              <p className="text-[11px] font-bold text-amber-900 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Aceleración H.264 ultrafast</span>
              </p>
              <p className="text-[10px] text-amber-800 leading-tight">
                Al publicar, el servidor procesará el video con átomo faststart para que en los Reels comience a reproducirse al instante sin tiempos de carga.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
