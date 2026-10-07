import React, { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  LayoutDashboard,
  Users,
  Video,
  ShoppingBag,
  Package,
  Truck,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Eye,
  Heart,
  Activity,
  Database,
  Server,
  X,
  Plus,
  Loader2,
  ChevronRight,
  Filter,
  ArrowUpRight,
  Sparkles,
  Edit3,
  Image as ImageIcon,
  Camera,
  Upload,
  RotateCcw,
  Link as LinkIcon,
  Check,
  UserCheck,
  BarChart3,
  Headphones
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Reel, Product, Order, NavigationTab } from "../../types";
import PublishView from "./publicar";
import UsuariosAdminView from "./usuarios";
import ReelsAdminView from "./reels";
import ProductoAdminView from "./producto";
import PedidosAdminView from "./pedidos";
import MetricaAdminView from "./metrica";
import SistemaAdminView from "./sistema";
import { apiFetch } from "../../config";
import { sessionState } from "../../utils/sessionState";
import { isSuperAdmin } from "../../superAdmin";
import { navigateTo } from "../../router";
import {
  getDefaultAvatar,
  getDefaultCoverPhoto,
  setDefaultAssetsCache,
  AVATAR_PRESETS,
  COVER_PRESETS,
  FALLBACK_DEFAULT_AVATAR,
  FALLBACK_DEFAULT_COVER
} from "../../utils/defaultAssets";

export interface AdminViewProps {
  currentUser: User;
  users: User[];
  reels: Reel[];
  products: Product[];
  onRefreshAll: () => void;
  onCreatorClick: (creatorId: string) => void;
  onProductClick: (product: Product) => void;
  onReelClick: (reelId: string) => void;
  onNavigateToTab: (tab: NavigationTab) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setReels: React.Dispatch<React.SetStateAction<Reel[]>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  activePlatform?: 'android' | 'web';
  onSwitchPlatform?: (platform: 'android' | 'web') => void;
}

type AdminTab = 'resumen' | 'usuarios' | 'reels' | 'productos' | 'publicar' | 'ordenes' | 'metrica' | 'fotos_defecto' | 'sistema';

const VALID_ADMIN_TABS: AdminTab[] = ['resumen', 'usuarios', 'reels', 'productos', 'publicar', 'ordenes', 'metrica', 'fotos_defecto', 'sistema'];

function parseAdminTabFromPath(pathname: string): AdminTab {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {}
  const match = decoded.trim().replace(/\/+$/, '').match(/^\/(?:src\/app\/|app\/(?:web\/)?)?admin\/([^/]+)/i);
  if (match) {
    const raw = match[1].toLowerCase();
    if (raw === 'producto' || raw === 'productos') return 'productos';
    if (raw === 'pedido' || raw === 'pedidos' || raw === 'ordenes') return 'ordenes';
    if (raw === 'metrica' || raw === 'metricas' || raw === 'métrica' || raw === 'métricas' || raw === 'embudo') return 'metrica';
    const seg = raw as AdminTab;
    if (VALID_ADMIN_TABS.includes(seg)) return seg;
  }
  return 'resumen';
}

