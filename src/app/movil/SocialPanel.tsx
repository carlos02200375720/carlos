import React, { useState, useEffect, useRef, useMemo } from "react";
import { Users, Send, X, MessageSquare, ArrowLeft, Headphones, ShieldCheck, CheckCheck } from "lucide-react";
import { User, ChatMessage } from "../../types";
import { resolveSupportUser, isSupportAdmin, isSupportAlias, SUPPORT_EMAIL, SUPPORT_USER_ID } from "../../utils/supportChat";

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
 * Adheres strictly to the single customer support chat rule for clients, and inbox for admin.
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
  const isAdmin = isSupportAdmin(currentUser);
  const supportUser = useMemo(() => resolveSupportUser(users), [users]);

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

  // Filter messages for current active chat
  const conversationMessages = useMemo(() => {
    if (!activeChatUser) return [];

    const myId = currentUser.originalId || currentUser.id;
    const partnerId = activeChatUser.originalId || activeChatUser.id;

    if (!isAdmin) {
      return messages.filter((msg) => {
        const isFromMe = msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";
        const isToMe = msg.receiverId === myId || msg.receiverId === currentUser.id || msg.receiverId === "current_user";
        const isFromSupport = isSupportAlias(msg.senderId) || msg.senderId === partnerId || msg.senderId === supportUser.id;
        const isToSupport = isSupportAlias(msg.receiverId) || msg.receiverId === partnerId || msg.receiverId === supportUser.id;
        return (isFromMe && isToSupport) || (isFromSupport && isToMe);
      });
    } else {
      return messages.filter((msg) => {
        const isFromPartner = msg.senderId === partnerId || msg.senderId === activeChatUser.id;
        const isToPartner = msg.receiverId === partnerId || msg.receiverId === activeChatUser.id;
        const isFromSupport = isSupportAlias(msg.senderId) || msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";
        const isToSupport = isSupportAlias(msg.receiverId) || msg.receiverId === myId || msg.receiverId === currentUser.id || msg.receiverId === "current_user";
        return (isFromSupport && isToPartner) || (isFromPartner && isToSupport);
      });
    }
  }, [messages, activeChatUser, currentUser, isAdmin, supportUser]);

  // Clients list for Admin
  const adminClientList = useMemo(() => {
    if (!isAdmin) return [];
    const clientMap = new Map<string, { user: User; lastMsg?: ChatMessage; unreads: number }>();

    messages.forEach((msg) => {
      let otherId = "";
      if (isSupportAlias(msg.senderId)) otherId = msg.receiverId;
      else if (isSupportAlias(msg.receiverId)) otherId = msg.senderId;

      if (otherId && !isSupportAlias(otherId) && otherId !== "current_user") {
        const found = users.find((u) => u.id === otherId || u.originalId === otherId);
        clientMap.set(otherId, {
          user: found || {
            id: otherId,
            name: otherId.startsWith("guest_") ? "Cliente Invitado" : "Cliente",
            username: otherId,
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            bio: "Cliente de Mall Social",
            isOnline: false,
            followers: 0,
            following: 0,
          },
          lastMsg: msg,
          unreads: unreadCounts[otherId] || 0,
        });
      }
    });

    users.forEach((u) => {
      if (u.id !== currentUser.id && u.email?.toLowerCase() !== SUPPORT_EMAIL && u.username !== "invitado" && !clientMap.has(u.id)) {
        clientMap.set(u.id, { user: u, unreads: unreadCounts[u.id] || 0 });
      }
    });

    let clients = Array.from(clientMap.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      clients = clients.filter((c) => c.user.name.toLowerCase().includes(q) || c.user.username.toLowerCase().includes(q));
    }
    return clients;
  }, [isAdmin, messages, users, currentUser, unreadCounts, searchQuery]);

  const clientUnreads = unreadCounts[supportUser.id] || unreadCounts[SUPPORT_USER_ID] || unreadCounts[SUPPORT_EMAIL] || 0;

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none" id="android-social-panel">
      {activeChatUser ? (
        /* --- Android 1-on-1 Chat Thread View --- */
        <div className="flex-1 flex flex-col h-full bg-slate-950">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={() => onSelectChatUser(null)}
                className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-slate-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="relative shrink-0">
                <img
                  src={isAdmin ? activeChatUser.avatar : supportUser.avatar}
                  alt={isAdmin ? activeChatUser.name : "Soporte Oficial"}
                  className="w-9 h-9 rounded-full object-cover border border-amber-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-black" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <span>{isAdmin ? activeChatUser.name : "Soporte al Cliente"}</span>
                  {!isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </p>
                <p className="text-[10px] text-amber-400 font-mono truncate">
                  {isAdmin ? `@${activeChatUser.username}` : SUPPORT_EMAIL}
                </p>
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
            {/* Tarjeta de bienvenida */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center max-w-sm mx-auto my-2">
              <Headphones className="w-6 h-6 text-amber-400 mx-auto mb-1" />
              <p className="text-xs font-black text-amber-300">
                {isAdmin ? `Atención Oficial (${SUPPORT_EMAIL})` : "Canal Oficial de Soporte"}
              </p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isAdmin
                  ? "Respondiendo a este cliente en tiempo real."
                  : `Escribe aquí tu consulta y el administrador (${SUPPORT_EMAIL}) te responderá directamente.`}
              </p>
            </div>

            {conversationMessages.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30 text-amber-500" />
                <p className="text-xs">No hay mensajes previos.</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Envía un mensaje para comenzar la conversación.</p>
              </div>
            ) : (
              conversationMessages.map((m, mIdx) => {
                const myId = currentUser.originalId || currentUser.id;
                const isMe = m.senderId === myId || m.senderId === currentUser.id || m.senderId === "current_user";
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
                      {!isMe && (
                        <p className="text-[10px] font-bold text-amber-400 mb-0.5 flex items-center gap-1">
                          <span>{isAdmin ? activeChatUser.name : "Soporte Oficial"}</span>
                          {!isAdmin && <ShieldCheck className="w-3 h-3 text-amber-500" />}
                        </p>
                      )}
                      <p className="break-words">{m.text}</p>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5 px-1 font-mono">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input Bar */}
          <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              placeholder={isAdmin ? "Responder al cliente..." : "Escribe a Soporte al Cliente..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white px-4 py-2.5 rounded-2xl focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
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
              <Headphones className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-white">
                {isAdmin ? "Bandeja de Clientes" : "Mensajes y Soporte"}
              </h2>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-bold">
              {isAdmin ? "Admin" : "Oficial"}
            </span>
          </div>

          {!isAdmin ? (
            /* PARA CLIENTE: UN SOLO CHAT DISPONIBLE */
            <div className="my-4 space-y-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">
                  Todas las consultas de compras, pedidos y publicaciones se atienden en el chat de <strong className="text-white">Soporte Oficial</strong> ({SUPPORT_EMAIL}).
                </p>
              </div>

              {/* Único chat disponible */}
              <div
                onClick={() => {
                  onSelectChatUser(supportUser);
                  clearUnreads(supportUser.id);
                  clearUnreads(SUPPORT_USER_ID);
                }}
                className="flex items-center justify-between p-3.5 bg-slate-900/90 hover:bg-slate-850 rounded-2xl border border-amber-500/50 cursor-pointer shadow-sm active:scale-[0.99] transition-all"
                id="android-single-support-chat-item"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={supportUser.avatar}
                      alt={supportUser.name}
                      className="w-12 h-12 rounded-full object-cover border border-amber-500"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Soporte al Cliente</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    </p>
                    <p className="text-[11px] text-amber-400 font-mono">{SUPPORT_EMAIL}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Canal oficial de atención directa</p>
                  </div>
                </div>

                {clientUnreads > 0 && (
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                    {clientUnreads}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* PARA ADMIN: LISTA DE CLIENTES */
            <div className="flex-1 flex flex-col my-3 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar clientes..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />

              <div className="flex-1 overflow-y-auto space-y-2">
                {adminClientList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No hay clientes con consultas pendientes.
                  </div>
                ) : (
                  adminClientList.map(({ user, lastMsg, unreads }) => (
                    <div
                      key={`android-client-${user.id}`}
                      onClick={() => {
                        onSelectChatUser(user);
                        clearUnreads(user.id);
                      }}
                      className="flex items-center justify-between p-3 bg-slate-900/80 hover:bg-slate-850 rounded-2xl border border-slate-800 cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                            alt={user.name}
                            className="w-11 h-11 rounded-full object-cover border border-amber-500/30"
                          />
                          {user.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{user.name}</p>
                          <p className="text-[11px] text-amber-400 truncate">@{user.username}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {lastMsg ? lastMsg.text : "Sin mensajes aún"}
                          </p>
                        </div>
                      </div>

                      {unreads > 0 && (
                        <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                          {unreads}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
