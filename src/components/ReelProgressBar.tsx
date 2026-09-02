import React, { useRef, useEffect, useCallback } from "react";

interface ReelProgressBarProps {
  video: HTMLVideoElement | null;
  isActive: boolean;
}

/**
 * Isolated, zero-overhead progress bar for Reels.
 * Directly listens to native video element events and updates DOM styles
 * without causing any parent component re-renders.
 */
export const ReelProgressBar: React.FC<ReelProgressBarProps> = React.memo(({ video, isActive }) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const fillBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);

  const updateProgress = useCallback(() => {
    if (!video || isScrubbingRef.current || !fillBarRef.current) return;
    const cur = video.currentTime || 0;
    const dur = video.duration || 0;
    if (dur > 0) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      fillBarRef.current.style.width = `${pct}%`;
    }
  }, [video]);

  useEffect(() => {
    if (!video || !isActive) return;

    video.addEventListener("timeupdate", updateProgress, { passive: true });
    video.addEventListener("loadedmetadata", updateProgress, { passive: true });
    video.addEventListener("seeking", updateProgress, { passive: true });
    video.addEventListener("seeked", updateProgress, { passive: true });

    updateProgress();

    return () => {
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", updateProgress);
      video.removeEventListener("seeking", updateProgress);
      video.removeEventListener("seeked", updateProgress);
    };
  }, [video, isActive, updateProgress]);

  const handleSeek = (clientX: number) => {
    if (!progressBarRef.current || !video || !video.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    video.currentTime = percentage * video.duration;
    if (fillBarRef.current) {
      fillBarRef.current.style.width = `${percentage * 100}%`;
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isScrubbingRef.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    handleSeek(clientX);

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!isScrubbingRef.current) return;
      const x = "touches" in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      handleSeek(x);
    };

    const onEnd = () => {
      isScrubbingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  };

  if (!isActive) return null;

  return (
    <div
      ref={progressBarRef}
      className="absolute bottom-0 left-0 right-0 z-30 h-3 flex items-end cursor-pointer group select-none touch-none"
      style={{ touchAction: "none" }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onClick={(e) => handleSeek(e.clientX)}
      id="video-progress-bar"
    >
      {/* Background Track with uniform solid thickness */}
      <div className="w-full h-[3px] bg-white/30 backdrop-blur-md relative overflow-hidden">
        {/* Filled Progress */}
        <div
          ref={fillBarRef}
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.9)] relative"
          style={{ width: "0%" }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
});

ReelProgressBar.displayName = "ReelProgressBar";