export default function AdminView({
  currentUser,
  users,
  reels,
  products,
  onRefreshAll,
  onCreatorClick,
  onProductClick,
  onReelClick,
  onNavigateToTab,
  setUsers,
  setReels,
  setProducts,
  activePlatform = 'web',
  onSwitchPlatform
}: AdminViewProps) {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      return parseAdminTabFromPath(window.location.pathname);
    }
    return 'resumen';
  });

  const handleSelectAdminTab = (tab: AdminTab) => {
    setActiveAdminTab(tab);
    const routeSegment =
      tab === 'productos'
        ? 'producto'
        : tab === 'ordenes'
        ? 'pedidos'
        : tab;
    navigateTo(`/admin/${routeSegment}`);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncTabFromUrl = () => {
      const nextTab = parseAdminTabFromPath(window.location.pathname);
      setActiveAdminTab((prev) => (prev === nextTab ? prev : nextTab));
    };
    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('app-route-change', syncTabFromUrl);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('app-route-change', syncTabFromUrl);
    };
  }, []);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishInitialTab, setPublishInitialTab] = useState<"video" | "image" | "carousel" | "product">("product");

  // Filter & Search states
  const [userSearch, setUserSearch] = useState("");
  const [reelSearch, setReelSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  // Deletion modal states
  const [deletingTarget, setDeletingTarget] = useState<{
    type: 'user' | 'reel' | 'product';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingPermissionId, setUpdatingPermissionId] = useState<string | null>(null);

  // Order editing modal states
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderNewStatus, setOrderNewStatus] = useState<string>("processing");
  const [orderNewCarrier, setOrderNewCarrier] = useState<string>("");
  const [orderNewTracking, setOrderNewTracking] = useState<string>("");
  const [orderNewNotes, setOrderNewNotes] = useState<string>("");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Default Assets State (Avatar & Cover Banner)
  const [defaultAvatar, setDefaultAvatar] = useState<string>(getDefaultAvatar());
  const [defaultCoverPhoto, setDefaultCoverPhoto] = useState<string>(getDefaultCoverPhoto());
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  const [isResettingDefaults, setIsResettingDefaults] = useState(false);
  const [avatarTabMode, setAvatarTabMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [coverTabMode, setCoverTabMode] = useState<'upload' | 'url' | 'presets'>('upload');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [customCoverUrl, setCustomCoverUrl] = useState('');

  // Platform switcher state (app/web <-> app/movil)
  const [currentPlatform, setCurrentPlatform] = useState<'android' | 'web'>(() => {
    return activePlatform || (sessionState.getPlatform() as 'android' | 'web') || 'web';
  });

  useEffect(() => {
    if (activePlatform) {
      setCurrentPlatform(activePlatform);
    }
  }, [activePlatform]);

  const handlePlatformChange = (target: 'android' | 'web') => {
    setCurrentPlatform(target);
    sessionState.setPlatform(target);
    if (onSwitchPlatform) {
      onSwitchPlatform(target);
    } else {
      window.location.reload();
    }
  };

  // System status
  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    server: string;
    mongoConnected: boolean;
    uptime?: number;
    timestamp?: string;
  } | null>(null);

  // Fetch orders, default assets and system health on mount
  const fetchOrdersAndHealth = async () => {
    setIsLoadingOrders(true);
    try {
      // 1. Fetch orders
      const ordersRes = await apiFetch("/api/orders");
      const ordersData = await ordersRes.json().catch(() => []);
      if (Array.isArray(ordersData)) {
        setAllOrders(ordersData);
      } else if (ordersData && Array.isArray(ordersData.orders)) {
        setAllOrders(ordersData.orders);
      }

      // 2. Fetch health
      const healthRes = await apiFetch("/api/health").catch(() => null);
      if (healthRes) {
        const healthData = await healthRes.json().catch(() => null);
        if (healthData) {
          setSystemHealth(healthData);
        }
      }

      // 3. Fetch default assets
      const defaultsRes = await apiFetch("/api/admin/default-assets").catch(() => null);
      if (defaultsRes && defaultsRes.ok) {
        const defaultsData = await defaultsRes.json().catch(() => null);
        if (defaultsData) {
          if (defaultsData.defaultAvatar) setDefaultAvatar(defaultsData.defaultAvatar);
          if (defaultsData.defaultCoverPhoto) setDefaultCoverPhoto(defaultsData.defaultCoverPhoto);
          setDefaultAssetsCache(defaultsData.defaultAvatar, defaultsData.defaultCoverPhoto);
        }
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleSaveDefaultAssets = async () => {
    setIsSavingDefaults(true);
    try {
      const res = await apiFetch("/api/admin/default-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultAvatar,
          defaultCoverPhoto
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        if (data.defaultAvatar) setDefaultAvatar(data.defaultAvatar);
        if (data.defaultCoverPhoto) setDefaultCoverPhoto(data.defaultCoverPhoto);
        setDefaultAssetsCache(data.defaultAvatar, data.defaultCoverPhoto);
        setStatusMessage({
          type: 'success',
          text: '¡Fotos por defecto guardadas con éxito! Se aplicarán a todas las cuentas nuevas y perfiles sin fotos personalizadas.'
        });
      } else {
        throw new Error(data.error || "Error al actualizar imágenes");
      }
    } catch (err: any) {
      console.error("Error saving default assets:", err);
      setStatusMessage({ type: 'error', text: err.message || 'Error al guardar imágenes por defecto' });
    } finally {
      setIsSavingDefaults(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleResetDefaultAssets = async () => {
    if (!window.confirm("¿Restablecer las fotos de perfil y portada por defecto a los valores originales de fábrica?")) return;
    setIsResettingDefaults(true);
    try {
      const res = await apiFetch("/api/admin/default-assets/reset", {
        method: "POST"
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDefaultAvatar(data.defaultAvatar || FALLBACK_DEFAULT_AVATAR);
        setDefaultCoverPhoto(data.defaultCoverPhoto || FALLBACK_DEFAULT_COVER);
        setDefaultAssetsCache(data.defaultAvatar, data.defaultCoverPhoto);
        setStatusMessage({
          type: 'success',
          text: 'Fotos por defecto restablecidas a los valores originales de fábrica.'
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al restablecer imágenes' });
    } finally {
      setIsResettingDefaults(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona una imagen válida (JPG, PNG, WEBP).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDefaultAvatar(reader.result);
        setStatusMessage({ type: 'info', text: 'Nueva foto de perfil cargada. Haz clic en "Guardar Cambios" para confirmar.' });
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona una imagen válida (JPG, PNG, WEBP).' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDefaultCoverPhoto(reader.result);
        setStatusMessage({ type: 'info', text: 'Nueva foto de portada cargada. Haz clic en "Guardar Cambios" para confirmar.' });
        setTimeout(() => setStatusMessage(null), 4000);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyCustomAvatarUrl = () => {
    const trimmed = customAvatarUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:")) {
      setStatusMessage({ type: 'error', text: 'El enlace debe ser una URL web válida (http:// o https://).' });
      return;
    }
    setDefaultAvatar(trimmed);
    setCustomAvatarUrl('');
    setStatusMessage({ type: 'info', text: 'URL de avatar aplicada. Haz clic en "Guardar Cambios" para confirmar.' });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const applyCustomCoverUrl = () => {
    const trimmed = customCoverUrl.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:")) {
      setStatusMessage({ type: 'error', text: 'El enlace debe ser una URL web válida (http:// o https://).' });
      return;
    }
    setDefaultCoverPhoto(trimmed);
    setCustomCoverUrl('');
    setStatusMessage({ type: 'info', text: 'URL de portada aplicada. Haz clic en "Guardar Cambios" para confirmar.' });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  useEffect(() => {
    fetchOrdersAndHealth();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchOrdersAndHealth(),
      Promise.resolve(onRefreshAll())
    ]);
    setIsRefreshing(false);
    setStatusMessage({ type: 'success', text: 'Datos administrativos actualizados exitosamente' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Aggregated KPIs
  const totalUsersCount = users.length;
  const totalReelsCount = reels.length;
  const totalProductsCount = products.length;
  const totalOrdersCount = allOrders.length;
  
  const totalPlatformRevenue = useMemo(() => {
    return allOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  }, [allOrders]);

  const totalReelViews = useMemo(() => {
    return reels.reduce((sum, r) => sum + (Number(r.views) || 0), 0);
  }, [reels]);

  const totalReelLikes = useMemo(() => {
    return reels.reduce((sum, r) => sum + (Number(r.likes) || 0), 0);
  }, [reels]);

  // Filtered lists
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredReels = useMemo(() => {
    const q = reelSearch.toLowerCase().trim();
    if (!q) return reels;
    return reels.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.creatorName.toLowerCase().includes(q) ||
        (r.creatorUsername && r.creatorUsername.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
    );
  }, [reels, reelSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.sellerName && p.sellerName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === "all") return allOrders;
    return allOrders.filter((o) => o.status === orderStatusFilter);
  }, [allOrders, orderStatusFilter]);

  // Execute Deletion
  const confirmDeleteTarget = async () => {
    if (!deletingTarget) return;
    setIsDeleting(true);

    try {
      if (deletingTarget.type === 'reel') {
        const res = await apiFetch(`/api/reels/${deletingTarget.id}`, { method: 'DELETE' });
        if (res) {
          setReels(prev => prev.filter(r => r.id !== deletingTarget.id));
          setStatusMessage({ type: 'success', text: `Reel "${deletingTarget.name}" eliminado del sistema.` });
        }
      } else if (deletingTarget.type === 'product') {
        const res = await apiFetch(`/api/products/${deletingTarget.id}`, { method: 'DELETE' });
        if (res) {
          setProducts(prev => prev.filter(p => p.id !== deletingTarget.id));
          setStatusMessage({ type: 'success', text: `Producto "${deletingTarget.name}" eliminado del catálogo.` });
        }
      } else if (deletingTarget.type === 'user') {
        const res = await apiFetch(`/api/users/${deletingTarget.id}`, { method: 'DELETE' });
        if (res) {
          setUsers(prev => prev.filter(u => u.id !== deletingTarget.id));
          setStatusMessage({ type: 'success', text: `Usuario @${deletingTarget.name} eliminado de la base de datos.` });
        }
      }
    } catch (err: any) {
      console.error("Error deleting target in admin:", err);
      setStatusMessage({ type: 'error', text: err.message || 'Error al procesar la eliminación' });
    } finally {
      setIsDeleting(false);
      setDeletingTarget(null);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleToggleSellerPermission = async (user: User) => {
    if (user.id === currentUser.id || updatingPermissionId) return;
    const nextCanSell = user.canSell !== true;
    setUpdatingPermissionId(user.id);
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canSell: nextCanSell })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.error || "No se pudo actualizar el permiso.");
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, canSell: data.canSell === true } : u));
      setStatusMessage({ type: "success", text: nextCanSell ? `@${user.username} ahora tiene permisos de vendedor.` : `Se retiraron los permisos de vendedor de @${user.username}.` });
    } catch (err: any) {
      console.error("Error updating seller permission:", err);
      setStatusMessage({ type: "error", text: err.message || "Error al actualizar el permiso." });
    } finally {
      setUpdatingPermissionId(null);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };
  // Save Order Tracking Updates
  const handleSaveOrderUpdate = async () => {
    if (!editingOrder) return;
    setIsUpdatingOrder(true);
    try {
      const payload = {
        status: orderNewStatus,
        carrier: orderNewCarrier,
        trackingNumber: orderNewTracking,
        sellerNotes: orderNewNotes
      };
      const res = await apiFetch(`/api/orders/${editingOrder.id}/update-tracking`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      const data: any = await res.json().catch(() => ({}));

      if (data && data.order) {
        setAllOrders(prev => prev.map(o => o.id === editingOrder.id ? data.order : o));
        setStatusMessage({ type: 'success', text: `Pedido ${editingOrder.id} actualizado correctamente a "${orderNewStatus}".` });
      }
      setEditingOrder(null);
    } catch (err: any) {
      console.error("Error updating order:", err);
      setStatusMessage({ type: 'error', text: err.message || "Error al actualizar pedido" });
    } finally {
      setIsUpdatingOrder(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none" id="admin-dashboard-view">
      
      {/* Sticky Top Header with Sub-Tabs Navigation */}
      <header
        className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/90 shadow-md shadow-slate-950/30 transition-all -mt-6 mb-6"
        id="admin-sticky-header"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Sub-Tabs Navigation Bar - Full Width / Expanded in Header */}
          <div
            className="flex-1 min-w-0 bg-slate-900/90 p-1 rounded-2xl flex items-center space-x-1.5 overflow-x-auto select-none border border-slate-800/90 scrollbar-none"
            id="admin-subtabs-nav"
          >
            {[
              { id: 'resumen', label: 'Resumen General', icon: LayoutDashboard },
              { id: 'metrica', label: 'Métricas', icon: BarChart3 },
              { id: 'usuarios', label: `Usuarios (${totalUsersCount})`, icon: Users },
              { id: 'reels', label: `Reels & Vídeos (${totalReelsCount})`, icon: Video },
              { id: 'productos', label: `Productos (${totalProductsCount})`, icon: ShoppingBag },
              { id: 'ordenes', label: `Pedidos (${totalOrdersCount})`, icon: Truck },
              { id: 'fotos_defecto', label: 'Fotos por Defecto', icon: ImageIcon },
              { id: 'sistema', label: 'Estado del Sistema', icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectAdminTab(tab.id as AdminTab)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`flex items-center justify-center p-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-slate-950 font-black shadow-sm shadow-amber-500/25 scale-[1.02]"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                  }`}
                  id={`admin-tab-btn-${tab.id}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-slate-950" : "text-slate-400"}`} />
                </button>
              );
            })}

            {/* Direct Support Chat Navigation for Admin */}
            <button
              type="button"
              onClick={() => {
                onNavigateToTab('messages');
                navigateTo('/messages');
              }}
              title="Bandeja de Soporte al Cliente (cg0220037@gmail.com)"
              aria-label="Bandeja de Soporte al Cliente"
              className="flex items-center justify-center p-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer text-amber-400 hover:text-white hover:bg-slate-800/70"
              id="admin-tab-btn-support-chat"
            >
              <Headphones className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Actions & Platform Switcher */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* App Target Switcher: Web <-> Android */}
            <div
              className="flex items-center bg-slate-900/90 p-1 border border-slate-800/90 rounded-2xl text-xs font-semibold select-none shadow-xs"
              id="admin-platform-switcher"
              title="Cambiar entre modo Web y modo Android"
            >
              <button
                type="button"
                onClick={() => handlePlatformChange('web')}
                className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                  currentPlatform === 'web'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-bold'
                }`}
                title="Visualizar versión Web"
                aria-label="Visualizar versión Web"
              >
                <span>🌐</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlatformChange('android')}
                className={`flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                  currentPlatform === 'android'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-bold'
                }`}
                title="Visualizar versión Android"
                aria-label="Visualizar versión Android"
              >
                <span>📱</span>
              </button>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-200 transition-all cursor-pointer disabled:opacity-50"
              id="admin-header-refresh-btn"
              title="Sincronizar"
              aria-label="Sincronizar"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
            </button>
            <button
              onClick={() => {
                setPublishInitialTab("product");
                handleSelectAdminTab("publicar");
              }}
              className="inline-flex items-center justify-center p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
              id="admin-header-publish-btn"
              title="Publicar / Vender"
              aria-label="Publicar / Vender"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isPublishOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-3 sm:p-6"
          id="admin-publish-overlay"
        >
          <div className="min-h-full flex items-start justify-center py-2 sm:py-6">
            <div className="w-full max-w-5xl">
              <PublishView
                currentUser={currentUser}
                initialTab={publishInitialTab}
                onBack={() => setIsPublishOpen(false)}
                onSuccess={() => {
                  onRefreshAll();
                  setIsPublishOpen(false);
                }}
                userProducts={products}
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Status Notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-sm ${
              statusMessage.type === 'success'
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : statusMessage.type === 'error'
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="p-1 hover:bg-black/5 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4" id="admin-kpi-cards">
        {/* Card 1: Usuarios */}
        <div
          onClick={() => handleSelectAdminTab('usuarios')}
          className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          id="kpi-card-users"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Usuarios Registrados</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-display font-black text-slate-900">
              {totalUsersCount}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Ver directorio de cuentas</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 2: Reels & Videos */}
        <div
          onClick={() => handleSelectAdminTab('reels')}
          className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          id="kpi-card-reels"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Reels & Contenido</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-black text-slate-900">
              {totalReelsCount}
            </span>
            <span className="text-[10px] font-mono text-slate-400 font-bold">
              ({totalReelViews} vistas)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Moderar publicaciones</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 3: Productos Tienda */}
        <div
          onClick={() => handleSelectAdminTab('productos')}
          className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          id="kpi-card-products"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Productos en Catálogo</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-display font-black text-slate-900">
              {totalProductsCount}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Inventario de la tienda</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 4: Pedidos & Facturación */}
        <div
          onClick={() => handleSelectAdminTab('ordenes')}
          className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          id="kpi-card-orders"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Pedidos Globales</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-display font-black text-slate-900">
              {totalOrdersCount}
            </span>
            <span className="text-[10px] font-mono text-emerald-600 font-black">
              ${totalPlatformRevenue.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
            <span>Gestionar envíos y guías</span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>
      </div>

      {/* Tab 1: Resumen General */}
      {activeAdminTab === 'resumen' && (
        <div className="space-y-6" id="admin-tab-content-resumen">
          {/* Quick Actions and Recent Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Platform Overview & Recent Orders */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Orders Overview */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <Truck className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base font-black text-slate-900">Órdenes Recientes de Clientes</h2>
                  </div>
                  <button
                    onClick={() => handleSelectAdminTab('ordenes')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1"
                  >
                    <span>Ver todas ({allOrders.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isLoadingOrders ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <p className="text-xs">Cargando órdenes del sistema...</p>
                  </div>
                ) : allOrders.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    No hay pedidos registrados en el sistema actualmente.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {allOrders.slice(0, 5).map((order, oIdx) => (
                      <div key={`${order.id || 'order'}-${oIdx}`} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl px-2 -mx-2 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {order.items && order.items[0]?.imageUrl ? (
                              <img src={order.items[0].imageUrl} alt="Item" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {order.buyerName || "Cliente"} <span className="text-slate-400 font-mono font-normal">(@{order.buyerUsername || "anon"})</span>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {order.items?.length || 0} producto(s) • Total: <span className="font-bold text-slate-800">${Number(order.total).toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 self-end sm:self-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            order.status === 'delivered'
                              ? "bg-emerald-100 text-emerald-800"
                              : order.status === 'shipped'
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {order.status}
                          </span>
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setOrderNewStatus(order.status || 'processing');
                              setOrderNewCarrier(order.carrier || '');
                              setOrderNewTracking(order.trackingNumber || '');
                              setOrderNewNotes(order.sellerNotes || '');
                            }}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                            title="Actualizar estado / guía"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Latest Registered Users */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-base font-black text-slate-900">Cuentas Registradas Recientemente</h2>
                  </div>
                  <button
                    onClick={() => handleSelectAdminTab('usuarios')}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1"
                  >
                    <span>Ver todos ({users.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.slice(0, 6).map((u, uIdx) => (
                    <div
                      key={`${u.id}-${uIdx}`}
                      onClick={() => onCreatorClick(u.id)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/30 transition-all flex items-center space-x-3 cursor-pointer group"
                    >
                      <img
                        src={u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-600">
                          {u.name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 truncate">
                          @{u.username}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 1 Col: Platform Health & Shortcuts */}
            <div className="space-y-6">
              {/* Shortcuts Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Accesos Rápidos
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => { onNavigateToTab('messages'); navigateTo('/messages'); }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-amber-200/90 bg-amber-50/50 hover:bg-amber-100/50 transition-all text-left group"
                    id="admin-shortcut-support-messages"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                        <Headphones className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900">Bandeja de Soporte al Cliente</p>
                        <p className="text-[10px] text-amber-800 font-semibold">Responder consultas como cg0220037@gmail.com</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-amber-700 group-hover:text-amber-950" />
                  </button>

                  <button
                    onClick={() => { onNavigateToTab('inicio'); navigateTo('/inicio'); }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Página de Inicio</p>
                        <p className="text-[10px] text-slate-500">Ver interfaz de inicio</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                  </button>

                  <button
                    onClick={() => onNavigateToTab('shop')}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Catálogo de Tienda</p>
                        <p className="text-[10px] text-slate-500">Explorar productos en vivo</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                  </button>

                  <button
                    onClick={() => {
                      setPublishInitialTab("product");
                      handleSelectAdminTab("publicar");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Publicador de Contenido</p>
                        <p className="text-[10px] text-slate-500">Subir nuevo reel o artículo</p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                  </button>
                </div>
              </div>

              {/* Server Diagnostics Widget */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-white space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Telemetría del Servidor
                    </h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="text-amber-400 font-bold">MongoDB Atlas</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Status Conexión</span>
                    <span className="text-emerald-400 font-bold">ReadyState 1 (Activo)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Media Transcoder</span>
                    <span className="text-indigo-400 font-bold">FFmpeg HLS (720p/1080p)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Cloud Storage</span>
                    <span className="text-slate-200">GCS Bucket / Local HLS</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Ventas Registradas</span>
                    <span className="text-emerald-400 font-bold">${totalPlatformRevenue.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Gestión de Usuarios */}
      {activeAdminTab === 'usuarios' && (
        <UsuariosAdminView
          currentUser={currentUser}
          users={users}
          setUsers={setUsers}
          onCreatorClick={onCreatorClick}
          onStatusMessage={setStatusMessage}
          onRequestDeleteUser={(target) => setDeletingTarget(target)}
        />
      )}

      {/* Tab 3: Moderación de Reels y Publicaciones */}
      {activeAdminTab === 'reels' && (
        <ReelsAdminView
          reels={reels}
          setReels={setReels}
          onReelClick={onReelClick}
          onStatusMessage={setStatusMessage}
          onRequestDeleteReel={(target) => setDeletingTarget(target)}
        />
      )}

      {/* Tab 4: Gestión del Catálogo de Tienda */}
      {activeAdminTab === 'productos' && (
        <ProductoAdminView
          products={products}
          setProducts={setProducts}
          onProductClick={onProductClick}
          onStatusMessage={setStatusMessage}
          onRequestDeleteProduct={(target) => setDeletingTarget(target)}
        />
      )}

      {/* Tab Publicar: Publicador de Contenido y Productos */}
      {activeAdminTab === 'publicar' && (
        <div className="w-full" id="admin-tab-content-publicar">
          <PublishView
            currentUser={currentUser}
            initialTab={publishInitialTab}
            onBack={() => handleSelectAdminTab('resumen')}
            onSuccess={() => {
              onRefreshAll();
              handleSelectAdminTab('resumen');
            }}
            userProducts={products}
          />
        </div>
      )}

      {/* Tab 5: Pedidos & Logística Global */}
      {activeAdminTab === 'ordenes' && (
        <PedidosAdminView
          orders={allOrders}
          setOrders={setAllOrders}
          onStatusMessage={setStatusMessage}
          onRequestEditOrder={(order) => {
            setEditingOrder(order);
            setOrderNewStatus(order.status || 'processing');
            setOrderNewCarrier(order.carrier || '');
            setOrderNewTracking(order.trackingNumber || '');
            setOrderNewNotes(order.sellerNotes || '');
          }}
        />
      )}

      {/* Tab Métricas: Analítica y Rendimiento */}
      {activeAdminTab === 'metrica' && (
        <MetricaAdminView
          users={users}
          reels={reels}
          products={products}
          orders={allOrders}
          onCreatorClick={onCreatorClick}
          onProductClick={onProductClick}
          onReelClick={onReelClick}
        />
      )}

      {/* Tab 6: Estado del Sistema & Configuración (Con el banner exclusivo) */}
      {activeAdminTab === 'sistema' && (
        <SistemaAdminView
          systemHealth={systemHealth}
          currentUser={currentUser}
          onRefreshHealth={fetchOrdersAndHealth}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Tab 7: Fotos de Portada y Perfil por Defecto */}
      {activeAdminTab === 'fotos_defecto' && (
        <div className="space-y-6" id="admin-tab-content-fotos-defecto">
          {/* Top Info Banner & Actions */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-bold">
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>Personalización Global de Cuentas Nuevas</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Fotos Predeterminadas de Perfil y Portada
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                Gestiona las imágenes oficiales que la app mostrará automáticamente cuando un usuario se registra por primera vez o si su perfil aún no cuenta con fotos personalizadas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetDefaultAssets}
                disabled={isResettingDefaults || isSavingDefaults}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                id="admin-reset-defaults-btn"
                title="Restablecer a valores de fábrica"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${isResettingDefaults ? "animate-spin" : ""}`} />
                <span>{isResettingDefaults ? "Restableciendo..." : "Valores de Fábrica"}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveDefaultAssets}
                disabled={isSavingDefaults}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                id="admin-save-defaults-btn"
              >
                {isSavingDefaults ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{isSavingDefaults ? "Guardando Cambios..." : "Guardar Configuración"}</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Image Editors (Avatar & Cover) */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. Foto de Perfil Predeterminada (Avatar) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5" id="admin-default-avatar-card">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Foto de Perfil por Defecto (Avatar)
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Icono circular que identifica a usuarios sin avatar propio
                      </p>
                    </div>
                  </div>

                  {/* Mode tabs */}
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setAvatarTabMode('upload')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        avatarTabMode === 'upload'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTabMode('presets')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        avatarTabMode === 'presets'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTabMode('url')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        avatarTabMode === 'url'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Enlace
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Avatar Preview */}
                  <div className="relative group shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-slate-100 shadow-lg bg-slate-100 flex items-center justify-center">
                      <img
                        src={defaultAvatar}
                        alt="Default avatar preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_DEFAULT_AVATAR;
                        }}
                      />
                    </div>
                    <label
                      htmlFor="admin-avatar-file-input"
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center cursor-pointer shadow-md transition-transform active:scale-95"
                      title="Cambiar foto de perfil"
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                  </div>

                  {/* Mode Controls */}
                  <div className="flex-1 w-full space-y-3">
                    {avatarTabMode === 'upload' && (
                      <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl p-4 text-center transition-colors bg-slate-50/50">
                        <input
                          id="admin-avatar-file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="admin-avatar-file-input"
                          className="cursor-pointer flex flex-col items-center space-y-1.5"
                        >
                          <Upload className="w-5 h-5 text-slate-400" />
                          <span className="text-xs font-black text-slate-800">
                            Haz clic aquí o arrastra una imagen
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Formatos admitidos: JPG, PNG, WEBP (Se optimiza a GCS)
                          </span>
                        </label>
                      </div>
                    )}

                    {avatarTabMode === 'presets' && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Elige uno de nuestros diseños predefinidos:
                        </span>
                        <div className="grid grid-cols-5 gap-2">
                          {AVATAR_PRESETS.map((p, pIdx) => {
                            const isSelected = defaultAvatar === p.url;
                            return (
                              <button
                                key={`${p.id}-${pIdx}`}
                                type="button"
                                onClick={() => setDefaultAvatar(p.url)}
                                className={`relative rounded-full aspect-square overflow-hidden border-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-amber-500 ring-2 ring-amber-500/30 scale-105"
                                    : "border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100"
                                }`}
                                title={p.label}
                              >
                                <img
                                  src={p.url}
                                  alt={p.label}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {avatarTabMode === 'url' && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Ingresa la URL directa de la imagen:
                        </span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="url"
                            value={customAvatarUrl}
                            onChange={(e) => setCustomAvatarUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={applyCustomAvatarUrl}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Foto de Portada Predeterminada (Cover Banner) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5" id="admin-default-cover-card">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        Foto de Portada por Defecto (Banner)
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Cabecera panorámica superior que adorna el perfil
                      </p>
                    </div>
                  </div>

                  {/* Mode tabs */}
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCoverTabMode('upload')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        coverTabMode === 'upload'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverTabMode('presets')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        coverTabMode === 'presets'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Galería
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverTabMode('url')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        coverTabMode === 'url'
                          ? "bg-white text-slate-950 shadow-xs font-black"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Enlace
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Cover Banner Preview */}
                  <div className="relative h-32 sm:h-40 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group">
                    <img
                      src={defaultCoverPhoto}
                      alt="Default cover preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_DEFAULT_COVER;
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/20" />
                    
                    <label
                      htmlFor="admin-cover-file-input"
                      className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold backdrop-blur-xs flex items-center space-x-1.5 cursor-pointer shadow-lg transition-all active:scale-95"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Cambiar Portada</span>
                    </label>
                  </div>

                  {/* Mode Controls */}
                  <div>
                    {coverTabMode === 'upload' && (
                      <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-4 text-center transition-colors bg-slate-50/50">
                        <input
                          id="admin-cover-file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleCoverFileUpload}
                          className="hidden"
                        />
                        <label
                          htmlFor="admin-cover-file-input"
                          className="cursor-pointer flex flex-col items-center space-y-1.5"
                        >
                          <Upload className="w-5 h-5 text-slate-400" />
                          <span className="text-xs font-black text-slate-800">
                            Haz clic o arrastra un banner panorámico
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Resolución recomendada: 1200x400 px o superior
                          </span>
                        </label>
                      </div>
                    )}

                    {coverTabMode === 'presets' && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Elige una portada de nuestra colección:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {COVER_PRESETS.map((c, cIdx) => {
                            const isSelected = defaultCoverPhoto === c.url;
                            return (
                              <button
                                key={`${c.id}-${cIdx}`}
                                type="button"
                                onClick={() => setDefaultCoverPhoto(c.url)}
                                className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-amber-500 ring-2 ring-amber-500/30 scale-102"
                                    : "border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100"
                                }`}
                                title={c.label}
                              >
                                <img
                                  src={c.url}
                                  alt={c.label}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-slate-950/20" />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white stroke-[3]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {coverTabMode === 'url' && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Ingresa la URL directa de la imagen de portada:
                        </span>
                        <div className="flex items-center space-x-2">
                          <input
                            type="url"
                            value={customCoverUrl}
                            onChange={(e) => setCustomCoverUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={applyCustomCoverUrl}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                          >
                            Aplicar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Live Interactive Profile Card Mockup */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
              <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Vista Previa en Vivo
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Tiempo Real
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Así se verá el encabezado de perfil para cualquier cuenta nueva o visitante registrado que no tenga fotos:
                </p>

                {/* Simulated Profile Card */}
                <div className="rounded-2xl overflow-hidden border border-slate-700 bg-white text-slate-900 shadow-lg">
                  {/* Banner */}
                  <div className="h-28 bg-slate-900 relative overflow-hidden">
                    <img
                      src={defaultCoverPhoto}
                      alt="Banner Mockup"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_DEFAULT_COVER;
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/20" />
                  </div>

                  {/* Profile info section */}
                  <div className="px-4 pb-4 pt-0 bg-slate-50 relative">
                    <div className="flex items-end justify-between -mt-9 mb-2">
                      <div className="relative">
                        <img
                          src={defaultAvatar}
                          alt="Avatar Mockup"
                          referrerPolicy="no-referrer"
                          className="w-18 h-18 rounded-full object-cover border-3 border-white shadow-md bg-white"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_DEFAULT_AVATAR;
                          }}
                        />
                      </div>
                      <div className="pt-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
                          Cuenta Nueva
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-display font-black text-sm text-slate-900 leading-tight">
                        Usuario Nuevo
                      </h4>
                      <p className="text-xs font-mono text-slate-500">
                        @nuevo_creador
                      </p>
                      <p className="text-[11px] text-slate-600 font-medium pt-1">
                        Nuevo creador de contenido en la plataforma MallSocial
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 pt-3 mt-2 border-t border-slate-200 text-[11px] font-bold text-slate-600">
                      <span>0 publicaciones</span>
                      <span>•</span>
                      <span>0 seguidores</span>
                      <span>•</span>
                      <span>0 seguidos</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDefaultAssets}
                    disabled={isSavingDefaults}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/25 active:scale-98 disabled:opacity-50"
                  >
                    {isSavingDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                    <span>{isSavingDefaults ? "Guardando en Base de Datos..." : "Aplicar y Guardar Fotos por Defecto"}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletions */}
      <AnimatePresence>
        {deletingTarget && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Confirmar eliminación?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar de forma permanente {deletingTarget.type === 'user' ? 'el usuario' : deletingTarget.type === 'reel' ? 'el reel' : 'el producto'}{" "}
                  <span className="font-bold text-slate-900">"{deletingTarget.name}"</span>. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setDeletingTarget(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteTarget}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isDeleting ? "Eliminando..." : "Eliminar Definitivamente"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Updating Order Tracking & Status */}
      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-black text-slate-900">
                    Actualizar Pedido #{editingOrder.id}
                  </h3>
                </div>
                <button onClick={() => setEditingOrder(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estado del Pedido</label>
                  <select
                    value={orderNewStatus}
                    onChange={(e) => setOrderNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value="pending">Pendiente de preparación</option>
                    <option value="processing">En preparación por el vendedor</option>
                    <option value="shipped">Despachado / En tránsito</option>
                    <option value="delivered">Entregado al comprador</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Empresa de Paquetería / Courier</label>
                  <input
                    type="text"
                    value={orderNewCarrier}
                    onChange={(e) => setOrderNewCarrier(e.target.value)}
                    placeholder="Ej. DHL Express, FedEx, Estafeta, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Número de Guía / Código de Rastreo</label>
                  <input
                    type="text"
                    value={orderNewTracking}
                    onChange={(e) => setOrderNewTracking(e.target.value)}
                    placeholder="Ej. DHL-984729184"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notas para el Comprador</label>
                  <textarea
                    value={orderNewNotes}
                    onChange={(e) => setOrderNewNotes(e.target.value)}
                    rows={2}
                    placeholder="Indicaciones adicionales de entrega..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setEditingOrder(null)}
                  disabled={isUpdatingOrder}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveOrderUpdate}
                  disabled={isUpdatingOrder}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5"
                >
                  {isUpdatingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isUpdatingOrder ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
