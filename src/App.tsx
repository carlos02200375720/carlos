import React, { useState, useEffect, useRef } from "react";
import { User as UserIcon, Camera, Upload, AlertTriangle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { User, Reel, Product, CartItem, Order, ChatMessage, LiveSession } from "./types";
import { WebApp, SplashScreen, AuthModal } from "./app/web";
import { AndroidApp } from "./app/android";
import { getApiUrl, getWebSocketUrl, BACKEND_URL, apiFetch } from "./config";
import { safeStorage } from "./utils/safeStorage";
import { INITIAL_USERS, INITIAL_PRODUCTS, INITIAL_REELS } from "./initialData";

const deduplicateById = <T extends { id?: string; _id?: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || item._id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function App() {
  // Navigation states: 'reels' | 'shop' | 'messages' | 'profile'
  const [activeTab, setActiveTab] = useState<'reels' | 'shop' | 'messages' | 'profile'>('reels');

  // Stop all media playback when switching away from reels tab (shop, messages, profile)
  useEffect(() => {
    if (activeTab !== 'reels' && typeof document !== "undefined") {
      document.querySelectorAll("video").forEach((v) => {
        try {
          v.pause();
        } catch {}
      });
    }
  }, [activeTab]);

  // Core Data State - pre-hydrated from safeStorage cache if available so UI displays immediately
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = safeStorage.getItem("cached_users");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateById(parsed) as User[];
      }
    } catch {}
    return INITIAL_USERS;
  });

  const [reels, setReels] = useState<Reel[]>(() => {
    try {
      const cached = safeStorage.getItem("cached_reels");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateById(parsed) as Reel[];
      }
    } catch {}
    return INITIAL_REELS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = safeStorage.getItem("cached_products");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateById(parsed) as Product[];
      }
    } catch {}
    return INITIAL_PRODUCTS;
  });
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedUsername = safeStorage.getItem("loggedInUsername");
      const guestId = safeStorage.getItem("cartClientId");
      const key = savedUsername && savedUsername !== "invitado" && savedUsername !== "guest"
        ? `saved_cart_${savedUsername}`
        : (guestId ? `saved_cart_${guestId}` : "saved_cart_guest");
      const raw = safeStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Error reading initial cart from safeStorage:", e);
    }
    return [];
  });
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);

  // Current User (Session source of truth)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => safeStorage.getItem("isLoggedIn") === "true");
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUserJson = safeStorage.getItem("currentUserData");
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        if (parsed && parsed.username && parsed.username !== "invitado" && !parsed.isGuest) {
          return parsed;
        }
      } catch (e) {}
    }
    const savedUsername = safeStorage.getItem("loggedInUsername");
    if (savedUsername && savedUsername !== "invitado" && savedUsername !== "guest") {
      return {
        id: "current_user",
        username: savedUsername,
        name: savedUsername,
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        bio: "",
        isOnline: true,
        followers: 0,
        following: 0,
        isGuest: false,
      };
    }
    return {
      id: "current_user",
      username: "invitado",
      name: "Invitado",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
      bio: "Explorando la plataforma",
      isOnline: false,
      followers: 0,
      following: 0,
      isGuest: true,
    };
  });

  // Selected details (for cross-tab linkage)
  const [directSelectedProduct, setDirectSelectedProduct] = useState<Product | null>(null);
  const [selectedCreatorProfileId, setSelectedCreatorProfileId] = useState<string | null>(null);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [shopInitialStep, setShopInitialStep] = useState<'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou'>('catalog');
  const [shopInitialSelectedIndices, setShopInitialSelectedIndices] = useState<number[]>([]);

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
  const [isLiveViewerOpen, setIsLiveViewerOpen] = useState(false);

  // App Startup & Server Connection Splash State (disabled by default on web for instant paint)
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    try {
      if (typeof window !== "undefined" && typeof Capacitor !== "undefined" && Capacitor?.isNativePlatform && Capacitor.isNativePlatform()) {
        return true;
      }
    } catch {}
    return false;
  });
  const [splashStatus, setSplashStatus] = useState("¡Bienvenido a MallSocial!");
  const [splashHasError, setSplashHasError] = useState(false);
  const loadAttemptsRef = useRef(0);

  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // Synchronize status bar and native bottom navigation bar color dynamically
  useEffect(() => {
    const isDark = activeTab === 'reels';
    const currentThemeColor = isDark ? "#000000" : "#ffffff";
    const statusBarStyle = isDark ? "black-translucent" : "default";

    // Update theme-color meta tags for mobile browsers and Android system UI
    const themeMeta = document.getElementById("theme-color-meta") || document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", currentThemeColor);
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
      tag.setAttribute("content", currentThemeColor);
    });

    // Update Apple mobile status bar style
    const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusMeta) {
      appleStatusMeta.setAttribute("content", statusBarStyle);
    }

    // Set document background color to seamlessly blend with native status and nav bars
    document.documentElement.style.backgroundColor = currentThemeColor;
    document.body.style.backgroundColor = currentThemeColor;
  }, [activeTab]);

  // Refresh functions to ensure feed is live without refreshing browser
  const refreshReels = async () => {
    try {
      let data: any = null;
      try {
        const res = await apiFetch("/api/reels");
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn("Primary reels fetch failed, trying android reels route:", e);
      }
      if (!Array.isArray(data) || data.length === 0) {
        try {
          const res = await apiFetch("/api/android/reels");
          if (res.ok) data = await res.json();
        } catch (e) {
          console.warn("Android reels route also failed:", e);
        }
      }
      if (Array.isArray(data) && data.length > 0) {
        const unique = deduplicateById(data) as Reel[];
        setReels(unique);
        safeStorage.setItem("cached_reels", JSON.stringify(unique));
      }
    } catch (err) {
      console.error("Error fetching reels:", err);
    }
  };

  const refreshProducts = async () => {
    try {
      let data: any = null;
      try {
        const res = await apiFetch("/api/products");
        if (res.ok) data = await res.json();
      } catch (e) {
        console.warn("Primary products fetch failed, trying android products route:", e);
      }
      if (!Array.isArray(data) || data.length === 0) {
        try {
          const res = await apiFetch("/api/android/products");
          if (res.ok) data = await res.json();
        } catch (e) {
          console.warn("Android products route also failed:", e);
        }
      }
      if (Array.isArray(data) && data.length > 0) {
        const unique = deduplicateById(data) as Product[];
        setProducts(unique);
        safeStorage.setItem("cached_products", JSON.stringify(unique));
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const refreshAllData = async () => {
    await Promise.allSettled([
      refreshReels(),
      refreshProducts(),
      apiFetch("/api/users")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const unique = deduplicateById(data) as User[];
            setUsers(unique);
            safeStorage.setItem("cached_users", JSON.stringify(unique));
          }
        })
        .catch((err) => console.error("Error fetching users:", err))
    ]);
  };

  // Clean up static HTML preloader as soon as React component mounts
  useEffect(() => {
    const preloader = document.getElementById("app-preloader");
    if (preloader) {
      preloader.style.opacity = "0";
      setTimeout(() => {
        try {
          preloader.remove();
        } catch (e) {}
      }, 400);
    }
  }, []);

  const loadInitialData = async () => {
    setSplashHasError(false);
    setSplashStatus("Cargando contenido...");
    loadAttemptsRef.current += 1;

    try {
      // Step 1: Optional health check ping to wake up container
      apiFetch("/api/health").catch(() => null);

      // Step 2: Fetch all core feed data in parallel
      setSplashStatus("Sincronizando reels, catálogo y sesiones...");
      const [usersRes, reelsRes, productsRes, liveRes] = await Promise.allSettled([
        apiFetch("/api/users").then(r => r.json()),
        apiFetch("/api/reels").then(r => r.json()),
        apiFetch("/api/products").then(r => r.json()),
        apiFetch("/api/live").then(r => r.json()),
      ]);

      let hasLoadedAnyCore = false;

      // Hydrate users
      if (usersRes.status === "fulfilled") {
        const val = usersRes.value;
        const list = Array.isArray(val) ? val : (val && Array.isArray(val.users) ? val.users : []);
        if (list.length > 0) {
          const uniqueUsers = deduplicateById(list) as User[];
          setUsers(uniqueUsers);
          safeStorage.setItem("cached_users", JSON.stringify(uniqueUsers));
          hasLoadedAnyCore = true;
        }
      }

      // Hydrate reels with dedicated Android route fallback
      let loadedReels: Reel[] = [];
      if (reelsRes.status === "fulfilled") {
        const val = reelsRes.value;
        const list = Array.isArray(val) ? val : (val && Array.isArray(val.reels) ? val.reels : []);
        if (list.length > 0) loadedReels = list;
      }
      if (loadedReels.length === 0) {
        try {
          const aRes = await apiFetch("/api/android/reels");
          if (aRes.ok) {
            const aData = await aRes.json();
            if (Array.isArray(aData) && aData.length > 0) loadedReels = aData;
          }
        } catch (e) {
          console.warn("Android fallback reels fetch failed:", e);
        }
      }
      if (loadedReels.length > 0) {
        const uniqueReels = deduplicateById(loadedReels) as Reel[];
        setReels(uniqueReels);
        safeStorage.setItem("cached_reels", JSON.stringify(uniqueReels));
        hasLoadedAnyCore = true;
      }

      // Hydrate products with dedicated Android route fallback
      let loadedProducts: Product[] = [];
      if (productsRes.status === "fulfilled") {
        const val = productsRes.value;
        const list = Array.isArray(val) ? val : (val && Array.isArray(val.products) ? val.products : []);
        if (list.length > 0) loadedProducts = list;
      }
      if (loadedProducts.length === 0) {
        try {
          const aRes = await apiFetch("/api/android/products");
          if (aRes.ok) {
            const aData = await aRes.json();
            if (Array.isArray(aData) && aData.length > 0) loadedProducts = aData;
          }
        } catch (e) {
          console.warn("Android fallback products fetch failed:", e);
        }
      }
      if (loadedProducts.length > 0) {
        const uniqueProducts = deduplicateById(loadedProducts) as Product[];
        setProducts(uniqueProducts);
        safeStorage.setItem("cached_products", JSON.stringify(uniqueProducts));
        hasLoadedAnyCore = true;
      }

      if (liveRes.status === "fulfilled" && Array.isArray(liveRes.value)) {
        setLiveSessions(deduplicateById(liveRes.value));
      }

      // Step 3: Restore session from safeStorage if logged in
      let savedUsername = safeStorage.getItem("loggedInUsername");
      if (savedUsername === "carlosg") {
        savedUsername = "carlos";
        safeStorage.setItem("loggedInUsername", "carlos");
      } else if (savedUsername === "davidb") {
        savedUsername = "david";
        safeStorage.setItem("loggedInUsername", "david");
      }
      const savedPassword = safeStorage.getItem("loggedInPassword") || "";
      if (savedUsername && savedUsername !== "invitado" && savedUsername !== "guest") {
        apiFetch("/api/users/current/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUsername: savedUsername, password: savedPassword, isSessionRestore: true }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.success && data.user) {
              setCurrentUser(data.user);
              setIsLoggedIn(true);
              safeStorage.setItem("isLoggedIn", "true");
              safeStorage.setItem("loggedInUsername", data.user.username);
              safeStorage.setItem("currentUserData", JSON.stringify(data.user));
              setSavedReelIds(data.user.savedReelIds || []);
            }
          })
          .catch((err) => console.error("Error switching session user on boot:", err));
      } else {
        // Fetch default server current_user details
        apiFetch("/api/users/current_user")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.user) {
              setCurrentUser((prev) => {
                if (prev.username && prev.username !== "invitado" && !prev.isGuest) {
                  return prev;
                }
                return data.user;
              });
              setSavedReelIds(data.user.savedReelIds || []);
            }
          })
          .catch((err) => console.error("Error fetching current user details:", err));
      }

      setIsInitialLoading(false);
    } catch (error) {
      console.error("Error initializing app data:", error);
      setIsInitialLoading(false);
    }
  };

  // Load initial catalog & files
  useEffect(() => {
    setActiveTab('reels');
    loadInitialData();

    // Fallback safety timeout: allow up to 8 seconds for slower mobile networks before clearing splash screen
    const safetyTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 8000);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Fetch Private Chats on Active User change
  useEffect(() => {
    if (activeChatUser) {
      apiFetch(`/api/chats/${activeChatUser.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setPrivateMessages(data);
          } else {
            setPrivateMessages([]);
          }
        })
        .catch((err) => console.error("Error loading chat:", err));
    } else {
      setPrivateMessages([]);
    }
  }, [activeChatUser]);

  // Connect WebSockets
  useEffect(() => {
    const socketUrl = getWebSocketUrl();

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketConnected(true);
        ws?.send(JSON.stringify({
          type: "auth",
          userId: currentUser.id
        }));
      };

      ws.onerror = (e) => {
        // Non-blocking WebSocket warning (common in sandboxed or preview proxies)
        console.warn("WebSocket non-fatal error event:", e);
      };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log("Incoming WebSocket Message:", payload);

        switch (payload.type) {
          case "presence_list": {
            if (Array.isArray(payload.users)) {
              setUsers(deduplicateById(payload.users));
            }
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

          case "error": {
            if (payload.message) {
              setGuestInteractionAlert(payload.message);
            }
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

          case "product_viewed": {
            if (payload.productId && typeof payload.views === "number") {
              setProducts((prev) =>
                prev.map((p) =>
                  p.id === payload.productId ? { ...p, views: payload.views } : p
                )
              );
            }
            break;
          }

          case "reel_created": {
            if (payload.reel) {
              setReels((prev) => {
                const exists = prev.some((r) => r.id === payload.reel.id);
                return exists ? prev : [payload.reel, ...prev];
              });
            }
            break;
          }

          case "reel_deleted": {
            if (payload.reelId) {
              setReels((prev) => prev.filter((r) => r.id !== payload.reelId));
            }
            break;
          }

          case "hls_job_completed": {
            if (payload.hlsManifestUrl) {
              setReels((prev) =>
                prev.map((r) =>
                  r.videoUrl === payload.originalUrl || r.id === payload.jobId
                    ? { ...r, videoUrl: payload.hlsManifestUrl, hlsUrl: payload.hlsManifestUrl }
                    : r
                )
              );
            }
            break;
          }

          case "product_created": {
            if (payload.product) {
              setProducts((prev) => {
                const exists = prev.some((p) => p.id === payload.product.id);
                return exists ? prev : [payload.product, ...prev];
              });
            }
            break;
          }

          case "product_updated": {
            if (payload.product) {
              setProducts((prev) =>
                prev.map((p) => (p.id === payload.product.id ? { ...p, ...payload.product } : p))
              );
            }
            break;
          }

          case "product_deleted": {
            if (payload.productId) {
              setProducts((prev) => prev.filter((p) => p.id !== payload.productId));
            }
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
                    saves: payload.saves !== undefined ? payload.saves : r.saves,
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

    if (ws) {
      ws.onclose = () => {
        setSocketConnected(false);
      };
    }
  } catch (err) {
    console.warn("WebSocket initialization warning:", err);
  }

  return () => {
    try {
      ws?.close();
    } catch (e) {}
  };
}, [activeChatUser, currentUser.id]);

  // --- API HANDLERS ---

  const handleLikeReel = (reelId: string) => {
    apiFetch(`/api/reels/${reelId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.originalId || currentUser.id,
        username: currentUser.username
      }),
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
    if (!currentUser || currentUser.username === "invitado" || currentUser.isGuest || !currentUser.username) {
      setGuestInteractionAlert("Para comentar en este reel, por favor inicia sesión o crea una cuenta de creador.");
      return;
    }

    apiFetch(`/api/reels/${reelId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.originalId || currentUser.id,
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
    if (!currentUser || currentUser.username === "invitado" || currentUser.isGuest || !currentUser.username) {
      setGuestInteractionAlert("Para guardar publicaciones, por favor inicia sesión o crea una cuenta.");
      return;
    }

    const isSaved = savedReelIds.includes(reelId);
    const newSavedIds = isSaved
      ? savedReelIds.filter((id) => id !== reelId)
      : [...savedReelIds, reelId];

    // Optimistic update for UI state
    setSavedReelIds(newSavedIds);
    setCurrentUser((prev) => ({
      ...prev,
      savedReelIds: newSavedIds
    }));

    // Optimistic update for reel saves count
    setReels((prev) =>
      prev.map((r) => {
        if (r.id === reelId) {
          const currentSaves = r.saves ?? 0;
          return {
            ...r,
            saves: isSaved ? Math.max(0, currentSaves - 1) : currentSaves + 1
          };
        }
        return r;
      })
    );

    apiFetch("/api/users/current/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reelId,
        userId: currentUser.originalId || currentUser.id,
        username: currentUser.username
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.savedReelIds) {
            setSavedReelIds(data.savedReelIds);
            setCurrentUser((prev) => ({
              ...prev,
              savedReelIds: data.savedReelIds
            }));
          }
          if (typeof data.saves === "number") {
            setReels((prev) =>
              prev.map((r) => (r.id === reelId ? { ...r, saves: data.saves } : r))
            );
          }
        }
      })
      .catch((err) => console.error("Error toggling saved reel:", err));
  };

  const handleToggleFollowUser = (targetUserId: string) => {
    if (!targetUserId) return;
    if (!currentUser || currentUser.username === "invitado" || currentUser.isGuest || !currentUser.username) {
      setGuestInteractionAlert("Para seguir a creadores, por favor inicia sesión o crea una cuenta.");
      return;
    }

    // Optimistic local state update for instant UI feedback on single click
    setCurrentUser((prev) => {
      const prevIds = prev.followingUserIds || [];
      const lowerTarget = targetUserId.toLowerCase();
      const isAlreadyFollowing = prevIds.some(
        (id) => id === targetUserId || id.toLowerCase() === lowerTarget
      );
      const nextIds = isAlreadyFollowing
        ? prevIds.filter((id) => id !== targetUserId && id.toLowerCase() !== lowerTarget)
        : [...prevIds, targetUserId];

      return {
        ...prev,
        followingUserIds: nextIds,
        following: isAlreadyFollowing ? Math.max(0, (prev.following || 1) - 1) : (prev.following || 0) + 1
      };
    });

    const currentUserId = currentUser.originalId || currentUser.id;
    apiFetch(`/api/users/${targetUserId}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentUserId, currentUsername: currentUser.username })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentUser((prev) => {
            const serverIds: string[] = data.followingUserIds || [];
            const targetsToRemove = new Set([
              targetUserId.toLowerCase(),
              (data.targetUserId || "").toLowerCase()
            ]);

            let updatedIds: string[];
            if (data.isFollowing) {
              updatedIds = Array.from(new Set([...serverIds, targetUserId, data.targetUserId].filter(Boolean)));
            } else {
              updatedIds = serverIds.filter((id) => !targetsToRemove.has(id.toLowerCase()));
            }

            return {
              ...prev,
              followingUserIds: updatedIds,
              following: data.currentUserFollowing !== undefined ? data.currentUserFollowing : prev.following
            };
          });
          setUsers((prev) =>
            prev.map((u) =>
              u.id === data.targetUserId || u.id === targetUserId || (u.username && u.username.toLowerCase() === targetUserId.toLowerCase())
                ? { ...u, followers: data.targetFollowers }
                : u
            )
          );
        } else if (data.error) {
          console.warn("Follow notification:", data.error);
        }
      })
      .catch((err) => console.error("Error toggling follow:", err));
  };

  // Get persistent Cart User ID for MongoDB storage
  const getCartUserId = (userObj?: User) => {
    const target = userObj || currentUser;
    const savedUsername = safeStorage.getItem("loggedInUsername");
    if (savedUsername && savedUsername !== "invitado" && savedUsername !== "guest") {
      return savedUsername;
    }
    if (target && target.username && target.username !== "invitado" && !target.isGuest && target.id !== "current_user") {
      return target.originalId || target.id || target.username;
    }
    let guestId = safeStorage.getItem("cartClientId");
    if (!guestId) {
      guestId = "guest_cart_" + Math.random().toString(36).substring(2, 11);
      safeStorage.setItem("cartClientId", guestId);
    }
    return guestId;
  };

  const saveCartToMongo = (updatedCart: CartItem[], userObj: User = currentUser) => {
    const userId = getCartUserId(userObj);
    if (!userId) return;

    // Save locally immediately
    try {
      safeStorage.setItem(`saved_cart_${userId}`, JSON.stringify(updatedCart));
    } catch (e) {
      console.error("Error writing cart to safeStorage:", e);
    }

    // Persist to MongoDB Atlas backend
    apiFetch(`/api/cart/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updatedCart }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success) {
          console.log(`💾 Cart persisted to MongoDB Atlas for user ${userId} (${updatedCart.length} items)`);
        }
      })
      .catch((err) => console.warn("Notice: Cart stored locally, background sync pending:", err?.message || err));
  };

  // Sync persistent shopping cart from MongoDB when user changes or app boots
  useEffect(() => {
    let isCancelled = false;
    const userId = getCartUserId(currentUser);
    if (!userId) return;

    // Load from local storage immediately for zero-latency UI
    try {
      const localKey = `saved_cart_${userId}`;
      const rawLocal = safeStorage.getItem(localKey);
      if (rawLocal) {
        const parsedLocal = JSON.parse(rawLocal);
        if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
          setCart(parsedLocal);
        }
      }
    } catch (e) {
      // Ignore safeStorage parse errors
    }

    // Resilient background sync with retry
    let retryTimer: any = null;
    const syncRemoteCart = (attemptsLeft: number = 3, delayMs: number = 1000) => {
      apiFetch(`/api/cart/${encodeURIComponent(userId)}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (isCancelled) return;
          if (data && Array.isArray(data.items)) {
            if (data.items.length > 0) {
              setCart(data.items);
              try {
                safeStorage.setItem(`saved_cart_${userId}`, JSON.stringify(data.items));
              } catch (e) {}
            } else {
              // If MongoDB returned 0 items, check if we have local items to sync UP to MongoDB
              const localKey = `saved_cart_${userId}`;
              const rawLocal = safeStorage.getItem(localKey);
              if (rawLocal) {
                try {
                  const parsedLocal = JSON.parse(rawLocal);
                  if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
                    setCart(parsedLocal);
                    saveCartToMongo(parsedLocal, currentUser);
                  }
                } catch (e) {}
              }
            }
          }
        })
        .catch((err) => {
          if (isCancelled) return;
          if (attemptsLeft > 1) {
            retryTimer = setTimeout(() => {
              if (!isCancelled) syncRemoteCart(attemptsLeft - 1, delayMs * 2);
            }, delayMs);
          } else {
            console.info("Using local cart cache:", err?.message || err);
          }
        });
    };

    syncRemoteCart(3, 1000);

    return () => {
      isCancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentUser.id, currentUser.username, currentUser.originalId]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.product.name === product.name &&
          item.product.imageUrl === product.imageUrl
      );
      let updated: CartItem[];
      if (existingIndex !== -1) {
        updated = prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        updated = [...prev, { product, quantity: 1 }];
      }
      setTimeout(() => saveCartToMongo(updated), 0);
      return updated;
    });
  };

  const handleRemoveFromCart = (productId: string, cartItemIndex?: number) => {
    setCart((prev) => {
      const updated = prev.filter((item, idx) => {
        if (cartItemIndex !== undefined) return idx !== cartItemIndex;
        return item.product.id !== productId && item.product.name !== productId;
      });
      setTimeout(() => saveCartToMongo(updated), 0);
      return updated;
    });
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number, cartItemIndex?: number) => {
    setCart((prev) => {
      const updated = prev.map((item, idx) => {
        if (cartItemIndex !== undefined) {
          return idx === cartItemIndex ? { ...item, quantity } : item;
        }
        if (item.product.id === productId || item.product.name === productId) {
          return { ...item, quantity };
        }
        return item;
      });
      setTimeout(() => saveCartToMongo(updated), 0);
      return updated;
    });
  };

  const handleCheckoutCart = (
    address: string,
    shippingCost: number = 0,
    onComplete: (newOrder: Order) => void,
    itemsToCheckout?: CartItem[],
    buyerInfo?: { buyerName?: string; buyerEmail?: string; buyerPhone?: string }
  ) => {
    const userId = getCartUserId(currentUser);
    const checkoutItems = itemsToCheckout && itemsToCheckout.length > 0 ? itemsToCheckout : cart;
    apiFetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        items: checkoutItems,
        shippingAddress: address,
        shippingCost: shippingCost,
        buyerName: buyerInfo?.buyerName || currentUser.name,
        buyerUsername: currentUser.username,
        buyerAvatar: currentUser.avatar,
        buyerEmail: buyerInfo?.buyerEmail || currentUser.email,
        buyerPhone: buyerInfo?.buyerPhone,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          if (data.autoCreatedUser?.user) {
            setUsers((prev) => {
              const existingIdx = prev.findIndex((u) => u.id === data.autoCreatedUser.user.id || u.username === data.autoCreatedUser.username);
              if (existingIdx >= 0) return prev;
              return [...prev, data.autoCreatedUser.user];
            });
          }
          // If partial checkout, only remove the selected items that were purchased
          setCart((prev) => {
            let updated: CartItem[];
            if (itemsToCheckout && itemsToCheckout.length > 0 && itemsToCheckout.length < prev.length) {
              const toRemove = [...itemsToCheckout];
              updated = prev.filter((cartItem) => {
                const matchIndex = toRemove.findIndex(
                  (r) =>
                    r.product.id === cartItem.product.id &&
                    r.product.name === cartItem.product.name &&
                    r.quantity === cartItem.quantity
                );
                if (matchIndex !== -1) {
                  toRemove.splice(matchIndex, 1);
                  return false;
                }
                return true;
              });
            } else {
              updated = [];
            }
            saveCartToMongo(updated);
            return updated;
          });
          onComplete(data);
        } else {
          alert(data.error);
        }
      })
      .catch((err) => console.error("Error checking out:", err));
  };

  // Private Messages handler
  const handleSendPrivateMessage = (text: string) => {
    if (currentUser.username === "invitado" || currentUser.isGuest) {
      setGuestInteractionAlert("Para enviar mensajes privados, por favor inicia sesión o crea una cuenta.");
      return;
    }
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
    if (currentUser.username === "invitado" || currentUser.isGuest) {
      setGuestInteractionAlert("Para iniciar una transmisión en vivo, por favor inicia sesión o crea una cuenta.");
      return;
    }

    apiFetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        creatorId: currentUser.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setGuestInteractionAlert(data.error);
        } else {
          setLiveSessions((prev) => {
            const filter = prev.filter((s) => s.id !== data.id);
            return [data, ...filter];
          });
          onComplete(data);
        }
      })
      .catch((err) => console.error("Error starting live session:", err));
  };

  const handleEndLive = (sessionId: string) => {
    apiFetch(`/api/live/${sessionId}/end`, { method: "POST" })
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
    safeStorage.removeItem("isLoggedIn");
    safeStorage.removeItem("loggedInUsername");
    safeStorage.removeItem("loggedInPassword");
    safeStorage.removeItem("currentUserData");
    setIsLoggedIn(false);
    
    // First notify server to clear session
    apiFetch("/api/users/current/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })
      .then(() => {
        // Fetch default guest user now that server has reset session
        return apiFetch("/api/users/current_user");
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
          isGuest: true,
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
      const response = await apiFetch("/api/users/current/update", {
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
        apiFetch("/api/users")
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
  const isDarkNavActive = activeTab === 'reels';

  return (
    <div className={`w-full ${isDarkNavActive ? "h-dvh max-h-dvh overflow-hidden bg-slate-950 text-slate-100" : "min-h-screen bg-white text-slate-900"} font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950`}>
      
      {/* App Launch & Cloud Run Connection Splash Screen */}
      <SplashScreen
        isLoading={isInitialLoading}
        statusMessage={splashStatus}
        hasError={splashHasError}
        onRetry={() => loadInitialData()}
        onContinueAnyway={() => setIsInitialLoading(false)}
      />

      {/* Main Target Routing: Android vs iOS vs Web */}
      {(((import.meta as any).env?.VITE_APP_TARGET === "android") || (typeof window !== "undefined" && window.location.search.includes("platform=android")) || (typeof window !== "undefined" && typeof Capacitor !== "undefined" && Capacitor?.getPlatform && Capacitor.getPlatform() === "android") || (typeof window !== "undefined" && typeof Capacitor !== "undefined" && Capacitor?.isNativePlatform && Capacitor.isNativePlatform() && !/iPhone|iPad|iPod/.test(navigator.userAgent || ""))) ? (
        <div className="flex flex-1 w-full min-h-screen" id="app-android-container">
          <AndroidApp
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            users={users}
            reels={reels}
            products={products}
            cart={cart}
            currentUser={currentUser}
            directSelectedProduct={directSelectedProduct}
            setDirectSelectedProduct={setDirectSelectedProduct}
            selectedCreatorProfileId={selectedCreatorProfileId}
            setSelectedCreatorProfileId={setSelectedCreatorProfileId}
            isProductDetailOpen={isProductDetailOpen}
            setIsProductDetailOpen={setIsProductDetailOpen}
            shopInitialStep={shopInitialStep}
            setShopInitialStep={setShopInitialStep}
            shopInitialSelectedIndices={shopInitialSelectedIndices}
            setShopInitialSelectedIndices={setShopInitialSelectedIndices}
            activeChatUser={activeChatUser}
            setActiveChatUser={setActiveChatUser}
            privateMessages={privateMessages}
            unreadCounts={unreadCounts}
            savedReelIds={savedReelIds}
            isLiveViewerOpen={isLiveViewerOpen}
            totalUnreads={totalUnreads}
            handleAddToCart={handleAddToCart}
            handleRemoveFromCart={handleRemoveFromCart}
            handleUpdateCartQuantity={handleUpdateCartQuantity}
            handleCheckoutCart={handleCheckoutCart}
            handleCreatorProfileLink={handleCreatorProfileLink}
            handleProductDetailsLink={handleProductDetailsLink}
            handleReelLink={handleReelLink}
            handleLikeReel={handleLikeReel}
            handleAddComment={handleAddComment}
            handleToggleSaveReel={handleToggleSaveReel}
            handleToggleFollowUser={handleToggleFollowUser}
            handleSendPrivateMessage={handleSendPrivateMessage}
            handleClearUnreads={handleClearUnreads}
            refreshReels={refreshReels}
            refreshProducts={refreshProducts}
            refreshAllData={refreshAllData}
            isInitialLoading={isInitialLoading}
            setCurrentUser={setCurrentUser}
            setUsers={setUsers}
            isLoggedIn={isLoggedIn}
            setIsLoggedIn={setIsLoggedIn}
            handleLogout={handleLogout}
            setGuestInteractionAlert={setGuestInteractionAlert}
            openPrivateChatDirectly={openPrivateChatDirectly}
            socket={socketRef.current}
          />
        </div>
      ) : (
        <div className="flex flex-1 w-full min-h-screen" id="app-web-container">
          <WebApp
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            users={users}
            reels={reels}
            products={products}
            cart={cart}
            currentUser={currentUser}
            directSelectedProduct={directSelectedProduct}
            setDirectSelectedProduct={setDirectSelectedProduct}
            selectedCreatorProfileId={selectedCreatorProfileId}
            setSelectedCreatorProfileId={setSelectedCreatorProfileId}
            isProductDetailOpen={isProductDetailOpen}
            setIsProductDetailOpen={setIsProductDetailOpen}
            shopInitialStep={shopInitialStep}
            setShopInitialStep={setShopInitialStep}
            shopInitialSelectedIndices={shopInitialSelectedIndices}
            setShopInitialSelectedIndices={setShopInitialSelectedIndices}
            activeChatUser={activeChatUser}
            setActiveChatUser={setActiveChatUser}
            privateMessages={privateMessages}
            unreadCounts={unreadCounts}
            savedReelIds={savedReelIds}
            isLiveViewerOpen={isLiveViewerOpen}
            totalUnreads={totalUnreads}
            handleAddToCart={handleAddToCart}
            handleRemoveFromCart={handleRemoveFromCart}
            handleUpdateCartQuantity={handleUpdateCartQuantity}
            handleCheckoutCart={handleCheckoutCart}
            handleCreatorProfileLink={handleCreatorProfileLink}
            handleProductDetailsLink={handleProductDetailsLink}
            handleReelLink={handleReelLink}
            handleLikeReel={handleLikeReel}
            handleAddComment={handleAddComment}
            handleToggleSaveReel={handleToggleSaveReel}
            handleToggleFollowUser={handleToggleFollowUser}
            handleSendPrivateMessage={handleSendPrivateMessage}
            handleClearUnreads={handleClearUnreads}
            refreshReels={refreshReels}
            refreshAllData={refreshAllData}
            setCurrentUser={setCurrentUser}
            setUsers={setUsers}
            setIsLoggedIn={setIsLoggedIn}
            handleLogout={handleLogout}
            setGuestInteractionAlert={setGuestInteractionAlert}
            openPrivateChatDirectly={openPrivateChatDirectly}
            socket={socketRef.current}
          />
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
                    {selectedForceAvatar && selectedForceAvatar.trim().length > 0 ? (
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
      {/* Forced Registration Auth Modal for Guest Interactions */}
      <AuthModal
        isOpen={Boolean(guestInteractionAlert)}
        actionDescription={guestInteractionAlert || "interactuar con las publicaciones"}
        onClose={() => setGuestInteractionAlert(null)}
        onLoginSuccess={(loggedUser) => {
          setCurrentUser(loggedUser);
          setIsLoggedIn(true);
          setUsers((prev) => {
            const idx = prev.findIndex((u) => u.id === loggedUser.id || u.username === loggedUser.username);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = loggedUser;
              return next;
            }
            return [...prev, loggedUser];
          });
          setGuestInteractionAlert(null);
        }}
      />

    </div>
  );
}
