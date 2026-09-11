import React, { useRef, useEffect, useCallback, useState } from "react";

interface AndroidProgressBarProps {
  video?: HTMLVideoElement | null;
  isActive: boolean;
  bottomOffset?: number;
}

/**
 * Android Native Progress Bar
 * Isolated, high-performance seek bar with Android touch ergonomics.
 * Always positioned at the bottom of the publication card, directly above the navigation bar.
 * Features 60fps requestAnimationFrame tracking, DOM element auto-detection fallback,
 * and fluid touch seeking.
 */
export const AndroidProgressBar: React.FC<AndroidProgressBarProps> = React.memo(({ video: propVideo, isActive, bottomOffset = 0 }) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const fillBarRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [resolvedVideo, setResolvedVideo] = useState<HTMLVideoElement | null>(propVideo || null);
  const animFrameIdRef = useRef<number | null>(null);

  // Synchronize prop video or search DOM container fallback if prop is delayed
  useEffect(() => {
    if (propVideo) {
      setResolvedVideo(propVideo);
      return;
    }

    // Fallback: search for <video> in parent container if propVideo is null
    const findVideo = () => {
      const container = progressBarRef.current?.parentElement;
      const el = (container?.querySelector("video") || document.querySelector("#android-reels-view video")) as HTMLVideoElement | null;
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

  // Smooth 60fps tracking using requestAnimationFrame while video is playing
  useEffect(() => {
    if (!activeVideo || !isActive) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    let isRunning = true;

    const loop = () => {
      if (!isRunning) return;
      if (!activeVideo.paused && !activeVideo.ended && !isScrubbingRef.current) {
        updateProgress();
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    // Event handlers for state transitions
    const handlePlay = () => {
      updateProgress();
      if (!animFrameIdRef.current) {
        animFrameIdRef.current = requestAnimationFrame(loop);
      }
    };

    const handlePauseOrEnd = () => {
      updateProgress();
    };

    // Initial update
    updateProgress();
    animFrameIdRef.current = requestAnimationFrame(loop);

    activeVideo.addEventListener("timeupdate", updateProgress, { passive: true });
    activeVideo.addEventListener("loadedmetadata", updateProgress, { passive: true });
    activeVideo.addEventListener("durationchange", updateProgress, { passive: true });
    activeVideo.addEventListener("seeking", updateProgress, { passive: true });
    activeVideo.addEventListener("seeked", updateProgress, { passive: true });
    activeVideo.addEventListener("play", handlePlay, { passive: true });
    activeVideo.addEventListener("playing", handlePlay, { passive: true });
    activeVideo.addEventListener("pause", handlePauseOrEnd, { passive: true });
    activeVideo.addEventListener("ended", handlePauseOrEnd, { passive: true });

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      activeVideo.removeEventListener("timeupdate", updateProgress);
      activeVideo.removeEventListener("loadedmetadata", updateProgress);
      activeVideo.removeEventListener("durationchange", updateProgress);
      activeVideo.removeEventListener("seeking", updateProgress);
      activeVideo.removeEventListener("seeked", updateProgress);
      activeVideo.removeEventListener("play", handlePlay);
      activeVideo.removeEventListener("playing", handlePlay);
      activeVideo.removeEventListener("pause", handlePauseOrEnd);
      activeVideo.removeEventListener("ended", handlePauseOrEnd);
    };
  }, [activeVideo, isActive, updateProgress]);

  const handleSeek = useCallback((clientX: number) => {
    if (!progressBarRef.current || !activeVideo) return;
    const dur = activeVideo.duration;
    if (typeof dur !== "number" || isNaN(dur) || !isFinite(dur) || dur <= 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));

    activeVideo.currentTime = percentage * dur;
    if (fillBarRef.current) {
      fillBarRef.current.style.width = `${percentage * 100}%`;
    }
  }, [activeVideo]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    isScrubbingRef.current = true;
    setIsScrubbing(true);

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    handleSeek(clientX);

    const onMove = (moveEvt: TouchEvent | MouseEvent) => {
      if (!isScrubbingRef.current) return;
      if ("touches" in moveEvt && moveEvt.cancelable) {
        moveEvt.preventDefault();
      }
      const x = "touches" in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      handleSeek(x);
    };

    const onEnd = () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      updateProgress();
    };

    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
  };

  if (!isActive) return null;

  return (
    <div
      ref={progressBarRef}
      className="absolute left-0 right-0 z-40 h-6 flex items-end cursor-pointer select-none touch-none group"
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
      {/* Background Track with increased visibility and tactile ergonomics */}
      <div className={`w-full ${isScrubbing ? "h-1.5" : "h-[3.5px] group-hover:h-1"} bg-white/25 backdrop-blur-sm relative transition-all duration-150`}>
        {/* Filled Progress Bar */}
        <div
          ref={fillBarRef}
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.9)] relative"
          style={{ width: "0%" }}
        >
          {/* Scrubber thumb circle */}
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full bg-amber-300 border border-white/80 shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 ${
              isScrubbing ? "w-3.5 h-3.5 scale-125" : "w-2.5 h-2.5 scale-90 group-hover:scale-110 opacity-80 group-hover:opacity-100"
            }`}
          />
        </div>
      </div>
    </div>
  );
});

AndroidProgressBar.displayName = "AndroidProgressBar";
