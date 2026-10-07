import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send,
  X,
  ShieldCheck,
  ArrowLeft,
  Search,
  MessageSquare,
  Headphones,
  CheckCheck,
  Clock,
  Sparkles,
  AlertCircle,
  LogIn,
  UserCheck,
  Check
} from "lucide-react";
import { User, ChatMessage } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { resolveSupportUser, isSupportAdmin, isSupportAlias, SUPPORT_EMAIL, SUPPORT_USER_ID } from "../../utils/supportChat";
import { apiFetch } from "../../config";

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

interface SupportConversationItem {
  clientId: string;
  user: User;
  lastMessage?: ChatMessage;
  messageCount: number;
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
  const supportUser = useMemo(() => resolveSupportUser(users), [users]);

  const [chatInput, setChatInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [adminTabFilter, setAdminTabFilter] = useState<"all" | "unreads">("all");
  const [apiConversations, setApiConversations] = useState<SupportConversationItem[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatUser]);

  // For regular clients: auto-select the single Support chat by default on desktop/large screens
  useEffect(() => {
    if (!isAdmin && !activeChatUser) {
      // Auto-select Support chat so it displays side-by-side or directly
      onSelectChatUser(supportUser);
      clearUnreads(supportUser.id);
      clearUnreads(SUPPORT_USER_ID);
      clearUnreads(SUPPORT_EMAIL);
    }
  }, [isAdmin, activeChatUser, supportUser, onSelectChatUser, clearUnreads]);

