import React, { useState, useEffect, useRef } from "react";
import { User, Product, Reel, Order, LiveSession } from "../types";
import { Eye, Heart, MessageCircle, BarChart3, ShoppingBag, ShieldCheck, Mail, Users, ArrowUpRight, Play, Star, Bookmark, Settings, Camera, Plus, Radio, Video, VideoOff, Mic, MicOff, Send, Sparkles, Flame, Zap, Shield, Crown, VolumeX, UserX, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import PublishView from "./PublishView";
import LoginView from "./LoginView";

interface ProfileViewProps {
  currentUser: User;
  selectedCreatorId: string | null; // Null means we view our own private admin profile
  users: User[];
  onBackToSelf: () => void;
  onOpenDirectChat: (user: User) => void;
  onSelectProduct: (product: Product) => void;
  onSelectReel: (reelId: string) => void;
  onProfileUpdate?: (updatedUser: User) => void;
  onRefreshUsers?: () => void;
  onLogout?: () => void;
  socket?: WebSocket | null;
  onGoLive?: (title: string, callback: (session: LiveSession) => void) => void;
  onEndLive?: (sessionId: string) => void;
  liveSessions?: LiveSession[];
}

export default function ProfileView({
  currentUser,
  selectedCreatorId,
  users,
  onBackToSelf,
  onOpenDirectChat,
  onSelectProduct,
  onSelectReel,
  onProfileUpdate,
  onRefreshUsers,
  onLogout,
  socket,
  onGoLive,
  onEndLive,
  liveSessions,
}: ProfileViewProps) {
  // Determine if we are looking at public creator profile or our private dashboard
  const isSelf = selectedCreatorId === null || selectedCreatorId === currentUser.id;
  const activeUserId = isSelf ? currentUser.id : selectedCreatorId;

  // Profiles data states
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"publications" | "saved" | "orders" | "performance" | "edit" | "publish" | "broadcast">("publications");

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

  // Edit profile states
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editCoverPhoto, setEditCoverPhoto] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // States for sub-sections inside the Edit Profile tab
  const [editSection, setEditSection] = useState<"edit_self" | "register_new" | "switch_account">("edit_self");
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("");
  const [regCoverPhoto, setRegCoverPhoto] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Switch account with password states
  const [switchingUser, setSwitchingUser] = useState<User | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");

  // Guest authentication states
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [loginUsernameInput, setLoginUsernameInput] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (profileUser && isSelf) {
      setEditName(profileUser.name);
      setEditUsername(profileUser.username);
      setEditBio(profileUser.bio);
      setEditAvatar(profileUser.avatar);
      setEditCoverPhoto(profileUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80");
      setEditPassword(profileUser.password || "");
    }
  }, [profileUser, isSelf]);

  // Connect camera stream when entering Broadcaster Studio
  useEffect(() => {
    if (activeSubTab === "broadcast" && cameraOn) {
      setHasMediaStream(false);
      navigator.mediaDevices?.getUserMedia({ video: { aspectRatio: 16 / 9 }, audio: true })
        .catch(() => {
          // Fallback if audio or aspect ratio fails
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
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [activeSubTab, cameraOn]);

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

  // Socket listener for live chat and reactions in Broadcaster Studio
  useEffect(() => {
    if (!socket) return;

    const handleSocketMsg = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "live_msg" && activeLiveSession && payload.streamId === activeLiveSession.id) {
          setLiveChatMessages((prev) => [...prev, {
            senderName: payload.senderName,
            avatar: payload.avatar,
            text: payload.text,
            timestamp: new Date().toISOString()
          }]);
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
          avatar: currentUser.avatar
        }));
      }
    });
  };

  const handleStopLive = () => {
    if (activeLiveSession && onEndLive) {
      onEndLive(activeLiveSession.id);
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch("/api/users/current/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          username: editUsername,
          bio: editBio,
          avatar: editAvatar,
          coverPhoto: editCoverPhoto,
          password: editPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setProfileUser(data.user);
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setIsRegistering(true);
    setRegisterError("");
    setRegisterSuccess(false);

    try {
      const response = await fetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          username: regUsername,
          bio: regBio,
          avatar: regAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          coverPhoto: regCoverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          password: regPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRegisterError(data.error || "Error al registrar el usuario");
        return;
      }
      if (data.success) {
        setRegisterSuccess(true);
        const registeredUsername = regUsername;
        const registeredPassword = regPassword;
        setRegName("");
        setRegUsername("");
        setRegPassword("");
        setRegBio("");
        setRegAvatar("");
        setRegCoverPhoto("");
        if (onRefreshUsers) {
          onRefreshUsers();
        }
        setTimeout(() => setRegisterSuccess(false), 3000);

        if (profileUser?.isGuest || profileUser?.username === "invitado") {
          await handleSwitchUser(registeredUsername, registeredPassword);
        }
      }
    } catch (err) {
      console.error("Error registering user:", err);
      setRegisterError("Error de conexión con el servidor.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSwitchUser = async (targetUsername: string, password?: string) => {
    try {
      setSwitchError("");
      const response = await fetch("/api/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setSwitchError(data.error || "Contraseña incorrecta o usuario no encontrado.");
        return;
      }
      if (response.ok && data.success) {
        // Update localstorage so session matches the newly typed password
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loggedInUsername", targetUsername);
        localStorage.setItem("loggedInPassword", password || "");

        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        if (onRefreshUsers) {
          onRefreshUsers();
        }
        setSwitchingUser(null);
        setSwitchPassword("");
        onBackToSelf();
      }
    } catch (err) {
      console.error("Error switching account:", err);
      setSwitchError("Error de conexión al cambiar de cuenta.");
    }
  };

  useEffect(() => {
    if (isSelf) {
      setProfileUser(currentUser);
    }
  }, [currentUser, isSelf]);

  useEffect(() => {
    if (!activeUserId) return;
    setLoading(true);
    
    fetch(`/api/users/${activeUserId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setProfileUser(data.user);
          setUserProducts(data.products || []);
          setUserReels(data.reels || []);
          setUserOrders(data.orders || []);
          setSavedReels(data.savedReels || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [activeUserId, currentUser.username, currentUser.avatar, isSelf]);

  // Calculate Creator Dashboard metrics (sum likes, views, comments)
  const totalViews = userReels.reduce((acc, r) => acc + r.views, 0);
  const totalLikes = userReels.reduce((acc, r) => acc + r.likes, 0);
  const totalComments = userReels.reduce((acc, r) => acc + r.comments.length, 0);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[550px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-500">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold mt-4">Sincronizando perfil...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[450px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
        <p className="font-bold text-slate-700">Error al cargar perfil</p>
        <button onClick={onBackToSelf} className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs">
          Regresar a mi perfil
        </button>
      </div>
    );
  }

  const isGuestMode = isSelf && (profileUser.isGuest || profileUser.username === "invitado");

  if (isGuestMode) {
    return (
      <div className="w-full max-w-4xl mx-auto" id="guest-profile-login-wrapper">
        <LoginView
          users={users}
          onRefreshUsers={onRefreshUsers || (() => {})}
          onLoginSuccess={(user) => {
            setProfileUser(user);
            if (onProfileUpdate) {
              onProfileUpdate(user);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[600px] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col" id="profile-panel">
      {/* Profile Header Image Backbanner */}
      <div className="h-40 bg-slate-900 relative overflow-hidden">
        {profileUser.coverPhoto ? (
          <img
            src={profileUser.coverPhoto}
            alt="Profile cover banner"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-slate-950/20" />
        {!isSelf && (
          <button
            onClick={onBackToSelf}
            className="absolute top-4 left-4 text-xs px-3 py-1.5 bg-slate-950/60 backdrop-blur-sm text-white hover:bg-slate-950/80 rounded-full border border-white/10 font-bold transition-all cursor-pointer z-10"
          >
            ← Mi Dashboard Privado
          </button>
        )}
        <div className="absolute top-4 right-4 bg-slate-950/60 backdrop-blur-sm text-white text-[9px] font-bold font-mono px-2.5 py-1 rounded-md border border-white/10 uppercase z-10">
          {isSelf ? "Dashboard Administrativo" : "Vista Pública de Creador"}
        </div>
      </div>

      {/* Profile Info Details Overlay row */}
      <div className="px-6 sm:px-8 pb-6 relative border-b border-slate-200/80 bg-slate-50 rounded-t-3xl -mt-6 z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between -mt-12 sm:-mt-16 mb-4 gap-4 z-10 relative" style={{ marginTop: '-16px', marginBottom: '0px' }}>
          <div className="flex items-end space-x-4">
            <div className="flex flex-col items-center shrink-0">
              <img
                src={profileUser.avatar}
                alt={profileUser.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-md bg-white shrink-0"
              />
              <span className="text-xs text-slate-500 font-bold font-mono mt-1 text-center">
                @{profileUser.username}
              </span>
            </div>
            <div className="pb-1">
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-950 flex items-center space-x-2">
                <span className="inline-block" style={{ paddingLeft: '18px' }}>{profileUser.name}</span>
                {!isSelf && (
                  <span className="bg-amber-500/10 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/25">
                    Verificado
                  </span>
                )}
              </h2>
              {/* Followers and Following counters */}
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-xs font-bold text-slate-900">
                  seguidores: {profileUser.followers.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-slate-900">
                  seguidos: {profileUser.following.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Call-to-actions / Session indicator */}
          <div className="sm:pb-1">
            {!isSelf && (
              <button
                onClick={() => onOpenDirectChat(profileUser)}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                id="message-creator-btn"
              >
                <Mail className="w-4 h-4 text-amber-500" />
                <span>Enviar Mensaje Privado</span>
              </button>
            )}
          </div>
        </div>

        {/* Biography summary (Max 50 chars) */}
        {profileUser.bio && (
          <div className="mt-3">
            <p className="text-xs text-slate-800 leading-relaxed font-medium max-w-sm break-words bg-white/90 border border-slate-200/80 rounded-xl px-3.5 py-2 shadow-xs">
              {profileUser.bio.length > 50 ? profileUser.bio.slice(0, 50) + "..." : profileUser.bio}
            </p>
          </div>
        )}

        {/* Horizontal Menu with Icons Only */}
        {isSelf && (
          <div className="mt-6 pt-4 border-t border-slate-200/60 flex justify-center">
            <div className="flex bg-slate-100 p-1.5 rounded-full space-x-4 shadow-inner">
              <button
                onClick={() => setActiveSubTab("publications")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "publications"
                    ? "bg-white text-amber-500 shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Mis Publicaciones"
                id="profile-subtab-publications"
              >
                <Play className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={() => setActiveSubTab("saved")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "saved"
                    ? "bg-white text-amber-500 shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Publicaciones Guardadas"
                id="profile-subtab-saved"
              >
                <Bookmark className="w-5 h-5" />
              </button>

              <button
                onClick={() => setActiveSubTab("orders")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "orders"
                    ? "bg-white text-amber-500 shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Historial de Compras"
                id="profile-subtab-orders"
              >
                <ShoppingBag className="w-5 h-5" />
              </button>

              <button
                onClick={() => setActiveSubTab("performance")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "performance"
                    ? "bg-white text-amber-500 shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Rendimiento"
                id="profile-subtab-performance"
              >
                <BarChart3 className="w-5 h-5" />
              </button>

              <button
                onClick={() => setActiveSubTab("broadcast")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "broadcast"
                    ? "bg-rose-500 text-white shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Transmitir En Vivo (Estudio del Emisor)"
                id="profile-subtab-broadcast"
              >
                <Radio className={`w-5 h-5 ${activeSubTab === "broadcast" ? "text-white" : "text-rose-500"} animate-pulse`} />
                {activeLiveSession && activeSubTab !== "broadcast" && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveSubTab("edit")}
                className={`p-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                  activeSubTab === "edit"
                    ? "bg-white text-amber-500 shadow-md scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
                title="Editar Perfil"
                id="profile-subtab-edit"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Inner Section tabs */}
      <div className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {isSelf ? (
            /* --- 1. ADMINISTRATIVE DASHBOARD VIEWS --- */
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <AnimatePresence mode="wait">
                {activeSubTab === "broadcast" && (
                  <motion.div
                    key="admin-broadcast-independent"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
                    id="broadcaster-studio-independent-panel"
                  >
                    {/* Floating Studio Header Overlay (Zero Wasted Vertical Space) */}
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
                        onClick={() => {
                          if (activeLiveSession) {
                            // Leave studio view but keep live stream session running in background
                          }
                          setActiveSubTab("publications");
                        }}
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
                    <div className="flex-1 overflow-y-auto p-3 sm:p-6 pt-14 sm:pt-14 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-7xl w-full mx-auto">
                      
                      {/* Left Side: Stream Video Feed & Title (7 Cols) */}
                      <div className="lg:col-span-7 space-y-4 flex flex-col">
                        
                        {/* Title Input */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                            Título de la Transmisión
                          </label>
                          <input
                            type="text"
                            disabled={!!activeLiveSession}
                            value={streamTitle}
                            onChange={(e) => setStreamTitle(e.target.value)}
                            placeholder="Escribe un título atractivo para tu directo..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-60 font-semibold"
                          />
                        </div>

                        {/* Camera Box */}
                        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center min-h-[250px]">
                          {cameraOn ? (
                            <>
                              <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${!hasMediaStream ? "hidden" : "block"}`}
                              />
                              {!hasMediaStream && (
                                <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950 p-6 text-center overflow-hidden">
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.15)_0,transparent_70%)] animate-pulse" />
                                  <div className="relative z-10 flex flex-col items-center space-y-2">
                                    <div className="relative">
                                      <img
                                        src={currentUser.avatar}
                                        alt={currentUser.name}
                                        className="w-20 h-20 rounded-full object-cover border-2 border-rose-500 shadow-xl shadow-rose-500/20"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className="absolute -bottom-1 -right-1 bg-rose-500 text-white p-1 rounded-full shadow-lg">
                                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                                      </span>
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-extrabold text-white">{currentUser.name}</h4>
                                      <p className="text-[11px] text-slate-300 font-medium mt-0.5">Señal de Audio y Avatar Activa</p>
                                    </div>
                                    <div className="bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 px-3 py-1 rounded-full backdrop-blur-md">
                                      💡 Sin webcam física detectada (Transmisión lista)
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex flex-col items-center text-slate-600 p-6 text-center">
                              <VideoOff className="w-14 h-14 mb-2 animate-pulse text-slate-700" />
                              <p className="text-xs font-bold text-slate-400">Cámara Desactivada</p>
                            </div>
                          )}

                          {/* Camera Overlay Controls */}
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-white/10 gap-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setCameraOn(!cameraOn)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                  cameraOn ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {cameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                                <span>{cameraOn ? "Cam On" : "Cam Off"}</span>
                              </button>

                              <button
                                onClick={() => setMicOn(!micOn)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                                  micOn ? "bg-slate-800 text-white hover:bg-slate-700" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                                <span>{micOn ? "Mic On" : "Mute"}</span>
                              </button>
                            </div>

                            {/* Start/Stop Live Button */}
                            {!activeLiveSession ? (
                              <button
                                onClick={handleStartLive}
                                className="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl flex items-center space-x-2 shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
                                id="btn-iniciar-directo-perfil"
                              >
                                <Sparkles className="w-4 h-4" />
                                <span>INICIAR TRANSMISIÓN</span>
                              </button>
                            ) : (
                              <button
                                onClick={handleStopLive}
                                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl flex items-center space-x-2 border border-rose-500 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                                id="btn-finalizar-directo-perfil"
                              >
                                <span>FINALIZAR TRANSMISIÓN</span>
                              </button>
                            )}
                          </div>

                          {/* Floating Reactions Overlay */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <AnimatePresence>
                              {reactions.map((r) => (
                                <motion.div
                                  key={r.id}
                                  initial={{ opacity: 1, y: 180, scale: 0.6, x: `${r.left}%` }}
                                  animate={{ opacity: 0, y: -120, scale: 1.5, rotate: r.rotate }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 2, ease: "easeOut" }}
                                  className="absolute text-3xl font-bold"
                                >
                                  {r.type === 'heart' && '❤️'}
                                  {r.type === 'flame' && '🔥'}
                                  {r.type === 'star' && '⭐'}
                                  {r.type === 'zap' && '⚡'}
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Broadcaster Chat */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col min-h-[200px]">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <h4 className="text-xs font-extrabold text-white flex items-center space-x-2">
                              <MessageCircle className="w-4 h-4 text-amber-500" />
                              <span>Chat en Vivo del Emisor</span>
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {liveChatMessages.length} mensajes
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1 max-h-48">
                            {liveChatMessages.map((msg, i) => (
                              <div key={i} className="text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-start space-x-2">
                                <span className="font-bold text-amber-400 shrink-0">@{msg.senderName}:</span>
                                <span className="text-slate-200">{msg.text}</span>
                              </div>
                            ))}

                            {liveChatMessages.length === 0 && (
                              <div className="py-8 text-center text-slate-500">
                                <p className="text-xs">Los mensajes de tus espectadores aparecerán aquí.</p>
                              </div>
                            )}
                          </div>

                          {activeLiveSession && (
                            <form onSubmit={handleSendBroadcasterChat} className="flex space-x-2 pt-3 border-t border-slate-800">
                              <input
                                type="text"
                                placeholder="Enviar mensaje como emisor..."
                                value={liveChatInput}
                                onChange={(e) => setLiveChatInput(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                              />
                              <button
                                type="submit"
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl font-extrabold text-xs cursor-pointer flex items-center space-x-1"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Responder</span>
                              </button>
                            </form>
                          )}
                        </div>

                      </div>

                      {/* Right Side: Tarjeta de Gestión de Usuarios del Emisor (5 Cols) */}
                      <div className="lg:col-span-5 space-y-4 flex flex-col">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 flex flex-col">
                          
                          {/* User Management Card Header */}
                          <div className="pb-3 border-b border-slate-800">
                            <div className="flex items-center justify-between">
                              <h3 className="font-display font-extrabold text-xs text-white uppercase tracking-wider flex items-center space-x-2">
                                <Users className="w-4 h-4 text-amber-500" />
                                <span>Tarjeta de Gestión de Usuarios</span>
                              </h3>
                              <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                                {users.length} Registrados
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Asigna moderadores, otorga estatus VIP, silencia o expulsa usuarios del directo.
                            </p>
                          </div>

                          {/* Search Input */}
                          <div className="mt-3 relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                )}

                {activeSubTab === "publications" && (
                  <motion.div
                    key="admin-publications"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                        <Play className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                        <span>Mis Publicaciones ({userReels.length})</span>
                      </h3>
                      <button
                        onClick={() => setActiveSubTab("publish")}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-sans text-xs rounded-lg transition-all duration-200 shadow-sm shadow-amber-500/10 cursor-pointer"
                        id="btn-publicar-contenido"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Publicar</span>
                      </button>
                    </div>

                    {userReels.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                        <Play className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-500">No has compartido ninguna publicación aún</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tus videos publicados aparecerán en esta sección.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {userReels.map((reel) => (
                          <div
                            key={reel.id}
                            onClick={() => onSelectReel(reel.id)}
                            className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                            id={`admin-my-reel-${reel.id}`}
                          >
                            {reel.type === "video" && (!reel.thumbnailUrl || reel.thumbnailUrl.includes("photo-1618005182384")) ? (
                              <video
                                src={reel.videoUrl}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={reel.thumbnailUrl || reel.images?.[0] || reel.videoUrl}
                                alt="Portada publicación"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                            
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                              <span className="flex items-center space-x-0.5">
                                <Eye className="w-3 h-3 text-slate-200" />
                                <span>{reel.views}</span>
                              </span>
                              <span className="flex items-center space-x-0.5">
                                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                                <span>{reel.likes}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeSubTab === "publish" && (
                  <motion.div
                    key="admin-publish"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PublishView
                      currentUser={currentUser}
                      onBack={() => setActiveSubTab("publications")}
                      onSuccess={() => {
                        if (activeUserId) {
                          setLoading(true);
                          fetch(`/api/users/${activeUserId}`)
                            .then((res) => res.json())
                            .then((data) => {
                              if (!data.error) {
                                setProfileUser(data.user);
                                setUserProducts(data.products || []);
                                setUserReels(data.reels || []);
                                setUserOrders(data.orders || []);
                                setSavedReels(data.savedReels || []);
                              }
                              setLoading(false);
                              setActiveSubTab("publications");
                            })
                            .catch(() => {
                              setLoading(false);
                              setActiveSubTab("publications");
                            });
                        } else {
                          setActiveSubTab("publications");
                        }
                      }}
                      userProducts={userProducts}
                    />
                  </motion.div>
                )}

                {activeSubTab === "saved" && (
                  <motion.div
                    key="admin-saved"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                      <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                      <span>Publicaciones Guardadas ({savedReels.length})</span>
                    </h3>

                    {savedReels.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                        <Bookmark className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-500">No tienes publicaciones guardadas</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Guarda publicaciones desde la sección de Reels para verlas aquí.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {savedReels.map((reel) => (
                          <div
                            key={reel.id}
                            onClick={() => onSelectReel(reel.id)}
                            className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                            id={`saved-reel-${reel.id}`}
                          >
                            {reel.type === "video" && (!reel.thumbnailUrl || reel.thumbnailUrl.includes("photo-1618005182384") || reel.thumbnailUrl === reel.videoUrl || reel.thumbnailUrl.endsWith(".mp4")) ? (
                              <video
                                src={reel.videoUrl || reel.thumbnailUrl}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={reel.thumbnailUrl || reel.images?.[0] || reel.videoUrl}
                                alt="Portada publicación guardada"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                            
                            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>@{reel.creatorUsername || reel.creatorName}</span>
                            </div>

                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                              <span className="flex items-center space-x-0.5">
                                <Eye className="w-3 h-3 text-slate-200" />
                                <span>{reel.views}</span>
                              </span>
                              <span className="flex items-center space-x-0.5">
                                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                                <span>{reel.likes}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeSubTab === "orders" && (
                  <motion.div
                    key="admin-orders"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <span>Historial de Mis Compras Recientes</span>
                    </h3>

                    <div className="space-y-3">
                      {userOrders.length === 0 ? (
                        <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                          <ShoppingBag className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                          <p className="text-xs font-semibold text-slate-500">No hay transacciones registradas</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Tus pedidos de e-commerce se mostrarán aquí en tiempo real.</p>
                        </div>
                      ) : (
                        userOrders.map((order) => (
                          <div
                            key={order.id}
                            className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            id={`order-item-${order.id}`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-0.5">
                                  <ShieldCheck className="w-3 h-3" /> <span>Transacción Aprobada</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold">Ref: {order.id}</span>
                              </div>
                              
                              {/* Order items list summary */}
                              <div className="text-xs font-semibold text-slate-800 pt-1">
                                {order.items.map((it) => `${it.name} (x${it.quantity})`).join(", ")}
                              </div>
                              
                              <div className="text-[10px] text-slate-500 flex items-center space-x-1.5">
                                <span>Entregar en: {order.shippingAddress}</span>
                                <span>•</span>
                                <span className="font-mono">{new Date(order.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="text-right sm:border-l sm:border-slate-200/80 sm:pl-6 shrink-0 flex sm:flex-col justify-between items-center sm:items-end">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Cargado</span>
                              <span className="text-base font-extrabold font-mono text-slate-900 mt-0.5">${order.total.toFixed(2)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {activeSubTab === "performance" && (
                  <motion.div
                    key="admin-performance"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-amber-500" />
                      <span>Rendimiento de Mis Publicaciones (Views / Likes)</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Views count */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visualizaciones</span>
                          <span className="text-lg font-extrabold text-slate-900 font-mono">14,750</span>
                        </div>
                      </div>

                      {/* Likes count */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
                        <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                          <Heart className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Likes Recibidos</span>
                          <span className="text-lg font-extrabold text-slate-900 font-mono">4,457</span>
                        </div>
                      </div>

                      {/* Comments count */}
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Comentarios</span>
                          <span className="text-lg font-extrabold text-slate-900 font-mono">92</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeSubTab === "edit" && (
                  <motion.div
                    key="admin-edit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6"
                  >
                      <div>
                        <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                          <Settings className="w-4 h-4 text-amber-500" />
                          <span>Configuración y Edición de Perfil</span>
                        </h3>

                        <form onSubmit={handleSaveProfile} className="space-y-6 bg-slate-50 border border-slate-100 p-6 rounded-2xl" id="edit-profile-form">
                          {saveSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center space-x-2 animate-pulse">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>¡Perfil guardado y sincronizado con éxito! Todos los cambios están activos.</span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Name Input */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre Completo</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                                placeholder="Tu Nombre"
                                required
                              />
                            </div>

                            {/* Username Input */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre de Usuario (Username)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">@</span>
                                <input
                                  type="text"
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                                  placeholder="nombre_usuario"
                                  required
                                />
                              </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contraseña de Perfil (Para Blindaje)</label>
                              <input
                                type="password"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                                placeholder="Ingresa una contraseña segura"
                                required
                              />
                            </div>

                            {/* Bio Input */}
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Biografía / Descripción del Canal</label>
                              <textarea
                                value={editBio}
                                onChange={(e) => setEditBio(e.target.value)}
                                rows={3}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none"
                                placeholder="Cuéntale a tu audiencia sobre ti..."
                                required
                              />
                            </div>

                            {/* Avatar Image URL Input & Presets */}
                            <div className="space-y-2.5">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Imagen de Perfil</label>
                                <div className="flex items-center space-x-4 bg-white p-3 border border-slate-200 rounded-xl">
                                  <img
                                    src={editAvatar}
                                    alt="Previsualización"
                                    className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="flex-1">
                                    <input
                                      type="file"
                                      id="avatar-file-input"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            if (typeof reader.result === "string") {
                                              setEditAvatar(reader.result);
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor="avatar-file-input"
                                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200"
                                    >
                                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Subir Foto de Galería</span>
                                    </label>
                                    <p className="text-[9px] text-slate-400 mt-1">Sube un archivo PNG, JPG o GIF</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Presets */}
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">O bien, elige un estilo rápido:</span>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { name: "Hombre Tech", url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80" },
                                    { name: "Mujer Fit", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" },
                                    { name: "Cyber Maker", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80" },
                                    { name: "Elegante", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" }
                                  ].map((preset, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setEditAvatar(preset.url)}
                                      className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all flex items-center space-x-1 cursor-pointer ${
                                        editAvatar === preset.url
                                          ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      <img src={preset.url} alt="" className="w-3.5 h-3.5 rounded-full object-cover" referrerPolicy="no-referrer" />
                                      <span>{preset.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Cover Image URL Input & Presets */}
                            <div className="space-y-2.5">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Foto de Portada / Banner</label>
                                <div className="flex items-center space-x-4 bg-white p-3 border border-slate-200 rounded-xl">
                                  <div className="w-16 h-10 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                    <img
                                      src={editCoverPhoto}
                                      alt="Previsualización de portada"
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <input
                                      type="file"
                                      id="cover-file-input"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                            if (typeof reader.result === "string") {
                                              setEditCoverPhoto(reader.result);
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor="cover-file-input"
                                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer border border-slate-200"
                                    >
                                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Subir Foto de Galería</span>
                                    </label>
                                    <p className="text-[9px] text-slate-400 mt-1">Sube una imagen horizontal</p>
                                  </div>
                                </div>
                              </div>

                              {/* Presets */}
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">O bien, elige un estilo rápido:</span>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    { name: "Abstracto Violeta", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" },
                                    { name: "Neon Synth", url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80" },
                                    { name: "Cosmic Glow", url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80" },
                                    { name: "Minimalist Dark", url: "https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?auto=format&fit=crop&w=800&q=80" }
                                  ].map((preset, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setEditCoverPhoto(preset.url)}
                                      className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition-all flex items-center space-x-1 cursor-pointer ${
                                        editCoverPhoto === preset.url
                                          ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="w-3.5 h-2 rounded bg-slate-200 overflow-hidden shrink-0">
                                        <img src={preset.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      </div>
                                      <span>{preset.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Submit Actions Button */}
                          <div className="pt-4 border-t border-slate-200/60 flex items-center justify-end space-x-3">
                            <button
                              type="button"
                              onClick={() => setActiveSubTab("publications")}
                              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-transparent rounded-xl transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={isSaving}
                              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 font-extrabold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                            >
                              {isSaving ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Guardando...</span>
                                </>
                              ) : (
                                <span>Guardar y Aplicar Cambios</span>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>

                    {false && (
                      <div className="space-y-6 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                            <Users className="w-4 h-4 text-amber-500" />
                            <span>Registrar Nuevo Creador (MongoDB Atlas)</span>
                          </h3>
                          <p className="text-xs text-slate-500 font-semibold">
                            Crea una cuenta para un nuevo creador de contenido. Se registrará en tiempo real en MongoDB Atlas.
                          </p>
                        </div>

                        {registerSuccess && (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center space-x-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>¡Nuevo creador registrado con éxito en MongoDB Atlas! Ya puedes cambiar de cuenta para usarlo.</span>
                          </div>
                        )}

                        {registerError && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl">
                            <span>{registerError}</span>
                          </div>
                        )}

                        <form onSubmit={handleRegisterUser} className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Reg Name */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre del Creador</label>
                              <input
                                type="text"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                                placeholder="Ej: Carlos Gómez"
                                required
                              />
                            </div>

                            {/* Reg Username */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre de Usuario (Username)</label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">@</span>
                                <input
                                  type="text"
                                  value={regUsername}
                                  onChange={(e) => setRegUsername(e.target.value)}
                                  className="w-full text-xs font-semibold pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                                  placeholder="carlos_gomez"
                                  required
                                />
                              </div>
                            </div>

                            {/* Reg Password */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contraseña Inicial</label>
                              <input
                                type="password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                                placeholder="Crea una contraseña"
                                required
                              />
                            </div>

                            {/* Reg Bio */}
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Biografía / Presentación</label>
                              <textarea
                                value={regBio}
                                onChange={(e) => setRegBio(e.target.value)}
                                rows={2}
                                className="w-full text-xs font-semibold px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none"
                                placeholder="Escribe algo sobre este nuevo creador..."
                              />
                            </div>

                            {/* Reg Avatar Upload */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Imagen de Perfil</label>
                              <div className="flex items-center space-x-3 bg-white p-2.5 border border-slate-200 rounded-xl">
                                <img
                                  src={regAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                                  alt="Preview avatar"
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="flex-1">
                                  <input
                                    type="file"
                                    id="reg-avatar-file-input"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === "string") {
                                            setRegAvatar(reader.result);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor="reg-avatar-file-input"
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-slate-200"
                                  >
                                    <Camera className="w-3 h-3 text-slate-500" />
                                    <span>Elegir Foto</span>
                                  </label>
                                </div>
                              </div>
                            </div>

                            {/* Reg Cover Photo Upload */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Foto de Portada</label>
                              <div className="flex items-center space-x-3 bg-white p-2.5 border border-slate-200 rounded-xl">
                                <div className="w-12 h-8 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                  <img
                                    src={regCoverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"}
                                    alt="Preview cover"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="file"
                                    id="reg-cover-file-input"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === "string") {
                                            setRegCoverPhoto(reader.result);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <label
                                    htmlFor="reg-cover-file-input"
                                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-slate-200"
                                  >
                                    <Camera className="w-3 h-3 text-slate-500" />
                                    <span>Elegir Banner</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200/60 flex items-center justify-end space-x-3">
                            <button
                              type="submit"
                              disabled={isRegistering}
                              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 font-extrabold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                            >
                              {isRegistering ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                  <span>Registrando en MongoDB...</span>
                                </>
                              ) : (
                                <span>Registrar Creador</span>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {false && (
                      <div className="space-y-6 bg-slate-50 border border-slate-100 p-6 rounded-2xl">
                        <div>
                          <h3 className="font-display font-extrabold text-sm text-slate-900 mb-1 flex items-center space-x-2">
                            <Users className="w-4 h-4 text-amber-500" />
                            <span>Cambiar de Cuenta / Sesión Activa</span>
                          </h3>
                          <p className="text-xs text-slate-500 font-semibold">
                            Inicia sesión o cámbiate al perfil de cualquiera de los siguientes creadores de la plataforma. El perfil seleccionado se convertirá en la sesión activa y guardará sus datos a través de la API.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {users
                            .filter((u) => u.id !== "current_user" && u.username !== "invitado")
                            .map((u) => {
                              const isTargetSelected = switchingUser?.id === u.id;
                              return (
                                <div
                                  key={u.id}
                                  className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500/50 hover:shadow-sm transition-all"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center space-x-3">
                                      <img
                                        src={u.avatar}
                                        alt={u.name}
                                        className="w-10 h-10 rounded-full object-cover border border-slate-150 shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-800">{u.name}</h4>
                                        <p className="text-[10px] text-slate-500 font-semibold">@{u.username}</p>
                                      </div>
                                    </div>

                                    {!isTargetSelected && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSwitchingUser(u);
                                          setSwitchPassword("");
                                          setSwitchError("");
                                        }}
                                        className="px-3 py-1.5 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                      >
                                        Entrar
                                      </button>
                                    )}
                                  </div>

                                  {isTargetSelected && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 w-full">
                                      <label className="text-[9px] font-bold text-slate-500 block uppercase mb-1">
                                        Contraseña de @{u.username}:
                                      </label>
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="password"
                                          value={switchPassword}
                                          onChange={(e) => setSwitchPassword(e.target.value)}
                                          placeholder="Contraseña"
                                          className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              handleSwitchUser(u.username, switchPassword);
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSwitchUser(u.username, switchPassword)}
                                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-all cursor-pointer shrink-0"
                                        >
                                          Confirmar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSwitchingUser(null);
                                            setSwitchPassword("");
                                            setSwitchError("");
                                          }}
                                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer shrink-0"
                                        >
                                          X
                                        </button>
                                      </div>
                                      {switchError && (
                                        <p className="text-[10px] text-rose-500 mt-1 font-semibold font-mono">
                                          ⚠️ {switchError}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* --- 2. PUBLIC CREATOR PROFILE VIEW --- */
            <motion.div
              key="creator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Creator's Video Reels listing */}
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                    <Play className="w-4 h-4 text-rose-500" />
                    <span>Publicaciones de {profileUser.name}</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {userReels.map((reel) => (
                      <div
                        key={reel.id}
                        onClick={() => onSelectReel(reel.id)}
                        className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900"
                        id={`profile-reel-${reel.id}`}
                      >
                        {reel.type === "video" && (!reel.thumbnailUrl || reel.thumbnailUrl.includes("photo-1618005182384")) ? (
                          <video
                            src={reel.videoUrl}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={reel.thumbnailUrl || reel.images?.[0] || reel.videoUrl}
                            alt="Portada publicación"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                        
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                          <span className="flex items-center space-x-0.5">
                            <Eye className="w-3 h-3 text-slate-200" />
                            <span>{reel.views}</span>
                          </span>
                          <span className="flex items-center space-x-0.5">
                            <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                            <span>{reel.likes}</span>
                          </span>
                        </div>
                      </div>
                    ))}

                    {userReels.length === 0 && (
                      <div className="col-span-2 py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        No hay videos compartidos por este creador.
                      </div>
                    )}
                  </div>
                </div>

                {/* Creator's Products list */}
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    <span>Catálogo de Productos en Venta</span>
                  </h3>

                  <div className="space-y-3">
                    {userProducts.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => onSelectProduct(prod)}
                        className="flex items-center space-x-3 p-2.5 rounded-xl border border-slate-150 hover:border-amber-500/30 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all"
                        id={`profile-prod-${prod.id}`}
                      >
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                          <p className="text-[10px] text-slate-500 truncate">{prod.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs font-extrabold font-mono text-emerald-600">${prod.price.toFixed(2)}</span>
                            <span className="text-[9px] text-amber-600 font-bold">Ver detalles →</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {userProducts.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        Este creador no tiene productos a la venta actualmente.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Background Live Banner when minimized */}
      {activeLiveSession && activeSubTab !== "broadcast" && (
        <div className="fixed bottom-20 right-4 z-40 bg-slate-950/90 border border-rose-500/50 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-3 backdrop-blur-md animate-bounce">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-xs font-bold text-rose-400">Transmisión Activa en Segundo Plano</span>
          </div>
          <button
            onClick={() => setActiveSubTab("broadcast")}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 flex items-center space-x-1"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Volver al Estudio</span>
          </button>
        </div>
      )}
    </div>
  );
}
