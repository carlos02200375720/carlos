import React, { useState } from "react";
import { User, Reel, Product, Order } from "../../types";
import { Play, ShoppingBag, Bookmark, Settings, LogOut, Edit3, Grid, Camera, Check, Sparkles, UserPlus, UserCheck, X, ExternalLink, Package, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { androidApiFetch } from "./api";
import AndroidUserPublicationsFeed from "./components/AndroidUserPublicationsFeed";
import AndroidPublishView from "./PublishView";
import AndroidLoginView from "./LoginView";

export interface AndroidProfileViewProps {
  user?: User;
  currentUser: User;
  selectedCreatorId?: string | null;
  users?: User[];
  reels?: Reel[];
  products?: Product[];
  onLogout: () => void;
  onSelectProduct?: (product: Product) => void;
  onSelectReel?: (reel: Reel | string) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onProfileUpdate?: (updatedUser: User) => void;
  onToggleFollowUser?: (creatorId: string) => void;
  onOpenSocial?: () => void;
  unreadCount?: number;
  onOpenPublishModal?: () => void;
  isCurrentUserProfile?: boolean;
  onNavigateToLogin?: () => void;
  onDeleteReel?: (reelId: string) => void;
  onUpdateReels?: (reels: Reel[]) => void;
  onUpdateProducts?: (products: Product[]) => void;
  savedReelIds?: string[];
  onToggleSaveReel?: (reelId: string) => void;
  orders?: Order[];
  onUpdateOrders?: (orders: Order[]) => void;
  onBackToSelf?: () => void;
  onOpenDirectChat?: (targetUser: User) => void;
  onRefreshUsers?: () => void;
  onPublishSuccess?: () => void;
  socket?: WebSocket | null;
}

type TabType = "reels" | "products" | "saved" | "orders";

export default function AndroidProfileView({
  user: directUser,
  currentUser,
  selectedCreatorId,
  users = [],
  reels = [],
  products = [],
  onLogout,
  onSelectProduct,
  onSelectReel,
  onUpdateUser,
  onProfileUpdate,
  onToggleFollowUser,
  onOpenPublishModal,
  onDeleteReel,
  savedReelIds = [],
  onToggleSaveReel,
  orders = [],
  onBackToSelf,
  onOpenDirectChat,
  onRefreshUsers,
  onPublishSuccess,
}: AndroidProfileViewProps) {
  // Determine who we are viewing
  const activeUser =
    directUser ||
    (selectedCreatorId ? users.find((u) => u.id === selectedCreatorId) : null) ||
    currentUser;

  const [activeTab, setActiveTab] = useState<TabType>("reels");
  const [selectedFeedReelId, setSelectedFeedReelId] = useState<string | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPublishingOpen, setIsPublishingOpen] = useState(false);

  // Edit profile form
  const [editName, setEditName] = useState(activeUser.name);
  const [editBio, setEditBio] = useState(activeUser.bio || "");
  const [editAvatar, setEditAvatar] = useState(activeUser.avatar);
  const [isSaving, setIsSaving] = useState(false);

  const isMe = activeUser.id === currentUser.id || activeUser.username === currentUser.username;
  const isGuest = activeUser.isGuest || activeUser.username === "invitado" || activeUser.id === "guest" || (isMe && (!currentUser || currentUser.isGuest || currentUser.username === "invitado" || currentUser.id === "guest"));

  if (isMe && isGuest) {
    return (
      <AndroidLoginView
        users={users}
        onRefreshUsers={onRefreshUsers || (() => {})}
        onLoginSuccess={(loggedUser) => {
          if (onProfileUpdate) onProfileUpdate(loggedUser);
          if (onUpdateUser) onUpdateUser(loggedUser);
          if (onRefreshUsers) onRefreshUsers();
        }}
      />
    );
  }

  const isFollowing = currentUser?.followingUserIds?.includes(activeUser.id) || false;

  const [extraPublications, setExtraPublications] = useState<Reel[]>([]);

  // Fetch real publications and reels from MongoDB Atlas for this user
  React.useEffect(() => {
    const targetId = activeUser.originalId || activeUser.id || activeUser.username;
    if (!targetId || targetId === "invitado") return;

    androidApiFetch(`/users/${targetId}/publications`)
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          const apiReels: Reel[] = [];
          if (Array.isArray(data.reels)) {
            apiReels.push(...data.reels);
          }
          if (Array.isArray(data.publicaciones)) {
            data.publicaciones.forEach((pub: any) => {
              if (pub.url) {
                apiReels.push({
                  id: pub.id,
                  videoUrl: pub.url,
                  thumbnailUrl: pub.thumbnailUrl || pub.url,
                  description: pub.title || pub.description || "Publicación",
                  creatorId: pub.creatorId || activeUser.id,
                  creatorName: activeUser.name,
                  creatorUsername: activeUser.username,
                  creatorAvatar: activeUser.avatar,
                  likes: pub.likes || 0,
                  likedBy: [],
                  comments: [],
                  shares: 0,
                  saves: 0,
                  views: 0,
                  type: "video",
                });
              }
            });
          }
          if (apiReels.length > 0) {
            setExtraPublications(apiReels);
          }
        }
      })
      .catch(() => {});
  }, [activeUser.id, activeUser.originalId, activeUser.username]);

  const userReels = React.useMemo(() => {
    const activeIds = [activeUser.id, activeUser.originalId].filter(Boolean);
    const primary = reels.filter((r) => {
      if (r.creatorId && activeIds.includes(r.creatorId)) return true;
      if (r.creatorUsername && activeUser.username && r.creatorUsername.toLowerCase() === activeUser.username.toLowerCase()) return true;
      if (isMe && (r.creatorId === "current_user" || (currentUser.username && r.creatorUsername?.toLowerCase() === currentUser.username.toLowerCase()))) return true;
      return false;
    });

    const map = new Map<string, Reel>();
    primary.forEach((r) => map.set(r.id, r));
    extraPublications.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, r);
    });
    return Array.from(map.values());
  }, [reels, extraPublications, activeUser.id, activeUser.originalId, activeUser.username, isMe, currentUser.username]);

  const userProducts = React.useMemo(() => {
    const activeIds = [activeUser.id, activeUser.originalId].filter(Boolean);
    return products.filter((p) => {
      if (p.sellerId && activeIds.includes(p.sellerId)) return true;
      if (p.sellerUsername && activeUser.username && p.sellerUsername.toLowerCase() === activeUser.username.toLowerCase()) return true;
      if (isMe && (p.sellerId === "current_user" || (currentUser.username && p.sellerUsername?.toLowerCase() === currentUser.username.toLowerCase()))) return true;
      return false;
    });
  }, [products, activeUser.id, activeUser.originalId, activeUser.username, isMe, currentUser.username]);

  const savedReels = reels.filter((r) => savedReelIds.includes(r.id));
  const userOrders = orders.filter((o) => o.buyerId === activeUser.id || o.buyerId === currentUser.id);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await androidApiFetch("/users/current/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeUser.originalId || activeUser.id,
          name: editName.trim(),
          bio: editBio.trim(),
          avatar: editAvatar,
        }),
      });

      if (res.ok) {
        const updated = { ...activeUser, name: editName.trim(), bio: editBio.trim(), avatar: editAvatar };
        if (onProfileUpdate) onProfileUpdate(updated);
        if (onUpdateUser) onUpdateUser(updated);
        setIsEditProfileOpen(false);
      }
    } catch (err) {
      console.error("Failed to update profile on Android:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none pb-24" id="android-profile-view">
      {/* Cover and Header */}
      <div className="relative w-full h-36 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300">
        {activeUser.coverPhoto && (
          <img src={activeUser.coverPhoto} alt="Cover" className="w-full h-full object-cover opacity-60" />
        )}
        <div className="absolute top-8 right-4 flex items-center space-x-2">
          {!isMe && onBackToSelf && (
            <button
              onClick={onBackToSelf}
              className="px-3 py-1.5 rounded-full bg-black/40 text-xs font-semibold text-white backdrop-blur-md active:scale-95 cursor-pointer shadow-sm"
            >
              Mi Perfil
            </button>
          )}
          {isMe ? (
            <button
              onClick={onLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-rose-200 backdrop-blur-md flex items-center justify-center active:scale-95 cursor-pointer transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Profile Bio Section */}
      <div className="px-4 relative -mt-12">
        <div className="flex items-end justify-between">
          <div className="relative">
            <img
              src={activeUser.avatar}
              alt={activeUser.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl bg-white"
            />
          </div>

          <div className="flex space-x-2 pb-2">
            {isMe ? (
              <>
                <button
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 border border-slate-200 active:scale-95 transition-transform cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => (onOpenPublishModal ? onOpenPublishModal() : setIsPublishingOpen(true))}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publicar</span>
                </button>
              </>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => onToggleFollowUser?.(activeUser.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 active:scale-95 transition-all cursor-pointer ${
                    isFollowing
                      ? "bg-slate-100 text-slate-700 border border-slate-300"
                      : "bg-amber-500 text-slate-950 shadow-sm"
                  }`}
                >
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isFollowing ? "Siguiendo" : "Seguir"}</span>
                </button>
                {onOpenDirectChat && (
                  <button
                    onClick={() => onOpenDirectChat(activeUser)}
                    className="px-3 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-200 active:scale-95 cursor-pointer"
                  >
                    Mensaje
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h1 className="text-lg font-black text-slate-900">{activeUser.name}</h1>
          <p className="text-xs text-amber-600 font-semibold">@{activeUser.username}</p>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{activeUser.bio || "Creador en MallSocial Android"}</p>
        </div>

        {/* Stats Row */}
        <div className="flex items-center space-x-6 mt-4 py-3 border-y border-slate-100 bg-slate-50/70 rounded-2xl text-center">
          <div className="flex-1">
            <span className="block text-sm font-bold text-slate-900">{userReels.length}</span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Reels</span>
          </div>
          <div className="flex-1 border-x border-slate-200">
            <span className="block text-sm font-bold text-slate-900">{typeof activeUser.followers === 'number' ? activeUser.followers : 0}</span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Seguidores</span>
          </div>
          <div className="flex-1">
            <span className="block text-sm font-bold text-slate-900">{typeof activeUser.following === 'number' ? activeUser.following : 0}</span>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Siguiendo</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mt-2 px-2">
        <button
          onClick={() => setActiveTab("reels")}
          title={`Reels (${userReels.length})`}
          aria-label="Reels"
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center border-b-2 transition-all cursor-pointer ${
            activeTab === "reels" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <Grid className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab("products")}
          title={`Tienda (${userProducts.length})`}
          aria-label="Tienda"
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center border-b-2 transition-all cursor-pointer ${
            activeTab === "products" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <ShoppingBag className="w-5 h-5" />
        </button>

        {isMe && (
          <button
            onClick={() => setActiveTab("saved")}
            title="Guardados"
            aria-label="Guardados"
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === "saved" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>
        )}

        {isMe && (
          <button
            onClick={() => setActiveTab("orders")}
            title="Pedidos"
            aria-label="Pedidos"
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center border-b-2 transition-all cursor-pointer ${
              activeTab === "orders" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Package className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === "reels" && (
          <div className="grid grid-cols-3 gap-2">
            {userReels.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-xs text-slate-400">
                Aún no has publicado ningún Reel en Android.
              </div>
            ) : (
              userReels.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    if (onSelectReel) onSelectReel(reel);
                    setSelectedFeedReelId(reel.id);
                  }}
                  className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer group active:scale-95 transition-transform"
                >
                  <img
                    src={reel.thumbnailUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80"}
                    alt={reel.description || "Reel"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[10px] font-bold text-white line-clamp-1">{reel.description || "Reel"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "products" && (
          <div className="grid grid-cols-2 gap-3">
            {userProducts.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-xs text-slate-400">
                No hay productos en esta tienda.
              </div>
            ) : (
              userProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectProduct?.(p)}
                  className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between cursor-pointer hover:border-amber-300 transition-colors"
                >
                  <img src={p.imageUrl} alt={p.name} className="w-full aspect-square rounded-xl object-cover mb-2" />
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</h4>
                  <p className="text-xs font-black text-amber-600 mt-1">${p.price.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div className="grid grid-cols-3 gap-2">
            {savedReels.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-xs text-slate-400">
                No tienes Reels guardados en Android.
              </div>
            ) : (
              savedReels.map((reel) => (
                <div
                  key={reel.id}
                  onClick={() => {
                    if (onSelectReel) onSelectReel(reel);
                    setSelectedFeedReelId(reel.id);
                  }}
                  className="relative aspect-[9/16] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer active:scale-95 transition-transform"
                >
                  <img
                    src={reel.thumbnailUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80"}
                    alt={reel.description || "Reel"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-3">
            {userOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No has realizado ningún pedido todavía.
              </div>
            ) : (
              userOrders.map((ord) => (
                <div key={ord.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Pedido #{ord.id?.slice(0, 8)}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {ord.status || "Completado"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{ord.items?.length || 1} producto(s)</span>
                    <span className="font-black text-amber-600 text-sm">${ord.total?.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Publications Feed Modal */}
      {selectedFeedReelId && (
        <AndroidUserPublicationsFeed
          user={activeUser}
          reels={reels}
          products={products}
          initialReelId={selectedFeedReelId}
          currentUser={currentUser}
          onClose={() => setSelectedFeedReelId(null)}
          onSelectProduct={onSelectProduct}
          onDeleteReel={onDeleteReel}
          savedReelIds={savedReelIds}
          onToggleSaveReel={onToggleSaveReel}
        />
      )}

      {/* Standalone Publish Modal for Android */}
      {isPublishingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950">
          <AndroidPublishView
            currentUser={currentUser}
            onBack={() => setIsPublishingOpen(false)}
            onSuccess={() => {
              setIsPublishingOpen(false);
              onPublishSuccess?.();
            }}
            userProducts={userProducts}
          />
        </div>
      )}

      {/* Edit Profile Sheet */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full bg-white border-t border-slate-200 rounded-t-3xl p-5 text-slate-900 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-900">Editar Perfil de Android</span>
                <button onClick={() => setIsEditProfileOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="py-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white border border-slate-200 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Biografía</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white border border-slate-200 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs active:scale-95 shadow-sm cursor-pointer"
                >
                  {isSaving ? "Guardando..." : "Actualizar Perfil"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