  // For ADMIN: fetch past conversations from server to ensure complete inbox
  useEffect(() => {
    if (isAdmin) {
      apiFetch("/api/chats/support/conversations")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.conversations)) {
            setApiConversations(data.conversations);
          }
        })
        .catch((err) => console.error("Error fetching support conversations:", err));
    }
  }, [isAdmin, messages]);

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

  // Filter messages specifically for the active conversation
  const currentConversationMessages = useMemo(() => {
    if (!activeChatUser) return [];

    const myId = currentUser.originalId || currentUser.id;
    const partnerId = activeChatUser.originalId || activeChatUser.id;

    if (!isAdmin) {
      // For Client: all messages between this client and Support (checking aliases)
      return messages.filter((msg) => {
        const isFromMe = msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";
        const isToMe = msg.receiverId === myId || msg.receiverId === currentUser.id || msg.receiverId === "current_user";
        const isFromSupport = isSupportAlias(msg.senderId) || msg.senderId === partnerId || msg.senderId === supportUser.id;
        const isToSupport = isSupportAlias(msg.receiverId) || msg.receiverId === partnerId || msg.receiverId === supportUser.id;

        return (isFromMe && isToSupport) || (isFromSupport && isToMe);
      });
    } else {
      // For Admin: messages between active client (partnerId) and Support/Admin
      return messages.filter((msg) => {
        const isFromPartner = msg.senderId === partnerId || msg.senderId === activeChatUser.id;
        const isToPartner = msg.receiverId === partnerId || msg.receiverId === activeChatUser.id;
        const isFromSupportOrMe = isSupportAlias(msg.senderId) || msg.senderId === myId || msg.senderId === currentUser.id || msg.senderId === "current_user";
        const isToSupportOrMe = isSupportAlias(msg.receiverId) || msg.receiverId === myId || msg.receiverId === currentUser.id || msg.receiverId === "current_user";

        return (isFromSupportOrMe && isToPartner) || (isFromPartner && isToSupportOrMe);
      });
    }
  }, [messages, activeChatUser, currentUser, isAdmin, supportUser]);

  // Client's last support message snippet
  const clientLastMessage = useMemo(() => {
    if (currentConversationMessages.length > 0) {
      return currentConversationMessages[currentConversationMessages.length - 1];
    }
    // Also check if any in general messages list matches
    const myId = currentUser.originalId || currentUser.id;
    const supportMsgs = messages.filter((m) => {
      const isFromMe = m.senderId === myId || m.senderId === currentUser.id || m.senderId === "current_user";
      const isToMe = m.receiverId === myId || m.receiverId === currentUser.id || m.receiverId === "current_user";
      const isSupportS = isSupportAlias(m.senderId);
      const isSupportR = isSupportAlias(m.receiverId);
      return (isFromMe && isSupportR) || (isSupportS && isToMe);
    });
    return supportMsgs.length > 0 ? supportMsgs[supportMsgs.length - 1] : null;
  }, [currentConversationMessages, messages, currentUser]);

  // For ADMIN: Build the list of client conversations
  const adminClientList = useMemo(() => {
    if (!isAdmin) return [];

    const myId = currentUser.originalId || currentUser.id;
    const clientMap = new Map<string, { user: User; lastMsg?: ChatMessage; unreads: number }>();

    // 1. Seed from apiConversations if loaded
    apiConversations.forEach((conv) => {
      const foundUser = users.find((u) => u.id === conv.clientId || u.originalId === conv.clientId) || conv.user;
      clientMap.set(conv.clientId, {
        user: foundUser,
        lastMsg: conv.lastMessage,
        unreads: unreadCounts[conv.clientId] || 0,
      });
    });

    // 2. Supplement from live messages in state
    messages.forEach((msg) => {
      let otherId = "";
      if (isSupportAlias(msg.senderId) || msg.senderId === myId) {
        otherId = msg.receiverId;
      } else if (isSupportAlias(msg.receiverId) || msg.receiverId === myId) {
        otherId = msg.senderId;
      }

      if (otherId && !isSupportAlias(otherId) && otherId !== "current_user") {
        const existing = clientMap.get(otherId);
        const foundUser = users.find((u) => u.id === otherId || u.originalId === otherId);
        const resolvedUser: User = foundUser || (existing?.user) || {
          id: otherId,
          name: otherId.startsWith("guest_") ? "Cliente Invitado" : "Cliente",
          username: otherId.startsWith("guest_") ? otherId.slice(0, 12) : otherId,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: "Cliente de Mall Social",
          isOnline: false,
          followers: 0,
          following: 0,
        };

        clientMap.set(otherId, {
          user: resolvedUser,
          lastMsg: msg,
          unreads: unreadCounts[otherId] || 0,
        });
      }
    });

    // 3. Add known registered users who are not the admin
    users.forEach((u) => {
      if (
        u.id !== currentUser.id &&
        u.email?.toLowerCase() !== SUPPORT_EMAIL &&
        !isSupportAlias(u.username) &&
        u.username !== "invitado" &&
        !clientMap.has(u.id)
      ) {
        clientMap.set(u.id, {
          user: u,
          unreads: unreadCounts[u.id] || 0,
        });
      }
    });

    let clients = Array.from(clientMap.values());

    // Apply search filter if query exists
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      clients = clients.filter(
        (c) =>
          c.user.name.toLowerCase().includes(query) ||
          c.user.username.toLowerCase().includes(query) ||
          (c.user.email && c.user.email.toLowerCase().includes(query))
      );
    }

    // Apply tab filter (unreads only)
    if (adminTabFilter === "unreads") {
      clients = clients.filter((c) => c.unreads > 0);
    }

    // Sort by latest message timestamp or unreads
    return clients.sort((a, b) => {
      if (a.unreads > 0 && b.unreads === 0) return -1;
      if (b.unreads > 0 && a.unreads === 0) return 1;
      const timeA = a.lastMsg?.timestamp ? new Date(a.lastMsg.timestamp).getTime() : 0;
      const timeB = b.lastMsg?.timestamp ? new Date(b.lastMsg.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [isAdmin, apiConversations, messages, users, currentUser, unreadCounts, searchQuery, adminTabFilter]);

  const clientUnreads = unreadCounts[supportUser.id] || unreadCounts[SUPPORT_USER_ID] || unreadCounts[SUPPORT_EMAIL] || 0;
  const isGuest = currentUser.isGuest || currentUser.username === "invitado";

  return (
    <div
      className="w-full bg-slate-100 flex flex-col justify-between text-slate-900 relative h-[calc(100dvh-4rem)] md:h-[calc(100dvh)] font-sans select-none overflow-hidden"
      id="social-support-chat-page"
    >
      {/* =========================================================================
          TOP APP HEADER
      ========================================================================== */}
      <header
        className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs z-20"
        style={{ paddingTop: "max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))" }}
      >
        <div className="flex items-center space-x-3">
          {/* Back button on mobile when a chat is open */}
          {activeChatUser && (
            <button
              type="button"
              onClick={() => onSelectChatUser(null)}
              className="md:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-700 active:scale-95 transition-all cursor-pointer"
              title="Volver a la lista de chats"
              aria-label="Volver a la lista de chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-sm shrink-0">
            <Headphones className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                {isAdmin ? "Bandeja de Soporte al Cliente" : "Soporte al Cliente"}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                {isAdmin ? "Admin" : "Oficial"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-1">
              {isAdmin
                ? `Atendiendo como Administrador (${SUPPORT_EMAIL})`
                : `Canal oficial de atención • ${SUPPORT_EMAIL}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>En Línea</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Cerrar panel de mensajes"
            aria-label="Cerrar panel de mensajes"
            id="btn-close-support-panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN 2-COLUMN RESPONSIVE LAYOUT
      ========================================================================== */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-100">
        {/* -----------------------------------------------------------------------
            PANEL IZQUIERDO: LISTA DE CHATS
            - Para Clientes: EXACTAMENTE UN SOLO CHAT (Soporte al Cliente)
            - Para Admin: Lista de clientes que contactan a soporte
        ------------------------------------------------------------------------ */}
        <aside
          className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200/90 flex flex-col shrink-0 z-10 transition-all ${
            activeChatUser ? "hidden md:flex" : "flex"
          }`}
          id="chat-list-sidebar"
        >
          {/* Header de la lista de chats */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-amber-600" />
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Lista de Chats
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
              {isAdmin ? `${adminClientList.length} clientes` : "1 chat disponible"}
            </span>
          </div>

          {/* CASO A: CLIENTE REGULAR / INVITADO */}
          {!isAdmin ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Aviso explicativo del canal único */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-950 font-medium leading-relaxed">
                  Por seguridad y garantía de la plataforma, todas las dudas sobre productos, pedidos y publicaciones se atienden exclusivamente en el chat de <strong className="font-extrabold">Soporte Oficial</strong>.
                </p>
              </div>

              {/* EL ÚNICO CHAT DISPONIBLE EN LA LISTA */}
              <div
                onClick={() => {
                  onSelectChatUser(supportUser);
                  clearUnreads(supportUser.id);
                  clearUnreads(SUPPORT_USER_ID);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs select-none ${
                  activeChatUser && isSupportAlias(activeChatUser.id)
                    ? "bg-amber-50/60 border-amber-500 shadow-amber-500/10 ring-2 ring-amber-500/20"
                    : "bg-white border-slate-200/90 hover:border-amber-400 hover:bg-slate-50"
                }`}
                id="single-client-chat-support-item"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative shrink-0">
                    <img
                      src={supportUser.avatar}
                      alt={supportUser.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-amber-500/40 shadow-xs"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <h3 className="text-xs font-black text-slate-900 truncate">
                          Soporte al Cliente
                        </h3>
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      </div>

                      {clientLastMessage && (
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(clientLastMessage.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-amber-700 font-bold truncate">
                      {SUPPORT_EMAIL}
                    </p>

                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-xs text-slate-500 truncate font-normal">
                        {clientLastMessage
                          ? clientLastMessage.text
                          : "¡Hola! ¿En qué podemos ayudarte hoy?"}
                      </p>

                      {clientUnreads > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-black text-[10px] shrink-0">
                          {clientUnreads}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Guía informativa de atención */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-2">
                <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Beneficios de Soporte Directo</span>
                </h4>
                <ul className="text-[11px] text-slate-600 space-y-1.5 font-medium">
                  <li className="flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Respuestas directas del Administrador</span>
                  </li>
                  <li className="flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Garantía y seguimiento de tus pedidos</span>
                  </li>
                  <li className="flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Ayuda con publicaciones y ventas en tienda</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* CASO B: ADMINISTRADOR (cg0220037@gmail.com) */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col space-y-3">
              {/* Buscador de clientes */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cliente por nombre o @usuario..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Filtro rápido de pestañas */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdminTabFilter("all")}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    adminTabFilter === "all"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Todos ({adminClientList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTabFilter("unreads")}
                  className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    adminTabFilter === "unreads"
                      ? "bg-white text-rose-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  No leídos
                </button>
              </div>

              {/* Lista de clientes para el admin */}
              {adminClientList.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center bg-white my-auto">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-2">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">No hay consultas de clientes</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cuando los clientes escriban al chat oficial ({SUPPORT_EMAIL}), aparecerán aquí para que les respondas.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {adminClientList.map(({ user, lastMsg, unreads }) => {
                    const isSelected = activeChatUser?.id === user.id;
                    return (
                      <div
                        key={`admin-client-${user.id}`}
                        onClick={() => handleSelectClient(user)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 shadow-xs ring-1 ring-amber-500/30"
                            : "bg-white border-slate-200/80 hover:border-amber-400 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <img
                              src={
                                user.avatar ||
                                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                              }
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200"
                            />
                            {user.isOnline && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-900 truncate">
                                {user.name}
                              </h4>
                              {lastMsg && (
                                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                  {new Date(lastMsg.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium truncate">
                              @{user.username}
                            </p>
                            <p className="text-xs text-slate-600 truncate mt-0.5 font-normal">
                              {lastMsg ? lastMsg.text : "Sin mensajes aún"}
                            </p>
                          </div>
                        </div>

                        {unreads > 0 && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-black text-[10px] shrink-0">
                            {unreads}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* -----------------------------------------------------------------------
            PANEL DERECHO: CONVERSACIÓN ACTIVA
        ------------------------------------------------------------------------ */}
        <main
          className={`flex-1 flex flex-col bg-slate-50 min-w-0 ${
            !activeChatUser ? "hidden md:flex" : "flex"
          }`}
          id="chat-conversation-pane"
        >
          {activeChatUser ? (
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
              {/* Cabecera del chat activo */}
              <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={
                        isAdmin
                          ? activeChatUser.avatar ||
                            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                          : supportUser.avatar
                      }
                      alt={isAdmin ? activeChatUser.name : "Soporte Oficial"}
                      className="w-10 h-10 rounded-2xl object-cover border border-amber-500/40"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-black text-slate-900 truncate">
                        {isAdmin ? activeChatUser.name : "Soporte al Cliente"}
                      </h3>
                      {!isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      {isAdmin && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          (@{activeChatUser.username})
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {isAdmin
                        ? `ID Cliente: ${activeChatUser.id}`
                        : `${SUPPORT_EMAIL} • Tiempo medio de respuesta: Inmediato`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    En Línea
                  </span>
                </div>
              </div>

              {/* Mensajes Scroll Area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60 no-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {/* Tarjeta de bienvenida oficial */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center max-w-md mx-auto my-2 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center mx-auto mb-2">
                    <Headphones className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                    {isAdmin
                      ? `Atención Oficial (${SUPPORT_EMAIL})`
                      : "Canal Oficial de Soporte al Cliente"}
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                    {isAdmin
                      ? `Estás respondiendo a este cliente como el usuario oficial de soporte (${SUPPORT_EMAIL}). Todas tus respuestas se entregarán en tiempo real.`
                      : `Bienvenido a Soporte al Cliente. Escribe tu duda o consulta sobre pedidos, envíos, productos o publicaciones, y el administrador responderá directamente a tu chat.`}
                  </p>
                </div>

                {currentConversationMessages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.8]" />
                    <p className="text-xs font-semibold text-slate-600">
                      Aún no hay mensajes en esta conversación.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isAdmin
                        ? "Escribe un mensaje para responder al cliente."
                        : "Escribe tu consulta abajo para comenzar a chatear con soporte."}
                    </p>
                  </div>
                ) : (
                  currentConversationMessages.map((msg, index) => {
                    const myId = currentUser.originalId || currentUser.id;
                    const isMe =
                      msg.senderId === myId ||
                      msg.senderId === currentUser.id ||
                      msg.senderId === "current_user";

                    return (
                      <div
                        key={`msg-${msg.id || index}`}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed border shadow-xs ${
                            isMe
                              ? "bg-amber-500 text-slate-950 border-amber-400 rounded-br-xs font-medium"
                              : "bg-white text-slate-900 border-slate-200/90 rounded-bl-xs"
                          }`}
                        >
                          {!isMe && (
                            <div className="flex items-center space-x-1.5 mb-1 pb-1 border-b border-slate-100">
                              <span className="text-[10px] font-black text-amber-700">
                                {isAdmin ? activeChatUser?.name || "Cliente" : "Soporte Oficial"}
                              </span>
                              {!isAdmin && <ShieldCheck className="w-3 h-3 text-amber-600 inline" />}
                            </div>
                          )}
                          <p className="break-words whitespace-pre-wrap">{msg.text}</p>
                          <div
                            className={`flex items-center justify-end space-x-1 mt-1 text-[9px] font-mono ${
                              isMe ? "text-slate-950/70" : "text-slate-400"
                            }`}
                          >
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMe && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Formulario de Entrada de Mensaje */}
              <div className="border-t border-slate-200 bg-white">
                {isGuest && !isAdmin ? (
                  <div className="p-3 bg-amber-50 border-t border-amber-200 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2 text-amber-900 font-medium">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Para enviar consultas a Soporte, inicia sesión o regístrate.</span>
                    </div>
                  </div>
                ) : null}

                <form
                  onSubmit={handleSubmit}
                  className="p-3 flex items-center space-x-2 shrink-0"
                  style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  <input
                    type="text"
                    placeholder={
                      isAdmin
                        ? `Responder a ${activeChatUser?.name || "este cliente"} como Soporte...`
                        : "Escribe tu consulta para Soporte al Cliente..."
                    }
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    autoFocus
                    className="flex-1 bg-slate-100 border border-slate-200 text-xs text-slate-900 px-4 py-2.5 rounded-full focus:outline-none focus:border-amber-500 focus:bg-white placeholder-slate-400 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 active:scale-95 text-slate-950 font-black rounded-full transition-all cursor-pointer shadow-xs"
                    title="Enviar mensaje"
                  >
                    <Send className="w-4 h-4 translate-x-0.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Estado vacío en desktop cuando admin no tiene chat seleccionado */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
                <Headphones className="w-8 h-8 stroke-[1.8]" />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                Bandeja de Soporte al Cliente
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Selecciona un cliente de la lista de la izquierda para ver su conversación y responder a sus consultas como soporte oficial ({SUPPORT_EMAIL}).
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
