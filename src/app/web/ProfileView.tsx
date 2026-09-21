import React, { useState, useEffect, useRef } from "react";
import { User, Product, Reel, Order } from "../../types";
import { Eye, Heart, MessageCircle, BarChart3, ShoppingBag, ShieldCheck, Shield, Lock, FileText, Mail, Users, ArrowUpRight, Play, Star, Bookmark, Settings, Camera, Plus, Search, X, LogOut, BadgeCheck, UserPlus, UserCheck, Package, Edit3, Trash2, Upload, Check, AlertCircle, Sparkles, DollarSign, Layers, CheckCircle2, RefreshCw, Loader2, Truck, Copy, ExternalLink, MapPin, Calendar, Clock, TrendingUp, Send, PackageCheck, PackageSearch } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import LoginView from "./LoginView";
import UserPublicationsFeed from "./components/UserPublicationsFeed";
import PublishView from "./PublishView";
import { apiFetch } from "../../config";
import { safeStorage } from "../../utils/safeStorage";
import { getDefaultAvatar, getDefaultCoverPhoto } from "../../utils/defaultAssets";

const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

function PublicationCover({ reel }: { reel: Reel }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    if (reel.thumbnailUrl && !reel.thumbnailUrl.toLowerCase().endsWith(".m3u8") && !reel.thumbnailUrl.includes("photo-1618005182384")) {
      return reel.thumbnailUrl;
    }
    if (reel.images && reel.images.length > 0 && !reel.images[0].toLowerCase().endsWith(".m3u8")) {
      return reel.images[0];
    }
    return null;
  });

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (thumbUrl) return;

    if (reel.videoUrl && typeof document !== "undefined") {
      let isCancelled = false;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.volume = 0;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = reel.videoUrl;

      const captureFrame = () => {
        if (isCancelled) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(video.videoWidth || 480, 480);
          canvas.height = Math.min(video.videoHeight || 640, 640);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            if (dataUrl && dataUrl.length > 100) {
              setThumbUrl(dataUrl);
            }
          }
        } catch (e) {
          // Fallback gracefully on CORS
        }
      };

      const handleLoadedData = () => {
        video.currentTime = 0.1;
      };

      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("seeked", captureFrame);
      video.load();

      return () => {
        isCancelled = true;
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.removeEventListener("loadeddata", handleLoadedData);
          video.removeEventListener("seeked", captureFrame);
          video.removeAttribute("src");
          video.load();
        } catch {
          // ignore
        }
      };
    }
  }, [reel.videoUrl, thumbUrl]);

  if (thumbUrl && !hasError) {
    return (
      <img
        src={thumbUrl}
        alt={reel.description || "Publicación"}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none bg-black"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="w-full h-full bg-black flex flex-col items-center justify-center p-3 text-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-2 shadow-md">
        <Play className="w-4 h-4 fill-white translate-x-0.5" />
      </div>
      <p className="text-[10px] text-white/80 font-bold line-clamp-2 leading-tight">
        {reel.description || (reel.type === "video" ? "Video" : "Publicación")}
      </p>
    </div>
  );
}

interface ProfileViewProps {
  currentUser: User;
  selectedCreatorId: string | null; // Null means we view our own private admin profile
  users: User[];
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
}

