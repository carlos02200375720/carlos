import React, { useRef, useEffect, useCallback } from "react";

interface AndroidProgressBarProps {
  video: HTMLVideoElement | null;
  isActive: boolean;
  bottomOffset?: number;
}

/**
 * Android Native Progress Bar
 * Isolated, high-performance seek bar with Android touch ergonomics.
 * Always positioned at the bottom of the publication card, directly above the navigation bar.
 */
export const AndroidProgressBar: React.FC<AndroidProgressBarProps> = React.memo(({ video, isActive, bottomOffset = 0 }) => {
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

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    isScrubbingRef.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    handleSeek(clientX);

    const onMove = (moveEvt: TouchEvent | MouseEvent) => {
      if (!isScrubbingRef.current) return;
      const x = "touches" in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      handleSeek(x);
    };

    const onEnd = () => {
      isScrubbingRef.current = false;
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
    };

    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
  };

  if (!isActive) return null;

  return (
    <div
      ref={progressBarRef}
      className="absolute left-0 right-0 z-30 h-5 flex items-end cursor-pointer select-none touch-none group"
      style={{
        bottom: `${bottomOffset}px`,
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onMouseDown={handleTouchStart}
      onClick={(e) => {
        e.stopPropagation();
        handleSeek(e.clientX);
      }}
      id="android-reel-progress-bar"
    >
      <div className="w-full h-[3.5px] group-hover:h-[5px] bg-white/20 backdrop-blur-sm relative overflow-hidden transition-all duration-150">
        <div
          ref={fillBarRef}
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.9)] relative"
          style={{ width: "0%" }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-amber-300 border border-white/60 rounded-full shadow-lg scale-90 group-hover:scale-125 transition-transform" />
        </div>
      </div>
    </div>
  );
});

AndroidProgressBar.displayName = "AndroidProgressBar";
