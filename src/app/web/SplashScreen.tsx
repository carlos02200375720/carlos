import React, { useState, useEffect } from "react";
import { RefreshCw, Server, Wifi, ArrowRight } from "lucide-react";

interface SplashScreenProps {
  isLoading: boolean;
  statusMessage: string;
  hasError: boolean;
  onRetry: () => void;
  onContinueAnyway?: () => void;
  progress?: number;
}

export default function SplashScreen({
  isLoading,
  statusMessage,
  hasError,
  onRetry,
  onContinueAnyway,
  progress = 0
}: SplashScreenProps) {
  const [shouldRender, setShouldRender] = useState(isLoading);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setIsFadingOut(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(true);
      setIsFadingOut(false);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div
      id="app-splash-screen"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 bg-black text-white select-none overflow-hidden transition-all duration-500 ease-in-out ${
        isFadingOut ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)"
      }}
    >
      {/* Ambient neon radial glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top header badge */}
      <div className="w-full flex items-center justify-center relative z-10">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs font-medium text-purple-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cloud Run · E-Commerce & Live Social</span>
        </div>
      </div>

      {/* Center Brand & Animation */}
      <div className="flex flex-col items-center justify-center text-center max-w-sm w-full relative z-10 my-auto">
        {/* Animated Logo Container */}
        <div className="relative mb-8">
          {/* Outer pulsing ring */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 opacity-40 blur-lg animate-pulse" />

          {/* App Icon Image with subtle hover/appearance */}
          <div className="relative">
            <img
              src="/app-icon.jpg"
              alt="MallSocial Icon"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover shadow-2xl border border-white/20"
            />
          </div>
        </div>

        {/* Brand Titles */}
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-purple-100 to-pink-300">
          MallSocial
        </h1>
        <p className="text-sm text-white/60 mt-1.5 font-medium tracking-wide">
          Social Reels · Live Streams · Tienda Online
        </p>

        {/* Loading & Status Area */}
        <div className="w-full mt-8 flex flex-col items-center">
          {!hasError ? (
            <>
              {/* Progress bar container */}
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-3.5 relative">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 rounded-full w-2/3 animate-pulse"
                />
              </div>

              {/* Status label with animated dots */}
              <div className="flex items-center space-x-2 text-xs text-white/70 font-medium">
                <Server className="w-3.5 h-3.5 text-purple-400 animate-spin" style={{ animationDuration: "3s" }} />
                <span>{statusMessage}</span>
              </div>

              {/* Manual entry button if taking more than a moment */}
              {onContinueAnyway && (
                <button
                  onClick={onContinueAnyway}
                  className="mt-4 text-[11px] text-white/50 hover:text-white/90 underline transition-colors cursor-pointer py-1 px-3 rounded-lg hover:bg-white/5"
                  id="splash-quick-enter-btn"
                >
                  Omitir y entrar directamente
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center space-y-3 w-full animate-fadeIn">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center">
                <p className="font-semibold mb-1">El servidor está tardando en responder</p>
                <p className="text-rose-300/80">Cloud Run se está iniciando. Puedes reintentar la conexión o ingresar con los datos guardados.</p>
              </div>

              <div className="flex items-center space-x-3 w-full pt-1">
                <button
                  onClick={onRetry}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg transition-all active:scale-95 cursor-pointer"
                  id="splash-retry-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>

                {onContinueAnyway && (
                  <button
                    onClick={onContinueAnyway}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 font-medium text-xs border border-white/10 transition-all active:scale-95 cursor-pointer"
                    id="splash-continue-btn"
                  >
                    <span>Entrar a la app</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full flex flex-col items-center space-y-1 text-[11px] text-white/40 relative z-10">
        <div className="flex items-center space-x-1.5">
          <Wifi className="w-3 h-3 text-emerald-400/70" />
          <span>Sincronización en tiempo real</span>
        </div>
        <span>v1.2.0 · Plataforma Segura</span>
      </div>
    </div>
  );
}