export default function ProfileView({
  currentUser,
  selectedCreatorId,
  users,
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
}: ProfileViewProps) {
  // Determine if we are looking at public creator profile or our private dashboard
  const isSelf =
    selectedCreatorId === null ||
    selectedCreatorId === currentUser.id ||
    (!!currentUser.originalId && selectedCreatorId === currentUser.originalId) ||
    (!!currentUser.username && selectedCreatorId?.toLowerCase() === currentUser.username?.toLowerCase()) ||
    (selectedCreatorId === "current_user" && currentUser.username !== "invitado" && !currentUser.isGuest);
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
  const totalProductViews = userProducts.reduce((acc, p) => acc + (p.views || 0), 0);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [userSales, setUserSales] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilterTab, setOrderFilterTab] = useState<"purchases" | "sales">("purchases");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  // Sub-section for product management panel: "catalog" (Mis Productos) or "sales" (Ventas Entrantes)
  const [productManagementSection, setProductManagementSection] = useState<"catalog" | "sales">("catalog");
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [salesStatusFilter, setSalesStatusFilter] = useState<string>("all");

  // Tracking inspection modal
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);

  // Seller editing tracking / fulfillment modal
  const [editingTrackingOrder, setEditingTrackingOrder] = useState<Order | null>(null);
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editCarrier, setEditCarrier] = useState("DHL Express");
  const [editOrderStatus, setEditOrderStatus] = useState<"pending" | "processing" | "shipped" | "delivered" | "cancelled">("processing");
  const [editEstimatedDelivery, setEditEstimatedDelivery] = useState("");
  const [editTrackingUrl, setEditTrackingUrl] = useState("");
  const [editSellerNotes, setEditSellerNotes] = useState("");
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [trackingSuccessMessage, setTrackingSuccessMessage] = useState<string | null>(null);
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"publish" | "publications" | "products" | "saved" | "orders" | "performance" | "edit">(currentUser.canSell === true ? "publish" : "saved");
  const canSell = isSelf && currentUser.canSell === true;
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publicTab, setPublicTab] = useState<"publications" | "products" | "policies">("publications");
  // Dedicated user publications feed state
  const [activeFeedReelId, setActiveFeedReelId] = useState<string | null>(null);

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

  // Product management states (for business owner)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingReel, setDeletingReel] = useState<Reel | null>(null);
  const [isDeletingReel, setIsDeletingReel] = useState(false);
  const [reelActionMessage, setReelActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [editProdForm, setEditProdForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    shippingCost: "",
    category: "Ropa Femenina",
    imageUrl: "",
    images: [] as string[],
  });
  const [newExtraImageUrl, setNewExtraImageUrl] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [isUploadingProdImage, setIsUploadingProdImage] = useState(false);
  const [productActionError, setProductActionError] = useState<string | null>(null);
  const [productActionSuccess, setProductActionSuccess] = useState<string | null>(null);
  const prodImageInputRef = useRef<HTMLInputElement>(null);
  const prodExtraImageInputRef = useRef<HTMLInputElement>(null);

  // Profile edit states
  const [editName, setEditName] = useState(currentUser.name);
  const [editUsername, setEditUsername] = useState(currentUser.username);
  const [editBio, setEditBio] = useState(currentUser.bio || "");
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar || "");
  const [editCoverPhoto, setEditCoverPhoto] = useState(currentUser.coverPhoto || "");
  const [editPassword, setEditPassword] = useState("");
  const [editPrivacyPolicy, setEditPrivacyPolicy] = useState(currentUser.privacyPolicy || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Register user states
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("");
  const [regCoverPhoto, setRegCoverPhoto] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const profileRegisteringRef = useRef(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Switch user states
  const [switchingUser, setSwitchingUser] = useState<User | null>(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await apiFetch("/api/users/current/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.originalId || currentUser.id,
          currentUsername: currentUser.username,
          name: editName,
          username: editUsername,
          bio: editBio,
          avatar: editAvatar,
          coverPhoto: editCoverPhoto,
          password: editPassword,
          privacyPolicy: editPrivacyPolicy,
        }),
      });
      const data = await response.json();
      if (data.success && data.user) {
        setProfileUser(data.user);
        if (onProfileUpdate) {
          onProfileUpdate(data.user);
        }
        if (onRefreshUsers) {
          onRefreshUsers();
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
    if (isRegistering || profileRegisteringRef.current) return;
    profileRegisteringRef.current = true;
    setIsRegistering(true);
    setRegisterError("");
    setRegisterSuccess(false);

    try {
      const cleanUsername = String(regUsername).trim().toLowerCase().replace(/\s+/g, "").replace("@", "");
      const response = await apiFetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          username: cleanUsername,
          email: `${cleanUsername}@mallsocial.app`,
          bio: regBio.trim() || "Creador en la plataforma",
          avatar: regAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
          coverPhoto: regCoverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
          password: regPassword.trim(),
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
      profileRegisteringRef.current = false;
    }
  };

  const handleSwitchUser = async (targetUsername: string, password?: string) => {
    try {
      setSwitchError("");
      const response = await apiFetch("/api/users/current/switch", {
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
        // Update safeStorage so session matches the newly typed password
        safeStorage.setItem("isLoggedIn", "true");
        safeStorage.setItem("loggedInUsername", targetUsername);
        safeStorage.setItem("loggedInPassword", password || "");
        safeStorage.setItem("currentUserData", JSON.stringify(data.user));

        setProfileUser(data.user);
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
      if (currentUser && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest) {
        setProfileUser(currentUser);
        setEditName(currentUser.name || "");
        setEditUsername(currentUser.username || "");
        setEditBio(currentUser.bio || "");
        setEditAvatar(currentUser.avatar || "");
        setEditCoverPhoto(currentUser.coverPhoto || "");
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
    
    const targetEndpoint = isSelf && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest
      ? `/api/users/${encodeURIComponent(currentUser.originalId || currentUser.username || currentUser.id)}`
      : `/api/users/${encodeURIComponent(activeUserId)}`;

    apiFetch(targetEndpoint)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error && data.user) {
          if (isSelf && currentUser && currentUser.username && currentUser.username !== "invitado" && !currentUser.isGuest) {
            // Keep authenticated client identity fields while updating metrics and server stats
            const resolvedPolicy = data.user.privacyPolicy !== undefined ? data.user.privacyPolicy : (currentUser.privacyPolicy || "");
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
        } else if (isSelf) {
          setProfileUser(currentUser);
        } else {
          // Fallback to local users list if server returned not found
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

  // Calculate Creator Dashboard metrics (sum likes, views, comments)
  const totalViews = userReels.reduce((acc, r) => acc + r.views, 0);
  const totalLikes = userReels.reduce((acc, r) => acc + r.likes, 0);
  const totalComments = userReels.reduce((acc, r) => acc + r.comments.length, 0);

  // Auto-clear publication feedback banner
  useEffect(() => {
    if (reelActionMessage) {
      const timer = setTimeout(() => {
        setReelActionMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [reelActionMessage]);

  const handleOpenDeleteReel = (reel: Reel, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingReel(reel);
  };

  const handleConfirmDeleteReel = async () => {
    if (!deletingReel) return;
    const reelId = deletingReel.id;
    try {
      setIsDeletingReel(true);
      const res = await apiFetch(`/api/reels/${reelId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setUserReels((prev) => prev.filter((r) => r.id !== reelId));
        setReelActionMessage({
          type: "success",
          text: "Publicación eliminada permanentemente de MongoDB y Cloud Storage.",
        });
        setDeletingReel(null);
        if (onPublishSuccess) {
          onPublishSuccess();
        }
      } else {
        setReelActionMessage({
          type: "error",
          text: "No se pudo eliminar la publicación: " + (data.error || "Error desconocido"),
        });
      }
    } catch (err: any) {
      console.error("Error al eliminar la publicación:", err);
      setReelActionMessage({
        type: "error",
        text: "Error de red al intentar eliminar la publicación.",
      });
    } finally {
      setIsDeletingReel(false);
    }
  };

  // Open product editor modal and pre-fill form
  const handleStartEditProduct = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(prod);
    setEditProdForm({
      name: prod.name || "",
      description: prod.description || "",
      price: prod.price !== undefined ? String(prod.price) : "0",
      stock: prod.stock !== undefined ? String(prod.stock) : "0",
      shippingCost: prod.shippingCost !== undefined ? String(prod.shippingCost) : "0",
      category: prod.category || "Ropa Femenina",
      imageUrl: prod.imageUrl || "",
      images: Array.isArray(prod.images) ? [...prod.images] : (prod.imageUrl ? [prod.imageUrl] : []),
    });
    setNewExtraImageUrl("");
    setProductActionError(null);
  };

  // Upload image from file input (for main image or extra gallery images)
  const handleUploadProdImage = async (file: File, isExtra = false) => {
    try {
      setIsUploadingProdImage(true);
      setProductActionError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("creatorId", currentUser.id);

      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        if (isExtra) {
          setEditProdForm((prev) => ({
            ...prev,
            images: prev.images.includes(data.url) ? prev.images : [...prev.images, data.url],
          }));
        } else {
          setEditProdForm((prev) => ({ ...prev, imageUrl: data.url }));
        }
      } else {
        // Fallback to FileReader base64 DataURL
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            const dataUrl = reader.result as string;
            if (isExtra) {
              setEditProdForm((prev) => ({ ...prev, images: [...prev.images, dataUrl] }));
            } else {
              setEditProdForm((prev) => ({ ...prev, imageUrl: dataUrl }));
            }
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.warn("Upload to GCS failed, falling back to FileReader DataURL:", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const dataUrl = reader.result as string;
          if (isExtra) {
            setEditProdForm((prev) => ({ ...prev, images: [...prev.images, dataUrl] }));
          } else {
            setEditProdForm((prev) => ({ ...prev, imageUrl: dataUrl }));
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingProdImage(false);
    }
  };

  // Save product changes to backend
  const handleSaveProductChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editProdForm.name.trim()) {
      setProductActionError("El nombre del producto es obligatorio.");
      return;
    }
    const numPrice = parseFloat(editProdForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      setProductActionError("Por favor ingresa un precio numérico válido (mayor o igual a 0).");
      return;
    }
    const numStock = parseInt(editProdForm.stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setProductActionError("El inventario/stock debe ser un número entero mayor o igual a 0.");
      return;
    }
    if (!editProdForm.imageUrl.trim()) {
      setProductActionError("La imagen principal del producto es obligatoria.");
      return;
    }

    try {
      setIsSavingProduct(true);
      setProductActionError(null);

      const payload = {
        name: editProdForm.name.trim(),
        description: editProdForm.description.trim(),
        price: numPrice,
        stock: numStock,
        shippingCost: Math.max(0, parseFloat(editProdForm.shippingCost) || 0),
        category: editProdForm.category.trim() || "General",
        imageUrl: editProdForm.imageUrl.trim(),
        images: editProdForm.images.filter((img) => img.trim().length > 0),
      };

      const res = await apiFetch(`/api/products/${editingProduct.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al actualizar el producto");
      }

      const updated = data.product;
      setUserProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setProductActionSuccess(`¡Producto "${updated.name}" actualizado exitosamente!`);
      setTimeout(() => setProductActionSuccess(null), 4000);
      setEditingProduct(null);

      if (onRefreshUsers) {
        onRefreshUsers();
      }
    } catch (err: any) {
      console.error("Error al actualizar producto:", err);
      setProductActionError(err.message || "Error al actualizar el producto.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Confirm delete product
  const handleConfirmDeleteProduct = async () => {
    if (!deletingProduct) return;

    try {
      setIsDeletingProduct(true);
      const res = await apiFetch(`/api/products/${deletingProduct.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al eliminar el producto");
      }

      setUserProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setProductActionSuccess(`Producto "${deletingProduct.name}" eliminado correctamente.`);
      setTimeout(() => setProductActionSuccess(null), 4000);
      setDeletingProduct(null);

      if (onRefreshUsers) {
        onRefreshUsers();
      }
    } catch (err: any) {
      console.error("Error al eliminar el producto:", err);
      alert(err.message || "Error de red al eliminar el producto.");
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Fetch fresh orders (both purchases and sales)
  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await apiFetch(`/api/orders?userId=${encodeURIComponent(currentUser.id)}`);
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

  // Listen to WebSocket events for real-time order tracking updates
  useEffect(() => {
    if (!socket) return;
    const handleWsMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "order_created" || payload.type === "order_updated") {
          const updated: Order = payload.order;
          if (updated) {
            // Update in purchases
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

            // Update in sales
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

            // Update modal if currently opened
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

  // Copy tracking number to clipboard with feedback
  const handleCopyTrackingNumber = (trackingNum: string, orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTrackingId(orderId);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  // Open seller tracking / fulfillment editor modal
  const openEditTrackingModal = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackingOrder(order);
    setEditTrackingNumber(order.trackingNumber || "");
    setEditCarrier(order.carrier || "");
    setEditOrderStatus((order.status as any) || "processing");
    setEditEstimatedDelivery(order.estimatedDelivery || "");
    setEditTrackingUrl(order.trackingUrl || "");
    setEditSellerNotes(order.sellerNotes || "");
    setTrackingSuccessMessage(null);
  };

  // Submit tracking update by seller
  const handleSaveTrackingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrackingOrder) return;

    try {
      setIsUpdatingTracking(true);
      const res = await apiFetch(`/api/orders/${editingTrackingOrder.id}/update-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: editTrackingNumber,
          carrier: editCarrier,
          status: editOrderStatus,
          trackingUrl: editTrackingUrl,
          estimatedDelivery: editEstimatedDelivery,
          sellerNotes: editSellerNotes,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        const updated: Order = data.order;
        setUserSales((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setUserOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setTrackingSuccessMessage("¡Guía de rastreo y estado actualizados exitosamente!");
        setTimeout(() => {
          setTrackingSuccessMessage(null);
          setEditingTrackingOrder(null);
        }, 1200);
      } else {
        alert(data.error || "No se pudo actualizar el seguimiento.");
      }
    } catch (err) {
      console.error("Error saving tracking update:", err);
      alert("Error de conexión al actualizar la guía de seguimiento.");
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  const isGuestMode =
    isSelf &&
    (!currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username);

  if (isGuestMode) {
    return (
      <div className="w-full max-w-4xl mx-auto pb-0 overflow-x-hidden" id="guest-profile-login-wrapper" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
        <button onClick={onBackToSelf} className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs">
          Regresar a mi perfil
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[600px] bg-white rounded-none sm:rounded-t-none sm:rounded-b-2xl border-0 sm:border sm:border-slate-200 shadow-none sm:shadow-xl overflow-hidden flex flex-col no-scrollbar pb-0" id="profile-panel" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between -mt-12 sm:-mt-16 mb-4 gap-4 z-10 relative" style={{ marginTop: '-16px', marginBottom: '0px' }}>
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
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-950 flex items-center space-x-2">
                <span className="inline-block" style={{ paddingLeft: '18px' }}>{profileUser.name}</span>
                {!isSelf && (
                  <BadgeCheck className="w-5 h-5 fill-sky-500 text-white shrink-0" title="Verificado" />
                )}
              </h2>
              {/* Followers and Following counters */}
              {(() => {
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

                {onToggleFollowUser && (() => {
                  const isFollowingCreator = Boolean(
                    currentUser.followingUserIds?.some((id) =>
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
                        const targetId = (profileUser.username && profileUser.username !== "invitado")
                          ? profileUser.username
                          : (profileUser.id && profileUser.id !== "current_user" ? profileUser.id : (profileUser.name || "current_user"));
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
                onClick={() => setActiveSubTab("publish")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "publish" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Publicar"
                id="profile-subtab-publish"
              >
                <Plus className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "publish" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            )}

            {canSell && (
              <button
                onClick={() => setActiveSubTab("publications")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "publications" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Mis Publicaciones"
                id="profile-subtab-publications"
              >
                <Play className="w-4.5 h-4.5 fill-current stroke-[2]" />
                {activeSubTab === "publications" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            )}

            {canSell && (
              <button
                onClick={() => { setActiveSubTab("products"); fetchOrders(); }}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "products" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title={`Gestión de Productos y Ventas (${userProducts.length} productos, ${userSales.length} ventas)`}
                id="profile-subtab-products"
              >
                <Package className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "products" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            )}

            <button
              onClick={() => setActiveSubTab("saved")}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "saved" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Publicaciones Guardadas"
              id="profile-subtab-saved"
            >
              <Bookmark className="w-4.5 h-4.5 stroke-[2]" />
              {activeSubTab === "saved" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
            </button>

            <button
              onClick={() => { setActiveSubTab("orders"); fetchOrders(); }}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "orders" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Historial de Mis Compras"
              id="profile-subtab-orders"
            >
              <ShoppingBag className="w-4.5 h-4.5 stroke-[2]" />
              {userOrders.length > 0 && <span className="absolute -top-1.5 -right-2 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded-full min-w-3 h-3 flex items-center justify-center border border-white leading-none shadow-xs">{userOrders.length}</span>}
              {activeSubTab === "orders" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
            </button>

            {canSell && (
              <button
                onClick={() => setActiveSubTab("performance")}
                className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                  activeSubTab === "performance" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Rendimiento"
                id="profile-subtab-performance"
              >
                <BarChart3 className="w-4.5 h-4.5 stroke-[2]" />
                {activeSubTab === "performance" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            )}

            <button
              onClick={() => setActiveSubTab("edit")}
              className={`py-1.5 px-2.5 transition-all cursor-pointer flex flex-col items-center justify-center relative group ${
                activeSubTab === "edit" ? "text-amber-500 font-bold scale-105" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Editar Perfil"
              id="profile-subtab-edit"
            >
              <Settings className="w-4.5 h-4.5 stroke-[2]" />
              {activeSubTab === "edit" && <motion.div layoutId="activeSubTabIndicator" className="absolute bottom-0 w-6 h-0.5 bg-amber-500 rounded-full" />}
            </button>
          </div>
        ) : (
          <div className="mt-2 pt-0.5 border-t border-slate-200/80 flex items-center justify-around w-full max-w-sm sm:max-w-md mx-auto">
            <button
              onClick={() => setPublicTab("publications")}
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
              onClick={() => setPublicTab("products")}
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
              onClick={() => setPublicTab("policies")}
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
                  <motion.div key="admin-publish" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2"><Plus className="w-4 h-4 text-amber-500" /><span>Publicar</span></h3>
                    </div>
                    <PublishView
                      currentUser={currentUser}
                      userProducts={userProducts}
                      onBack={() => setActiveSubTab("publications")}
                      onSuccess={() => { setActiveSubTab("publications"); onPublishSuccess?.(); }}
                    />
                  </motion.div>
                )}

                {activeSubTab === "publications" && canSell && (
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
                    </div>

                    {userReels.length === 0 ? (
                      <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                        <Play className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
                        <p className="text-xs font-semibold text-slate-500">No has compartido ninguna publicación aún</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tus videos publicados aparecerán en esta sección.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {userReels.map((reel, index) => (
                          <div
                            key={`${reel.id}-${index}`}
                            onClick={() => setActiveFeedReelId(reel.id)}
                            className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                            id={`admin-my-reel-${reel.id}`}
                          >
                            <PublicationCover reel={reel} />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />
                            
                            {/* Botón (X) para eliminar publicación de MongoDB y Google Cloud Storage con fondo transparente */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenDeleteReel(reel, e)}
                              onPointerDown={(e) => e.stopPropagation()}
                              title="Eliminar publicación"
                              className="absolute top-1.5 right-1.5 w-8 h-8 bg-transparent hover:text-rose-400 active:scale-90 text-white flex items-center justify-center transition-all z-30 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                              id={`btn-delete-reel-${reel.id}`}
                            >
                              <X className="w-5 h-5 stroke-[2.5]" />
                            </button>

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

                {activeSubTab === "products" && canSell && (
                  <motion.div
                    key="admin-products"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                    id="admin-products-management-panel"
                  >
                    {/* Sub-navigation Switcher: Mis Productos vs Ventas Entrantes */}
                    <div className="flex items-center space-x-2 bg-slate-100/90 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setProductManagementSection("catalog")}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                          productManagementSection === "catalog"
                            ? "bg-white text-slate-900 shadow-xs scale-[1.01]"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                        id="tab-btn-admin-productos"
                      >
                        <Package className="w-4 h-4 text-amber-500" />
                        <span>Mis Productos</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {userProducts.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setProductManagementSection("sales");
                          fetchOrders();
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer relative ${
                          productManagementSection === "sales"
                            ? "bg-white text-slate-900 shadow-xs scale-[1.01]"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                        id="tab-btn-admin-ventas"
                      >
                        <Truck className="w-4 h-4 text-emerald-600" />
                        <span>Ventas Entrantes</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {userSales.length}
                        </span>
                        {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length > 0 && (
                          <span
                            className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white leading-none shadow-2xs"
                            title="Ventas pendientes por despachar"
                          >
                            {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length} por despachar
                          </span>
                        )}
                      </button>
                    </div>

                    {productManagementSection === "catalog" ? (
                      <>
                        {/* Header & Quick Actions Bar */}
                        <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1.5" id="products-summary-metrics">
                            <Package className="w-5 h-5 text-amber-500 shrink-0" />
                            <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full border border-amber-200">
                              {userProducts.length} {userProducts.length === 1 ? "producto" : "productos"}
                            </span>
                            <span
                              className="bg-sky-100 text-sky-800 text-xs font-black px-2.5 py-1 rounded-full border border-sky-200 flex items-center space-x-1"
                              title="Visualizaciones acumuladas en páginas de detalle"
                              id="products-total-views-counter"
                            >
                              <Eye className="w-3.5 h-3.5 text-sky-600" />
                              <span>{totalProductViews} {totalProductViews === 1 ? "visualización" : "visualizaciones"}</span>
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                          </div>
                        </div>

                    {/* Notice / Feedback Banner */}
                    {productActionSuccess && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{productActionSuccess}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProductActionSuccess(null)}
                          className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Search & Filter Bar if there are products */}
                    {userProducts.length > 0 && (
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={productSearchQuery}
                          onChange={(e) => setProductSearchQuery(e.target.value)}
                          placeholder="Buscar producto por nombre, categoría o descripción..."
                          className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all font-medium text-slate-800"
                        />
                        {productSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setProductSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Product List / Empty States */}
                    {userProducts.length === 0 ? (
                      <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-100">
                          <Package className="w-7 h-7 text-amber-500" />
                        </div>
                        <h4 className="font-display font-extrabold text-sm text-slate-800">
                          No tienes productos publicados todavía
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Agrega artículos a tu catálogo para que tus clientes puedan descubrirlos, comprarlos y agregarlos al carrito.
                        </p>
                      </div>
                    ) : (() => {
                      const filtered = userProducts.filter((p) => {
                        if (!productSearchQuery.trim()) return true;
                        const q = productSearchQuery.toLowerCase();
                        return (
                          p.name?.toLowerCase().includes(q) ||
                          p.category?.toLowerCase().includes(q) ||
                          p.description?.toLowerCase().includes(q)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-600">
                              No se encontraron productos que coincidan con "{productSearchQuery}"
                            </p>
                            <button
                              type="button"
                              onClick={() => setProductSearchQuery("")}
                              className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                            >
                              Limpiar búsqueda
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="business-products-list">
                          {filtered.map((prod, prodIdx) => {
                            const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
                            return (
                              <div
                                key={`${prod.id}-${prodIdx}`}
                                id={`product-manage-card-${prod.id}`}
                                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between hover:border-amber-400/80 hover:shadow-sm transition-all group relative"
                              >
                                <div>
                                  {/* Top Row: Image & Primary Info */}
                                  <div className="flex space-x-3">
                                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                                      <img
                                        src={prod.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80"}
                                        alt={prod.name}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                      />
                                      {prod.images && prod.images.length > 1 && (
                                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center space-x-0.5">
                                          <Layers className="w-2.5 h-2.5" />
                                          <span>{prod.images.length}</span>
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-start justify-between gap-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate block">
                                            {prod.category || "General"}
                                          </span>
                                          {isOutOfStock ? (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                                              Agotado
                                            </span>
                                          ) : (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                              Stock: {prod.stock ?? 1}
                                            </span>
                                          )}
                                        </div>

                                        <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1 mt-0.5" title={prod.name}>
                                          {prod.name}
                                        </h4>

                                        <div className="flex items-baseline space-x-2 mt-1">
                                          <span className="font-display font-black text-sm sm:text-base text-amber-600">
                                            ${Number(prod.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                          {prod.shippingCost !== undefined && (
                                            <span className="text-[10px] text-slate-500 font-medium">
                                              {prod.shippingCost === 0 ? "Envío gratis" : `Envío: $${prod.shippingCost}`}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {prod.description && (
                                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                          {prod.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons Footer */}
                                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                    <button
                                      type="button"
                                      onClick={() => onSelectProduct(prod)}
                                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 transition-colors cursor-pointer py-1"
                                      title="Ver vista pública del producto"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Ver en tienda</span>
                                    </button>
                                    <span
                                      className="flex items-center space-x-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/80"
                                      title="Visualizaciones en la página de detalle"
                                    >
                                      <Eye className="w-3 h-3 text-sky-600" />
                                      <span>{prod.views || 0} {prod.views === 1 ? "vista" : "vistas"}</span>
                                    </span>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={(e) => handleStartEditProduct(prod, e)}
                                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                                      title="Editar detalles del producto"
                                      id={`btn-edit-product-${prod.id}`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Editar</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingProduct(prod);
                                      }}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                                      title="Eliminar este producto"
                                      id={`btn-delete-product-${prod.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Eliminar</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                      </>
                    ) : (
                      /* Panel de Ventas Entrantes */
                      <div className="space-y-4" id="admin-incoming-sales-panel">
                        {/* Header with refresh button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-150 p-3.5 rounded-2xl">
                          <div>
                            <h4 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2">
                              <Truck className="w-4.5 h-4.5 text-emerald-600" />
                              <span>Gestión de Ventas Entrantes & Despachos</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Supervisa las ventas de tus productos, asigna transportadoras y guías de rastreo a tus compradores.
                            </p>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={fetchOrders}
                              disabled={ordersLoading}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 shadow-2xs"
                              title="Actualizar ventas"
                              id="btn-refresh-sales"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin text-emerald-600" : ""}`} />
                              <span>Actualizar</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick Stats Summary Banner */}
                        <div className="grid grid-cols-3 gap-2 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl">
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Total Ventas</p>
                            <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">{userSales.length}</p>
                          </div>
                          <div className="text-center border-x border-emerald-200/70">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Por Despachar</p>
                            <p className="text-sm font-black text-amber-600 mt-0.5 font-mono">
                              {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">Ingresos Totales</p>
                            <p className="text-sm font-black text-emerald-700 mt-0.5 font-mono">
                              ${userSales.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Search and Status Filters */}
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <div className="relative flex-1 w-full">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={salesSearchQuery}
                              onChange={(e) => setSalesSearchQuery(e.target.value)}
                              placeholder="Buscar por referencia, cliente, dirección, producto o guía..."
                              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                            />
                            {salesSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setSalesSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <select
                            value={salesStatusFilter}
                            onChange={(e) => setSalesStatusFilter(e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="all">Todos los estados</option>
                            <option value="processing">🟡 En preparación</option>
                            <option value="shipped">🚚 En camino / Despachado</option>
                            <option value="delivered">🟢 Entregado</option>
                            <option value="cancelled">🔴 Cancelado</option>
                          </select>
                        </div>

                        {/* Incoming Sales List */}
                        <div className="space-y-4">
                          {(() => {
                            const filtered = userSales.filter((order) => {
                              if (salesStatusFilter !== "all" && order.status !== salesStatusFilter) {
                                return false;
                              }
                              if (!salesSearchQuery.trim()) return true;
                              const q = salesSearchQuery.toLowerCase();
                              const matchesId = order.id?.toLowerCase().includes(q);
                              const matchesTracking = order.trackingNumber?.toLowerCase().includes(q);
                              const matchesCarrier = order.carrier?.toLowerCase().includes(q);
                              const matchesAddress = order.shippingAddress?.toLowerCase().includes(q);
                              const matchesBuyer =
                                order.buyerName?.toLowerCase().includes(q) ||
                                order.buyerUsername?.toLowerCase().includes(q);
                              const matchesItem = order.items?.some((it) =>
                                it.name?.toLowerCase().includes(q)
                              );
                              return matchesId || matchesTracking || matchesCarrier || matchesAddress || matchesBuyer || matchesItem;
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/40">
                                  <Truck className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                                  <p className="text-sm font-extrabold text-slate-700">
                                    No se encontraron ventas registradas
                                  </p>
                                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                    {salesSearchQuery || salesStatusFilter !== "all"
                                      ? "Intenta modificar el término de búsqueda o quitar los filtros de estado."
                                      : "Cuando otros usuarios compren productos de tu negocio, aquí podrás gestionar sus envíos y asignar guías de seguimiento."}
                                  </p>
                                  {(salesSearchQuery || salesStatusFilter !== "all") && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSalesSearchQuery("");
                                        setSalesStatusFilter("all");
                                      }}
                                      className="mt-3 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Limpiar filtros
                                    </button>
                                  )}
                                </div>
                              );
                            }

                            return filtered.map((order, index) => {
                              const isShipped = order.status === "shipped";
                              const isDelivered = order.status === "delivered";
                              const isProcessing = order.status === "processing" || !order.status;
                              const isCancelled = order.status === "cancelled";

                              const stepProgress = isDelivered ? 4 : isShipped ? 3 : isProcessing ? 2 : 1;

                              return (
                                <div
                                  key={order.id || `sale-${index}`}
                                  className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs transition-all hover:border-slate-300 flex flex-col space-y-4"
                                  id={`admin-sale-card-${order.id}`}
                                >
                                  {/* Order Card Top: Reference, Date, Status Badge */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-black font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                        Ref: {order.id}
                                      </span>
                                      <span className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
                                        <Clock className="w-3 h-3" />
                                        <span>
                                          {order.createdAt
                                            ? new Date(order.createdAt).toLocaleDateString("es-ES", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })
                                            : "Fecha no disponible"}
                                        </span>
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-1.5">
                                      {isDelivered && (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>Entregado</span>
                                        </span>
                                      )}
                                      {isShipped && (
                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                          <Truck className="w-3 h-3 text-blue-600 animate-pulse" />
                                          <span>En Camino / Despachado</span>
                                        </span>
                                      )}
                                      {isProcessing && (
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                          <Clock className="w-3 h-3 text-amber-600" />
                                          <span>En Preparación</span>
                                        </span>
                                      )}
                                      {isCancelled && (
                                        <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                          <AlertCircle className="w-3 h-3 text-rose-600" />
                                          <span>Cancelado</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Buyer metadata */}
                                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center space-x-3">
                                      <img
                                        src={
                                          order.buyerAvatar ||
                                          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80"
                                        }
                                        alt={order.buyerName || "Cliente"}
                                        className="w-9 h-9 rounded-full object-cover border border-emerald-200"
                                      />
                                      <div>
                                        <p className="font-extrabold text-slate-900">
                                          Cliente: {order.buyerName || "Cliente"}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                          {order.buyerUsername ? `@${order.buyerUsername}` : order.buyerEmail || "Cliente registrado"}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2 text-slate-600 text-[11px]">
                                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="font-medium line-clamp-1">{order.shippingAddress}</span>
                                    </div>
                                  </div>

                                  {/* Tracking Progress Stepper (4 Steps) */}
                                  {!isCancelled && (
                                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center space-x-1">
                                          <Truck className="w-3 h-3 text-amber-500" />
                                          <span>Progreso del Despacho</span>
                                        </span>
                                        {order.estimatedDelivery && (
                                          <span className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                                            <Calendar className="w-3 h-3 text-amber-500" />
                                            <span>Entrega estimada: {order.estimatedDelivery}</span>
                                          </span>
                                        )}
                                      </div>

                                      <div className="relative flex items-center justify-between mt-3 mb-2 px-3">
                                        {/* Background Connecting Line */}
                                        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
                                        {/* Active Progress Line */}
                                        <div
                                          className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 transition-all duration-500 z-0"
                                          style={{
                                            width:
                                              stepProgress === 1
                                                ? "0%"
                                                : stepProgress === 2
                                                ? "33%"
                                                : stepProgress === 3
                                                ? "66%"
                                                : "100%",
                                          }}
                                        />

                                        {/* Step 1: Pago Aprobado */}
                                        <div className="relative z-10 flex flex-col items-center">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              stepProgress >= 1
                                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                                : "bg-slate-200 text-slate-500"
                                            }`}
                                          >
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-600 mt-1">Confirmado</span>
                                        </div>

                                        {/* Step 2: En Preparación */}
                                        <div className="relative z-10 flex flex-col items-center">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              stepProgress >= 2
                                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                                : "bg-slate-200 text-slate-500"
                                            }`}
                                          >
                                            {stepProgress > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-600 mt-1">Preparando</span>
                                        </div>

                                        {/* Step 3: En Camino */}
                                        <div className="relative z-10 flex flex-col items-center">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              stepProgress >= 3
                                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                                : "bg-slate-200 text-slate-500"
                                            }`}
                                          >
                                            {stepProgress > 3 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-600 mt-1">En Camino</span>
                                        </div>

                                        {/* Step 4: Entregado */}
                                        <div className="relative z-10 flex flex-col items-center">
                                          <div
                                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              stepProgress === 4
                                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                                : "bg-slate-200 text-slate-500"
                                            }`}
                                          >
                                            {stepProgress === 4 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
                                          </div>
                                          <span className="text-[9px] font-bold text-slate-600 mt-1">Entregado</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Prominent Tracking Information Banner */}
                                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-emerald-50/40 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1">
                                          <Truck className="w-3 h-3" />
                                          <span>{order.carrier || "Transportadora"}</span>
                                        </span>
                                        <span className="text-[11px] font-extrabold text-slate-700">
                                          Guía de Seguimiento:
                                        </span>
                                      </div>

                                      {order.trackingNumber ? (
                                        <div className="flex items-center space-x-2 pt-0.5">
                                          <span className="font-mono font-black text-sm text-slate-900 tracking-wide bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                            {order.trackingNumber}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => handleCopyTrackingNumber(order.trackingNumber!, order.id, e)}
                                            className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-xs flex items-center space-x-1"
                                            title="Copiar número de guía"
                                          >
                                            {copiedTrackingId === order.id ? (
                                              <>
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-[10px] font-black text-emerald-700">¡Copiado!</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-bold">Copiar</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-amber-700 font-semibold pt-0.5">
                                          ⚠️ Pendiente de generar número de guía para el comprador.
                                        </p>
                                      )}

                                      {order.sellerNotes && (
                                        <p className="text-[11px] text-slate-500 italic pt-0.5">
                                          Nota: "{order.sellerNotes}"
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => openEditTrackingModal(order, e)}
                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                                        id={`btn-manage-tracking-sales-${order.id}`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Gestionar Guía & Envío</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setSelectedTrackingOrder(order)}
                                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                                      >
                                        <PackageSearch className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Ver Rastreo en Vivo</span>
                                      </button>

                                      {order.trackingUrl && (
                                        <a
                                          href={order.trackingUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition-colors flex items-center justify-center space-x-1"
                                        >
                                          <span>Web del transportista</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Items Sold Details */}
                                  <div className="space-y-2 pt-1">
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                                      Artículos vendidos en este pedido ({order.items.length})
                                    </span>
                                    <div className="divide-y divide-slate-100">
                                      {order.items.map((item, itIdx) => (
                                        <div key={itIdx} className="py-2 flex items-center justify-between gap-3">
                                          <div className="flex items-center space-x-3 min-w-0">
                                            <img
                                              src={item.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"}
                                              alt={item.name}
                                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                                            />
                                            <div className="min-w-0">
                                              <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                              <p className="text-[10px] text-slate-500">
                                                <span className="font-mono">Cantidad: {item.quantity}</span>
                                              </p>
                                            </div>
                                          </div>

                                          <div className="text-right shrink-0">
                                            <p className="text-xs font-extrabold font-mono text-slate-900">
                                              ${(item.price * item.quantity).toFixed(2)}
                                            </p>
                                            {item.quantity > 1 && (
                                              <p className="text-[10px] text-slate-400 font-mono">
                                                ${item.price.toFixed(2)} c/u
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Footer: Address and Total Summary */}
                                  <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">Dirección de entrega: {order.shippingAddress}</span>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                                      {order.shippingCost !== undefined && order.shippingCost > 0 && (
                                        <span className="text-[11px] text-slate-500">
                                          Envío: <span className="font-mono font-bold">${order.shippingCost.toFixed(2)}</span>
                                        </span>
                                      )}
                                      <div className="text-right">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1.5">
                                          Ingreso Venta:
                                        </span>
                                        <span className="text-sm font-black font-mono text-emerald-700">
                                          ${order.total.toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
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
                        {savedReels.map((reel, index) => (
                          <div
                            key={`${reel.id}-${index}`}
                            onClick={() => setActiveFeedReelId(reel.id)}
                            className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                            id={`saved-reel-${reel.id}`}
                          >
                            <PublicationCover reel={reel} />
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
                    className="space-y-4"
                  >
                    {/* Header & Refresh */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="font-display font-extrabold text-base text-slate-900 flex items-center space-x-2">
                          <ShoppingBag className="w-5 h-5 text-amber-500" />
                          <span>Historial de Mis Compras</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Rastrea los envíos de tus compras en tiempo real y consulta los detalles de tus pedidos.
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={fetchOrders}
                          disabled={ordersLoading}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                          title="Actualizar compras"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin text-amber-500" : ""}`} />
                          <span>Actualizar</span>
                        </button>
                      </div>
                    </div>

                    {/* Notification/Banner redirecting to sales in Products tab if user has sales */}
                    {userSales.length > 0 && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center space-x-2 text-emerald-800">
                          <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold">
                            ¿Deseas gestionar las ventas de tus productos? Ahora están en la pestaña <strong>Productos &gt; Ventas Entrantes</strong>.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSubTab("products");
                            setProductManagementSection("sales");
                            fetchOrders();
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Ir a Ventas ({userSales.length})
                        </button>
                      </div>
                    )}

                    {/* Quick Stats Summary Banner */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Total Compras</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">{userOrders.length}</p>
                      </div>
                      <div className="text-center border-x border-amber-200/60">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">En Tránsito</p>
                        <p className="text-sm font-black text-amber-600 mt-0.5 font-mono">
                          {userOrders.filter((o) => o.status === "shipped" || o.status === "processing").length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Total Invertido</p>
                        <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
                          ${userOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Search and Status Filters */}
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          placeholder="Buscar por referencia, producto, vendedor o guía de rastreo..."
                          className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                        />
                        {orderSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setOrderSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="all">Todos los estados</option>
                        <option value="processing">🟡 En preparación</option>
                        <option value="shipped">🚚 En camino / Despachado</option>
                        <option value="delivered">🟢 Entregado</option>
                        <option value="cancelled">🔴 Cancelado</option>
                      </select>
                    </div>

                    {/* Orders List */}
                    <div className="space-y-4">
                      {(() => {
                        const filtered = userOrders.filter((order) => {
                          if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) {
                            return false;
                          }
                          if (!orderSearchQuery.trim()) return true;
                          const q = orderSearchQuery.toLowerCase();
                          const matchesId = order.id?.toLowerCase().includes(q);
                          const matchesTracking = order.trackingNumber?.toLowerCase().includes(q);
                          const matchesCarrier = order.carrier?.toLowerCase().includes(q);
                          const matchesAddress = order.shippingAddress?.toLowerCase().includes(q);
                          const matchesItem = order.items?.some((it) =>
                            it.name?.toLowerCase().includes(q) ||
                            it.sellerName?.toLowerCase().includes(q)
                          );
                          return matchesId || matchesTracking || matchesCarrier || matchesAddress || matchesItem;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/40">
                              <ShoppingBag className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                              <p className="text-sm font-extrabold text-slate-700">
                                No se encontraron compras registradas
                              </p>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                {orderSearchQuery || orderStatusFilter !== "all"
                                  ? "Intenta modificar el término de búsqueda o quitar los filtros de estado."
                                  : "Cuando compres productos en la plataforma, aparecerán aquí con su código de guía y rastreo en vivo."}
                              </p>
                              {(orderSearchQuery || orderStatusFilter !== "all") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderSearchQuery("");
                                    setOrderStatusFilter("all");
                                  }}
                                  className="mt-3 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Limpiar filtros
                                </button>
                              )}
                            </div>
                          );
                        }

                        return filtered.map((order, index) => {
                          const isShipped = order.status === "shipped";
                          const isDelivered = order.status === "delivered";
                          const isProcessing = order.status === "processing" || !order.status;
                          const isCancelled = order.status === "cancelled";

                          const stepProgress = isDelivered ? 4 : isShipped ? 3 : isProcessing ? 2 : 1;

                          return (
                            <div
                              key={`${order.id}-${index}`}
                              className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs transition-all hover:border-slate-300 flex flex-col space-y-4"
                              id={`order-card-${order.id}`}
                            >
                              {/* Order Card Top: Reference, Date, Status Badge */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-black font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                    Ref: {order.id}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{new Date(order.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1.5">
                                  {isDelivered && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Entregado</span>
                                    </span>
                                  )}
                                  {isShipped && (
                                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                      <Truck className="w-3 h-3 text-blue-600 animate-pulse" />
                                      <span>En Camino / Despachado</span>
                                    </span>
                                  )}
                                  {isProcessing && (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                      <Package className="w-3 h-3 text-amber-600" />
                                      <span>En Preparación</span>
                                    </span>
                                  )}
                                  {isCancelled && (
                                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      <span>Cancelado</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tracking Progress Stepper (4 Steps) */}
                              {!isCancelled && (
                                <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center space-x-1">
                                      <Truck className="w-3 h-3 text-amber-500" />
                                      <span>Progreso del Envío</span>
                                    </span>
                                    {order.estimatedDelivery && (
                                      <span className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                                        <Calendar className="w-3 h-3 text-amber-500" />
                                        <span>Entrega estimada: {order.estimatedDelivery}</span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="relative flex items-center justify-between mt-3 mb-2 px-3">
                                    {/* Background Connecting Line */}
                                    <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
                                    {/* Active Progress Line */}
                                    <div
                                      className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-amber-500 transition-all duration-500 z-0"
                                      style={{
                                        width:
                                          stepProgress === 1
                                            ? "0%"
                                            : stepProgress === 2
                                            ? "33%"
                                            : stepProgress === 3
                                            ? "66%"
                                            : "100%",
                                      }}
                                    />

                                    {/* Step 1: Pago Aprobado */}
                                    <div className="relative z-10 flex flex-col items-center">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          stepProgress >= 1
                                            ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                            : "bg-slate-200 text-slate-500"
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-600 mt-1">Confirmado</span>
                                    </div>

                                    {/* Step 2: En Preparación */}
                                    <div className="relative z-10 flex flex-col items-center">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          stepProgress >= 2
                                            ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                            : "bg-slate-200 text-slate-500"
                                        }`}
                                      >
                                        {stepProgress > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-600 mt-1">Preparando</span>
                                    </div>

                                    {/* Step 3: En Camino */}
                                    <div className="relative z-10 flex flex-col items-center">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          stepProgress >= 3
                                            ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                                            : "bg-slate-200 text-slate-500"
                                        }`}
                                      >
                                        {stepProgress > 3 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-600 mt-1">En Camino</span>
                                    </div>

                                    {/* Step 4: Entregado */}
                                    <div className="relative z-10 flex flex-col items-center">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          stepProgress === 4
                                            ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                            : "bg-slate-200 text-slate-500"
                                        }`}
                                      >
                                        {stepProgress === 4 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-600 mt-1">Entregado</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Prominent Tracking Information Banner */}
                              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50/70 via-slate-50 to-amber-50/40 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1">
                                      <Truck className="w-3 h-3" />
                                      <span>{order.carrier || "Paquetería Express"}</span>
                                    </span>
                                    <span className="text-[11px] font-extrabold text-slate-700">
                                      Guía de Seguimiento:
                                    </span>
                                  </div>

                                  {order.trackingNumber ? (
                                    <div className="flex items-center space-x-2 pt-0.5">
                                      <span className="font-mono font-black text-sm text-slate-900 tracking-wide bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                        {order.trackingNumber}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopyTrackingNumber(order.trackingNumber!, order.id, e)}
                                        className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-xs flex items-center space-x-1"
                                        title="Copiar número de guía"
                                      >
                                        {copiedTrackingId === order.id ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-[10px] font-black text-emerald-700">¡Copiado!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold">Copiar</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-amber-700 font-semibold pt-0.5">
                                      ⚠️ Pendiente de generar número de guía por el vendedor.
                                    </p>
                                  )}

                                  {order.sellerNotes && (
                                    <p className="text-[11px] text-slate-500 italic pt-0.5">
                                      Nota: "{order.sellerNotes}"
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTrackingOrder(order)}
                                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                                  >
                                    <PackageSearch className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Ver Rastreo en Vivo</span>
                                  </button>

                                  {order.trackingUrl && (
                                    <a
                                      href={order.trackingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition-colors flex items-center justify-center space-x-1"
                                    >
                                      <span>Web del transportista</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Items Purchased Details */}
                              <div className="space-y-2 pt-1">
                                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                                  Artículos en este pedido ({order.items.length})
                                </span>
                                <div className="divide-y divide-slate-100">
                                  {order.items.map((item, itIdx) => (
                                    <div key={itIdx} className="py-2 flex items-center justify-between gap-3">
                                      <div className="flex items-center space-x-3 min-w-0">
                                        <img
                                          src={item.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"}
                                          alt={item.name}
                                          className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                                          <p className="text-[10px] text-slate-500">
                                            {item.sellerName && (
                                              <span>Vendedor: {item.sellerName} • </span>
                                            )}
                                            <span className="font-mono">Cantidad: {item.quantity}</span>
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <p className="text-xs font-extrabold font-mono text-slate-900">
                                          ${(item.price * item.quantity).toFixed(2)}
                                        </p>
                                        {item.quantity > 1 && (
                                          <p className="text-[10px] text-slate-400 font-mono">
                                            ${item.price.toFixed(2)} c/u
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Footer: Address and Total Summary */}
                              <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">Dirección: {order.shippingAddress}</span>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end space-x-4">
                                  {order.shippingCost !== undefined && order.shippingCost > 0 && (
                                    <span className="text-[11px] text-slate-500">
                                      Envío: <span className="font-mono font-bold">${order.shippingCost.toFixed(2)}</span>
                                    </span>
                                  )}
                                  <div className="text-right">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1.5">
                                      Total Pagado:
                                    </span>
                                    <span className="text-sm font-black font-mono text-slate-900">
                                      ${order.total.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </motion.div>
                )}

                {activeSubTab === "performance" && canSell && (
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

                            {/* Privacy Policy & Terms Input */}
                            <div className="space-y-2 md:col-span-2 bg-slate-50/90 p-4 rounded-2xl border border-slate-200/90">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                                  <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block">
                                    Política y Privacidad del Negocio
                                  </label>
                                </div>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">Pestaña Pública</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                Describe aquí tus políticas de compra, tiempos de entrega, condiciones de garantía, reembolsos y protección de datos para tus clientes.
                              </p>
                              <textarea
                                value={editPrivacyPolicy}
                                onChange={(e) => setEditPrivacyPolicy(e.target.value)}
                                rows={5}
                                className="w-full text-xs font-medium px-3.5 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none leading-relaxed"
                                placeholder="Ejemplo:&#10;• Envíos: Despachos seguros en 24 a 48 horas con número de rastreo.&#10;• Garantía: 30 días de cobertura contra defectos de fabricación.&#10;• Privacidad: Datos 100% resguardados y protegidos."
                              />
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Plantillas sugeridas:</span>
                                <button
                                  type="button"
                                  onClick={() => setEditPrivacyPolicy(`• Envíos y Tiempos de Entrega: Realizamos despachos seguros en 24 a 48 horas hábiles a todo el país. Recibirás tu guía de seguimiento en tiempo real.
• Garantía y Devoluciones: Ofrecemos 30 días de garantía de satisfacción. Si el producto presenta algún desperfecto o no coincide con tu pedido, gestionamos el cambio o reembolso inmediato.
• Privacidad y Seguridad: Tu información personal y datos bancarios están estrictamente protegidos bajo cifrado SSL. Jamás compartimos tus datos con terceros.
• Atención y Contacto: Brindamos asesoría continua y soporte directo a través de nuestro chat de atención.`)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                                >
                                  📋 Plantilla Completa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditPrivacyPolicy(`• Garantía Directa: Cobertura total por 30 días contra fallas de fábrica.
• Envíos Garantizados: Entregas rápidas y protegidas a nivel nacional.
• Privacidad Total: Resguardo estricto y confidencial de todos tus datos.`)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                                >
                                  ⚡ Plantilla Breve
                                </button>
                              </div>
                            </div>

                            {/* Avatar Image URL Input & Presets */}
                            <div className="space-y-2.5">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Imagen de Perfil</label>
                                <div className="flex items-center space-x-4 bg-white p-3 border border-slate-200 rounded-xl">
                                  <img
                                    src={editAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
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
                                      src={editCoverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"}
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
                                <span>Guardar</span>
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
                            .map((u, index) => {
                              const isTargetSelected = switchingUser?.id === u.id;
                              return (
                                <div
                                  key={`${u.id}-${index}`}
                                  className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500/50 hover:shadow-sm transition-all"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center space-x-3">
                                      <img
                                        src={u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
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
              className="space-y-6"
            >
              {/* Dynamic Sub-tab Section Content */}
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
                          <p className="text-[11px] text-slate-400 mt-0.5">Este creador no ha compartido videos todavía.</p>
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
                              <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">{prod.description}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                              <span className="text-xs sm:text-sm font-black font-mono text-emerald-600">${prod.price.toFixed(2)}</span>
                              <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">Ver detalles →</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {userProducts.length === 0 && (
                        <div className="col-span-full py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-500">Sin productos en venta</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Este creador no tiene productos en su catálogo en este momento.</p>
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
                    {/* Header Banner */}
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
                            Términos comerciales, garantías y resguardo de datos de <span className="text-amber-400 font-bold">{profileUser.name}</span> (@{profileUser.username}).
                          </p>
                        </div>
                      </div>

                      {/* Trust Badges */}
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

                    {/* Policy Details Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
                      <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-slate-100">
                        <FileText className="w-4 h-4 text-amber-500" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Términos y Políticas del Vendedor</h4>
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

                      {/* Contact Action */}
                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] font-bold text-slate-500">¿Deseas consultar o aclarar alguna duda?</span>
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

      {/* Hidden File Inputs for Product Images */}
      <input
        type="file"
        ref={prodImageInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadProdImage(file, false);
          }
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={prodExtraImageInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadProdImage(file, true);
          }
          e.target.value = "";
        }}
      />

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            id="modal-edit-product-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto my-auto flex flex-col justify-between"
              id="modal-edit-product-content"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-extrabold text-base text-slate-900 leading-tight">
                        Editar Producto
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Modifica precio, fotos, inventario, descripción y detalles
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSavingProduct) {
                        setEditingProduct(null);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Error Banner */}
                {productActionError && (
                  <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{productActionError}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSaveProductChanges} id="form-edit-product" className="space-y-4">
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={editProdForm.name}
                      onChange={(e) => setEditProdForm({ ...editProdForm, name: e.target.value })}
                      placeholder="Ej: Zapatillas Urbanas Pro Max"
                      className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      required
                    />
                  </div>

                  {/* Two Columns: Price & Stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Precio ($ USD) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editProdForm.price}
                          onChange={(e) => setEditProdForm({ ...editProdForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full text-xs font-bold pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Stock / Inventario *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editProdForm.stock}
                        onChange={(e) => setEditProdForm({ ...editProdForm, stock: e.target.value })}
                        placeholder="10"
                        className="w-full text-xs font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Two Columns: Shipping & Category */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Costo de Envío ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editProdForm.shippingCost}
                          onChange={(e) => setEditProdForm({ ...editProdForm, shippingCost: e.target.value })}
                          placeholder="0.00 (Gratis)"
                          className="w-full text-xs font-semibold pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Categoría
                      </label>
                      <select
                        value={editProdForm.category}
                        onChange={(e) => setEditProdForm({ ...editProdForm, category: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      >
                        <option value="Ropa Femenina">Ropa Femenina</option>
                        <option value="Ropa Masculina">Ropa Masculina</option>
                        <option value="Calzado">Calzado</option>
                        <option value="Tecnología & Celulares">Tecnología & Celulares</option>
                        <option value="Belleza & Cuidado Personal">Belleza & Cuidado Personal</option>
                        <option value="Joyería & Relojes">Joyería & Relojes</option>
                        <option value="Hogar & Decoración">Hogar & Decoración</option>
                        <option value="Deportes & Fitness">Deportes & Fitness</option>
                        <option value="Juguetes & Bebés">Juguetes & Bebés</option>
                        <option value="General">General / Otros</option>
                      </select>
                    </div>
                  </div>

                  {/* Main Product Image */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                        Foto Principal del Producto *
                      </label>
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                        Portada
                      </span>
                    </div>

                    <div className="flex items-center space-x-3.5">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                        {editProdForm.imageUrl ? (
                          <img
                            src={editProdForm.imageUrl}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                        {isUploadingProdImage && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <button
                          type="button"
                          disabled={isUploadingProdImage}
                          onClick={() => prodImageInputRef.current?.click()}
                          className="w-full px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-500" />
                          <span>{isUploadingProdImage ? "Subiendo foto..." : "Subir desde tu dispositivo"}</span>
                        </button>

                        <div className="relative">
                          <input
                            type="text"
                            value={editProdForm.imageUrl}
                            onChange={(e) => setEditProdForm({ ...editProdForm, imageUrl: e.target.value })}
                            placeholder="O pega una URL de imagen (https://...)"
                            className="w-full text-[11px] font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Gallery Images */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                        Galería de Fotos Adicionales ({editProdForm.images.length})
                      </label>
                      <button
                        type="button"
                        onClick={() => prodExtraImageInputRef.current?.click()}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Subir otra foto</span>
                      </button>
                    </div>

                    {editProdForm.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {editProdForm.images.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="relative w-14 h-14 rounded-lg overflow-hidden bg-white border border-slate-200 group/img shrink-0"
                          >
                            <img
                              src={imgUrl}
                              alt={`Extra ${idx}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditProdForm((prev) => ({
                                  ...prev,
                                  images: prev.images.filter((_, i) => i !== idx),
                                }));
                              }}
                              className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                              title="Quitar foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No hay fotos adicionales agregadas</p>
                    )}

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        value={newExtraImageUrl}
                        onChange={(e) => setNewExtraImageUrl(e.target.value)}
                        placeholder="O pega URL de foto adicional..."
                        className="flex-1 text-[11px] font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newExtraImageUrl.trim()) {
                            setEditProdForm((prev) => ({
                              ...prev,
                              images: prev.images.includes(newExtraImageUrl.trim())
                                ? prev.images
                                : [...prev.images, newExtraImageUrl.trim()],
                            }));
                            setNewExtraImageUrl("");
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Descripción del Producto
                    </label>
                    <textarea
                      value={editProdForm.description}
                      onChange={(e) => setEditProdForm({ ...editProdForm, description: e.target.value })}
                      rows={3}
                      placeholder="Describe materiales, detalles, garantía, tallas, colores..."
                      className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                    <button
                      type="button"
                      disabled={isSavingProduct}
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProduct ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando cambios...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Guardar Cambios</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Product Confirmation Modal */}
      <AnimatePresence>
        {deletingProduct && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            id="modal-delete-product-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center"
              id="modal-delete-product-content"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-display font-extrabold text-base text-slate-900">
                ¿Eliminar este producto?
              </h3>

              <div className="my-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center space-x-3 text-left">
                <img
                  src={deletingProduct.imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80"}
                  alt={deletingProduct.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate">{deletingProduct.name}</p>
                  <p className="text-amber-600 font-bold text-xs mt-0.5">
                    ${Number(deletingProduct.price || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Esta acción retirará el producto de tu tienda, catálogo público y bases de datos. No se puede deshacer.
              </p>

              <div className="flex items-center justify-center space-x-2.5">
                <button
                  type="button"
                  disabled={isDeletingProduct}
                  onClick={() => setDeletingProduct(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingProduct}
                  onClick={handleConfirmDeleteProduct}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-confirm-delete-product"
                >
                  {isDeletingProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN ELIMINAR PUBLICACIÓN / REEL */}
        {deletingReel && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            id="modal-delete-reel-backdrop"
            onClick={() => {
              if (!isDeletingReel) setDeletingReel(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center"
              id="modal-delete-reel-content"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-display font-extrabold text-base text-slate-900">
                ¿Eliminar esta publicación?
              </h3>

              <div className="my-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center space-x-3 text-left">
                {deletingReel.thumbnailUrl && !deletingReel.thumbnailUrl.endsWith(".m3u8") ? (
                  <img
                    src={deletingReel.thumbnailUrl}
                    alt={deletingReel.description || "Publicación"}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover bg-black border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <Play className="w-5 h-5 text-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {deletingReel.description || "Publicación de video"}
                  </p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {deletingReel.views || 0} vistas • {deletingReel.likes || 0} me gusta
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Esta acción eliminará el video y sus archivos permanentemente de MongoDB y Google Cloud Storage. No se puede deshacer.
              </p>

              <div className="flex items-center justify-center space-x-2.5">
                <button
                  type="button"
                  disabled={isDeletingReel}
                  onClick={() => setDeletingReel(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  id="btn-cancel-delete-reel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingReel}
                  onClick={handleConfirmDeleteReel}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-confirm-delete-reel"
                >
                  {isDeletingReel ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* TOAST NOTIFICATION FOR REEL ACTIONS */}
        {reelActionMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-bold border ${
              reelActionMessage.type === "success"
                ? "bg-slate-900 text-white border-emerald-500/30"
                : "bg-rose-600 text-white border-rose-400/30"
            }`}
          >
            {reelActionMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white" />
            )}
            <span>{reelActionMessage.text}</span>
          </motion.div>
        )}

        {/* MODAL 1: LIVE TRACKING & EXPANDED DISPATCH TIMELINE */}
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
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <PackageSearch className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-slate-900">
                      Rastreo de Envío en Vivo
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500">
                      Ref: {selectedTrackingOrder.id}
                    </p>
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

              {/* Modal Scrollable Body */}
              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Carrier & Tracking Code Card */}
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

                {/* 4-Step Stepper in Modal */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3">
                    Estado Actual del Paquete
                  </p>
                  {(() => {
                    const st = selectedTrackingOrder.status;
                    const step =
                      st === "delivered" ? 4 : st === "shipped" ? 3 : st === "processing" ? 2 : 1;
                    return (
                      <div className="relative flex items-center justify-between px-2">
                        {/* Connecting track */}
                        <div className="absolute left-6 right-6 top-3 h-1 bg-slate-200 z-0" />
                        <div
                          className="absolute left-6 top-3 h-1 bg-amber-500 transition-all duration-300 z-0"
                          style={{
                            width:
                              step === 1 ? "0%" : step === 2 ? "33%" : step === 3 ? "66%" : "100%",
                          }}
                        />

                        {/* Steps */}
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

                {/* Chronological Timeline History */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Historial Cronológico de Paradas y Despacho
                  </p>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-4">
                    {selectedTrackingOrder.statusHistory &&
                    selectedTrackingOrder.statusHistory.length > 0 ? (
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

                {/* Delivery Destination */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start space-x-2.5 text-xs text-slate-600">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-800">Dirección de Destino:</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedTrackingOrder.shippingAddress}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
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

        {/* MODAL 2: SELLER EDIT TRACKING NUMBER & FULFILLMENT */}
        {editingTrackingOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
            onClick={() => {
              if (!isUpdatingTracking) setEditingTrackingOrder(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
              id="modal-edit-tracking"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-slate-900">
                      Gestionar Envío & Guía de Rastreo
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pedido: <span className="font-mono font-bold text-slate-800">{editingTrackingOrder.id}</span>
                      {editingTrackingOrder.buyerName && ` • Cliente: ${editingTrackingOrder.buyerName}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUpdatingTracking}
                  onClick={() => setEditingTrackingOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveTrackingUpdate} className="flex-1 overflow-y-auto p-5 space-y-4">
                {trackingSuccessMessage && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{trackingSuccessMessage}</span>
                  </div>
                )}

                {/* Carrier Manual Input with Suggestions */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <span>Empresa de Paquetería / Courier *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editCarrier}
                      onChange={(e) => setEditCarrier(e.target.value)}
                      placeholder="Ej: DHL Express, FedEx, Correos de España, Estafeta, etc."
                      list="carrier-suggestions"
                      className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      id="input-edit-carrier"
                    />
                    <datalist id="carrier-suggestions">
                      <option value="DHL Express" />
                      <option value="FedEx" />
                      <option value="UPS" />
                      <option value="Correos de España" />
                      <option value="Estafeta" />
                      <option value="Servientrega" />
                      <option value="Envia" />
                      <option value="Paquetería Express Local" />
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Escribe manualmente el nombre de cualquier empresa de paquetería o servicio de envío.
                  </p>
                </div>

                {/* Tracking Number Input (Manual Entry Only) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Número de Seguimiento (Guía de Rastreo) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editTrackingNumber}
                      onChange={(e) => setEditTrackingNumber(e.target.value)}
                      placeholder="Escribe manualmente el número o código de guía..."
                      className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-900 uppercase"
                      id="input-edit-tracking-number"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Introduce el código de guía emitido por tu paquetería para que el comprador pueda rastrearlo.
                  </p>
                </div>

                {/* Order Status Select Pills */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Estado Actual del Pedido *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("processing")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "processing"
                          ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Package className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">En preparación</p>
                        <p className="text-[10px] font-normal text-slate-400">Empacando productos</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("shipped")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "shipped"
                          ? "bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">En camino / Enviado</p>
                        <p className="text-[10px] font-normal text-slate-400">Entregado a paquetería</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("delivered")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "delivered"
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">Entregado</p>
                        <p className="text-[10px] font-normal text-slate-400">Recibido por el cliente</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("cancelled")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "cancelled"
                          ? "bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">Cancelado</p>
                        <p className="text-[10px] font-normal text-slate-400">Orden anulada</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Estimated Delivery Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Fecha Estimada de Entrega</span>
                  </label>
                  <input
                    type="date"
                    value={editEstimatedDelivery}
                    onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                  />
                </div>

                {/* Courier Web Tracking URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Enlace Web de Rastreo (Opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={editTrackingUrl}
                    onChange={(e) => setEditTrackingUrl(e.target.value)}
                    placeholder="https://www.dhl.com o url del courier..."
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                  />
                </div>

                {/* Seller Dispatch Note for Customer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Mensaje / Nota de Despacho para el Comprador
                  </label>
                  <textarea
                    rows={3}
                    value={editSellerNotes}
                    onChange={(e) => setEditSellerNotes(e.target.value)}
                    placeholder="Ej: Paquete despachado con embalaje reforzado y precinto de seguridad desde nuestra sede central..."
                    className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Esta nota se agregará a la cronología de eventos que verá el cliente al rastrear el paquete.
                  </p>
                </div>

                {/* Form Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    disabled={isUpdatingTracking}
                    onClick={() => setEditingTrackingOrder(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdatingTracking || !editTrackingNumber.trim()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    id="btn-submit-save-tracking"
                  >
                    {isUpdatingTracking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Guardar y Notificar al Comprador</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPONENTE EXCLUSIVO PARA MOSTRAR LA LISTA DE PUBLICACIONES DE UN USUARIO */}
      <AnimatePresence>
        {activeFeedReelId && (
          <UserPublicationsFeed
            user={profileUser || currentUser}
            reels={activeSubTab === "saved" ? savedReels : userReels}
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

