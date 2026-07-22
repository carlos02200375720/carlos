import React, { useState, useEffect, useRef } from "react";
import { Play, ShoppingBag, Radio, User as UserIcon, MessageSquare, Bell, Heart, ShieldCheck, Camera, Upload, LogOut, AlertTriangle } from "lucide-react";
import { User, Reel, Product, CartItem, Order, ChatMessage, LiveSession } from "./types";
import ReelsView from "./components/ReelsView";
import ShopView from "./components/ShopView";
import LiveView from "./components/LiveView";
import SocialPanel from "./components/SocialPanel";
import ProfileView from "./components/ProfileView";
import LoginView from "./components/LoginView";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation states: 'reels' | 'shop' | 'messages' | 'live' | 'profile'
  const [activeTab, setActiveTab] = useState<'reels' | 'shop' | 'messages' | 'live' | 'profile'>('reels');

  // Core Data State
  const [users, setUsers] = useState<User[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);

  // Current User (Session source of truth)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem("isLoggedIn") === "true");
  const [currentUser, setCurrentUser] = useState<User>({
    id: "current_user",
    username: "",
    name: "Cargando...",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    bio: "",
    isOnline: false,
    followers: 0,
    following: 0,
  });

  // Selected details (for cross-tab linkage)
  const [directSelectedProduct, setDirectSelectedProduct] = useState<Product | null>(null);
  const [selectedCreatorProfileId, setSelectedCreatorProfileId] = useState<string | null>(null);

  // Private 1-on-1 Chat States
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [savedReelIds, setSavedReelIds] = useState<string[]>([]);

  // Force upload profile photo state
  const [selectedForceAvatar, setSelectedForceAvatar] = useState<string | null>(null);
  const [forceAvatarSaving, setForceAvatarSaving] = useState(false);
  const [forceAvatarError, setForceAvatarError] = useState("");
  const [guestInteractionAlert, setGuestInteractionAlert] = useState<string | null>(null);

  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Load initial catalog & files
  useEffect(() => {
    // Asegurar que al abrir o refrescar la aplicación, la pestaña activa sea siempre 'reels' (Inicio)
    setActiveTab('reels');

    // 1. Fetch Users
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setUsers(data))
      .catch((err) => console.error("Error fetching users:", err));

    // 2. Fetch Reels
    fetch("/api/reels")
      .then((res) => res.json())
      .then((data) => setReels(data))
      .catch((err) => console.error("Error fetching reels:", err));

    // 3. Fetch Products
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error("Error fetching products:", err));

    // 4. Fetch Live sessions
    fetch("/api/live")
      .then((res) => res.json())
      .then((data) => setLiveSessions(data))
      .catch((err) => console.error("Error fetching live sessions:", err));

    // 5. Restore session from localStorage if logged in
    const savedUsername = localStorage.getItem("loggedInUsername");
    const savedPassword = localStorage.getItem("loggedInPassword") || "";
    if (savedUsername) {
      fetch("/api/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername: savedUsername, password: savedPassword }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.user) {
            setCurrentUser(data.user);
            setSavedReelIds(data.user.savedReelIds || []);
          }
        })
        .catch((err) => console.error("Error switching session user on boot:", err));
    } else {
      // Fetch default server current_user details
      fetch("/api/users/current_user")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.user) {
            setCurrentUser(data.user);
            setSavedReelIds(data.user.savedReelIds || []);
          }
        })
        .catch((err) => console.error("Error fetching current user details:", err));
    }
  }, []);

  // Fetch Private Chats on Active User change
  useEffect(() => {
    if (activeChatUser) {
      fetch(`/api/chats/${activeChatUser.id}`)
        .then((res) => res.json())
        .then((data) => setPrivateMessages(data))
        .catch((err) => console.error("Error loading chat:", err));
    } else {
      setPrivateMessages([]);
    }
  }, [activeChatUser]);

  // Connect WebSockets
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const socketUrl = `${protocol}//${host}`;

    console.log("Attempting WebSocket connection to:", socketUrl);
    const ws = new WebSocket(socketUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected successfully!");
      setSocketConnected(true);
      
      // Authenticate
      ws.send(JSON.stringify({
        type: "auth",
        userId: currentUser.id
      }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("Incoming WebSocket Message:", payload);

        switch (payload.type) {
          case "presence_list": {
            setUsers(payload.users);
            break;
          }

          case "private_msg": {
            const msg: ChatMessage = payload.message;
            // Append message if chat partner is currently selected
            if (activeChatUser && (msg.senderId === activeChatUser.id || msg.receiverId === activeChatUser.id)) {
              setPrivateMessages((prev) => [...prev, msg]);
            } else {
              // Increment unread count
              setUnreadCounts((prev) => ({
                ...prev,
                [msg.senderId]: (prev[msg.senderId] || 0) + 1
              }));
            }
            break;
          }

          case "private_msg_sent": {
            const msg: ChatMessage = payload.message;
            setPrivateMessages((prev) => [...prev, msg]);
            break;
          }

          case "live_started": {
            setLiveSessions((prev) => {
              const filter = prev.filter(s => s.id !== payload.session.id);
              return [payload.session, ...filter];
            });
            break;
          }

          case "live_ended": {
            setLiveSessions((prev) => prev.filter(s => s.id !== payload.sessionId));
            break;
          }

          case "live_viewers": {
            setLiveSessions((prev) =>
              prev.map((s) => (s.id === payload.streamId ? { ...s, viewersCount: payload.count } : s))
            );
            break;
          }

          case "live_chat_msg": {
            setLiveSessions((prev) =>
              prev.map((s) =>
                s.id === payload.streamId
                  ? { ...s, chatMessages: [...s.chatMessages, payload.msg] }
                  : s
              )
            );
            break;
          }

          case "stock_updated": {
            setProducts((prev) =>
              prev.map((p) => {
                const fresh = payload.products.find((f: any) => f.id === p.id);
                return fresh ? { ...p, stock: fresh.stock } : p;
              })
            );
            break;
          }

          case "reel_updated": {
            setReels((prev) =>
              prev.map((r) => {
                if (r.id === payload.reelId) {
                  let updatedComments = r.comments;
                  if (payload.newComment) {
                    const exists = r.comments.some((c) => c.id === payload.newComment.id);
                    if (!exists) {
                      updatedComments = [...r.comments, payload.newComment];
                    }
                  }
                  return {
                    ...r,
                    likes: payload.likes !== undefined ? payload.likes : r.likes,
                    likedBy: payload.likedBy || r.likedBy,
                    comments: updatedComments
                  };
                }
                return r;
              })
            );
            break;
          }
        }
      } catch (err) {
        console.error("Error parsing socket message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected.");
      setSocketConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [activeChatUser, currentUser.id]);

  // --- API HANDLERS ---

  const handleLikeReel = (reelId: string) => {
    fetch(`/api/reels/${reelId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setReels((prev) =>
            prev.map((r) =>
              r.id === reelId
                ? { ...r, likes: data.likes, likedBy: data.likedBy || [] }
                : r
            )
          );
        }
      })
      .catch((err) => console.error("Error liking reel:", err));
  };

  const handleAddComment = (reelId: string, text: string) => {
    fetch(`/api/reels/${reelId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUser.username,
        avatar: currentUser.avatar,
        text: text,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.id) {
          setReels((prev) =>
            prev.map((r) => {
              if (r.id === reelId) {
                const exists = r.comments.some((c) => c.id === data.id);
                if (exists) return r;
                return { ...r, comments: [...r.comments, data] };
              }
              return r;
            })
          );
        }
      })
      .catch((err) => console.error("Error commenting reel:", err));
  };

  const handleToggleSaveReel = (reelId: string) => {
    fetch("/api/users/current/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSavedReelIds(data.savedReelIds || []);
          setCurrentUser(prev => ({
            ...prev,
            savedReelIds: data.savedReelIds || []
          }));
        }
      })
      .catch((err) => console.error("Error toggling saved reel:", err));
  };

  const handleToggleFollowUser = (targetUserId: string) => {
    if (currentUser.username === "invitado" || currentUser.isGuest) {
      setGuestInteractionAlert("Para seguir a creadores, por favor inicia sesión o crea una cuenta.");
      return;
    }
    fetch(`/api/users/${targetUserId}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentUser((prev) => ({
            ...prev,
            followingUserIds: data.followingUserIds || [],
            following: data.currentUserFollowing !== undefined ? data.currentUserFollowing : prev.following
          }));
          setUsers((prev) =>
            prev.map((u) =>
              u.id === data.targetUserId
                ? { ...u, followers: data.targetFollowers }
                : u
            )
          );
        }
      })
      .catch((err) => console.error("Error toggling follow:", err));
  };

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const handleCheckoutCart = (address: string, onComplete: (newOrder: Order) => void) => {
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart,
        shippingAddress: address,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setCart([]); // Clear cart
          onComplete(data);
        } else {
          alert(data.error);
        }
      })
      .catch((err) => console.error("Error checking out:", err));
  };

  // Private Messages handler
  const handleSendPrivateMessage = (text: string) => {
    if (!activeChatUser || !socketRef.current || !socketConnected) return;

    socketRef.current.send(JSON.stringify({
      type: "private_msg",
      senderId: currentUser.id,
      receiverId: activeChatUser.id,
      text: text,
    }));
  };

  // Clear unreads
  const handleClearUnreads = (userId: string) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [userId]: 0
    }));
  };

  // Public/Creator profile cross linkers
  const handleCreatorProfileLink = (creatorId: string) => {
    setSelectedCreatorProfileId(creatorId);
    setActiveTab('profile');
  };

  const handleProductDetailsLink = (product: Product) => {
    setDirectSelectedProduct(product);
    setActiveTab('shop');
  };

  const handleReelLink = (reelId: string) => {
    const idx = reels.findIndex(r => r.id === reelId);
    if (idx !== -1) {
      // Reels view auto-scrolls to active reel
      setActiveTab('reels');
    }
  };

  // Go live action
  const handleGoLive = (title: string, onComplete: (session: LiveSession) => void) => {
    fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        creatorId: currentUser.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          onComplete(data);
        }
      })
      .catch((err) => console.error("Error starting live session:", err));
  };

  const handleEndLive = (sessionId: string) => {
    fetch(`/api/live/${sessionId}/end`, { method: "POST" })
      .then((res) => res.json())
      .then(() => {
        setLiveSessions((prev) => prev.filter(s => s.id !== sessionId));
      })
      .catch((err) => console.error("Error ending live session:", err));
  };

  const openPrivateChatDirectly = (partner: User) => {
    setActiveChatUser(partner);
    handleClearUnreads(partner.id);
    setActiveTab('messages');
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loggedInUsername");
    localStorage.removeItem("loggedInPassword");
    setIsLoggedIn(false);
    
    // First notify server to clear session
    fetch("/api/users/current/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })
      .then(() => {
        // Fetch default guest user now that server has reset session
        return fetch("/api/users/current_user");
      })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.user) {
          setCurrentUser(data.user);
          setSavedReelIds([]);
          setActiveTab('reels');
        }
      })
      .catch((err) => {
        console.error("Error setting guest user on logout:", err);
        // Fallback default guest structure
        setCurrentUser({
          id: "current_user",
          username: "invitado",
          name: "Invitado",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          bio: "Explorando la plataforma",
          isOnline: false,
          followers: 0,
          following: 0,
        });
        setSavedReelIds([]);
        setActiveTab('reels');
      });
  };

  const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

  const handleSaveForceAvatar = async () => {
    if (!selectedForceAvatar) {
      setForceAvatarError("Por favor, selecciona o sube una foto de perfil.");
      return;
    }
    setForceAvatarSaving(true);
    setForceAvatarError("");
    try {
      const response = await fetch("/api/users/current/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: selectedForceAvatar }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setForceAvatarError(data.error || "No se pudo guardar la imagen.");
      } else {
        setCurrentUser(data.user);
        // Refresh global users list to sync
        fetch("/api/users")
          .then((res) => res.json())
          .then((usersData) => setUsers(usersData))
          .catch((err) => console.error("Error refreshing users:", err));
      }
    } catch (err) {
      console.error("Error saving profile picture:", err);
      setForceAvatarError("Error de conexión al guardar.");
    } finally {
      setForceAvatarSaving(false);
    }
  };

  const totalUnreads: number = Object.values(unreadCounts).reduce<number>((acc, val) => acc + (val as number), 0);
  const isDarkNavActive = activeTab === 'reels' || activeTab === 'messages';

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      
      {/* Main Container */}
      <main className={`flex-1 w-full bg-white ${activeTab === 'messages' && activeChatUser ? "" : "mb-16"}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full"
          >
            {activeTab === 'reels' && (
              <ReelsView
                reels={reels}
                currentUser={currentUser}
                onProductClick={handleProductDetailsLink}
                onCreatorClick={handleCreatorProfileLink}
                onLikeReel={handleLikeReel}
                onAddComment={handleAddComment}
                savedReelIds={savedReelIds}
                onToggleSaveReel={handleToggleSaveReel}
                onToggleFollowUser={handleToggleFollowUser}
                onGuestInteraction={(action) => {
                  setGuestInteractionAlert(`Para ${action} en este reel, por favor inicia sesión o crea una cuenta de creador.`);
                }}
              />
            )}

            {activeTab === 'shop' && (
              <ShopView
                products={products}
                cart={cart}
                users={users}
                currentUser={currentUser}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onCheckout={handleCheckoutCart}
                onCreatorClick={handleCreatorProfileLink}
                selectedProductDirectly={directSelectedProduct}
                clearDirectProduct={() => setDirectSelectedProduct(null)}
                onNavigateToHistory={() => { setSelectedCreatorProfileId(currentUser.id); setActiveTab('profile'); }}
              />
            )}

            {activeTab === 'live' && (
              <LiveView
                liveSessions={liveSessions}
                currentUser={currentUser}
                socket={socketRef.current}
                onGoLive={handleGoLive}
                onEndLive={handleEndLive}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                selectedCreatorId={selectedCreatorProfileId}
                users={users}
                onBackToSelf={() => setSelectedCreatorProfileId(currentUser.id)}
                onOpenDirectChat={openPrivateChatDirectly}
                onSelectProduct={handleProductDetailsLink}
                onSelectReel={handleReelLink}
                onProfileUpdate={(updatedUser) => {
                  setCurrentUser(updatedUser);
                  setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                  if (updatedUser.username !== "invitado") {
                    setIsLoggedIn(true);
                    setSelectedCreatorProfileId(null);
                    setActiveTab('profile');
                  }
                }}
                onRefreshUsers={() => {
                  fetch("/api/users")
                    .then((res) => res.json())
                    .then((data) => setUsers(data))
                    .catch((err) => console.error("Error refreshing users:", err));
                }}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'messages' && (
              <SocialPanel
                users={users}
                currentUser={currentUser}
                messages={privateMessages}
                activeChatUser={activeChatUser}
                onSelectChatUser={setActiveChatUser}
                onSendPrivateMessage={handleSendPrivateMessage}
                unreadCounts={unreadCounts}
                clearUnreads={handleClearUnreads}
                onClose={() => setActiveTab('reels')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Floating Navigation Bar */}
      {!(activeTab === 'messages' && activeChatUser) && (
        <div id="bottom-nav-bar" className="fixed bottom-0 inset-x-0 py-3 px-6 z-30 shadow-md backdrop-blur-lg border-t border-slate-900 bg-black text-white">
          <div className="max-w-md mx-auto flex items-center justify-around">
            
            {/* Tab 1: Reels */}
            <button
              onClick={() => { setActiveTab('reels'); }}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl cursor-pointer transition-all ${
                activeTab === 'reels'
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="tab-reels-btn"
            >
              <Play className={`w-5 h-5 ${activeTab === 'reels' ? "fill-amber-500/10" : ""}`} />
              <span className="text-[10px] font-bold tracking-tight">Reels</span>
            </button>
   
            {/* Tab 2: Shop */}
            <button
              onClick={() => { setActiveTab('shop'); }}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl cursor-pointer transition-all ${
                activeTab === 'shop'
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="tab-shop-btn"
            >
              <ShoppingBag className={`w-5 h-5 ${activeTab === 'shop' ? "fill-amber-500/10" : ""}`} />
              <span className="text-[10px] font-bold tracking-tight">Market</span>
            </button>
   
            {/* Tab: Messages (between Market and Directos) */}
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl cursor-pointer transition-all relative ${
                activeTab === 'messages'
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="tab-messages-btn"
            >
              <div className="relative">
                <MessageSquare className={`w-5 h-5 ${activeTab === 'messages' ? "fill-amber-500/10" : ""}`} />
                {totalUnreads > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-bold font-mono w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {totalUnreads}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight">Mensajes</span>
            </button>
   
            {/* Tab 3: Live */}
            <button
              onClick={() => setActiveTab('live')}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl cursor-pointer transition-all ${
                activeTab === 'live'
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="tab-live-btn"
            >
              <div className="relative">
                <Radio className="w-5 h-5" />
                {liveSessions.filter(s => s.isLive).length > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                )}
              </div>
              <span className="text-[10px] font-bold tracking-tight">Directos</span>
            </button>
   
            {/* Tab 4: Profile / Dashboard */}
            <button
              onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); }}
              className={`flex flex-col items-center justify-center space-y-1 py-1 px-4 rounded-xl cursor-pointer transition-all ${
                activeTab === 'profile' && selectedCreatorProfileId === null
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="tab-profile-btn"
            >
              <UserIcon className="w-5 h-5" />
              <span className="text-[10px] font-bold tracking-tight">
                {currentUser.username === "invitado" ? "Registro" : "Dashboard"}
              </span>
            </button>
  
          </div>
        </div>
      )}

      {/* Forced Avatar Upload Modal */}
      {isLoggedIn && currentUser.username && currentUser.avatar === DEFAULT_AVATAR && currentUser.username !== "invitado" && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden text-center">
            
            {/* Ambient gold glow decoration */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>

            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
              <Camera className="w-6 h-6 text-amber-500" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">¡Sube tu foto de perfil!</h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Para disfrutar de la plataforma y empezar a compartir contenido o interactuar en el mercado, es requisito obligatorio configurar tu foto de perfil real.
            </p>

            <div className="my-6">
              <div className="flex flex-col items-center justify-center">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-950 flex items-center justify-center shadow-inner relative">
                    {selectedForceAvatar ? (
                      <img
                        src={selectedForceAvatar}
                        alt="Previsualización"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <UserIcon className="w-12 h-12 text-slate-700" />
                    )}
                  </div>
                  
                  {/* File Upload Selector */}
                  <input
                    type="file"
                    id="force-avatar-file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === "string") {
                            setSelectedForceAvatar(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="force-avatar-file"
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 transition-colors cursor-pointer border-2 border-slate-900 shadow-md animate-pulse"
                  >
                    <Upload className="w-4 h-4" />
                  </label>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-mono">JPG, PNG o GIF (Máx 5MB)</p>
              </div>
            </div>

            {forceAvatarError && (
              <div className="text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl font-medium mb-4 flex items-center justify-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{forceAvatarError}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleSaveForceAvatar}
                disabled={forceAvatarSaving || !selectedForceAvatar}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-2xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                {forceAvatarSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando foto...</span>
                  </>
                ) : (
                  <span>Guardar foto de perfil</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Elegant Guest Notification Modal */}
      {guestInteractionAlert && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="guest-alert-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative overflow-hidden text-center">
            
            {/* Ambient amber glow decoration */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl"></div>

            <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20">
              <span className="text-xl">🔒</span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight font-display">Acceso Restringido</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              {guestInteractionAlert}
            </p>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setGuestInteractionAlert(null);
                  setActiveTab('profile');
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center space-x-2 shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer"
              >
                <span>Ir a Registro / Login</span>
              </button>

              <button
                type="button"
                onClick={() => setGuestInteractionAlert(null)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-extrabold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Seguir Explorando</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
