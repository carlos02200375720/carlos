import React from "react";
import { Sun, Volume2, VolumeX, Volume1, Lock, Unlock, FastForward, Rewind } from "lucide-react";
import { VLCConeIcon } from "./VLCConeIcon";
import { VLCGestureState } from "./types";
import { motion, AnimatePresence } from "motion/react";

interface VLCOSDProps {
  gesture: VLCGestureState | null;
  notification: string | null;
  isLocked?: boolean;
  jumpAnim?: 'forward' | 'backward' | null;
}

export const VLCOSD: React.FC<VLCOSDProps> = ({
  gesture,
  notification,
  isLocked,
  jumpAnim,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden">
      {/* 1. Left Vertical Brightness OSD */}
      <AnimatePresence>
        {gesture && gesture.type === "brightness" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center bg-black/75 backdrop-blur-md border border-white/20 px-3 py-4 rounded-2xl shadow-2xl z-40"
          >
            <Sun className="w-6 h-6 text-amber-400 mb-3 animate-pulse" />
            <div className="w-2.5 h-36 bg-white/20 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-full transition-all duration-75"
                style={{ height: `${Math.min(100, Math.max(0, gesture.value))}%` }}
              />
            </div>
            <span className="text-white text-xs font-mono font-bold mt-3">
              {Math.round(gesture.value)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Right Vertical Volume OSD (Supports up to 200% Audio Boost) */}
      <AnimatePresence>
        {gesture && gesture.type === "volume" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center bg-black/75 backdrop-blur-md border border-white/20 px-3 py-4 rounded-2xl shadow-2xl z-40"
          >
            {gesture.value === 0 ? (
              <VolumeX className="w-6 h-6 text-slate-400 mb-3" />
            ) : gesture.value > 100 ? (
              <div className="relative mb-3 flex items-center justify-center">
                <Volume2 className="w-6 h-6 text-[#ff8800] animate-bounce" />
                <span className="absolute -top-1.5 -right-3 text-[9px] bg-[#ff8800] text-black font-black px-1 rounded-full">
                  BOOST
                </span>
              </div>
            ) : gesture.value > 50 ? (
              <Volume2 className="w-6 h-6 text-amber-400 mb-3" />
            ) : (
              <Volume1 className="w-6 h-6 text-amber-300 mb-3" />
            )}

            <div className="w-2.5 h-36 bg-white/20 rounded-full overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className={`w-full rounded-full transition-all duration-75 ${
                  gesture.value > 100
                    ? "bg-gradient-to-t from-amber-500 via-[#ff8800] to-rose-500 shadow-[0_0_12px_#ff8800]"
                    : "bg-gradient-to-t from-amber-500 to-amber-300"
                }`}
                style={{ height: `${Math.min(100, Math.max(0, (gesture.value / 200) * 100))}%` }}
              />
            </div>
            <span
              className={`text-xs font-mono font-bold mt-3 ${
                gesture.value > 100 ? "text-[#ff8800] font-black" : "text-white"
              }`}
            >
              {Math.round(gesture.value)}%
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Horizontal Seek OSD (Center Time Pill) */}
      <AnimatePresence>
        {gesture && gesture.type === "seek" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center justify-center bg-black/85 backdrop-blur-lg border border-[#ff8800]/50 px-6 py-3.5 rounded-2xl shadow-2xl z-40"
          >
            <div className="flex items-center space-x-2 text-[#ff8800] mb-1">
              <VLCConeIcon size={20} />
              <span className="text-xs font-black uppercase tracking-wider">VLC Seek</span>
            </div>
            <div className="text-lg font-mono font-bold text-white tracking-wide">
              {gesture.displayLabel || "00:00"}
            </div>
            {gesture.subLabel && (
              <div className="text-xs font-mono text-amber-400/90 mt-0.5">
                {gesture.subLabel}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Double Tap Jump 10s Ripples */}
      <AnimatePresence>
        {jumpAnim === "backward" && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
            className="absolute left-10 flex flex-col items-center justify-center p-4 rounded-full bg-white/15 backdrop-blur-md z-35"
          >
            <Rewind className="w-8 h-8 text-white fill-white" />
            <span className="text-white text-xs font-mono font-bold mt-1">-10s</span>
          </motion.div>
        )}
        {jumpAnim === "forward" && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.4 }}
            className="absolute right-10 flex flex-col items-center justify-center p-4 rounded-full bg-white/15 backdrop-blur-md z-35"
          >
            <FastForward className="w-8 h-8 text-white fill-white" />
            <span className="text-white text-xs font-mono font-bold mt-1">+10s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. VLC Status Notification Toast (Top / Center) */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-16 flex items-center space-x-2 bg-black/85 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full shadow-xl z-45"
          >
            <VLCConeIcon size={18} />
            <span className="text-xs font-medium text-slate-100">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. Locked indicator when locked */}
      {isLocked && (
        <div className="absolute top-5 right-5 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/20 z-40">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
      )}
    </div>
  );
};
