import React, { useState, useEffect } from "react";
import { User, Product, Reel, Order } from "../../../types";
import {
  Eye,
  Heart,
  MessageCircle,
  BarChart3,
  ShoppingBag,
  ShieldCheck,
  Shield,
  Lock,
  FileText,
  Mail,
  Play,
  Bookmark,
  Settings,
  Plus,
  X,
  LogOut,
  BadgeCheck,
  UserPlus,
  UserCheck,
  Package,
  Check,
  Truck,
  Copy,
  ExternalLink,
  MapPin,
  Calendar,
  Clock,
  PackageSearch,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import LoginView from "../LoginView";
import UserPublicationsFeed from "../components/UserPublicationsFeed";
import PublishView from "./publicar";
import GuardadoPerfilView, { PublicationCover } from "./guardado";
import CompraPerfilView from "./compra";
import ConfigPerfilView from "./config";
import ProductosPerfilView from "./productos";
import PublicacionesPerfilView from "./publicaciones";
import RendimientoPerfilView from "./rendimiento";
import {
  navigateTo,
  parseRoute,
  getProfilePath,
  getProfileSavedPath,
  getProfileCompraPath,
  getProfileConfigPath,
  getProfileProductoPath,
  getProfileVentaPath,
  getProfilePublicacionesPath,
  getProfilePublicarPath,
  getProfileRendimientoPath,
} from "../../../router";
import { apiFetch } from "../../../config";
import { getDefaultAvatar, getDefaultCoverPhoto } from "../../../utils/defaultAssets";
import { isSuperAdmin } from "../../../superAdmin";

const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export interface PerfilProps {
  currentUser: User;
  selectedCreatorId: string | null; // Null means we view our own private admin profile
  users: User[];
  products?: Product[];
  savedReelIds?: string[];
  onToggleSave?: (id: string) => void;
  onBackToSelf: () => void;
  onOpenDirectChat: (user: User) => void;
  onSelectProduct: (product: Product) => void;
  onSelectReel: (reelId: string) => void;
  onToggleFollowUser?: (creatorId: string) => void;
  onProfileUpdate?: (updatedUser: User) => void;
  onRefreshUsers?: () => void;
  onPublishSuccess?: () => void;
  onLogout?: () => void;
  socket?: WebSocket | null;
  initialSubTab?: "publish" | "publications" | "products" | "saved" | "orders" | "performance" | "edit";
  onClearInitialSubTab?: () => void;
}

export type ProfileViewProps = PerfilProps;

export default function Perfil({
  currentUser,
  selectedCreatorId,
  users,
  products = [],
  savedReelIds = [],
  onToggleSave,
  onBackToSelf,
  onOpenDirectChat,
  onSelectProduct,
  onSelectReel,
  onToggleFollowUser,
  onProfileUpdate,
  onRefreshUsers,
  onPublishSuccess,
  onLogout,
  socket,
  initialSubTab,
  onClearInitialSubTab,
}: PerfilProps) {
  // Determine if we are looking at public creator profile or our private dashboard
  const decodedCreatorId = selectedCreatorId ? decodeURIComponent(selectedCreatorId).replace(/^@/, "") : null;
  const isSelf =
    decodedCreatorId === null ||
    decodedCreatorId === currentUser.id ||
    (!!currentUser.originalId && decodedCreatorId === currentUser.originalId) ||
    (!!currentUser.username && decodedCreatorId?.toLowerCase() === currentUser.username?.toLowerCase().replace(/^@/, "")) ||
    (!!currentUser.email && decodedCreatorId?.toLowerCase() === currentUser.email?.toLowerCase()) ||
    (decodedCreatorId === "current_user" && currentUser.username !== "invitado" && !currentUser.isGuest);
  const activeUserId = isSelf
    ? (currentUser.originalId || currentUser.username || currentUser.id)
    : selectedCreatorId;

  // Profiles data states
  const [profileUser, setProfileUser] = useState<User | null>(() => {
    if (isSelf) return currentUser;
    if (selectedCreatorId && users) {
      return (
        users.find(
          (u) =>
            u.id === selectedCreatorId ||
            u.username?.toLowerCase() === selectedCreatorId.toLowerCase() ||
            (u.originalId && u.originalId === selectedCreatorId) ||
            u.name?.toLowerCase() === selectedCreatorId.toLowerCase()
        ) || null
      );
    }
    return null;
  });
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userSales, setUserSales] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Sub-section for product management panel: "catalog" (Mis Productos) or "sales" (Ventas Entrantes)
  const [productManagementSection, setProductManagementSection] = useState<"catalog" | "sales">(() => {
    if (typeof window !== "undefined") {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "profile" && parsed.profileTab === "venta") {
        return "sales";
      }
    }
    return "catalog";
  });

  // Tracking inspection modal
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [savedProductsFromApi, setSavedProductsFromApi] = useState<Product[]>([]);
  const effectiveSavedIds = React.useMemo(() => {
    const set = new Set<string>([...(savedReelIds || []), ...(currentUser?.savedReelIds || [])]);
    return Array.from(set);
  }, [savedReelIds, currentUser?.savedReelIds]);
  const savedProducts = React.useMemo(() => {
    const combined = [
      ...savedProductsFromApi,
      ...(products || []).filter((p) => effectiveSavedIds.includes(p.id)),
    ];
    return deduplicateById(combined).filter(
      (p) =>
        effectiveSavedIds.includes(p.id) ||
        savedProductsFromApi.some(
          (sp) => sp.id === p.id && (!savedReelIds || savedReelIds.length === 0 || savedReelIds.includes(p.id))
        )
    );
  }, [savedProductsFromApi, products, effectiveSavedIds, savedReelIds]);

  const [loading, setLoading] = useState(true);
  const isCurrentSuperAdmin = isSuperAdmin(currentUser);
  const [activeSubTab, setActiveSubTab] = useState<
    "publish" | "publications" | "products" | "saved" | "orders" | "performance" | "edit"
  >(() => {
    if (typeof window !== "undefined") {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "profile" && parsed.profileTab === "guardado") {
        return "saved";
      }
      if (parsed.type === "profile" && parsed.profileTab === "compra") {
        return "orders";
      }
      if (parsed.type === "profile" && parsed.profileTab === "config") {
        return "edit";
      }
      if (parsed.type === "profile" && (parsed.profileTab === "producto" || parsed.profileTab === "venta")) {
        return "products";
      }
      if (parsed.type === "profile" && parsed.profileTab === "publicaciones") {
        return "publications";
      }
      if (parsed.type === "profile" && parsed.profileTab === "publicar") {
        return "publish";
      }
      if (parsed.type === "profile" && parsed.profileTab === "rendimiento") {
        return "performance";
      }
    }
    return initialSubTab || ((currentUser.canSell === true || isCurrentSuperAdmin) ? "publish" : "saved");
  });

  const canSell = isSelf && (currentUser.canSell === true || isCurrentSuperAdmin);
  const [publicTab, setPublicTab] = useState<"publications" | "products" | "policies">(() => {
    if (typeof window !== "undefined") {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "profile" && parsed.profileTab === "producto") {
        return "products";
      }
      if (parsed.type === "profile" && parsed.profileTab === "publicaciones") {
        return "publications";
      }
    }
    return "publications";
  });

  // Dedicated user publications feed state
  const [activeFeedReelId, setActiveFeedReelId] = useState<string | null>(null);
  const [editPrivacyPolicy, setEditPrivacyPolicy] = useState(currentUser.privacyPolicy || "");

  const handleSelectSubTab = (
    tab: "publish" | "publications" | "products" | "saved" | "orders" | "performance" | "edit"
  ) => {
    setActiveSubTab(tab);
    if (tab === "products") {
      setProductManagementSection("catalog");
    }
    if (isSelf && typeof window !== "undefined") {
      const targetUser = profileUser || currentUser;
      if (tab === "saved") {
        navigateTo(getProfileSavedPath(targetUser));
      } else if (tab === "orders") {
        navigateTo(getProfileCompraPath(targetUser));
      } else if (tab === "edit") {
        navigateTo(getProfileConfigPath(targetUser));
      } else if (tab === "products") {
        navigateTo(getProfileProductoPath(targetUser));
      } else if (tab === "publications") {
        navigateTo(getProfilePublicacionesPath(targetUser));
      } else if (tab === "publish") {
        navigateTo(getProfilePublicarPath(targetUser));
      } else if (tab === "performance") {
        navigateTo(getProfileRendimientoPath(targetUser));
      } else {
        navigateTo(getProfilePath(targetUser));
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromUrl = () => {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "profile" && parsed.profileTab === "guardado") {
        setActiveSubTab("saved");
      } else if (parsed.type === "profile" && parsed.profileTab === "compra") {
        setActiveSubTab("orders");
      } else if (parsed.type === "profile" && parsed.profileTab === "config") {
        setActiveSubTab("edit");
      } else if (parsed.type === "profile" && parsed.profileTab === "producto") {
        setActiveSubTab("products");
        setProductManagementSection("catalog");
        setPublicTab("products");
      } else if (parsed.type === "profile" && parsed.profileTab === "venta") {
        setActiveSubTab("products");
        setProductManagementSection("sales");
      } else if (parsed.type === "profile" && parsed.profileTab === "publicaciones") {
        setActiveSubTab("publications");
        setPublicTab("publications");
      } else if (parsed.type === "profile" && parsed.profileTab === "publicar") {
        setActiveSubTab("publish");
      } else if (parsed.type === "profile" && parsed.profileTab === "rendimiento") {
        setActiveSubTab("performance");
      }
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("app-route-change", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("app-route-change", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSelf) {
      if (profileUser && publicTab === "products") {
        const expectedProdPath = getProfileProductoPath(profileUser);
        if (window.location.pathname !== expectedProdPath) {
          navigateTo(expectedProdPath, { replace: true });
        }
      } else if (profileUser && publicTab === "publications") {
        const parsed = parseRoute(window.location.pathname);
        if (parsed.type === "profile" && parsed.profileTab === "publicaciones") {
          const expectedPubPath = getProfilePublicacionesPath(profileUser);
          if (window.location.pathname !== expectedPubPath) {
            navigateTo(expectedPubPath, { replace: true });
          }
        }
      }
      return;
    }
    const isGuest = !currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username;
    if (isGuest) return;
    const targetUser = profileUser || currentUser;
    if (activeSubTab === "saved") {
      const expectedSavedPath = getProfileSavedPath(targetUser);
      if (window.location.pathname !== expectedSavedPath) {
        navigateTo(expectedSavedPath, { replace: true });
      }
    } else if (activeSubTab === "orders") {
      const expectedCompraPath = getProfileCompraPath(targetUser);
      if (window.location.pathname !== expectedCompraPath) {
        navigateTo(expectedCompraPath, { replace: true });
      }
    } else if (activeSubTab === "edit") {
      const expectedConfigPath = getProfileConfigPath(targetUser);
      if (window.location.pathname !== expectedConfigPath) {
        navigateTo(expectedConfigPath, { replace: true });
      }
    } else if (activeSubTab === "products") {
      const expectedPath =
        productManagementSection === "sales"
          ? getProfileVentaPath(targetUser)
          : getProfileProductoPath(targetUser);
      if (window.location.pathname !== expectedPath) {
        navigateTo(expectedPath, { replace: true });
      }
    } else if (activeSubTab === "publications") {
      const expectedPubPath = getProfilePublicacionesPath(targetUser);
      if (window.location.pathname !== expectedPubPath) {
        navigateTo(expectedPubPath, { replace: true });
      }
    } else if (activeSubTab === "publish") {
      const expectedPublicarPath = getProfilePublicarPath(targetUser);
      if (window.location.pathname !== expectedPublicarPath) {
        navigateTo(expectedPublicarPath, { replace: true });
      }
    } else if (activeSubTab === "performance") {
      const expectedRendimientoPath = getProfileRendimientoPath(targetUser);
      if (window.location.pathname !== expectedRendimientoPath) {
        navigateTo(expectedRendimientoPath, { replace: true });
      }
    }
  }, [isSelf, activeSubTab, productManagementSection, publicTab, profileUser, currentUser]);

  useEffect(() => {
    if (initialSubTab) {
      handleSelectSubTab(initialSubTab);
      onClearInitialSubTab?.();
    }
  }, [initialSubTab, onClearInitialSubTab]);

  useEffect(() => {
    if (
      isSelf &&
      !canSell &&
      (activeSubTab === "publish" ||
        activeSubTab === "publications" ||
        activeSubTab === "products" ||
        activeSubTab === "performance")
    ) {
      setActiveSubTab("saved");
    }
  }, [isSelf, canSell, activeSubTab]);

  // Whenever the active subtab/tarjeta changes or ProfileView unmounts, dismiss any active reel feed and pause all videos
  useEffect(() => {
    setActiveFeedReelId(null);
    if (typeof document !== "undefined") {
      document.querySelectorAll("video").forEach((v) => {
        try {
          v.pause();
        } catch {}
      });
    }
  }, [activeSubTab, publicTab]);

  useEffect(() => {
    return () => {
      setActiveFeedReelId(null);
      if (typeof document !== "undefined") {
        document.querySelectorAll("video").forEach((v) => {
          try {
            v.pause();
          } catch {}
        });
      }
    };
  }, []);

  useEffect(() => {
    if (isSelf) {
      if (currentUser && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest) {
        setProfileUser(currentUser);
        setEditPrivacyPolicy(currentUser.privacyPolicy || "");
      } else {
        setProfileUser(currentUser);
      }
    } else if (activeUserId) {
      const matched = users?.find(
        (u) =>
          u.id === activeUserId ||
          u.username?.toLowerCase() === activeUserId.toLowerCase() ||
          (u.originalId && u.originalId === activeUserId) ||
          u.name?.toLowerCase() === activeUserId.toLowerCase()
      );
      if (matched) {
        setProfileUser(matched);
      }
    }
  }, [currentUser, isSelf, activeUserId, users]);

  useEffect(() => {
    if (!activeUserId) return;

    // If viewing own guest profile, don't trigger unnecessary network fetch
    if (isSelf && (!currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username)) {
      setProfileUser(currentUser);
      setLoading(false);
      return;
    }

    setLoading(true);

    const targetEndpoint =
      isSelf && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest
        ? `/api/users/${encodeURIComponent(currentUser.originalId || currentUser.username || currentUser.id)}`
        : `/api/users/${encodeURIComponent(activeUserId)}`;

    apiFetch(targetEndpoint)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.user) {
          if (isSelf && currentUser && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest) {
            const resolvedPolicy =
              data.user.privacyPolicy !== undefined ? data.user.privacyPolicy : currentUser.privacyPolicy || "";
            setProfileUser({
              ...currentUser,
              ...data.user,
              id: currentUser.id,
              originalId: currentUser.originalId || data.user.originalId || data.user.id,
              username: currentUser.username || data.user.username,
              name: currentUser.name || data.user.name,
              avatar: currentUser.avatar || data.user.avatar,
              coverPhoto: currentUser.coverPhoto || data.user.coverPhoto,
              isGuest: false,
              privacyPolicy: resolvedPolicy,
            });
            if (resolvedPolicy) {
              setEditPrivacyPolicy(resolvedPolicy);
            }
          } else {
            setProfileUser(data.user);
          }
          setUserProducts(deduplicateById(data.products || []));
          setUserReels(deduplicateById(data.reels || []));
          setUserOrders(deduplicateById(data.purchases || data.orders || []));
          if (data.sales) {
            setUserSales(deduplicateById(data.sales || []));
          }
          setSavedReels(deduplicateById(data.savedReels || []));
          if (data.savedProducts) {
            setSavedProductsFromApi(deduplicateById(data.savedProducts || []));
          }
        } else if (isSelf) {
          setProfileUser(currentUser);
        } else {
          const matched = users?.find(
            (u) =>
              u.id === activeUserId ||
              u.username?.toLowerCase() === activeUserId.toLowerCase() ||
              (u.originalId && u.originalId === activeUserId) ||
              u.name?.toLowerCase() === activeUserId.toLowerCase()
          );
          if (matched) {
            setProfileUser(matched);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Could not fetch remote user details, using client state:", err);
        if (isSelf) {
          setProfileUser(currentUser);
        } else {
          const matched = users?.find(
            (u) =>
              u.id === activeUserId ||
              u.username?.toLowerCase() === activeUserId.toLowerCase() ||
              (u.originalId && u.originalId === activeUserId) ||
              u.name?.toLowerCase() === activeUserId.toLowerCase()
          );
          if (matched) {
            setProfileUser(matched);
          }
        }
        setLoading(false);
      });
  }, [activeUserId, currentUser, isSelf]);

  // Fetch fresh orders (both purchases and sales)
  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const targetOrderUserId = currentUser.originalId || currentUser.username || currentUser.id;
      const res = await apiFetch(`/api/orders?userId=${encodeURIComponent(targetOrderUserId)}`);
      const data = await res.json();
      if (data && !data.error) {
        if (data.purchases) {
          setUserOrders(deduplicateById(data.purchases));
        } else if (Array.isArray(data)) {
          setUserOrders(deduplicateById(data));
        }
        if (data.sales) {
          setUserSales(deduplicateById(data.sales));
        }
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (
      isSelf &&
      (activeSubTab === "orders" || activeSubTab === "products") &&
      currentUser &&
      !currentUser.isGuest &&
      currentUser.username !== "invitado"
    ) {
      fetchOrders();
    }
  }, [isSelf, activeSubTab, currentUser.id, currentUser.originalId, currentUser.username]);

  // Listen to WebSocket events for real-time order tracking updates
  useEffect(() => {
    if (!socket) return;
    const handleWsMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "order_created" || payload.type === "order_updated") {
          const updated: Order = payload.order;
          if (updated) {
            setUserOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === updated.id);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              const isBuyer =
                updated.buyerId === currentUser.id ||
                updated.buyerId === "current_user" ||
                (currentUser.originalId && updated.buyerId === currentUser.originalId) ||
                (updated.buyerUsername && updated.buyerUsername.toLowerCase() === currentUser.username?.toLowerCase());
              return isBuyer ? [updated, ...prev] : prev;
            });

            setUserSales((prev) => {
              const idx = prev.findIndex((o) => o.id === updated.id);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              const isSeller = updated.items.some(
                (it) =>
                  it.sellerId === currentUser.id ||
                  it.sellerId === "current_user" ||
                  (currentUser.originalId && it.sellerId === currentUser.originalId) ||
                  (it.sellerUsername && it.sellerUsername.toLowerCase() === currentUser.username?.toLowerCase())
              );
              return isSeller ? [updated, ...prev] : prev;
            });

            setSelectedTrackingOrder((prev) => (prev && prev.id === updated.id ? updated : prev));
          }
        }
      } catch (e) {}
    };

    socket.addEventListener("message", handleWsMessage);
    return () => {
      socket.removeEventListener("message", handleWsMessage);
    };
  }, [socket, currentUser.id, currentUser.originalId, currentUser.username]);

  const handleCopyTrackingNumber = (trackingNum: string, orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTrackingId(orderId);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  const isGuestMode =
    isSelf &&
    (!currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username);

  if (isGuestMode) {
    return (
      <div
        className="w-full max-w-4xl mx-auto pb-0 overflow-x-hidden"
        id="guest-profile-login-wrapper"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
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

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[550px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-500 pb-0">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold mt-4">Sincronizando perfil...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="w-full max-w-4xl mx-auto h-[450px] bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-500 p-6 text-center pb-0">
        <p className="font-bold text-slate-700">Perfil no disponible</p>
        <button
          onClick={onBackToSelf}
          className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
        >
          Regresar a mi perfil
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-4xl mx-auto min-h-[600px] bg-white rounded-none sm:rounded-t-none sm:rounded-b-2xl border-0 sm:border sm:border-slate-200 shadow-none sm:shadow-xl overflow-hidden flex flex-col no-scrollbar pb-0"
      id="profile-panel"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {/* Profile Header Image Backbanner */}
      <div className="h-40 bg-slate-900 relative overflow-hidden rounded-t-none">
        {profileUser.coverPhoto && profileUser.coverPhoto.trim().length > 0 ? (
          <img
            src={profileUser.coverPhoto}
            alt="Profile cover banner"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85 rounded-t-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = getDefaultCoverPhoto();
            }}
          />
        ) : (
          <img
            src={getDefaultCoverPhoto()}
            alt="Profile cover banner"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85 rounded-t-none"
          />
        )}
        <div className="absolute inset-0 bg-slate-950/20" />

        {/* Top-Right Logout Button - Only visible on user's own profile */}
        {isSelf && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            id="profile-logout-btn"
            className="absolute top-3 right-3 z-20 p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer flex items-center justify-center group"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5 text-white group-hover:text-red-400 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </button>
        )}
      </div>

      {/* Profile Info Details Overlay row */}
      <div className="px-6 sm:px-8 pb-0 relative border-b border-slate-200/80 bg-slate-50 rounded-t-3xl -mt-6 z-10">
        <div
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between -mt-12 sm:-mt-16 mb-4 gap-4 z-10 relative"
          style={{ marginTop: "-16px", marginBottom: "0px" }}
        >
          <div className="flex items-end space-x-4">
            <div className="flex flex-col items-center shrink-0">
              <img
                src={profileUser.avatar || getDefaultAvatar()}
                alt={profileUser.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-md bg-white shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getDefaultAvatar();
                }}
              />
              <span className="text-xs text-slate-500 font-bold font-mono mt-1 text-center">
                @{profileUser.username}
              </span>
            </div>
            <div className="pb-1">
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-950 flex items-center space-x-2 flex-wrap">
                <span className="inline-block" style={{ paddingLeft: "18px" }}>
                  {profileUser.name}
                </span>
                {(isSuperAdmin(profileUser) || !isSelf) && (
                  <BadgeCheck className="w-5 h-5 fill-sky-500 text-white shrink-0" title="Verificado" />
                )}
              </h2>
              {/* Followers and Following counters - Only for Sellers / Admins */}
              {(profileUser.canSell === true || isSuperAdmin(profileUser)) &&
                (() => {
                  const matchedUserInList = users?.find(
                    (u) =>
                      u.id === profileUser.id ||
                      (profileUser.username && u.username?.toLowerCase() === profileUser.username.toLowerCase()) ||
                      (profileUser.originalId && u.originalId === profileUser.originalId)
                  );
                  const effectiveFollowers = matchedUserInList?.followers ?? (profileUser.followers || 0);

                  return (
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs font-bold text-slate-900">
                        seguidores: {effectiveFollowers.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        seguidos: {profileUser.following.toLocaleString()}
                      </span>
                    </div>
                  );
                })()}
            </div>
          </div>

          {/* Call-to-actions / Session indicator */}
          <div className="sm:pb-1 flex items-center space-x-2">
            {!isSelf && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenDirectChat(profileUser)}
                  className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                  id="message-creator-btn"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Mensaje</span>
                </button>

                {onToggleFollowUser &&
                  (() => {
                    const isFollowingCreator = Boolean(
                      currentUser.followingUserIds?.some(
                        (id) =>
                          id === profileUser.id ||
                          id === profileUser.username ||
                          (profileUser.originalId && id === profileUser.originalId) ||
                          (profileUser.username && id.toLowerCase() === profileUser.username.toLowerCase()) ||
                          (profileUser.id && id.toLowerCase() === profileUser.id.toLowerCase())
                      )
                    );

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (isSelf) return;
                          const targetId =
                            profileUser.username && profileUser.username !== "invitado"
                              ? profileUser.username
                              : profileUser.id && profileUser.id !== "current_user"
                              ? profileUser.id
                              : profileUser.name || "current_user";
                          onToggleFollowUser(targetId);
                        }}
                        id="follow-creator-profile-btn"
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer active:scale-95 border ${
                          isFollowingCreator
                            ? "bg-slate-200/90 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-300 hover:border-rose-200"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500 font-extrabold"
                        } ${isSelf ? "opacity-75 cursor-default" : ""}`}
                      >
                        {isFollowingCreator ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>Siguiendo</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>{isSelf ? "Tu Perfil" : "Seguir"}</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
              </>
            )}
          </div>
        </div>

        {/* Biography summary (Max 50 chars) */}
        {profileUser.bio && (
          <div className="mt-2 mb-1">
            <p className="text-xs text-slate-800 leading-relaxed font-medium max-w-sm break-words bg-transparent rounded-none px-0 py-0.5 shadow-none border-0">
              {profileUser.bio.length > 50 ? profileUser.bio.slice(0, 50) + "..." : profileUser.bio}
            </p>
          </div>
        )}

        {/* Horizontal Menu with Icons Only */}
        {isSelf ? (
          <div className="mt-2 pt-0.5 border-t border-slate-200/80 flex items-center justify-around w-full max-w-sm sm:max-w-md mx-auto">
            {canSell && (
              <button
                onClick={() => handleSelectSubTab("publish")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "publish" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Publicar"
                id="profile-subtab-publish"
              >
                <Plus className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "publish" && (
                  <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            )}

            {canSell && (
              <button
                onClick={() => handleSelectSubTab("publications")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "publications"
                    ? "text-amber-500 font-bold scale-105"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="Mis Publicaciones"
                id="profile-subtab-publications"
              >
                <Play className="w-4.5 h-4.5 fill-current stroke-[2]" />
                {activeSubTab === "publications" && (
                  <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            )}

            {canSell && (
              <button
                onClick={() => {
                  handleSelectSubTab("products");
                  fetchOrders();
                }}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "products" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title={`Gestión de Productos y Ventas (${userProducts.length} productos, ${userSales.length} ventas)`}
                id="profile-subtab-products"
              >
                <Package className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "products" && (
                  <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            )}

            <button
              onClick={() => handleSelectSubTab("saved")}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "saved" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Publicaciones Guardadas"
              id="profile-subtab-saved"
            >
              <Bookmark className="w-4.5 h-4.5 stroke-[2]" />
              {activeSubTab === "saved" && (
                <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>

            <button
              onClick={() => {
                handleSelectSubTab("orders");
                fetchOrders();
              }}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "orders" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Historial de Mis Compras"
              id="profile-subtab-orders"
            >
              <ShoppingBag className="w-4.5 h-4.5 stroke-[2]" />
              {userOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded-full min-w-3 h-3 flex items-center justify-center border border-white leading-none shadow-xs">
                  {userOrders.length}
                </span>
              )}
              {activeSubTab === "orders" && (
                <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>

            {canSell && (
              <button
                onClick={() => handleSelectSubTab("performance")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "performance" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Rendimiento"
                id="profile-subtab-performance"
              >
                <BarChart3 className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "performance" && (
                  <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
                )}
              </button>
            )}

            <button
              onClick={() => handleSelectSubTab("edit")}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "edit" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Editar Perfil"
              id="profile-subtab-edit"
            >
              <Settings className="w-4.5 h-4.5 stroke-[2]" />
              {activeSubTab === "edit" && (
                <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />
              )}
            </button>
          </div>
        ) : (
          <div className="mt-2 pt-0.5 border-t border-slate-200/80 flex items-center justify-around w-full max-w-sm sm:max-w-md mx-auto">
            <button
              onClick={() => {
                setPublicTab("publications");
                if (profileUser) navigateTo(getProfilePublicacionesPath(profileUser));
              }}
              className={`py-1.5 px-3.5 sm:px-4 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                publicTab === "publications"
                  ? "text-amber-500 font-bold scale-105"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title={`Publicaciones (${userReels.length})`}
              id="public-tab-publications"
            >
              <Play className="w-4.5 h-4.5 fill-current stroke-[2]" />
              {publicTab === "publications" && (
                <motion.div
                  layoutId="activePublicTabIndicator"
                  className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>

            <button
              onClick={() => {
                setPublicTab("products");
                if (profileUser) navigateTo(getProfileProductoPath(profileUser));
              }}
              className={`py-1.5 px-3.5 sm:px-4 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                publicTab === "products"
                  ? "text-amber-500 font-bold scale-105"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title={`Catálogo (${userProducts.length})`}
              id="public-tab-products"
            >
              <ShoppingBag className="w-4.5 h-4.5 stroke-[2]" />
              {publicTab === "products" && (
                <motion.div
                  layoutId="activePublicTabIndicator"
                  className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>

            <button
              onClick={() => {
                setPublicTab("policies");
                if (profileUser) navigateTo(getProfilePath(profileUser));
              }}
              className={`py-1.5 px-3.5 sm:px-4 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                publicTab === "policies"
                  ? "text-amber-500 font-bold scale-105"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Política y Privacidad del Negocio"
              id="public-tab-policies"
            >
              <FileText className="w-4.5 h-4.5 stroke-[2]" />
              {publicTab === "policies" && (
                <motion.div
                  layoutId="activePublicTabIndicator"
                  className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full"
                />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Profile Inner Section tabs */}
      <div className="flex-1 p-4 sm:p-6 pt-3 sm:pt-4 pb-0">
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
                {activeSubTab === "publish" && canSell && (
                  <motion.div
                    key="admin-publish"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-amber-500" />
                        <span>Publicar</span>
                      </h3>
                    </div>
                    <PublishView
                      currentUser={currentUser}
                      userProducts={userProducts}
                      onBack={() => handleSelectSubTab("publications")}
                      onSuccess={() => {
                        handleSelectSubTab("publications");
                        onPublishSuccess?.();
                      }}
                    />
                  </motion.div>
                )}

                {activeSubTab === "publications" && canSell && (
                  <PublicacionesPerfilView
                    userReels={userReels}
                    onSelectReel={(reelId) => setActiveFeedReelId(reelId)}
                    onUpdateReels={setUserReels}
                    onPublishSuccess={onPublishSuccess}
                  />
                )}

                {activeSubTab === "products" && canSell && (
                  <ProductosPerfilView
                    currentUser={currentUser}
                    userProducts={userProducts}
                    userSales={userSales}
                    ordersLoading={ordersLoading}
                    section={productManagementSection}
                    onSectionChange={(nextSection) => {
                      setProductManagementSection(nextSection);
                      if (isSelf) {
                        const targetUser = profileUser || currentUser;
                        navigateTo(
                          nextSection === "sales"
                            ? getProfileVentaPath(targetUser)
                            : getProfileProductoPath(targetUser)
                        );
                      }
                    }}
                    onRefreshOrders={fetchOrders}
                    onSelectProduct={onSelectProduct}
                    onUpdateProducts={setUserProducts}
                    onUpdateSales={setUserSales}
                    onUpdateOrders={setUserOrders}
                    onRefreshUsers={onRefreshUsers}
                    onSelectTrackingOrder={(order) => setSelectedTrackingOrder(order)}
                  />
                )}

                {activeSubTab === "saved" && (
                  <GuardadoPerfilView
                    savedProducts={savedProducts}
                    savedReels={savedReels}
                    onSelectProduct={onSelectProduct}
                    onToggleSave={onToggleSave}
                    onRemoveSavedProductFromLocal={(productId) =>
                      setSavedProductsFromApi((prev) => prev.filter((p) => p.id !== productId))
                    }
                    onSelectReel={(reelId) => setActiveFeedReelId(reelId)}
                  />
                )}

                {activeSubTab === "orders" && (
                  <CompraPerfilView
                    userOrders={userOrders}
                    userSales={userSales}
                    ordersLoading={ordersLoading}
                    onRefreshOrders={fetchOrders}
                    onNavigateToSales={() => {
                      setActiveSubTab("products");
                      setProductManagementSection("sales");
                      if (isSelf) {
                        navigateTo(getProfileVentaPath(profileUser || currentUser));
                      }
                      fetchOrders();
                    }}
                    onSelectTrackingOrder={(order) => setSelectedTrackingOrder(order)}
                  />
                )}

                {activeSubTab === "performance" && canSell && (
                  <RendimientoPerfilView userReels={userReels} userProducts={userProducts} />
                )}

                {activeSubTab === "edit" && (
                  <ConfigPerfilView
                    currentUser={currentUser}
                    profileUser={profileUser}
                    users={users}
                    onProfileSaved={(updatedUser) => {
                      setProfileUser(updatedUser);
                      if (onProfileUpdate) {
                        onProfileUpdate(updatedUser);
                      }
                    }}
                    onRefreshUsers={onRefreshUsers}
                    onBackToSelf={onBackToSelf}
                    onCancel={() => handleSelectSubTab(canSell ? "publications" : "saved")}
                    onPrivacyPolicyChange={(policy) => setEditPrivacyPolicy(policy)}
                  />
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
              className="space-y-6"
            >
              <AnimatePresence mode="wait">
                {publicTab === "publications" ? (
                  <motion.div
                    key="public-reels"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {userReels.map((reel, index) => (
                        <div
                          key={`${reel.id}-${index}`}
                          onClick={() => setActiveFeedReelId(reel.id)}
                          className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                          id={`profile-reel-${reel.id}`}
                        >
                          <PublicationCover reel={reel} />
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
                        <div className="col-span-full py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <Play className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-500">No hay publicaciones disponibles</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Este creador no ha compartido videos todavía.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : publicTab === "products" ? (
                  <motion.div
                    key="public-products"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {userProducts.map((prod, index) => (
                        <div
                          key={`${prod.id}-${index}`}
                          onClick={() => onSelectProduct(prod)}
                          className="flex flex-row items-stretch rounded-2xl border border-slate-200 hover:border-amber-500/40 bg-white hover:bg-slate-50/80 shadow-xs hover:shadow-md cursor-pointer transition-all overflow-hidden group min-h-[115px] sm:min-h-[125px]"
                          id={`profile-prod-${prod.id}`}
                        >
                          <div className="w-28 sm:w-32 self-stretch shrink-0 relative bg-slate-100 overflow-hidden">
                            {prod.imageUrl ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 p-3 sm:p-3.5 flex flex-col justify-between">
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{prod.name}</h4>
                              <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                                {prod.description}
                              </p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-black font-mono text-emerald-600">
                                  ${prod.price.toFixed(2)}
                                </span>
                                {prod.freeShipping && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <Truck className="w-2.5 h-2.5" />
                                    <span>Envío Gratis</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                                Ver detalles →
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {userProducts.length === 0 && (
                        <div className="col-span-full py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-500">Sin productos en venta</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Este creador no tiene productos en su catálogo en este momento.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="public-policies"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4 max-w-2xl mx-auto"
                  >
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-extrabold text-sm sm:text-base text-white">
                            Política y Privacidad del Negocio
                          </h3>
                          <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                            Términos comerciales, garantías y resguardo de datos de{" "}
                            <span className="text-amber-400 font-bold">{profileUser.name}</span> (@{profileUser.username}).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-slate-700/60">
                        <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/5 border border-white/5">
                          <Shield className="w-4 h-4 text-emerald-400 mb-1" />
                          <span className="text-[10px] font-bold text-white leading-tight">Compra Segura</span>
                          <span className="text-[9px] text-slate-400">Garantizada</span>
                        </div>
                        <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/5 border border-white/5">
                          <Lock className="w-4 h-4 text-sky-400 mb-1" />
                          <span className="text-[10px] font-bold text-white leading-tight">Privacidad</span>
                          <span className="text-[9px] text-slate-400">100% Protegido</span>
                        </div>
                        <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/5 border border-white/5">
                          <MessageCircle className="w-4 h-4 text-amber-400 mb-1" />
                          <span className="text-[10px] font-bold text-white leading-tight">Atención</span>
                          <span className="text-[9px] text-slate-400">Chat Directo</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
                      <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Términos y Políticas del Vendedor
                        </h4>
                      </div>

                      {(() => {
                        const matchedUser = users?.find(
                          (u) =>
                            u.id === profileUser.id ||
                            (profileUser.username && u.username?.toLowerCase() === profileUser.username.toLowerCase()) ||
                            (profileUser.originalId && u.originalId === profileUser.originalId) ||
                            (profileUser.name && u.name?.toLowerCase() === profileUser.name.toLowerCase())
                        );
                        const effectivePolicy =
                          (profileUser.privacyPolicy && profileUser.privacyPolicy.trim()) ||
                          (matchedUser?.privacyPolicy && matchedUser.privacyPolicy.trim()) ||
                          (isSelf && editPrivacyPolicy && editPrivacyPolicy.trim()) ||
                          "";

                        return effectivePolicy ? (
                          <div className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-line space-y-2 bg-slate-50/60 p-4 rounded-xl border border-slate-100">
                            {effectivePolicy}
                          </div>
                        ) : (
                          <div className="space-y-3 py-2">
                            <div className="p-3.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-amber-900 text-xs leading-relaxed font-medium">
                              <p className="font-bold mb-1">Garantías estándar de la plataforma:</p>
                              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                                <li>Todas tus transacciones cuentan con protección al comprador.</li>
                                <li>Puedes comunicarte directamente con el vendedor a través del chat oficial.</li>
                                <li>Tus datos personales y dirección solo son usados para la logística del despacho.</li>
                              </ul>
                            </div>
                            <p className="text-[11px] text-slate-400 italic text-center">
                              (El vendedor aún no ha configurado términos adicionales personalizados)
                            </p>
                          </div>
                        );
                      })()}

                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          ¿Deseas consultar o aclarar alguna duda?
                        </span>
                        <button
                          onClick={() => onOpenDirectChat(profileUser)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Contactar al Negocio</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* MODAL: LIVE TRACKING & EXPANDED DISPATCH TIMELINE */}
      <AnimatePresence>
        {selectedTrackingOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
            onClick={() => setSelectedTrackingOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col"
              id="modal-live-tracking"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <PackageSearch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-slate-900">Rastreo de Envío en Vivo</h3>
                    <p className="text-[11px] font-mono text-slate-500">Ref: {selectedTrackingOrder.id}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTrackingOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 rounded-2xl border border-amber-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center space-x-1">
                      <Truck className="w-3 h-3" />
                      <span>{selectedTrackingOrder.carrier || "Paquetería Express"}</span>
                    </span>

                    {selectedTrackingOrder.estimatedDelivery && (
                      <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        <span>Entrega: {selectedTrackingOrder.estimatedDelivery}</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Número de Guía / Seguimiento
                    </p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-base font-black font-mono text-slate-900 tracking-wider">
                        {selectedTrackingOrder.trackingNumber || "Pendiente de asignación"}
                      </span>
                      {selectedTrackingOrder.trackingNumber && (
                        <button
                          onClick={(e) =>
                            handleCopyTrackingNumber(
                              selectedTrackingOrder.trackingNumber!,
                              selectedTrackingOrder.id,
                              e
                            )
                          }
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedTrackingId === selectedTrackingOrder.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] text-emerald-700 font-bold">¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Copiar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedTrackingOrder.trackingUrl && (
                    <div className="pt-1">
                      <a
                        href={selectedTrackingOrder.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline"
                      >
                        <span>Abrir portal oficial de {selectedTrackingOrder.carrier || "paquetería"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
                    Estado Actual del Paquete
                  </p>
                  {(() => {
                    const st = selectedTrackingOrder.status;
                    const step = st === "delivered" ? 4 : st === "shipped" ? 3 : st === "processing" ? 2 : 1;
                    return (
                      <div className="relative flex items-center justify-between px-2">
                        <div className="absolute left-6 right-6 top-3 h-1 bg-slate-200 z-0" />
                        <div
                          className="absolute left-6 top-3 h-1 bg-amber-500 transition-all duration-300 z-0"
                          style={{
                            width: step === 1 ? "0%" : step === 2 ? "33%" : step === 3 ? "66%" : "100%",
                          }}
                        />

                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              step >= 1
                                ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 mt-1">Confirmado</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              step >= 2
                                ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {step > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 mt-1">Preparando</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              step >= 3
                                ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {step > 3 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 mt-1">En Camino</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              step === 4
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {step === 4 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 mt-1">Entregado</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Historial Cronológico de Paradas y Despacho
                  </p>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                    {selectedTrackingOrder.statusHistory && selectedTrackingOrder.statusHistory.length > 0 ? (
                      selectedTrackingOrder.statusHistory.map((h, hIdx) => (
                        <div key={hIdx} className="flex items-start space-x-3 text-xs">
                          <div className="relative flex flex-col items-center">
                            <div className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[8px] font-black ring-4 ring-amber-50 shrink-0">
                              ✓
                            </div>
                            {hIdx < (selectedTrackingOrder.statusHistory?.length || 1) - 1 && (
                              <div className="w-0.5 h-10 bg-slate-200 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 space-y-0.5 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-extrabold text-slate-900 text-xs truncate">
                                {h.label || "Actualización de despacho"}
                              </p>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {new Date(h.timestamp).toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {h.note && <p className="text-[11px] text-slate-600">{h.note}</p>}
                            {h.trackingNumber && (
                              <p className="text-[10px] text-amber-700 font-mono font-bold">
                                Guía asignada: {h.trackingNumber} ({h.carrier || "Transportista"})
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-xs">
                        <Clock className="w-6 h-6 mx-auto mb-1 stroke-1 text-slate-300" />
                        <p>El paquete está en proceso de despacho inicial.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start space-x-2.5 text-xs text-slate-600">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-800">Dirección de Destino:</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{selectedTrackingOrder.shippingAddress}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedTrackingOrder(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPONENTE EXCLUSIVO PARA MOSTRAR LA LISTA DE PUBLICACIONES DE UN USUARIO */}
      <AnimatePresence>
        {activeFeedReelId && (
          <UserPublicationsFeed
            user={profileUser || currentUser}
            reels={
              (isSelf && activeSubTab === "saved" ? savedReels : userReels).some((r) => r.id === activeFeedReelId)
                ? isSelf && activeSubTab === "saved"
                  ? savedReels
                  : userReels
                : userReels.some((r) => r.id === activeFeedReelId)
                ? userReels
                : savedReels.some((r) => r.id === activeFeedReelId)
                ? savedReels
                : [...userReels, ...savedReels.filter((sr) => !userReels.some((ur) => ur.id === sr.id))]
            }
            products={userProducts}
            initialReelId={activeFeedReelId}
            currentUser={currentUser}
            onClose={() => setActiveFeedReelId(null)}
            onSelectProduct={onSelectProduct}
            onToggleFollowUser={onToggleFollowUser}
            onDeleteReel={(reelId) => {
              setUserReels((prev) => prev.filter((r) => r.id !== reelId));
              if (onPublishSuccess) onPublishSuccess();
            }}
            onUpdateReels={(updatedReels) => {
              if (activeSubTab === "saved") {
                setSavedReels(updatedReels);
              } else {
                setUserReels(updatedReels);
              }
            }}
            savedReelIds={currentUser.savedReelIds || []}
            onToggleSaveReel={(reelId) => {
              apiFetch(`/api/users/${currentUser.id}/save-reel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reelId }),
              }).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
