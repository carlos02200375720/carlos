import React, { useState, useRef, useEffect, useCallback } from "react";
import { Reel, Product, User, Comment, CartItem } from "../../types";
import { Heart, MessageCircle, Share2, Bookmark, ShoppingBag, Volume2, VolumeX, Plus, Send, X, RefreshCw, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AndroidVideoPlayer, AndroidVideoPlayerHandle } from "./components/AndroidVideoPlayer";
import { AndroidProgressBar } from "./components/AndroidProgressBar";
import { AndroidAuthModal } from "./components/AndroidAuthModal";

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

  const totalCartCount = (cart || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

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

  const playerRef = useRef<AndroidVideoPlayerHandle>(null);
  const touchStartY = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);
  const isGuest = !currentUser || currentUser.isGuest || currentUser.username === "invitado";

  const currentReel = reels[currentIndex] || reels[0];

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    const SWIPE_THRESHOLD = 45;

    if (diff > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diff < -SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isMouseDownRef.current = true;
    touchStartY.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    const diff = touchStartY.current - e.clientY;
    const SWIPE_THRESHOLD = 45;
    if (diff > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diff < -SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  // Keyboard navigation (ArrowDown / ArrowUp)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showComments) return;
      if (e.key === "ArrowDown") handleNext();
      if (e.key === "ArrowUp") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, showComments]);

  // Infinite mouse wheel scroll navigation
  useEffect(() => {
    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      if (showComments) return;
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
  }, [handleNext, handlePrev, showComments]);

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
        <p className="text-base font-bold text-slate-200">No hay Reels disponibles en este momento</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Comprueba tu conexión o reintenta sincronizar con el catálogo de videos.
        </p>
        {onRefreshReels && (
          <button
            type="button"
            onClick={onRefreshReels}
            className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center space-x-2 transition-transform shadow-lg shadow-amber-500/10"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar conexión</span>
          </button>
        )}
      </div>
    );
  }

  const isLiked = currentReel.likedBy?.includes(currentUser?.originalId || currentUser?.id) || false;
  const isSaved = savedReelIds.includes(currentReel.id);
  const taggedProduct = products.find((p) => p.id === (currentReel.productId || (currentReel as any).taggedProductId));
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

  const isVideo = !currentReel.type || currentReel.type === "video" || (!!currentReel.videoUrl && currentReel.videoUrl.trim() !== "");

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
      {/* Media Player Container: Dynamic Aspect Architecture (Vertical 100%, Horizontal 16:9, Square 1:1) */}
      {isVideo ? (
        <AndroidVideoPlayer
          key={currentReel.id}
          ref={playerRef}
          src={currentReel.videoUrl}
          hlsUrl={currentReel.hlsUrl}
          poster={currentReel.thumbnailUrl}
          autoPlay={true}
          loop={true}
          muted={isMuted}
          isCurrent={isFeedActive}
          aspectRatio={currentReel.aspectRatio}
          onDoubleTap={handleDoubleTap}
          onMuteChange={(m) => setLocalMuted(m)}
          onVideoReady={(video) => setProgressVideo(video)}
          className="w-full h-full"
        />
      ) : (
        /* Image / Carousel publication */
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black">
          {imageAspect !== "vertical" && (
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none opacity-30 filter blur-3xl scale-125 select-none"
              aria-hidden="true"
            >
              <img
                src={currentReel.thumbnailUrl || (currentReel.images && currentReel.images[0])}
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
              src={currentReel.thumbnailUrl || (currentReel.images && currentReel.images[0])}
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

      {/* Top Header: Keep the transparent reel feel but separate from the phone status bar and safe area */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pb-2 pointer-events-none bg-gradient-to-b from-black/80 via-black/35 to-transparent"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        {/* Left: Cart Button */}
        <button
          onClick={() => {
            if (onNavigateToShop) {
              onNavigateToShop();
            }
          }}
          className="pointer-events-auto relative p-1 text-white hover:text-amber-400 active:scale-90 transition-transform cursor-pointer"
          title="Ver Carrito"
          id="android-reels-cart-btn"
        >
          <ShoppingBag className="w-7 h-7 scale-x-120 stroke-[1.7] text-white hover:text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
          {totalCartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-lg border border-slate-900">
              {totalCartCount > 99 ? "99+" : totalCartCount}
            </span>
          )}
        </button>

        {/* Right: Audio Toggle */}
        {isVideo && (
          <button
            onClick={toggleMute}
            className="pointer-events-auto p-1 text-white hover:text-amber-400 active:scale-90 transition-transform cursor-pointer"
            title={isMuted ? "Activar audio" : "Silenciar audio"}
            id="android-mute-toggle"
          >
            {isMuted ? (
              <VolumeX className="w-7 h-7 scale-x-120 stroke-[1.7] text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
            ) : (
              <Volume2 className="w-7 h-7 scale-x-120 stroke-[1.7] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
            )}
          </button>
        )}
      </div>

      {/* Right Actions: Keep 10px gap above the bottom navigation bar */}
      <div className="absolute right-2.5 bottom-[10px] z-30 flex flex-col items-center space-y-3.5 text-white pointer-events-auto">
        <div className="relative mb-1">
          <img
            src={displayAvatar}
            alt={displayUsername}
            onClick={handleCreatorNav}
            className="w-11 h-11 rounded-full object-cover shadow-xl cursor-pointer active:scale-95 transition-transform"
          />
          {!isFollowing && currentUser?.id !== currentReel.creatorId && onToggleFollowUser && (
            <button
              onClick={() => onToggleFollowUser(currentReel.creatorId)}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-transform"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            if (isGuest) {
              if (onGuestInteraction) onGuestInteraction("dar Me Gusta");
              setAuthDescription("dar 'Me gusta'");
              setShowAuthModal(true);
            } else {
              onLikeReel(currentReel.id);
            }
          }}
          className="flex flex-col items-center group cursor-pointer active:scale-85 transition-transform"
          id="android-reel-like-btn"
        >
          <Heart
            className={`w-7 h-7 scale-x-120 stroke-[1.8] transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${
              isLiked ? "fill-rose-500 text-rose-500 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.85)]" : "text-white group-hover:text-rose-400"
            }`}
          />
          <span className="text-[11px] font-black mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{currentReel.likes || 0}</span>
        </button>

        <button
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center group cursor-pointer active:scale-85 transition-transform"
          id="android-reel-comment-btn"
        >
          <MessageCircle className="w-7 h-7 scale-x-120 stroke-[1.8] text-white group-hover:text-slate-200 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]" />
          <span className="text-[11px] font-black mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{currentReel.comments?.length || 0}</span>
        </button>

        <button
          onClick={() => {
            if (isGuest) {
              if (onGuestInteraction) onGuestInteraction("guardar");
              setAuthDescription("guardar este Reel");
              setShowAuthModal(true);
            } else {
              onToggleSaveReel(currentReel.id);
            }
          }}
          className="flex flex-col items-center group cursor-pointer active:scale-85 transition-transform"
          id="android-reel-save-btn"
        >
          <Bookmark
            className={`w-7 h-7 scale-x-120 stroke-[1.8] transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] ${
              isSaved ? "fill-amber-400 text-amber-400 filter drop-shadow-[0_0_12px_rgba(245,158,11,0.85)]" : "text-white group-hover:text-amber-400"
            }`}
          />
          <span className="text-[11px] font-black mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Guardar</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center group cursor-pointer active:scale-85 transition-transform"
          id="android-reel-share-btn"
        >
          <Share2 className="w-7 h-7 scale-x-120 stroke-[1.8] text-white group-hover:text-slate-200 transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]" />
          <span className="text-[11px] font-black mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">Compartir</span>
        </button>
      </div>

      {/* Bottom Info: Clean, transparent overlay without dark shadow. Only displays username and caption */}
      <div className="absolute bottom-2 left-0 right-0 z-20 pointer-events-none pb-2 px-4">
        <div className="max-w-[calc(100%-72px)]">
          {taggedProduct && handleProductSelect && (
            <div
              onClick={() => handleProductSelect(taggedProduct)}
              className="inline-flex w-auto max-w-[min(78vw,280px)] items-center gap-2 px-2 py-1.5 rounded-2xl border border-amber-400/50 bg-slate-950/50 backdrop-blur-md mb-2 pointer-events-auto cursor-pointer active:scale-95 transition-transform shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
            >
              <img
                src={taggedProduct.imageUrl || taggedProduct.images?.[0] || ""}
                alt={taggedProduct.name}
                className="w-9 h-9 rounded-xl object-cover border border-white/25 bg-white/10"
              />
              <div className="min-w-0 flex flex-col">
                <span className="flex items-center gap-1 text-[11px] font-bold text-white truncate">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{taggedProduct.name}</span>
                </span>
                <span className="text-[10px] font-black text-amber-300">${taggedProduct.price}</span>
              </div>
            </div>
          )}

          {/* Author Username ONLY */}
          <div className="flex items-center space-x-2 mb-1 pointer-events-auto">
            <span
              onClick={handleCreatorNav}
              className="text-sm font-black text-white hover:text-amber-400 cursor-pointer flex items-center space-x-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-tight"
            >
              <span>@{displayUsername}</span>
            </span>
          </div>

          {/* Description */}
          {currentReel.description && (
            <p className="text-xs text-white/95 font-medium line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] leading-relaxed">
              {currentReel.description}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Comments Sheet */}
      <AnimatePresence>
        {showComments && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-h-[75vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl flex flex-col overflow-hidden p-4 text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-sm font-bold">Comentarios ({currentReel.comments?.length || 0})</span>
                <button onClick={() => setShowComments(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-3">
                {(!currentReel.comments || currentReel.comments.length === 0) ? (
                  <div className="text-center py-10 text-xs text-slate-500">
                    Aún no hay comentarios. ¡Sé el primero!
                  </div>
                ) : (
                  currentReel.comments.map((c) => (
                    <div key={c.id} className="flex space-x-3 text-xs">
                      <img src={c.avatar} alt={c.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div>
                        <span className="font-bold text-amber-400">@{c.username}</span>
                        <p className="text-slate-200 mt-0.5">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleCommentSubmit} className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="p-2.5 bg-amber-500 disabled:opacity-40 text-slate-950 rounded-xl font-bold active:scale-95"
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
        onLoginSuccess={() => setShowAuthModal(false)}
      />
    </div>
  );
}
