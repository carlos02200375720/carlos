import React, { useState, useEffect, useRef } from "react";
import { Users, Send, X, MessageSquare, ShieldCheck, Heart } from "lucide-react";
import { User, ChatMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SocialPanelProps {
  users: User[];
  currentUser: User;
  messages: ChatMessage[];
  activeChatUser: User | null;
  onSelectChatUser: (user: User | null) => void;
  onSendPrivateMessage: (text: string) => void;
  unreadCounts: Record<string, number>;
  clearUnreads: (userId: string) => void;
  onClose: () => void;
}

export default function SocialPanel({
  users,
  currentUser,
  messages,
  activeChatUser,
  onSelectChatUser,
  onSendPrivateMessage,
  unreadCounts,
  clearUnreads,
  onClose,
}: SocialPanelProps) {
  const [activeSection, setActiveSection] = useState<"friends" | "discover">("friends");

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [navBarHeight, setNavBarHeight] = useState(64);

  // Auto-scroll private chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatUser]);

  useEffect(() => {
    const navBar = document.getElementById("bottom-nav-bar");
    if (navBar) {
      setNavBarHeight(navBar.offsetHeight);
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setNavBarHeight(entry.target.clientHeight);
        }
      });
      observer.observe(navBar);
      return () => observer.disconnect();
    } else {
      setNavBarHeight(0);
    }
  }, [activeChatUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendPrivateMessage(chatInput);
    setChatInput("");
  };

  const handleSelectUser = (user: User) => {
    onSelectChatUser(user);
    clearUnreads(user.id);
  };

  // Filter out current user from listing and apply search query
  const listUsers = users
    .filter((u) => u.id !== currentUser.id)
    .filter((u) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.bio && u.bio.toLowerCase().includes(query))
      );
    });

  // Split into "chats already initiated" and "other registered users"
  const chatConversationsUsers = listUsers.filter((u) => {
    const hasMessages = messages.some(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === u.id) ||
        (msg.senderId === u.id && msg.receiverId === currentUser.id)
    );
    const hasUnreads = unreadCounts[u.id] > 0;
    return hasMessages || hasUnreads;
  });

  const otherRegisteredUsers = listUsers.filter((u) => {
    const hasMessages = messages.some(
      (msg) =>
        (msg.senderId === currentUser.id && msg.receiverId === u.id) ||
        (msg.senderId === u.id && msg.receiverId === currentUser.id)
    );
    const hasUnreads = unreadCounts[u.id] > 0;
    return !hasMessages && !hasUnreads;
  });

  if (currentUser.isGuest) {
    return (
      <div
        className="w-full bg-slate-950 flex flex-col justify-center items-center text-slate-100 p-6 text-center relative"
        id="social-page-guest-blocked"
        style={{ height: `calc(100dvh - ${navBarHeight}px)` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="max-w-xs space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 animate-pulse">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Acceso Restringido</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Debes registrarte o iniciar sesión con una cuenta para poder chatear y enviar mensajes directos en la plataforma.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/15"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-white flex flex-col justify-between text-slate-900 relative"
      id="social-page"
      style={{ height: `calc(100dvh - ${navBarHeight}px)` }}
    >
      {/* Header */}
      {!activeChatUser && (
        <div className="p-4 border-0 flex items-center gap-3 bg-white shrink-0">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Users className="w-4 h-4 text-amber-500" />
            </span>
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border border-slate-200 text-xs text-slate-900 pl-10 pr-10 py-2.5 rounded-full focus:outline-none focus:border-amber-500 placeholder-slate-400 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-800 text-[10px] uppercase font-bold tracking-wider"
              >
                Limpiar
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
            title="Volver a Reels"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Content Switch: Users List vs Active Chat */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!activeChatUser ? (
          /* USERS LIST VIEW */
          <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full">
            {/* TABS HEADER */}
            <div className="flex border-b border-slate-200 mb-6 w-full">
              <button
                onClick={() => setActiveSection("friends")}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  activeSection === "friends"
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Amigos</span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded-full">
                    {chatConversationsUsers.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveSection("discover")}
                className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  activeSection === "discover"
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <div className="flex items-center justify-center space-x-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Conocer</span>
                  <span className="text-[9px] bg-slate-100 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded-full">
                    {otherRegisteredUsers.length}
                  </span>
                </div>
              </button>
            </div>

            {/* TAB CONTENTS */}
            <AnimatePresence mode="wait">
              {activeSection === "friends" ? (
                <motion.div
                  key="friends-list"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  {chatConversationsUsers.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50">
                      <p className="text-xs text-slate-600 font-medium">No tienes conversaciones con amigos.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Busca a alguien en la pestaña "Conocer" para comenzar a chatear.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {chatConversationsUsers.map((user, index) => (
                        <div
                          key={`${user.id}-${index}`}
                          onClick={() => handleSelectUser(user)}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 cursor-pointer transition-all group shadow-2xs"
                          id={`social-user-active-${user.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                              {/* Online indicator dot */}
                              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${user.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">@{user.username}</h4>
                              <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{user.bio}</p>
                            </div>
                          </div>

                          {/* Right notification badge */}
                          {unreadCounts[user.id] > 0 ? (
                            <span className="bg-rose-500 text-white font-bold font-mono text-[9px] px-2 py-0.5 rounded-full">
                              {unreadCounts[user.id]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono font-semibold">
                              {user.isOnline ? "online" : "offline"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="discover-list"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  {otherRegisteredUsers.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50">
                      <p className="text-xs text-slate-600 font-medium">No hay otras personas disponibles.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {otherRegisteredUsers.map((user, index) => (
                        <div
                          key={`${user.id}-${index}`}
                          onClick={() => handleSelectUser(user)}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 cursor-pointer transition-all group shadow-2xs"
                          id={`social-user-all-${user.id}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                              />
                              {/* Online indicator dot */}
                              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${user.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors">@{user.username}</h4>
                              <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{user.bio}</p>
                            </div>
                          </div>

                          {/* Right notification badge */}
                          {unreadCounts[user.id] > 0 ? (
                            <span className="bg-rose-500 text-white font-bold font-mono text-[9px] px-2 py-0.5 rounded-full">
                              {unreadCounts[user.id]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono font-semibold">
                              {user.isOnline ? "online" : "offline"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* 1-on-1 CHAT WINDOW VIEW */
          <div className="flex-1 flex flex-col justify-between overflow-hidden max-w-lg mx-auto w-full border-x border-slate-200 bg-white">
            {/* Chat Partner details header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => onSelectChatUser(null)}
                className="text-xs text-amber-600 hover:underline font-semibold cursor-pointer flex items-center space-x-1"
              >
                <span>← Volver</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-900">@{activeChatUser.username}</span>
                <span className="text-[9px] text-emerald-600 font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Canal de chat encriptado</span>
                </span>
              </div>
              <img
                src={activeChatUser.avatar}
                alt={activeChatUser.username}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover border border-slate-200"
              />
            </div>

            {/* Message log */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 p-4">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No hay mensajes previos</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Comienza a escribir para conversar privadamente.</p>
                </div>
              )}

              {messages.map((msg, index) => {
                const isMe = msg.senderId === currentUser.id || msg.senderId === "current_user";
                return (
                  <div key={`${msg.id}-${index}`} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed border shadow-sm ${isMe ? "bg-amber-500 text-slate-950 border-amber-400 rounded-tr-none" : "bg-white text-slate-800 border-slate-200 rounded-tl-none"}`}>
                      <p>{msg.text}</p>
                      <span className={`text-[8px] block text-right mt-1 font-mono ${isMe ? "text-slate-950/70" : "text-slate-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Private chat submit input form */}
            <form onSubmit={handleSubmit} className="p-3 border-0 bg-white flex items-center space-x-2 shrink-0">
              <input
                type="text"
                placeholder="Escribe un mensaje privado..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-100 border border-slate-200 text-xs text-slate-900 px-4 py-2.5 rounded-full focus:outline-none focus:border-amber-500 focus:bg-white placeholder-slate-400 transition-all"
              />
              <button
                type="submit"
                className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-full transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
