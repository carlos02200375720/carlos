import React, { useState, useEffect, useRef } from "react";
import { Users, Send, X, MessageSquare, ArrowLeft, Smartphone, ShieldCheck, Check } from "lucide-react";
import { User, ChatMessage } from "../../types";
import { motion, AnimatePresence } from "motion/react";

export interface AndroidSocialPanelProps {
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

/**
 * Android Native Social & Messaging Panel
 * Features Android chat bubbles, persistent contact list, and full touch-responsive messaging.
 */
export default function AndroidSocialPanel({
  users,
  currentUser,
  messages,
  activeChatUser,
  onSelectChatUser,
  onSendPrivateMessage,
  unreadCounts,
  clearUnreads,
  onClose,
}: AndroidSocialPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendPrivateMessage(chatInput.trim());
    setChatInput("");
  };

  const filteredUsers = users.filter((u) => {
    if (u.id === currentUser.id || u.username === currentUser.username || u.username === "invitado") return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none" id="android-social-panel">
      {activeChatUser ? (
        /* --- Android 1-on-1 Chat Thread View --- */
        <div className="flex-1 flex flex-col h-full bg-slate-950">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onSelectChatUser(null)}
                className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-slate-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative">
                <img
                  src={activeChatUser.avatar}
                  alt={activeChatUser.name}
                  className="w-9 h-9 rounded-full object-cover border border-amber-500/40"
                />
                {activeChatUser.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-white">{activeChatUser.name}</p>
                <p className="text-[10px] text-amber-400">@{activeChatUser.username}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-amber-500" />
                <p className="text-xs">No hay mensajes previos.</p>
                <p className="text-[11px] text-slate-600 mt-1">Envía un saludo para iniciar la conversación en Android.</p>
              </div>
            ) : (
              messages.map((m, mIdx) => {
                const isMe = m.senderId === currentUser.id || m.senderId === currentUser.originalId;
                return (
                  <div
                    key={`${m.id || 'msg'}-${mIdx}`}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs ${
                        isMe
                          ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-medium rounded-br-none shadow-sm"
                          : "bg-slate-900 text-white rounded-bl-none border border-slate-800"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Mensaje de Android..."
              className="flex-1 px-4 py-2.5 bg-slate-850 border border-slate-700/80 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-2xl active:scale-95 transition-all shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        /* --- Android Chats & User List View --- */
        <div className="flex-1 flex flex-col h-full p-4 pb-20">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-white">Mensajes</h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              Android Chat
            </span>
          </div>

          {/* Search bar */}
          <div className="my-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar personas..."
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No se encontraron contactos en la red.
              </div>
            ) : (
              filteredUsers.map((u, uIdx) => {
                const unreads = unreadCounts[u.id] || 0;
                return (
                  <div
                    key={`${u.id}-${uIdx}`}
                    onClick={() => {
                      onSelectChatUser(u);
                      clearUnreads(u.id);
                    }}
                    className="flex items-center justify-between p-3 bg-slate-900/80 hover:bg-slate-850 rounded-2xl border border-slate-800/80 cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-11 h-11 rounded-full object-cover border border-amber-500/30"
                        />
                        {u.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{u.name}</p>
                        <p className="text-[11px] text-amber-400">@{u.username}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{u.bio || "Creador en MallSocial"}</p>
                      </div>
                    </div>

                    {unreads > 0 && (
                      <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                        {unreads}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
