import React, { useState, useEffect } from "react";
import { User, Product, Reel, Order } from "../types";
import { Eye, Heart, MessageCircle, BarChart3, ShoppingBag, ShieldCheck, Mail, Users, ArrowUpRight, Play, Star, Bookmark, Settings, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  const [activeSubTab, setActiveSubTab] = useState<"publications" | "saved" | "orders" | "performance" | "edit">("publications");

  // Edit profile states
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editCoverPhoto, setEditCoverPhoto] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // States for sub-sections inside the Edit Profile tab
  const [editSection, setEditSection] = useState<"edit_self" | "register_new" | "switch_account">("edit_self");
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("");
  const [regCoverPhoto, setRegCoverPhoto] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    if (profileUser && isSelf) {
      setEditName(profileUser.name);
      setEditUsername(profileUser.username);
      setEditBio(profileUser.bio);
      setEditAvatar(profileUser.avatar);
      setEditCoverPhoto(profileUser.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80");
    }
  }, [profileUser, isSelf]);

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
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRegisterError(data.error || "Error al registrar el usuario");
        return;
      }
      if (data.success) {
        setRegisterSuccess(true);
        setRegName("");
        setRegUsername("");
        setRegBio("");
        setRegAvatar("");
        setRegCoverPhoto("");
        if (onRefreshUsers) {
          onRefreshUsers();
        }
        setTimeout(() => setRegisterSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error registering user:", err);
      setRegisterError("Error de conexión con el servidor.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSwitchUser = async (targetUsername: string) => {
    try {
      const response = await fetch("/api/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        if (onRefreshUsers) {
          onRefreshUsers();
        }
        onBackToSelf();
      }
    } catch (err) {
      console.error("Error switching account:", err);
    }
  };

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
  }, [activeUserId]);

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
      <div className="px-8 pb-6 relative border-b border-slate-100 bg-slate-50">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 mb-4 sm:space-x-6 z-10 relative">
          <img
            src={profileUser.avatar}
            alt={profileUser.name}
            referrerPolicy="no-referrer"
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-md bg-white shrink-0"
          />

          <div className="flex-1 mt-4 sm:mt-0">
            <h2 className="font-display font-extrabold text-xl text-slate-950 flex items-center space-x-2">
              <span>{profileUser.name}</span>
              {!isSelf && (
                <span className="bg-amber-500/10 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/25">
                  Verificado
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">@{profileUser.username}</p>
          </div>

          {/* Call-to-actions */}
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">
            {!isSelf ? (
              <button
                onClick={() => onOpenDirectChat(profileUser)}
                className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                id="message-creator-btn"
              >
                <Mail className="w-4 h-4 text-amber-500" />
                <span>Enviar Mensaje Privado</span>
              </button>
            ) : (
              <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ID: current_user</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats and biography summary */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Bio text */}
          <div className="md:col-span-3">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">{profileUser.bio}</p>
          </div>

          {/* Social Counts */}
          <div className="md:col-span-2 flex items-center space-x-6 border-l border-slate-200/60 pl-6">
            <div className="text-center">
              <span className="text-xl font-extrabold text-slate-900 block font-mono">
                {profileUser.followers.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Seguidores</span>
            </div>
            <div className="text-center">
              <span className="text-xl font-extrabold text-slate-900 block font-mono">
                {profileUser.following.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">Seguidos</span>
            </div>
          </div>
        </div>

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
                {activeSubTab === "publications" && (
                  <motion.div
                    key="admin-publications"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                      <Play className="w-4 h-4 text-amber-500 fill-amber-500/10" />
                      <span>Mis Publicaciones ({userReels.length})</span>
                    </h3>

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
                            <img
                              src={reel.thumbnailUrl}
                              alt="Reel thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
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
                            <img
                              src={reel.thumbnailUrl}
                              alt="Reel thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                            
                            <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>@{reel.creatorName}</span>
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
                    {/* Internal Navigation Sub-tabs */}
                    <div className="flex border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => setEditSection("edit_self")}
                        className={`pb-3 text-xs font-bold px-4 -mb-px border-b-2 transition-all cursor-pointer ${
                          editSection === "edit_self"
                            ? "border-amber-500 text-slate-900 font-extrabold"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        Editar Mi Perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSection("register_new")}
                        className={`pb-3 text-xs font-bold px-4 -mb-px border-b-2 transition-all cursor-pointer ${
                          editSection === "register_new"
                            ? "border-amber-500 text-slate-900 font-extrabold"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        Registrar Nuevo Creador (MongoDB)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSection("switch_account")}
                        className={`pb-3 text-xs font-bold px-4 -mb-px border-b-2 transition-all cursor-pointer ${
                          editSection === "switch_account"
                            ? "border-amber-500 text-slate-900 font-extrabold"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        Cambiar de Cuenta / Sesión
                      </button>
                    </div>

                    {editSection === "edit_self" && (
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
                    )}

                    {editSection === "register_new" && (
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

                    {editSection === "switch_account" && (
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
                            .filter((u) => u.id !== "current_user")
                            .map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500/50 hover:shadow-sm transition-all"
                              >
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

                                <button
                                  type="button"
                                  onClick={() => handleSwitchUser(u.username)}
                                  className="px-3 py-1.5 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
                                >
                                  Entrar
                                </button>
                              </div>
                            ))}
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
                        <img
                          src={reel.thumbnailUrl}
                          alt="Reel thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
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
    </div>
  );
}
