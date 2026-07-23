import React, { useState, useEffect, useRef } from "react";
import {
  Radio,
  Users,
  Send,
  MessageSquare,
  X,
  Play,
  Camera,
  Mic,
  ChevronUp,
  ChevronDown,
  UserPlus,
  UserCheck
} from "lucide-react";
import { LiveSession, User } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface LiveViewProps {
  liveSessions: LiveSession[];
  currentUser: User;
  users?: User[];
  socket: WebSocket | null;
  onGoLive: (title: string, callback: (session: LiveSession) => void) => void;
  onEndLive: (sessionId: string) => void;
  onViewerStateChange?: (isViewing: boolean) => void;
  onClose?: () => void;
  onToggleFollowUser?: (creatorId: string) => void;
}

export default function LiveView({
  liveSessions,
  currentUser,
  socket,
  onGoLive,
  onEndLive,
  onViewerStateChange,
  onClose,
  onToggleFollowUser,
}: LiveViewProps) {
  const activeLives = liveSessions.filter((s) => s.isLive);
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);

  // Go live title input
  const [newStreamTitle, setNewStreamTitle] = useState("");

  // Chat input
  const [chatInput, setChatInput] = useState("");

  // Floating Reactions
  const [reactions, setReactions] = useState<{ id: string; type: string; left: number; rotate: number }[]>([]);

  // Ref for chat auto-scroll
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Wheel throttle state
  const isScrollingRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  // Current active session
  const activeSession = activeLives[currentStreamIndex] || null;

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (activeSession?.chatMessages?.length) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.chatMessages?.length, activeSession?.id]);

  // Sync stream index if count changes
  useEffect(() => {
    if (currentStreamIndex >= activeLives.length && activeLives.length > 0) {
      setCurrentStreamIndex(activeLives.length - 1);
    }
  }, [activeLives.length, currentStreamIndex]);

  // Notify viewer state change
  useEffect(() => {
    if (activeLives.length > 0) {
      onViewerStateChange?.(true);
    } else {
      onViewerStateChange?.(false);
    }
    return () => {
      onViewerStateChange?.(false);
    };
  }, [activeLives.length, onViewerStateChange]);

  // Handle WebSocket join/leave
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (prevSessionIdRef.current && prevSessionIdRef.current !== activeSession?.id) {
        socket.send(
          JSON.stringify({
            type: "live_leave",
            streamId: prevSessionIdRef.current,
          })
        );
        prevSessionIdRef.current = null;
      }

      if (activeSession) {
        socket.send(
          JSON.stringify({
            type: "live_join",
            streamId: activeSession.id,
            username: currentUser.name,
            avatar: currentUser.avatar,
          })
        );
        prevSessionIdRef.current = activeSession.id;
      }
    }

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN && prevSessionIdRef.current) {
        socket.send(
          JSON.stringify({
            type: "live_leave",
            streamId: prevSessionIdRef.current,
          })
        );
        prevSessionIdRef.current = null;
      }
    };
  }, [activeSession?.id, socket, currentUser.name, currentUser.avatar]);

  // Handle WebSocket reactions
  useEffect(() => {
    if (!socket) return;

    const handleSocketMsg = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "live_reaction" && activeSession && payload.streamId === activeSession.id) {
          triggerFloatingReaction(payload.reactionType);
        }
      } catch (err) {
        // Ignore
      }
    };

    socket.addEventListener("message", handleSocketMsg);
    return () => {
      socket.removeEventListener("message", handleSocketMsg);
    };
  }, [socket, activeSession]);

  const triggerFloatingReaction = (type: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const left = 20 + Math.random() * 60;
    const rotate = -30 + Math.random() * 60;
    setReactions((prev) => [...prev, { id, type, left, rotate }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  };

  const nextStream = () => {
    if (currentStreamIndex < activeLives.length - 1) {
      setCurrentStreamIndex((prev) => prev + 1);
    }
  };

  const prevStream = () => {
    if (currentStreamIndex > 0) {
      setCurrentStreamIndex((prev) => prev - 1);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isScrollingRef.current || activeLives.length <= 1) return;

    if (e.deltaY > 40) {
      isScrollingRef.current = true;
      nextStream();
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    } else if (e.deltaY < -40) {
      isScrollingRef.current = true;
      prevStream();
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || activeLives.length <= 1) return;
    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchStartYRef.current - touchEndY;

    if (diffY > 50) {
      nextStream();
    } else if (diffY < -50) {
      prevStream();
    }
    touchStartYRef.current = null;
  };

  const sendLiveMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSession) return;
    if (currentUser.isGuest) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "live_msg",
          streamId: activeSession.id,
          senderName: currentUser.name,
          avatar: currentUser.avatar,
          text: chatInput,
        })
      );
    }
    setChatInput("");
  };

  const sendReaction = (type: string) => {
    if (currentUser.isGuest) return;
    if (!activeSession) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "live_reaction",
          streamId: activeSession.id,
          reactionType: type,
        })
      );
    }
    triggerFloatingReaction(type);
  };

  // State when no active lives: Informative screen
  if (activeLives.length === 0) {
    return (
      <div
        className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative select-none"
        id="live-panel-default"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full border border-slate-700 transition-all cursor-pointer shadow-md active:scale-90 z-20"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
            <Radio className="w-8 h-8 text-rose-500 animate-pulse" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-white">No Hay Transmisiones en Vivo</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              En este momento ningún creador está en directo. Las transmisiones de los creadores aparecerán aquí automáticamente tan pronto como inicien sesión en vivo.
            </p>
          </div>

          <div className="pt-2">
            <p className="text-[11px] text-slate-500 bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-mono">
              💡 Para iniciar tu propia transmisión en vivo, ve a tu <strong className="text-rose-400">Perfil</strong> y presiona el botón de <strong className="text-rose-400">Estudio de Transmisión</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Stream Screen
  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full h-screen bg-black overflow-hidden relative flex flex-col text-slate-100 select-none"
      id="live-panel-active"
    >
      <div className="flex-1 flex flex-col md:flex-row h-full relative overflow-hidden bg-black">
        {/* Stream Video Area */}
        <div className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          {/* Top Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2">
            <div className="bg-slate-950/80 backdrop-blur-md border border-white/15 p-1.5 pr-3 rounded-full flex items-center space-x-2 shadow-lg max-w-[220px] sm:max-w-xs flex-shrink min-w-0">
              <img
                src={activeSession.creatorAvatar}
                alt={activeSession.creatorName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-rose-500 shadow-md flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <span className="text-xs font-extrabold text-white truncate leading-tight">
                    @{activeSession.creatorName}
                  </span>
                  {activeSession.creatorId !== currentUser.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleFollowUser) {
                          onToggleFollowUser(activeSession.creatorId);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1 shrink-0 shadow-sm active:scale-95 ${
                        currentUser.followingUserIds?.includes(activeSession.creatorId)
                          ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                          : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                      }`}
                      title={
                        currentUser.followingUserIds?.includes(activeSession.creatorId)
                          ? "Siguiendo"
                          : "Seguir al creador"
                      }
                    >
                      {currentUser.followingUserIds?.includes(activeSession.creatorId) ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span className="hidden xs:inline">Siguiendo</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>Seguir</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-300 font-medium block truncate leading-tight">
                  {activeSession.title}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="bg-slate-950/70 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5 shadow-md">
                <Users className="w-3.5 h-3.5 text-slate-300" />
                <span>{activeSession.viewersCount}</span>
              </div>

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 bg-slate-950/80 hover:bg-rose-600 text-slate-300 hover:text-white backdrop-blur-md rounded-full border border-white/20 transition-all cursor-pointer shadow-lg active:scale-90"
                  title="Salir"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Video Stream Element */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSession.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full h-full relative"
            >
              <video
                src="https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-on-a-mixer-41556-large.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/30 pointer-events-none" />
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          {activeLives.length > 1 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center space-y-3">
              <button
                onClick={prevStream}
                disabled={currentStreamIndex === 0}
                className="p-3 bg-slate-950/80 hover:bg-rose-500 text-slate-300 disabled:opacity-30 rounded-full border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button
                onClick={nextStream}
                disabled={currentStreamIndex === activeLives.length - 1}
                className="p-3 bg-slate-950/80 hover:bg-rose-500 text-slate-300 disabled:opacity-30 rounded-full border border-white/20 transition-all cursor-pointer shadow-lg"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Live Chat Panel */}
        <div className="w-full md:w-80 border-0 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between h-[280px] md:h-full z-20 relative">
          {/* Floating Reactions */}
          <div className="absolute inset-x-0 bottom-16 -top-20 pointer-events-none z-30 overflow-visible">
            {reactions.map((react) => {
              const emojis: Record<string, string> = {
                heart: "❤️",
                flame: "🔥",
                star: "⭐",
                zap: "⚡",
              };

              return (
                <div
                  key={react.id}
                  className="absolute bottom-2 text-2xl sm:text-3xl reaction-bubble pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
                  style={
                    {
                      left: `${Math.max(10, Math.min(80, react.left))}%`,
                      "--rotate": `${react.rotate}deg`,
                    } as React.CSSProperties
                  }
                >
                  <span>{emojis[react.type]}</span>
                </div>
              );
            })}
          </div>

          {/* Chat Messages */}
          <div
            className="flex-1 p-3 overflow-y-auto space-y-2 bg-transparent"
            style={{
              maskImage: "linear-gradient(to bottom, transparent 0%, black 40px, black 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 40px, black 100%)",
            }}
          >
            {activeSession.chatMessages.map((msg) => (
              <div key={msg.id} className="text-xs leading-relaxed p-1 flex items-start space-x-2 w-full break-words min-w-0">
                <img
                  src={msg.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"}
                  alt={msg.username || "Usuario"}
                  className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/20 mt-0.5 shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80";
                  }}
                />
                <div className="flex flex-col items-start space-y-0.5 w-full break-words min-w-0 flex-1">
                  <span className="font-bold text-amber-400 text-[11px]">@{msg.username}</span>
                  <span className="text-white font-medium text-xs break-words break-all max-w-full leading-snug">{msg.text}</span>
                </div>
              </div>
            ))}

            {activeSession.chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-6">
                <MessageSquare className="w-8 h-8 text-slate-400 mb-1 stroke-1" />
                <p className="text-[11px]">¡Escribe el primer mensaje!</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Reactions & Form */}
          <div className="p-3 border-0 bg-transparent">
            <div className="flex items-center justify-around mb-2 px-1">
              <button
                onClick={() => sendReaction("heart")}
                className="p-1 hover:bg-white/20 rounded-full text-lg cursor-pointer"
              >
                ❤️
              </button>
              <button
                onClick={() => sendReaction("flame")}
                className="p-1 hover:bg-white/20 rounded-full text-lg cursor-pointer"
              >
                🔥
              </button>
              <button
                onClick={() => sendReaction("star")}
                className="p-1 hover:bg-white/20 rounded-full text-lg cursor-pointer"
              >
                ⭐
              </button>
              <button
                onClick={() => sendReaction("zap")}
                className="p-1 hover:bg-white/20 rounded-full text-lg cursor-pointer"
              >
                ⚡
              </button>
            </div>

            <form onSubmit={sendLiveMessage} className="flex items-center space-x-1.5">
              <input
                type="text"
                placeholder={currentUser.isGuest ? "Inicia sesión para comentar..." : "Comentar..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={currentUser.isGuest}
                className="flex-1 bg-transparent text-xs text-white px-4 py-2 rounded-full border border-white/30 focus:outline-none focus:border-rose-500 placeholder-slate-400"
              />
              <button
                type="submit"
                disabled={currentUser.isGuest || !chatInput.trim()}
                className="p-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-full cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
