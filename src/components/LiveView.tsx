import React, { useState, useEffect, useRef } from "react";
import { Radio, Users, Heart, Send, Video, VideoOff, MessageSquare, AlertTriangle, Sparkles, Flame, Star, Award, Zap } from "lucide-react";
import { LiveSession, User } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface LiveViewProps {
  liveSessions: LiveSession[];
  currentUser: User;
  socket: WebSocket | null;
  onGoLive: (title: string, callback: (session: LiveSession) => void) => void;
  onEndLive: (sessionId: string) => void;
}

export default function LiveView({
  liveSessions,
  currentUser,
  socket,
  onGoLive,
  onEndLive,
}: LiveViewProps) {
  // Navigation: 'list' | 'viewer' | 'broadcaster'
  const [mode, setMode] = useState<'list' | 'viewer' | 'broadcaster'>('list');
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);

  // Broadcaster State
  const [streamTitle, setStreamTitle] = useState("Sesión de Directo Interactiva! 🌌🚀");
  const [cameraOn, setCameraOn] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  
  // Chat input
  const [chatInput, setChatInput] = useState("");

  // Refs for local camera WebRTC streams
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Floating Reactions
  const [reactions, setReactions] = useState<{ id: string; type: string; left: number; rotate: number }[]>([]);

  // Connect local camera stream for broadcasting
  useEffect(() => {
    if (mode === 'broadcaster' && cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 16/9 }, audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Camera/Mic permission denied or not supported:", err);
          setStreamError("No se pudo acceder a la cámara o micrófono. Mostrando transmisión sintetizada.");
        });
    }

    return () => {
      // Cleanup streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [mode, cameraOn]);

  // Handle stream list events or stream updates
  useEffect(() => {
    if (activeSession) {
      const fresh = liveSessions.find(s => s.id === activeSession.id);
      if (fresh) {
        setActiveSession(fresh);
      } else if (mode === 'viewer') {
        // Stream was ended by broadcaster
        alert("La transmisión ha sido finalizada por el creador.");
        leaveStream();
      }
    }
  }, [liveSessions]);

  // Socket listener for reactions
  useEffect(() => {
    if (!socket) return;

    const handleSocketMsg = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "live_reaction" && activeSession && payload.streamId === activeSession.id) {
          triggerFloatingReaction(payload.reactionType);
        }
      } catch (err) {
        // Ignore parsing errors
      }
    };

    socket.addEventListener("message", handleSocketMsg);
    return () => {
      socket.removeEventListener("message", handleSocketMsg);
    };
  }, [socket, activeSession]);

  const startBroadcasting = () => {
    onGoLive(streamTitle, (newSession) => {
      setActiveSession(newSession);
      setMode('broadcaster');
      
      // Notify websocket that we joined
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "live_join",
          streamId: newSession.id,
          username: currentUser.name,
          avatar: currentUser.avatar
        }));
      }
    });
  };

  const stopBroadcasting = () => {
    if (activeSession) {
      onEndLive(activeSession.id);
    }
    setActiveSession(null);
    setMode('list');
  };

  const joinStream = (session: LiveSession) => {
    setActiveSession(session);
    setMode('viewer');

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "live_join",
        streamId: session.id,
        username: currentUser.name,
        avatar: currentUser.avatar
      }));
    }
  };

  const leaveStream = () => {
    if (socket && socket.readyState === WebSocket.OPEN && activeSession) {
      socket.send(JSON.stringify({
        type: "live_leave",
        streamId: activeSession.id
      }));
    }
    setActiveSession(null);
    setMode('list');
  };

  const sendLiveMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSession) return;
    if (currentUser.isGuest) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "live_msg",
        streamId: activeSession.id,
        senderName: currentUser.name,
        avatar: currentUser.avatar,
        text: chatInput
      }));
    }
    setChatInput("");
  };

  const sendReaction = (type: string) => {
    if (currentUser.isGuest) return;
    if (!activeSession) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "live_reaction",
        streamId: activeSession.id,
        reactionType: type
      }));
    }
  };

  const triggerFloatingReaction = (type: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const left = 20 + Math.random() * 60; // random offset percentage
    const rotate = -30 + Math.random() * 60; // random rotation angle
    setReactions(prev => [...prev, { id, type, left, rotate }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[680px] bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative flex flex-col text-slate-100" id="live-panel">
      
      {/* 1. STREAM SELECTION / LOBBY */}
      {mode === 'list' && (
        <div className="flex-1 p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-extrabold text-xl tracking-tight text-white flex items-center space-x-2">
                  <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
                  <span>Transmisiones en Vivo (WebRTC)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Conexión de latencia ultra-baja y chat simultáneo para comercio en vivo.</p>
              </div>
            </div>

            {/* List of active lives */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {liveSessions.filter(s => s.isLive).map((session) => (
                <div
                  key={session.id}
                  className="bg-slate-900 border border-slate-850 hover:border-rose-500/50 rounded-2xl p-5 flex flex-col justify-between hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => joinStream(session)}
                  id={`live-item-${session.id}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        <span>EN DIRECTO</span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                        <Users className="w-4 h-4" />
                        <span className="font-mono font-bold">{session.viewersCount}</span>
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-sm text-white mt-3 group-hover:text-rose-400 transition-colors">{session.title}</h3>
                    
                    <div className="flex items-center space-x-2.5 mt-4">
                      <img
                        src={session.creatorAvatar}
                        alt={session.creatorName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-slate-800"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">@{session.creatorName}</span>
                        <span className="text-[10px] text-slate-500">Tienda asociada</span>
                      </div>
                    </div>
                  </div>

                  <button className="w-full bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-200 text-xs font-bold py-2.5 rounded-xl mt-6 transition-colors cursor-pointer">
                    Unirse a la transmisión
                  </button>
                </div>
              ))}

              {liveSessions.filter(s => s.isLive).length === 0 && (
                <div className="md:col-span-2 border border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
                  <Radio className="w-10 h-10 stroke-1 text-slate-700 mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-400">No hay transmisiones públicas activas</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs">Los creadores de productos no han iniciado transmisiones en vivo en este momento.</p>
                </div>
              )}
            </div>
          </div>

          {/* Broadcaster Go Live launcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-white">¿Quieres promocionar tus productos?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Inicia tu propia transmisión en vivo para interactuar y vender con compradores en tiempo real.</p>
              </div>
            </div>

            <div className="w-full md:w-auto flex items-center space-x-3">
              <input
                type="text"
                placeholder="Título del directo..."
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                className="bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-rose-500 text-white w-full md:w-60"
              />
              <button
                onClick={startBroadcasting}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap"
                id="start-live-btn"
              >
                <Sparkles className="w-4 h-4" />
                <span>Transmitir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE VIEWER & BROADCASTER IMMERSIVE MODE */}
      {(mode === 'viewer' || mode === 'broadcaster') && activeSession && (
        <div className="flex-1 flex flex-col md:flex-row h-full relative overflow-hidden bg-black" id="live-session-panel">
          
          {/* Left / Center Frame: Video Feed */}
          <div className="flex-1 relative flex items-center justify-center bg-slate-950">
            {/* Live Indicator overlay top left */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-3">
              <div className="bg-rose-500 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full border border-rose-600 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-slate-950 rounded-full animate-ping"></span>
                <span>🔴 DIRECTO</span>
              </div>

              <div className="bg-slate-950/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-slate-300" />
                <span>{activeSession.viewersCount}</span>
              </div>
            </div>

            {/* End Stream / Exit button top right */}
            <div className="absolute top-4 right-4 z-20">
              {mode === 'broadcaster' ? (
                <button
                  onClick={stopBroadcasting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-1.5 rounded-full border border-rose-500 transition-colors cursor-pointer"
                  id="stop-broadcaster-btn"
                >
                  Finalizar Directo
                </button>
              ) : (
                <button
                  onClick={leaveStream}
                  className="bg-slate-900/80 hover:bg-slate-800 text-white font-bold text-xs px-4 py-1.5 rounded-full border border-white/10 transition-colors cursor-pointer"
                >
                  Salir
                </button>
              )}
            </div>

            {/* VIDEO FEED ELEMENT */}
            {mode === 'broadcaster' ? (
              cameraOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 p-8 text-center">
                  <VideoOff className="w-16 h-16 text-slate-700 mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-400">Cámara Apagada</p>
                </div>
              )
            ) : (
              /* Viewer simulated feed */
              <div className="relative w-full h-full">
                <video
                  src="https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-dj-playing-music-on-a-mixer-41556-large.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Simulated overlay for WebRTC */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
              </div>
            )}

            {/* Error notifications or warnings */}
            {streamError && (
              <div className="absolute bottom-4 left-4 right-4 z-20 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 p-2.5 rounded-xl flex items-center space-x-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">{streamError}</span>
              </div>
            )}

            {/* Title / Description info overlay bottom left */}
            <div className="absolute bottom-4 left-4 right-20 z-10 pointer-events-none">
              <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500">Transmisión Activa</span>
              <h4 className="font-display font-extrabold text-sm text-white drop-shadow-md">{activeSession.title}</h4>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1.5">
                <span className="font-bold text-slate-300">@{activeSession.creatorName}</span>
                <span>• latency: 150ms</span>
              </p>
            </div>

            {/* Floating Reactions Container */}
            <div className="absolute right-4 bottom-4 w-24 h-[250px] overflow-hidden pointer-events-none z-20">
              {reactions.map((react) => {
                const colors: Record<string, string> = {
                  heart: "text-rose-500",
                  flame: "text-amber-500",
                  star: "text-yellow-400",
                  zap: "text-cyan-400"
                };
                
                const emojis: Record<string, string> = {
                  heart: "❤️",
                  flame: "🔥",
                  star: "⭐",
                  zap: "⚡"
                };

                return (
                  <div
                    key={react.id}
                    className="absolute bottom-0 text-xl reaction-bubble pointer-events-none"
                    style={{
                      left: `${react.left}%`,
                      "--rotate": `${react.rotate}deg`,
                    } as React.CSSProperties}
                  >
                    <span>{emojis[react.type]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Live Chat Overlay */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-850 bg-slate-900 flex flex-col justify-between h-[250px] md:h-full z-10">
            
            {/* Chat Messages header */}
            <div className="px-4 py-3 border-b border-slate-850 flex items-center justify-between bg-slate-900/50">
              <span className="font-display font-bold text-xs flex items-center space-x-1.5">
                <MessageSquare className="w-4 h-4 text-rose-400" />
                <span>Chat en Vivo</span>
              </span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">WebRTC</span>
            </div>

            {/* Messages body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3" id="live-chat-messages">
              {activeSession.chatMessages.map((msg) => (
                <div key={msg.id} className="text-xs leading-relaxed">
                  <span className="font-bold text-slate-300 mr-1.5">@{msg.username}:</span>
                  <span className="text-slate-400">{msg.text}</span>
                </div>
              ))}

              {activeSession.chatMessages.length === 0 && (
                <p className="text-[11px] text-center text-slate-600 py-6">Escribe un mensaje para empezar la conversación.</p>
              )}
            </div>

            {/* Chat send block & floating reactions triggers */}
            <div className="p-3 border-t border-slate-850 bg-slate-950/60">
              {/* Reaction shortcuts panel */}
              <div className={`flex items-center justify-around mb-2 px-1 py-1 bg-slate-900/80 rounded-xl border border-slate-800 ${currentUser.isGuest ? "opacity-40 cursor-not-allowed" : ""}`}>
                <button
                  onClick={() => sendReaction("heart")}
                  className={`p-1 hover:bg-slate-800 rounded text-base active:scale-90 transition-transform cursor-pointer ${currentUser.isGuest ? "pointer-events-none" : ""}`}
                  title="Love"
                  disabled={currentUser.isGuest}
                >
                  ❤️
                </button>
                <button
                  onClick={() => sendReaction("flame")}
                  className={`p-1 hover:bg-slate-800 rounded text-base active:scale-90 transition-transform cursor-pointer ${currentUser.isGuest ? "pointer-events-none" : ""}`}
                  title="Fire"
                  disabled={currentUser.isGuest}
                >
                  🔥
                </button>
                <button
                  onClick={() => sendReaction("star")}
                  className={`p-1 hover:bg-slate-800 rounded text-base active:scale-90 transition-transform cursor-pointer ${currentUser.isGuest ? "pointer-events-none" : ""}`}
                  title="Star"
                  disabled={currentUser.isGuest}
                >
                  ⭐
                </button>
                <button
                  onClick={() => sendReaction("zap")}
                  className={`p-1 hover:bg-slate-800 rounded text-base active:scale-90 transition-transform cursor-pointer ${currentUser.isGuest ? "pointer-events-none" : ""}`}
                  title="Energy"
                  disabled={currentUser.isGuest}
                >
                  ⚡
                </button>
              </div>

              {/* Msg input */}
              <form onSubmit={sendLiveMessage} className="flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder={currentUser.isGuest ? "Regístrate para chatear..." : "Escribe en el chat..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={currentUser.isGuest}
                  className={`flex-1 bg-slate-900 text-xs text-white px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-rose-500 placeholder-slate-600 ${currentUser.isGuest ? "opacity-50 cursor-not-allowed" : ""}`}
                />
                <button
                  type="submit"
                  disabled={currentUser.isGuest}
                  className={`p-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold rounded-lg transition-colors cursor-pointer ${currentUser.isGuest ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
