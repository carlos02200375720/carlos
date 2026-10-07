import React, { useState, useEffect, useRef } from "react";
import { Send, X, ShieldCheck, ArrowLeft, Search, UserCheck, MessageSquare, Headphones, Sparkles, CheckCheck } from "lucide-react";
import { User, ChatMessage } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { resolveSupportUser, isSupportAdmin, SUPPORT_EMAIL } from "../../utils/supportChat";

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
  const isAdmin = isSupportAdmin(currentUser);
  const supportUser = resolveSupportUser(users);

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatUser]);

  // For regular clients: auto-select the Support chat if none is selected
  useEffect(() => {
    if (!isAdmin && !activeChatUser) {
      onSelectChatUser(supportUser);
      clearUnreads(supportUser.id);
    }
  }, [isAdmin, activeChatUser, supportUser, onSelectChatUser, clearUnreads]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendPrivateMessage(chatInput.trim());
    setChatInput("");
  };

  const handleSelectClient = (clientUser: User) => {
    onSelectChatUser(clientUser);
    clearUnreads(clientUser.id);
  };

  // Filter messages specifically for the current conversation between currentUser and activeChatUser
  const currentConversationMessages = React.useMemo(() => {
    if (!activeChatUser) return [];
    const myId = currentUser.originalId || currentUser.id;
    const partnerId = activeChatUser.originalId || activeChatUser.id;

    return messages.filter((msg) => {
      const isFromMe = msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";
      const isToMe = msg.receiverId === myId || msg.receiverId === currentUser.id || msg.receiverId === "current_user";

      const isFromPartner = msg.senderId === partnerId || msg.senderId === activeChatUser.id;
      const isToPartner = msg.receiverId === partnerId || msg.receiverId === activeChatUser.id;

      return (isFromMe && isToPartner) || (isFromPartner && isToMe);
    });
  }, [messages, activeChatUser, currentUser]);

  // For ADMIN: group messages to find all clients who have messaged support
  const adminClientList = React.useMemo(() => {
    if (!isAdmin) return [];

    const myId = currentUser.originalId || currentUser.id;
    const supportAliases = [myId, currentUser.id, supportUser.id, SUPPORT_EMAIL, "support", "carlos"];

    // Find all distinct client IDs who have sent or received messages with support
    const clientMap = new Map<string, { lastMsg: ChatMessage; count: number }>();
    messages.forEach((msg) => {
      let otherId = "";
      if (supportAliases.includes(msg.senderId)) {
        otherId = msg.receiverId;
      } else if (supportAliases.includes(msg.receiverId)) {
        otherId = msg.senderId;
      }

      if (otherId && !supportAliases.includes(otherId) && otherId !== "current_user") {
        const existing = clientMap.get(otherId);
        if (!existing) {
          clientMap.set(otherId, { lastMsg: msg, count: 1 });
        } else {
          existing.lastMsg = msg;
          existing.count += 1;
        }
      }
    });

    // Also include any registered clients from users who are not the admin
    const knownUsers = users.filter(
      (u) =>
        u.id !== currentUser.id &&
        u.email?.toLowerCase() !== SUPPORT_EMAIL &&
        u.username !== "invitado" &&
        u.username !== "soporte"
    );

    // Build the merged client list
    const clients: Array<{ user: User; lastMsg?: ChatMessage; unreads: number }> = [];

    // First add clients with existing conversations
    clientMap.forEach((info, clientId) => {
      const foundUser = users.find((u) => u.id === clientId || u.originalId === clientId);
      const clientUser: User = foundUser || {
        id: clientId,
        name: clientId.startsWith("guest_") ? "Cliente Invitado" : "Cliente",
        username: clientId.startsWith("guest_") ? clientId.slice(0, 12) : clientId,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        bio: "Cliente de Mall Social",
      };
      clients.push({
        user: clientUser,
        lastMsg: info.lastMsg,
        unreads: unreadCounts[clientId] || 0,
      });
    });

    // Then add other registered users who haven't messaged yet
    knownUsers.forEach((u) => {
      if (!clients.some((c) => c.user.id === u.id)) {
        clients.push({
          user: u,
          unreads: unreadCounts[u.id] || 0,
        });
      }
    });

    // Filter by search query if any
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      return clients.filter(
        (c) =>
          c.user.name.toLowerCase().includes(query) ||
          c.user.username.toLowerCase().includes(query) ||
          (c.user.email && c.user.email.toLowerCase().includes(query))
      );
    }

    return clients;
  }, [isAdmin, messages, users, currentUser, supportUser, unreadCounts, searchQuery]);

  // Last message in client's support chat
  const lastSupportMessage = React.useMemo(() => {
    if (currentConversationMessages.length > 0) {
      return currentConversationMessages[currentConversationMessages.length - 1];
    }
    return null;
  }, [currentConversationMessages]);

  return (
    <div
      className="w-full bg-white flex flex-col justify-between text-slate-900 relative h-[calc(100dvh-4rem)] md:h-[calc(100dvh)]"
      id="social-support-chat-page"
    >
      {/* =========================================================================
          TOP HEADER
      ========================================================================== */}
      <header
        className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs"
        style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))" }}
      >
        <div className="flex items-center space-x-3">
          {activeChatUser && isAdmin && (
            <button
              type="button"
              onClick={() => onSelectChatUser(null)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Volver a lista de clientes"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 leading-tight flex items-center gap-1.5">
                <span>{isAdmin ? "Bandeja de Soporte al Cliente" : "Soporte al Cliente"}</span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 text-[9px] font-extrabold uppercase">
                  Oficial
                </span>
              </h2>
              <p className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                {isAdmin
                  ? `Atendiendo como Administrador (${SUPPORT_EMAIL})`
                  : `Canal oficial de atención (${SUPPORT_EMAIL})`}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          title="Cerrar panel"
          id="btn-close-support-panel"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* =========================================================================
          MAIN CONTENT AREA
      ========================================================================== */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
        {/* -----------------------------------------------------------------------
            CASO 1: ADMIN VIENDO LISTA DE CLIENTES (cuando no tiene chat seleccionado)
        ------------------------------------------------------------------------ */}
        {isAdmin && !activeChatUser ? (
          <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full no-scrollbar">
            {/* Buscador de clientes */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente por nombre o @usuario..."
                className="w-full bg-white border border-slate-200 text-xs text-slate-900 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all shadow-2xs"
              />
            </div>

            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Clientes que han contactado a soporte ({adminClientList.length})
              </span>
            </div>

            {adminClientList.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-2xl p-10 text-center bg-white">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 stroke-[1.8]" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No hay consultas de soporte pendientes</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Cuando los clientes escriban al chat de soporte ({SUPPORT_EMAIL}), aparecerán aquí para que les respondas directamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {adminClientList.map(({ user, lastMsg, unreads }) => (
                  <div
                    key={`admin-client-${user.id}`}
                    onClick={() => handleSelectClient(user)}
                    className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 hover:border-amber-500/50 bg-white hover:bg-amber-50/20 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <img
                          src={user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                          alt={user.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        />
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">
                            {user.name}
                          </h4>
                          {lastMsg && (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                              {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold truncate">@{user.username}</p>
                        <p className="text-xs text-slate-600 truncate mt-0.5 font-normal">
                          {lastMsg ? lastMsg.text : "Sin mensajes aún"}
                        </p>
                      </div>
                    </div>

                    {unreads > 0 && (
                      <span className="ml-3 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] shrink-0">
                        {unreads}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* -----------------------------------------------------------------------
              CASO 2: VENTANA DE CHAT ACTIVA
              - Para CLIENTES: Su chat único con Soporte al Cliente
              - Para ADMIN: Su chat con el cliente seleccionado
          ------------------------------------------------------------------------ */
          <div className="flex-1 flex flex-col justify-between overflow-hidden max-w-2xl mx-auto w-full bg-white border-x border-slate-200/80">
            {/* Sub-cabecera con datos del interlocutor */}
            <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => onSelectChatUser(null)}
                    className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Clientes</span>
                  </button>
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}

                <div>
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    {isAdmin ? (
                      <>
                        <span>Atendiendo a: {activeChatUser?.name}</span>
                        <span className="text-slate-500 font-normal">(@{activeChatUser?.username})</span>
                      </>
                    ) : (
                      <>
                        <span>Soporte Oficial Mall Social</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500 inline" />
                      </>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {isAdmin
                      ? `ID Cliente: ${activeChatUser?.id}`
                      : `Contacto: ${SUPPORT_EMAIL} • Tiempo medio de respuesta: Inmediato`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  En Línea
                </span>
              </div>
            </div>

            {/* Lista de Mensajes */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {/* Tarjeta de bienvenida oficial */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-center max-w-md mx-auto my-2 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center mx-auto mb-2">
                  <Headphones className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                  Canal de Soporte Oficial
                </h4>
                <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                  {isAdmin
                    ? `Estás respondiendo como el usuario oficial de soporte (${SUPPORT_EMAIL}). Todas tus respuestas se entregarán en tiempo real a este cliente.`
                    : `Bienvenido al canal exclusivo de soporte. Escribe tu duda sobre pedidos, envíos o la plataforma, y el equipo oficial (${SUPPORT_EMAIL}) te responderá de inmediato.`}
                </p>
              </div>

              {currentConversationMessages.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-semibold text-slate-500">Aún no hay mensajes en esta conversación.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAdmin ? "Escribe un mensaje para responder al cliente." : "Escribe tu consulta abajo para comenzar."}
                  </p>
                </div>
              ) : (
                currentConversationMessages.map((msg, index) => {
                  const myId = currentUser.originalId || currentUser.id;
                  const isMe = msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";

                  return (
                    <div key={`msg-${msg.id || index}`} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed border shadow-xs ${
                          isMe
                            ? "bg-amber-500 text-slate-950 border-amber-400 rounded-br-xs font-medium"
                            : "bg-white text-slate-900 border-slate-200 rounded-bl-xs"
                        }`}
                      >
                        {!isMe && (
                          <div className="flex items-center space-x-1.5 mb-1 pb-1 border-b border-slate-100">
                            <span className="text-[10px] font-bold text-amber-700">
                              {isAdmin ? activeChatUser?.name || "Cliente" : "Soporte Oficial"}
                            </span>
                            {!isAdmin && <ShieldCheck className="w-3 h-3 text-amber-600 inline" />}
                          </div>
                        )}
                        <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                        <div
                          className={`flex items-center justify-end space-x-1 mt-1.5 text-[9px] font-mono ${
                            isMe ? "text-slate-950/70" : "text-slate-400"
                          }`}
                        >
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Formulario de Envío de Mensaje */}
            <form
              onSubmit={handleSubmit}
              className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0 shadow-sm"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <input
                type="text"
                placeholder={isAdmin ? "Responder a este cliente como Soporte..." : "Escribe tu mensaje para Soporte al Cliente..."}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                autoFocus
                className="flex-1 bg-slate-100 border border-slate-200 text-xs text-slate-900 px-4 py-2.5 rounded-full focus:outline-none focus:border-amber-500 focus:bg-white placeholder-slate-400 transition-all font-medium"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 active:scale-95 text-slate-950 font-bold rounded-full transition-all cursor-pointer shadow-sm"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4 translate-x-0.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
