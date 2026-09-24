import React, { useState, useRef, useEffect, useCallback } from "react";
import { Reel, ReelMedia, Product, User, Comment, CartItem } from "../../types";
import { Heart, MessageCircle, Share2, Bookmark, ShoppingBag, Volume2, VolumeX, Plus, Send, X, RefreshCw, Video, Minus, Trash2, CreditCard, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AndroidVideoPlayer, AndroidVideoPlayerHandle } from "./components/AndroidVideoPlayer";
import { AndroidProgressBar } from "./components/AndroidProgressBar";
import { AndroidAuthModal } from "./components/AndroidAuthModal";
import { getMediaUrl } from "../../config";

export interface AndroidReelsViewProps {
  reels: Reel[];
  currentUser: User;
  onLikeReel: (reelId: string) => void;
  onCommentReel?: (reelId: string, commentText: string) => void;
  onAddComment?: (reelId: string, commentText: string) => void;
  onSelectProduct?: (product: Product) => void;
  onProductClick?: (product: Product) => void;
  products?: Product[];
  onOpenPublishModal?: () => void;
  onToggleSaveReel: (reelId: string) => void;
  savedReelIds: string[];
  onSelectUser?: (user: User) => void;
  onCreatorClick?: (creatorId: string) => void;
  users?: User[];
  onToggleFollowUser?: (creatorId: string) => void;
  isFeedActive?: boolean;
  onOpenSocial?: () => void;
  unreadCount?: number;
  onAuthRequired?: (actionDescription?: string) => void;
  onGuestInteraction?: (action: string) => void;
  onRefreshReels?: () => void;
  isLoading?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  bottomNavHeight?: number;
  cart?: CartItem[];
  onRemoveFromCart?: (productId: string, idx?: number) => void;
  onUpdateCartQuantity?: (productId: string, qty: number, idx?: number) => void;
  onNavigateToShop?: () => void;
  onNavigateToCheckout?: (selectedIndices?: number[]) => void;
  onNavigateToProfile?: () => void;
}

