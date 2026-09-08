import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Trash2, Film } from "lucide-react";

interface AndroidVideoUploadPreviewProps {
  file: File;
  coverFile?: File | null;
  onRemove: () => void;
  compact?: boolean;
}

export default function AndroidVideoUploadPreview({
  file,
  onRemove,
  compact = false,
}: AndroidVideoUploadPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (!file || typeof window === "undefined" || !window.URL?.createObjectURL) {
      setVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 ${compact ? "h-48" : "h-72"}`}>
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
          <Film className="w-10 h-10 mb-2" />
          <span className="text-xs">Cargando previsualización...</span>
        </div>
      )}

      {/* Overlay controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-3 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <span className="px-2.5 py-1 bg-black/60 rounded-full text-[10px] font-semibold text-white backdrop-blur-md">
            Android Preview
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 bg-rose-500/80 hover:bg-rose-600 rounded-full text-white backdrop-blur-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between pointer-events-auto">
          <button
            type="button"
            onClick={togglePlay}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
