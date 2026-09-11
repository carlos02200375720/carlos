import React, { useRef, useEffect, useCallback, useState } from "react";

interface ReelProgressBarProps {
  video?: HTMLVideoElement | null;
  isActive: boolean;
}

/**
 * Isolated, zero-overhead progress bar for Reels.
 * Directly listens to native video element events and updates DOM styles
 * with 60fps tracking and automatic DOM video detection fallback.
 */
export const ReelProgressBar: React.FC<ReelProgressBarProps> = React.memo(({ video: propVideo, isActive }) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const fillBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  const [resolvedVideo, setResolvedVideo] = useState<HTMLVideoElement | null>(propVideo || null);
  const animFrameRef = useRef<number | null>(null);

  // Sync propVideo or search DOM container fallback if prop is delayed
  useEffect(() => {
    if (propVideo) {
      setResolvedVideo(propVideo);
      return;
    }

    const findVideo = () => {
      const container = progressBarRef.current?.parentElement;
      const el = (container?.querySelector("video") || document.querySelector("video")) as HTMLVideoElement | null;
      if (el) {
        setResolvedVideo(el);
      }
    };

    findVideo();
    const t1 = setTimeout(findVideo, 100);
    const t2 = setTimeout(findVideo, 350);
    const t3 = setTimeout(findVideo, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [propVideo, isActive]);

  const activeVideo = propVideo || resolvedVideo;

  const updateProgress = useCallback(() => {
    if (!activeVideo || isScrubbingRef.current || !fillBarRef.current) return;
    const cur = activeVideo.currentTime || 0;
    const dur = activeVideo.duration || 0;
    if (dur > 0 && isFinite(dur)) {
      const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
      fillBarRef.current.style.width = `${pct}%`;
    } else {
      fillBarRef.current.style.width = "0%";
    }
  }, [activeVideo]);

  // High-precision 60fps tracking via requestAnimationFrame while video is playing
  useEffect(() => {
    if (!activeVideo || !isActive) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      updateProgress();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    activeVideo.addEventListener("timeupdate", updateProgress, { passive: true });
    activeVideo.addEventListener("loadedmetadata", updateProgress, { passive: true });
    activeVideo.addEventListener("seeking", updateProgress, { passive: true });
    activeVideo.addEventListener("seeked", updateProgress, { passive: true });

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      activeVideo.removeEventListener("timeupdate", updateProgress);
      activeVideo.removeEventListener("loadedmetadata", updateProgress);
      activeVideo.removeEventListener("seeking", updateProgress);
      activeVideo.removeEventListener("seeked", updateProgress);
    };
  }, [activeVideo, isActive, updateProgress]);

  const handleSeek = (clientX: number) => {
    if (!progressBarRef.current || !activeVideo || !activeVideo.duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    activeVideo.currentTime = percentage * activeVideo.duration;
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
