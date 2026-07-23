import React, { useState, useEffect, useRef } from "react";
import { User, LiveSession } from "../types";
import { MessageCircle, Send, Radio, Video, VideoOff, Mic, MicOff, Sparkles, Flame, Zap, Shield, Crown, VolumeX, UserX, Search, X, Users } from "lucide-react";
import { motion } from "motion/react";

interface BroadcasterStudioProps {
  currentUser: User;
  users: User[];
  socket?: WebSocket | null;
  liveSessions?: LiveSession[];
  onGoLive?: (title: string, callback: (session: LiveSession) => void) => void;
  onEndLive?: (sessionId: string) => void;
  onClose: () => void;
}

export default function BroadcasterStudio({
  currentUser,
  users,
  socket,
  liveSessions,
  onGoLive,
  onEndLive,
  onClose,
}: BroadcasterStudioProps) {
  // Broadcaster studio states
  const [streamTitle, setStreamTitle] = useState("¡En Vivo Promocionando Novedades! 🚀");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [activeLiveSession, setActiveLiveSession] = useState<LiveSession | null>(null);
  const [liveChatMessages, setLiveChatMessages] = useState<{ senderName: string; avatar?: string; text: string; timestamp?: string }[]>([]);
  const [liveChatInput, setLiveChatInput] = useState("");
  const [reactions, setReactions] = useState<{ id: string; type: string; left: number; rotate: number }[]>([]);

  // User management states for broadcaster
  const [broadcasterUserSearch, setBroadcasterUserSearch] = useState("");
  const [broadcasterUserRoles, setBroadcasterUserRoles] = useState<Record<string, "moderator" | "vip" | "viewer">>({});
  const [broadcasterMutedUsers, setBroadcasterMutedUsers] = useState<string[]>([]);
  const [broadcasterKickedUsers, setBroadcasterKickedUsers] = useState<string[]>([]);
  const [hasMediaStream, setHasMediaStream] = useState<boolean>(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const broadcasterChatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll broadcaster chat on new messages
  useEffect(() => {
    if (liveChatMessages.length) {
      broadcasterChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveChatMessages.length]);

  // Connect camera stream
  useEffect(() => {
    if (cameraOn) {
      setHasMediaStream(false);
      navigator.mediaDevices?.getUserMedia({ video: { aspectRatio: 9 / 16 }, audio: true })
        .catch(() => {
          return navigator.mediaDevices?.getUserMedia({ video: true });
        })
        .then((stream) => {
          if (stream) {
            mediaStreamRef.current = stream;
            setHasMediaStream(true);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          }
        })
        .catch((err) => {
          console.warn("Broadcaster camera access error:", err);
          setHasMediaStream(false);
        });
    } else {
      setHasMediaStream(false);
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [cameraOn]);

  // Sync active live session from liveSessions array
  useEffect(() => {
    if (liveSessions && currentUser) {
      const myLive = liveSessions.find(s => (s.creatorId === currentUser.id || s.creatorId === "current_user") && s.isLive);
      if (myLive) {
        setActiveLiveSession(myLive);
      } else if (activeLiveSession && !liveSessions.some(s => s.id === activeLiveSession.id && s.isLive)) {
        setActiveLiveSession(null);
      }
    }
  }, [liveSessions, currentUser]);

  // Keep broadcaster liveChatMessages synced with activeLiveSession chatMessages
  useEffect(() => {
    if (activeLiveSession?.chatMessages) {
      setLiveChatMessages(
        activeLiveSession.chatMessages.map((c) => ({
          senderName: c.username,
          avatar: c.avatar,
          text: c.text,
          timestamp: c.createdAt,
        }))
      );
    }
  }, [activeLiveSession?.chatMessages]);

  // Socket listener for live chat and reactions in Broadcaster Studio
  useEffect(() => {
    if (!socket) return;

    const handleSocketMsg = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if ((payload.type === "live_msg" || payload.type === "live_chat_msg") && activeLiveSession && payload.streamId === activeLiveSession.id) {
          const msgObj = payload.msg || {
            username: payload.senderName,
            avatar: payload.avatar,
            text: payload.text,
            createdAt: new Date().toISOString()
          };
          const senderName = msgObj.username || msgObj.senderName || "Usuario";
          const avatar = msgObj.avatar;
          const text = msgObj.text;
          
          if (text) {
            setLiveChatMessages((prev) => {
              if (prev.some((m) => m.text === text && m.senderName === senderName)) {
                return prev;
              }
              return [...prev, {
                senderName,
                avatar,
                text,
                timestamp: msgObj.createdAt || new Date().toISOString()
              }];
            });
          }
        } else if (payload.type === "live_reaction" && activeLiveSession && payload.streamId === activeLiveSession.id) {
          triggerFloatingReaction(payload.reactionType);
        }
      } catch (err) {
        // ignore
      }
    };

    socket.addEventListener("message", handleSocketMsg);
    return () => {
      socket.removeEventListener("message", handleSocketMsg);
    };
  }, [socket, activeLiveSession]);

  const triggerFloatingReaction = (type: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const left = 20 + Math.random() * 60;
    const rotate = -30 + Math.random() * 60;
    setReactions(prev => [...prev, { id, type, left, rotate }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  const handleStartLive = () => {
    if (currentUser.username === "invitado" || currentUser.isGuest) {
      alert("Por favor inicia sesión o crea una cuenta para realizar transmisiones en vivo.");
      return;
    }
    if (!onGoLive) return;

    onGoLive(streamTitle, (newSession) => {
      setActiveLiveSession(newSession);
      setLiveChatMessages([]);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "live_join",
          streamId: newSession.id,
          username: currentUser.name,
          avatar: currentUser.avatar,
          isHost: true
        }));
      }
    });
  };

  const handleStopLive = () => {
    if (activeLiveSession) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "live_leave",
          streamId: activeLiveSession.id
        }));
      }
      if (onEndLive) {
        onEndLive(activeLiveSession.id);
      }
    }
    setActiveLiveSession(null);
  };

  const handleSendBroadcasterChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveChatInput.trim() || !activeLiveSession) return;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "live_msg",
        streamId: activeLiveSession.id,
        senderName: currentUser.name + " (Creador)",
        avatar: currentUser.avatar,
        text: liveChatInput
      }));
    }
    setLiveChatInput("");
  };

  return (
    <motion.div
      key="admin-broadcast-independent"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
      id="broadcaster-studio-independent-panel"
    >
      {/* Floating Studio Header Overlay */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          {activeLiveSession ? (
            <div className="bg-slate-950/85 backdrop-blur-md border border-rose-500/40 px-3 py-1.5 rounded-full text-xs font-bold text-rose-400 flex items-center space-x-2 shadow-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span>🔴 EN DIRECTO ({activeLiveSession.viewersCount})</span>
            </div>
          ) : (
            <div className="bg-slate-950/85 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-slate-200 flex items-center space-x-2 shadow-xl">
              <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>Estudio Emisor</span>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto px-3 py-2 bg-slate-950/85 hover:bg-slate-800 text-slate-300 hover:text-white backdrop-blur-md rounded-full border border-white/20 transition-all cursor-pointer shadow-xl active:scale-95 flex items-center space-x-1.5"
          title={activeLiveSession ? "Minimizar estudio (el directo seguirá activo)" : "Salir del Estudio"}
          id="btn-cerrar-estudio-emisor"
        >
          <X className="w-4 h-4" />
          <span className="text-xs font-bold hidden sm:inline">
            {activeLiveSession ? "Minimizar" : "Salir"}
          </span>
        </button>
      </div>

      {/* Studio Body Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 pt-14 sm:pt-14 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-[1600px] w-full mx-auto">
        
        {/* Column 1 (Left): Chat en Vivo del Emisor (4 Cols on desktop, Order 2 on mobile) */}
        <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-xs font-extrabold text-white flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-amber-500" />
                <span>Chat en Vivo del Emisor</span>
              </h4>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono font-bold px-2 py-0.5 rounded-full">
                {liveChatMessages.length} mensajes
              </span>
            </div>

            <div
              className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 max-h-[420px] lg:max-h-[520px]"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 20px, black 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20px, black 100%)",
              }}
            >
              {liveChatMessages.map((msg, i) => (
                <div key={i} className="text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-start space-x-2 w-full break-words min-w-0">
                  <img
                    src={msg.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"}
                    alt={msg.senderName || "Usuario"}
                    className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/20 mt-0.5 shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80";
                    }}
                  />
                  <div className="flex flex-col items-start space-y-0.5 w-full break-words min-w-0 flex-1">
                    <span className="font-bold text-amber-400 text-[11px]">@{msg.senderName}</span>
                    <span className="text-slate-200 text-xs break-words break-all max-w-full leading-snug">{msg.text}</span>
                  </div>
                </div>
              ))}

              {liveChatMessages.length === 0 && (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                  <MessageCircle className="w-8 h-8 text-slate-700 mb-2 opacity-50" />
                  <p className="text-xs font-medium">Los mensajes de tus espectadores aparecerán aquí.</p>
                </div>
              )}
              <div ref={broadcasterChatEndRef} />
            </div>

            {activeLiveSession && (
              <form onSubmit={handleSendBroadcasterChat} className="flex space-x-2 pt-3 border-t border-slate-800 mt-auto">
                <input
                  type="text"
                  placeholder="Enviar mensaje como emisor..."
                  value={liveChatInput}
                  onChange={(e) => setLiveChatInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-extrabold text-xs cursor-pointer flex items-center space-x-1 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Responder</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Column 2 (Center): Stream Video Feed & Title (5 Cols on desktop, Order 1 on mobile) */}
        <div className="lg:col-span-5 order-1 lg:order-2 space-y-4 flex flex-col items-center w-full">
          
          {/* Title Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg w-full">
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Título de la Transmisión
            </label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              disabled={!!activeLiveSession}
              placeholder="Ej. ¡Nueva colección disponible en vivo!"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60"
            />
          </div>

          {/* Camera Box - Vertical 9:16 Reel format with transparent background */}
          <div className="relative aspect-[9/16] w-full max-w-[320px] sm:max-w-[340px] bg-transparent rounded-2xl overflow-hidden border-0 shadow-none flex items-center justify-center mx-auto">
            {cameraOn ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-2xl transform scale-x-[-1]"
                />
                {!hasMediaStream && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center z-10">
                    <Video className="w-10 h-10 text-rose-500 mb-2 animate-bounce" />
                    <p className="text-xs text-slate-300 font-semibold">Iniciando cámara...</p>
                    <p className="text-[10px] text-slate-500 mt-1">Por favor concede permiso de acceso en tu navegador</p>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-500 space-y-2 rounded-2xl border border-slate-800">
                <VideoOff className="w-12 h-12 text-slate-700" />
                <span className="text-xs font-semibold">Cámara Apagada</span>
              </div>
            )}

            {/* Floating Reactions Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              {reactions.map((r) => (
                <div
                  key={r.id}
                  className="absolute bottom-16 text-3xl animate-bounce"
                  style={{
                    left: `${r.left}%`,
                    transform: `rotate(${r.rotate}deg)`,
                    transition: "all 2s ease-out",
                  }}
                >
                  {r.type === "fire" && "🔥"}
                  {r.type === "zap" && "⚡"}
                  {r.type === "sparkle" && "✨"}
                  {r.type === "heart" && "❤️"}
                </div>
              ))}
            </div>

            {/* Camera Overlay Controls */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-transparent p-3 rounded-xl border-0 shadow-none gap-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCameraOn(!cameraOn)}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-md ${
                    cameraOn ? "bg-slate-800/90 hover:bg-slate-700 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                  title={cameraOn ? "Apagar Cámara" : "Encender Cámara"}
                >
                  {cameraOn ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setMicOn(!micOn)}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer shadow-md ${
                    micOn ? "bg-slate-800/90 hover:bg-slate-700 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                  title={micOn ? "Silenciar Micrófono" : "Activar Micrófono"}
                >
                  {micOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
                </button>
              </div>

              {/* Start / End Stream Button */}
              {activeLiveSession ? (
                <button
                  onClick={handleStopLive}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
                  id="btn-finalizar-directo"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Finalizar Transmisión</span>
                </button>
              ) : (
                <button
                  onClick={handleStartLive}
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-extrabold text-xs rounded-xl shadow-xl transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95"
                  id="btn-iniciar-directo"
                >
                  <Radio className="w-4 h-4" />
                  <span>Transmitir En Vivo</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Column 3 (Right): Tarjeta de Gestión de Usuarios del Emisor (3 Cols on desktop, Order 3 on mobile) */}
        <div className="lg:col-span-3 order-3 lg:order-3 space-y-4 flex flex-col">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col min-h-[420px]">
            
            {/* User Management Card Header */}
            <div className="pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span>Gestión de Espectadores</span>
                </h4>
                <span className="text-[10px] bg-slate-800 text-slate-300 font-mono font-bold px-2 py-0.5 rounded-full">
                  {users.length - 1} usuarios
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Asigna roles de moderador, VIP o modera usuarios en tiempo real.
              </p>
            </div>

            {/* Search Input */}
            <div className="mt-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={broadcasterUserSearch}
                onChange={(e) => setBroadcasterUserSearch(e.target.value)}
                placeholder="Buscar espectador por nombre o usuario..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* User List */}
            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {users
                .filter((u) => u.id !== currentUser.id && u.username !== "invitado")
                .filter((u) =>
                  broadcasterUserSearch
                    ? u.name.toLowerCase().includes(broadcasterUserSearch.toLowerCase()) ||
                      u.username.toLowerCase().includes(broadcasterUserSearch.toLowerCase())
                    : true
                )
                .map((u) => {
                  const role = broadcasterUserRoles[u.username] || "viewer";
                  const isMuted = broadcasterMutedUsers.includes(u.username);
                  const isKicked = broadcasterKickedUsers.includes(u.username);

                  return (
                    <div
                      key={u.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isKicked
                          ? "bg-rose-950/20 border-rose-900/40 opacity-50"
                          : "bg-slate-950/80 border-slate-850 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <h5 className="text-xs font-bold text-white truncate">{u.name}</h5>
                              {role === "moderator" && (
                                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold">
                                  MOD
                                </span>
                              )}
                              {role === "vip" && (
                                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[9px] font-bold">
                                  VIP
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">@{u.username}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1 shrink-0">
                          {/* Toggle MOD */}
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcasterUserRoles((prev) => ({
                                ...prev,
                                [u.username]: prev[u.username] === "moderator" ? "viewer" : "moderator",
                              }));
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              role === "moderator"
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-400"
                            }`}
                            title="Asignar Moderador"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle VIP */}
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcasterUserRoles((prev) => ({
                                ...prev,
                                [u.username]: prev[u.username] === "vip" ? "viewer" : "vip",
                              }));
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              role === "vip"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-purple-300"
                            }`}
                            title="Otorga Estatus VIP"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle MUTE */}
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcasterMutedUsers((prev) =>
                                prev.includes(u.username)
                                  ? prev.filter((m) => m !== u.username)
                                  : [...prev, u.username]
                              );
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isMuted
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-rose-400"
                            }`}
                            title={isMuted ? "Quitar Silencio" : "Silenciar Usuario"}
                          >
                            <VolumeX className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle KICK */}
                          <button
                            type="button"
                            onClick={() => {
                              setBroadcasterKickedUsers((prev) =>
                                prev.includes(u.username)
                                  ? prev.filter((k) => k !== u.username)
                                  : [...prev, u.username]
                              );
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isKicked
                                ? "bg-rose-600 text-white border-rose-500"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-rose-500"
                            }`}
                            title={isKicked ? "Readmitir" : "Expulsar del Directo"}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
