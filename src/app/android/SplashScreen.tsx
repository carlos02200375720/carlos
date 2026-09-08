import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, RefreshCw, Smartphone, Wifi } from "lucide-react";

interface AndroidSplashScreenProps {
  isLoading: boolean;
  statusMessage: string;
  hasError: boolean;
  onRetry: () => void;
  onContinueAnyway?: () => void;
}

/**
 * Android-Native Splash Screen
 * Features Android Material design, smooth pulse animation, and direct connection feedback.
 */
export default function AndroidSplashScreen({
  isLoading,
  statusMessage,
  hasError,
  onRetry,
  onContinueAnyway,
}: AndroidSplashScreenProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          id="android-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-slate-950 text-white select-none overflow-hidden font-sans"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
          }}
        >
          {/* Ambient Android Gold & Emerald glow */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Platform Tag */}
          <div className="w-full flex items-center justify-center relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md text-[11px] font-medium text-amber-400">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Native Frontend</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* Center Brand */}
          <div className="flex flex-col items-center justify-center text-center max-w-sm w-full relative z-10 my-auto">
            <div className="relative mb-6">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut",
                }}
                className="absolute -inset-4 bg-amber-500/20 rounded-3xl blur-xl"
              />
              <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-amber-500/30 p-2 shadow-2xl flex items-center justify-center">
                <img
                  src="/app-icon.jpg"
                  alt="MallSocial"
                  className="w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    // Fallback to favicon or icon
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-2">
              <span>MallSocial</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                ANDROID
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">E-Commerce & Social Video Engine</p>

            {/* Status & Progress */}
            <div className="mt-8 w-full max-w-xs flex flex-col items-center">
              <div className="flex items-center space-x-2 text-xs text-slate-300 mb-3 font-medium">
                {!hasError && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                <span>{statusMessage}</span>
              </div>

              {/* Native Android linear progress indicator */}
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden relative">
                <motion.div
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.4,
                    ease: "easeInOut",
                  }}
                  className="w-1/2 h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                />
              </div>
            </div>

            {hasError && (
              <div className="mt-6 flex flex-col items-center space-y-3">
                <p className="text-xs text-rose-400">Verifica la conexión a internet.</p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs active:scale-95"
                  >
                    Reintentar
                  </button>
                  {onContinueAnyway && (
                    <button
                      onClick={onContinueAnyway}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs active:scale-95"
                    >
                      Continuar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Footer */}
          <div className="relative z-10 text-[11px] text-slate-500">
            Arquitectura Independiente Android · Servidor Centralizado
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