export default function AndroidReelsView({
  reels,
  currentUser,
  onLikeReel,
  onCommentReel,
  onAddComment,
  onSelectProduct,
  onProductClick,
  products = [],
  onToggleSaveReel,
  savedReelIds,
  onSelectUser,
  onCreatorClick,
  users = [],
  onToggleFollowUser,
  isFeedActive = true,
  onAuthRequired,
  onGuestInteraction,
  onRefreshReels,
  isLoading = false,
  isMuted: propIsMuted,
  onToggleMute: propOnToggleMute,
  bottomNavHeight = 56,
  cart = [],
  onNavigateToShop,
  onNavigateToCheckout,
  onNavigateToProfile,
  onRemoveFromCart,
  onUpdateCartQuantity,
}: AndroidReelsViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localMuted, setLocalMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDescription, setAuthDescription] = useState("");
  const [actualNavHeight, setActualNavHeight] = useState<number>(bottomNavHeight || 56);
  const [imageAspect, setImageAspect] = useState<'vertical' | 'horizontal' | 'square'>('vertical');
  const [progressVideo, setProgressVideo] = useState<HTMLVideoElement | null>(null);
  const [showCartPanel, setShowCartPanel] = useState(false);

  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>([]);

  // Synchronize cart selection when cart items change
  useEffect(() => {
    setSelectedCartIndices((prev) => {
      if (!cart || cart.length === 0) return [];
      const valid = prev.filter((i) => i < cart.length);
      if (valid.length > 0) return valid;
      return cart.map((_, i) => i);
    });
  }, [cart?.length]);

  const toggleSelectCartItem = (idx: number) => {
    setSelectedCartIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const isAllSelected = (cart?.length || 0) > 0 && selectedCartIndices.length === cart.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCartIndices([]);
    } else {
      setSelectedCartIndices((cart || []).map((_, i) => i));
    }
  };

  const selectedCartItems = (cart || []).filter((_, idx) => selectedCartIndices.includes(idx));
  const selectedCartTotal = selectedCartItems.reduce((sum, item) => {
    return sum + (item.product?.price || 0) * (item.quantity || 1);
  }, 0);
  const totalCartCount = (cart || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const cartTotal = selectedCartTotal;

  // Track bottom navigation bar height dynamically for pixel-perfect alignment
  useEffect(() => {
    const updateHeight = () => {
      const navEl = document.getElementById("android-bottom-nav-bar");
      if (navEl) {
        setActualNavHeight(navEl.offsetHeight || navEl.getBoundingClientRect().height || 56);
      } else if (bottomNavHeight) {
        setActualNavHeight(bottomNavHeight);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [bottomNavHeight]);

  const isMuted = propIsMuted !== undefined ? propIsMuted : localMuted;
  const toggleMute = () => {
    if (propOnToggleMute) {
      propOnToggleMute();
    } else {
      setLocalMuted((prev) => !prev);
    }
    if (playerRef.current) {
      playerRef.current.toggleMute();
    }
  };

  const handleMuteChange = useCallback((m: boolean) => {
    setLocalMuted(m);
  }, []);

  const handleVideoReady = useCallback((video: HTMLVideoElement | null) => {
    setProgressVideo((prev) => (prev === video ? prev : video));
  }, []);

  const playerRef = useRef<AndroidVideoPlayerHandle>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const mouseStartX = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);
  const isGuest = !currentUser || currentUser.isGuest || currentUser.username === "invitado";

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const currentReel = reels[currentIndex] || reels[0];

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [currentIndex]);

  const handleProductSelect = onProductClick || onSelectProduct;

  // Infinite scroll: Next reel loops back to beginning seamlessly
  const handleNext = useCallback(() => {
    if (reels.length === 0) return;
    setCurrentIndex((i) => (i + 1) % reels.length);
    if (currentIndex >= reels.length - 2 && onRefreshReels) {
      onRefreshReels();
    }
  }, [currentIndex, reels.length, onRefreshReels]);

  // Infinite scroll: Prev reel loops back to end seamlessly
  const handlePrev = useCallback(() => {
    if (reels.length === 0) return;
    setCurrentIndex((i) => (i - 1 + reels.length) % reels.length);
  }, [reels.length]);

  const mediaItems: ReelMedia[] =
    Array.isArray(currentReel?.media) && currentReel.media.length > 0
      ? currentReel.media.map((item) =>
          item.type === "video"
            ? { ...item, url: currentReel.hlsUrl || currentReel.videoUrl || item.url, hlsUrl: currentReel.hlsUrl || item.hlsUrl, thumbnailUrl: item.thumbnailUrl || currentReel.thumbnailUrl || undefined }
            : item
        )
      : currentReel?.videoUrl && currentReel.videoUrl.trim() !== ""
        ? [{ type: "video", url: currentReel.hlsUrl || currentReel.videoUrl, hlsUrl: currentReel.hlsUrl, thumbnailUrl: currentReel.thumbnailUrl || undefined }]
    : (currentReel?.images && currentReel.images.length > 0)
    ? currentReel.images.map((img, i) => ({ type: "image", url: img, order: i }))
    : [{ type: "image", url: currentReel?.thumbnailUrl || "" }];

  const currentMedia = mediaItems[activeMediaIndex] || mediaItems[0];
  const isVideo = currentMedia?.type === "video" && !!currentMedia.url;

  const nextReel = reels.length > 1 ? reels[(currentIndex + 1) % reels.length] : null;
  const nextMediaItems: ReelMedia[] =
    Array.isArray(nextReel?.media) && nextReel.media.length > 0
      ? nextReel.media.map((item) =>
          item.type === "video"
            ? { ...item, url: nextReel.hlsUrl || nextReel.videoUrl || item.url, hlsUrl: nextReel.hlsUrl || item.hlsUrl, thumbnailUrl: item.thumbnailUrl || nextReel.thumbnailUrl || undefined }
            : item
        )
      : nextReel?.videoUrl && nextReel.videoUrl.trim() !== ""
        ? [{ type: "video", url: nextReel.hlsUrl || nextReel.videoUrl, hlsUrl: nextReel.hlsUrl, thumbnailUrl: nextReel.thumbnailUrl || undefined }]
        : nextReel?.images && nextReel.images.length > 0
          ? nextReel.images.map((img, i) => ({ type: "image", url: img, order: i }))
          : [];
  const nextMedia = nextMediaItems.find((item) => item.type === "video" && !!item.url);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (showComments || showCartPanel) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments || showCartPanel) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;
    const SWIPE_THRESHOLD = 45;

    // Detect horizontal swipe inside reel media sequence
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD && mediaItems.length > 1) {
      if (diffX > 0 && activeMediaIndex < mediaItems.length - 1) {
        setActiveMediaIndex((prev) => prev + 1);
        return;
      } else if (diffX < 0 && activeMediaIndex > 0) {
        setActiveMediaIndex((prev) => prev - 1);
        return;
      }
    }

    if (diffY > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diffY < -SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (showComments || showCartPanel) return;
    isMouseDownRef.current = true;
    mouseStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (showComments || showCartPanel || !isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    const diffX = mouseStartX.current - e.clientX;
    const diffY = touchStartY.current - e.clientY;
    const SWIPE_THRESHOLD = 45;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD && mediaItems.length > 1) {
      if (diffX > 0 && activeMediaIndex < mediaItems.length - 1) {
        setActiveMediaIndex((prev) => prev + 1);
        return;
      } else if (diffX < 0 && activeMediaIndex > 0) {
        setActiveMediaIndex((prev) => prev - 1);
        return;
      }
    }

    if (diffY > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diffY < -SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  // Keyboard navigation (ArrowDown / ArrowUp)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showComments || showCartPanel) return;
      if (e.key === "ArrowDown") handleNext();
      if (e.key === "ArrowUp") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, showComments, showCartPanel]);

  // Infinite mouse wheel scroll navigation
  useEffect(() => {
    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      if (showComments || showCartPanel) return;
      const now = Date.now();
      if (now - lastWheelTime < 400) return;
      if (e.deltaY > 25) {
        lastWheelTime = now;
        handleNext();
      } else if (e.deltaY < -25) {
        lastWheelTime = now;
        handlePrev();
      }
    };

    const container = document.getElementById("android-reels-view");
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: true });
    }
    return () => {
      if (container) container.removeEventListener("wheel", handleWheel);
    };
  }, [handleNext, handlePrev, showComments, showCartPanel]);

  if (!currentReel) {
    if (isLoading) {
      return (
        <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-200">Sincronizando Reels...</p>
          <p className="text-xs text-slate-400 mt-1">Conectando con la base de datos de videos</p>
        </div>
      );
    }

    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-amber-400">
          <Video className="w-8 h-8" />
        </div>
        <p className="text-base font-bold text-slate-200">No hay publicaciones disponibles</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Aún no se han publicado reels o videos en la aplicación.
        </p>
        {onRefreshReels && (
          <button
            type="button"
            onClick={onRefreshReels}
            className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-transform shadow-lg shadow-amber-500/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        )}
      </div>
    );
  }

  const isLiked = currentReel.likedBy?.includes(currentUser?.originalId || currentUser?.id) || false;
  const isSaved = savedReelIds.includes(currentReel.id);
  const taggedProduct =
    (currentReel as any).product ||
    products.find((p) => p.id === (currentReel.productId || (currentReel as any).taggedProductId));
  const isFollowing = currentUser?.followingUserIds?.includes(currentReel.creatorId) || false;

  // Resolve creator username, display name, and avatar reliably
  const creatorUser = users.find(
    (u) =>
      (currentReel.creatorId && (u.id === currentReel.creatorId || u.originalId === currentReel.creatorId)) ||
      (currentReel.creatorUsername && u.username?.toLowerCase() === currentReel.creatorUsername?.toLowerCase())
  );
  const displayUsername =
    creatorUser?.username ||
    currentReel.creatorUsername ||
    (currentReel.creatorId === "current_user" ? currentUser?.username : "") ||
    "usuario";
  const displayName = creatorUser?.name || currentReel.creatorName || (displayUsername ? `@${displayUsername}` : "Creador");
  const displayAvatar =
    creatorUser?.avatar ||
    currentReel.creatorAvatar ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio < 0.85) setImageAspect("vertical");
      else if (ratio > 1.18) setImageAspect("horizontal");
      else setImageAspect("square");
    }
  };

  const handleDoubleTap = () => {
    if (isGuest) {
      if (onGuestInteraction) onGuestInteraction("dar Me Gusta");
      setAuthDescription("dar 'Me gusta' a las publicaciones");
      setShowAuthModal(true);
      return;
    }
    if (!isLiked) {
      onLikeReel(currentReel.id);
    }
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 800);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      if (onGuestInteraction) onGuestInteraction("comentar");
      setAuthDescription("comentar en los Reels");
      setShowAuthModal(true);
      return;
    }
    if (!commentInput.trim()) return;
    const commentFn = onAddComment || onCommentReel;
    if (commentFn) commentFn(currentReel.id, commentInput.trim());
    setCommentInput("");
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: currentReel.description || "Reel",
          text: currentReel.description,
          url: window.location.href,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText?.(window.location.href);
      alert("Enlace copiado al portapapeles de Android");
    }
  };

  const handleCreatorNav = () => {
    if (onCreatorClick) {
      onCreatorClick(currentReel.creatorId);
    } else if (onSelectUser) {
      const creator = users.find((u) => u.id === currentReel.creatorId || u.username === currentReel.creatorUsername);
      if (creator) onSelectUser(creator);
    }
  };

  return (
    <div
      className="relative w-full bg-black overflow-hidden flex flex-col items-center justify-center select-none font-sans"
      style={{
        height: `calc(100vh - ${actualNavHeight}px)`,
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      id="android-reels-view"
    >
      {/* Media item sequence indicators for multi-media publications (Video -> Image -> Image etc.) */}
      {mediaItems.length > 1 && (
        <div className="absolute top-1.5 inset-x-3 z-35 flex items-center space-x-1.5 pointer-events-none">
          {mediaItems.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                idx === activeMediaIndex ? "bg-amber-400 shadow-sm" : "bg-white/35"
              }`}
            />
          ))}
        </div>
      )}

      {/* Navigation chevrons for multi-media publication sequence */}
      {mediaItems.length > 1 && (
        <>
          {activeMediaIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMediaIndex((prev) => prev - 1);
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-35 w-8 h-8 rounded-full bg-black/45 backdrop-blur-xs text-white/90 flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10 shadow-lg"
              title="Anterior elemento"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {activeMediaIndex < mediaItems.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMediaIndex((prev) => prev + 1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-35 w-8 h-8 rounded-full bg-black/45 backdrop-blur-xs text-white/90 flex items-center justify-center active:scale-90 transition-all cursor-pointer border border-white/10 shadow-lg"
              title="Siguiente elemento"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </>
      )}

      {/* Media Player Container: Dynamic Aspect Architecture (Vertical 100%, Horizontal 16:9, Square 1:1) */}
      {isVideo ? (
        <>
          <AndroidVideoPlayer
            key={currentReel.id}
            ref={playerRef}
            src={getMediaUrl(currentMedia.url)}
            hlsUrl={getMediaUrl(currentMedia.hlsUrl || (currentMedia.url?.includes(".m3u8") ? currentMedia.url : currentReel.hlsUrl))}
            poster={currentReel.thumbnailUrl ? getMediaUrl(currentReel.thumbnailUrl) : undefined}
            autoPlay={true}
            loop={true}
            muted={isMuted}
            isCurrent={isFeedActive}
            aspectRatio={currentReel.aspectRatio}
            onDoubleTap={handleDoubleTap}
            onMuteChange={handleMuteChange}
            onVideoReady={handleVideoReady}
            className="w-full h-full"
          />
        </>
      ) : (
        /* Image / Carousel publication */
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black">
          {imageAspect !== "vertical" && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 filter blur-3xl scale-125 select-none"
              aria-hidden="true"
            >
              <img
                src={getMediaUrl(currentMedia?.url || currentReel.thumbnailUrl || (currentReel.images && currentReel.images[0]))}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div
            className={
              imageAspect === "vertical"
                ? "w-full h-full flex items-center justify-center relative overflow-hidden"
                : imageAspect === "horizontal"
                ? "w-full max-h-[calc(100vh-120px)] relative z-10 flex items-center justify-center my-auto px-0 rounded-none overflow-hidden"
                : "w-full max-w-[min(94vw,calc(100vh-160px))] aspect-square relative z-10 mx-auto flex items-center justify-center my-auto rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            }
          >
            <img
              src={getMediaUrl(currentMedia?.url || currentReel.thumbnailUrl || (currentReel.images && currentReel.images[0]))}
              alt={currentReel.description}
              onLoad={handleImageLoad}
              className={
                imageAspect === "vertical"
                  ? "w-full h-full object-cover"
                  : imageAspect === "horizontal"
                  ? "w-full max-h-full aspect-video object-cover rounded-none shadow-none"
                  : "w-full h-full object-cover"
              }
            />
          </div>
        </div>
      )}

      {nextMedia && nextReel && (
        <AndroidVideoPlayer
          key={nextReel.id}
          src={getMediaUrl(nextMedia.url)}
          hlsUrl={getMediaUrl(nextMedia.hlsUrl || (nextMedia.url?.includes(".m3u8") ? nextMedia.url : nextReel.hlsUrl))}
          poster={nextReel.thumbnailUrl ? getMediaUrl(nextReel.thumbnailUrl) : undefined}
          autoPlay={false}
          loop={true}
          muted={true}
          isCurrent={false}
          aspectRatio={nextReel.aspectRatio}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
        />
      )}

      {/* Progress Bar for video publications: receives the live video element from AndroidVideoPlayer and tracks its accurate playback */}
      {isVideo && (
        <AndroidProgressBar
          video={progressVideo}
          isActive={isFeedActive}
          bottomOffset={0}
        />
      )}

      <AnimatePresence>
        {showHeartAnim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.3, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute z-40 pointer-events-none text-rose-500"
          >
            <Heart className="w-24 h-24 fill-rose-500 drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-4 pointer-events-none"
        style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top, 0px) + 0.75rem))", paddingBottom: "0.75rem" }}
        id="android-reels-fixed-header"
      >
        <button onClick={() => setShowCartPanel(true)} className="relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto" id="android-reels-cart-btn" title="Ver carrito de compras">
          <ShoppingBag className="w-5 h-5 text-amber-400 drop-shadow-md" />
          {totalCartCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">{totalCartCount}</span>}
        </button>
        <div className="flex items-center space-x-2 pointer-events-auto">
          {mediaItems.length > 1 && <div className="inline-flex items-center space-x-1 px-1.5 py-1 bg-transparent text-xs font-extrabold text-white drop-shadow-md"><span className="text-amber-400 font-mono font-black">{activeMediaIndex + 1}</span><span className="text-white/70 font-mono">/</span><span className="text-white font-mono font-bold">{mediaItems.length}</span></div>}
          {isVideo && <button onClick={toggleMute} className="p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto" title={isMuted ? "Activar sonido" : "Silenciar video"} id="android-mute-toggle">{isMuted ? <VolumeX className="w-5 h-5 drop-shadow-md" /> : <Volume2 className="w-5 h-5 drop-shadow-md" />}</button>}
        </div>
      </header>

      <div className="absolute right-2.5 sm:right-3.5 bottom-6 sm:bottom-8 z-30 flex flex-col items-center space-y-3.5 select-none p-0" id={`android-reel-interaction-bar-${currentReel.id}`}>
        <div className="flex flex-col items-center"><button onClick={handleCreatorNav} className="relative rounded-full transform hover:scale-110 active:scale-95 transition-transform cursor-pointer drop-shadow-sm" id="android-mobile-creator-avatar-btn"><img src={displayAvatar} alt={displayUsername} className="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-full object-cover" /></button></div>
        <div className="flex flex-col items-center">
          <button onClick={() => { if (isGuest) { onGuestInteraction?.("dar me gusta"); setAuthDescription("dar 'Me gusta'"); setShowAuthModal(true); } else { onLikeReel(currentReel.id); } }} className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${isLiked ? "text-rose-500" : "text-white hover:text-rose-400"}`} id="android-reel-like-btn">
            <Heart strokeWidth={2.2} className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${isLiked ? "fill-rose-500 text-rose-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"}`} />
          </button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{currentReel.likes || 0}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => { if (isGuest) { onGuestInteraction?.("comentar"); setAuthDescription("comentar en los Reels"); setShowAuthModal(true); } else { setShowComments(true); } }} className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-amber-400 hover:scale-115 active:scale-95 transition-all cursor-pointer" id="android-reel-comment-btn">
            <MessageCircle strokeWidth={2.2} className="w-8 h-7 sm:w-9 sm:h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
          </button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{currentReel.comments?.length || 0}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => { if (isGuest) { onGuestInteraction?.("guardar publicaciones"); setAuthDescription("guardar este Reel"); setShowAuthModal(true); } else { onToggleSaveReel(currentReel.id); } }} className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${isSaved ? "text-amber-400" : "text-white hover:text-amber-300"}`} id="android-reel-save-btn">
            <Bookmark strokeWidth={2.2} className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${isSaved ? "fill-amber-400 text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"}`} />
          </button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{currentReel.saves ?? 0}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={handleShare} className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-cyan-400 hover:scale-115 active:scale-95 transition-all cursor-pointer" id="android-reel-share-btn">
            <Share2 strokeWidth={2.2} className="w-8 h-7 sm:w-9 sm:h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" />
          </button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{currentReel.shares || 0}</span>
        </div>
      </div>
      <div className="absolute left-4 right-20 bottom-4 sm:bottom-6 z-20 pointer-events-none">
        <div className="max-w-[calc(100%-10px)]">
          <div className="text-white bg-transparent p-3 rounded-xl drop-shadow-md">
            <h3 className="font-display font-bold text-base tracking-wide flex items-center space-x-2.5">
              <span onClick={handleCreatorNav} className="cursor-pointer hover:underline text-white font-bold drop-shadow-sm pointer-events-auto">@{displayUsername}</span>
              {currentUser?.id !== currentReel.creatorId && onToggleFollowUser && <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (isGuest) onGuestInteraction?.("seguir a creadores"); else onToggleFollowUser(currentReel.creatorId); }} className={`text-xs font-bold px-3 py-1 rounded-full transition-all cursor-pointer border bg-transparent backdrop-blur-sm pointer-events-auto ${isFollowing ? "text-white/80 border-white/60" : "text-white border-white"}`}>{isFollowing ? "Siguiendo" : "+ Seguir"}</button>}
            </h3>
            {currentReel.description && <p className="text-sm text-white/95 font-medium mt-1.5 line-clamp-3 leading-relaxed drop-shadow-sm">{currentReel.description}</p>}
            {taggedProduct && handleProductSelect && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} onClick={() => handleProductSelect(taggedProduct)} className="bg-black/10 backdrop-blur-md border border-white/15 text-white rounded-xl flex items-stretch cursor-pointer hover:bg-black/20 hover:border-amber-500/40 active:scale-[0.98] transition-all shadow-lg overflow-hidden pointer-events-auto select-none mt-2" id={`tagged-product-${currentReel.id}`} style={{ marginLeft: "-4px", width: "285.606px", maxWidth: "100%", height: "68.3438px" }}>
              <div className="w-20 shrink-0 h-full relative overflow-hidden bg-black/10 border-r border-white/10">{taggedProduct.imageUrl || taggedProduct.images?.[0] ? <img src={taggedProduct.imageUrl || taggedProduct.images?.[0]} alt={taggedProduct.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800 text-amber-400"><ShoppingBag className="w-5 h-5" /></div>}</div>
              <div className="flex-1 min-w-0 px-2.5 py-1.5 flex flex-col justify-between bg-black/10"><span className="text-[9.5px] uppercase tracking-wider font-bold text-amber-400 flex items-center"><ShoppingBag className="w-2.5 h-2.5 mr-1 shrink-0" /> Producto Destacado</span><h4 className="text-xs font-bold truncate text-slate-100">{taggedProduct.name}</h4><div className="flex items-center justify-between"><span className="text-xs font-semibold text-emerald-400 font-mono">${(Number(taggedProduct.price) || 0).toFixed(2)}</span><span className="text-[9px] text-amber-400 font-semibold">Ver detalles →</span></div></div>
            </motion.div>}
          </div>
        </div>
      </div>
      {/* Left Cart Side Panel */}
      <AnimatePresence>
        {showCartPanel && (
          <div
            className="fixed inset-0 z-[60] flex items-stretch"
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <motion.aside
              initial={{ x: -360, opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -360, opacity: 0.8 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="w-[86vw] max-w-[380px] h-full bg-white text-slate-900 shadow-2xl border-r border-slate-200 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col border-b border-slate-200 bg-amber-50 px-4 py-3 gap-2" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-black text-slate-900">Carrito</span>
                    {cart.length > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-950">
                        {selectedCartIndices.length}/{cart.length}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setShowCartPanel(false)} className="p-1 rounded-full hover:bg-slate-100 cursor-pointer">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {cart.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-amber-200/60">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-amber-700 transition-colors cursor-pointer select-none"
                    >
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                          isAllSelected
                            ? "bg-amber-500 text-slate-950 shadow-xs"
                            : selectedCartIndices.length > 0
                            ? "bg-amber-200 text-amber-900"
                            : "border border-slate-300 bg-white"
                        }`}
                      >
                        {isAllSelected ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : selectedCartIndices.length > 0 ? (
                          <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" />
                        ) : null}
                      </div>
                      <span className="text-[11px]">
                        {isAllSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                      </span>
                    </button>
                    <span className="text-[10.5px] font-extrabold text-amber-800">
                      {selectedCartIndices.length} para pagar
                    </span>
                  </div>
                )}
              </div>

              <div
                className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain"
                style={{ touchAction: "pan-y" }}
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                    <ShoppingBag className="w-10 h-10 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-700">Tu carrito está vacío</p>
                    <p className="text-xs mt-1">Agrega artículos desde la tienda.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item, idx) => {
                      const isSelected = selectedCartIndices.includes(idx);
                      return (
                        <div
                          key={`${item.product.id}-${idx}`}
                          className={`flex items-center gap-2.5 rounded-2xl border p-2.5 transition-all ${
                            isSelected
                              ? "border-amber-300/90 bg-amber-50/50 shadow-xs ring-1 ring-amber-400/30"
                              : "border-slate-200 bg-slate-50/60 opacity-60 hover:opacity-80"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelectCartItem(idx)}
                            aria-label={isSelected ? "Deseleccionar producto" : "Seleccionar producto"}
                            className="shrink-0 p-0.5 cursor-pointer"
                          >
                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                                  : "border-2 border-slate-300 bg-white hover:border-amber-400"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>

                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-[11px] font-black text-slate-900 truncate">{item.product.name}</p>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                                  isSelected ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-500"
                                }`}
                              >
                                {isSelected ? "A pagar" : "Omitido"}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-amber-600 mt-0.5">${item.product.price.toFixed(2)} c/u</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => {
                                  const newQty = Math.max(1, (item.quantity || 1) - 1);
                                  if (onUpdateCartQuantity) onUpdateCartQuantity(item.product.id, newQty, idx);
                                  else if (onRemoveFromCart) onRemoveFromCart(item.product.id, idx);
                                }}
                                className="p-1 rounded-full bg-slate-200 text-slate-700 active:scale-90 transition-transform cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-[11px] font-bold text-slate-900 w-5 text-center">{item.quantity || 1}</span>
                              <button
                                onClick={() => {
                                  if (onUpdateCartQuantity) onUpdateCartQuantity(item.product.id, (item.quantity || 1) + 1, idx);
                                }}
                                className="p-1 rounded-full bg-slate-200 text-slate-700 active:scale-90 transition-transform cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (onRemoveFromCart) onRemoveFromCart(item.product.id, idx);
                                }}
                                className="ml-auto p-1 rounded-full text-rose-500 hover:bg-rose-50 active:scale-90 transition-colors cursor-pointer"
                                title="Eliminar del carrito"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5px)" }}>
                <div className="flex items-center justify-between text-sm font-black text-slate-900">
                  <div className="flex flex-col">
                    <span>Total a pagar</span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {selectedCartItems.length} de {cart.length} {cart.length === 1 ? "artículo" : "artículos"}
                    </span>
                  </div>
                  <span className="text-amber-600 text-base font-black">${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  id="android-reels-cart-checkout-btn"
                  disabled={cart.length > 0 && selectedCartItems.length === 0}
                  onClick={() => {
                    setShowCartPanel(false);
                    if (cart.length > 0 && onNavigateToCheckout) {
                      onNavigateToCheckout(selectedCartIndices);
                    } else if (onNavigateToShop) {
                      onNavigateToShop();
                    }
                  }}
                  className={`mt-3 w-full rounded-2xl font-black text-xs py-3.5 shadow-lg transition-all flex items-center justify-center space-x-2 ${
                    cart.length > 0 && selectedCartItems.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 active:scale-[0.98] cursor-pointer"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {cart.length === 0
                      ? "Ver tienda"
                      : selectedCartItems.length === 0
                      ? "Selecciona productos para pagar"
                      : `Completar Compra (${selectedCartItems.length}) - $${cartTotal.toFixed(2)}`}
                  </span>
                </button>
              </div>
            </motion.aside>
            <button className="flex-1 bg-black/30 backdrop-blur-[1px]" onClick={() => setShowCartPanel(false)} aria-label="Cerrar carrito" />
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Comments Sheet */}
      <AnimatePresence>
        {showComments && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full h-[70vh] max-h-[70vh] bg-white border-t border-slate-200 rounded-t-3xl flex flex-col overflow-hidden p-2 text-slate-900"
              style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
            >
              <div className="flex items-center justify-between py-1 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-900">Comentarios ({currentReel.comments?.length || 0})</span>
                <button onClick={() => setShowComments(false)} className="p-1 text-slate-500 hover:text-slate-900">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-2">
                {(!currentReel.comments || currentReel.comments.length === 0) ? (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Aún no hay comentarios. ¡Sé el primero!
                  </div>
                ) : (
                  currentReel.comments.map((c, cIdx) => (
                    <div key={`${c.id || 'comment'}-${cIdx}`} className="flex space-x-3 text-xs">
                      <img src={c.avatar} alt={c.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div>
                        <span className="font-bold text-amber-600">@{c.username}</span>
                        <p className="text-slate-500 mt-0.5">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="pt-1 border-t border-slate-200 flex items-center space-x-2 bg-white" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}>
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="p-2 bg-amber-500 disabled:opacity-40 text-slate-950 rounded-xl font-bold active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AndroidAuthModal
        isOpen={showAuthModal}
        actionDescription={authDescription}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={() => {
          setShowAuthModal(false);
          if (onNavigateToProfile) {
            onNavigateToProfile();
          }
        }}
      />
    </div>
  );
}
