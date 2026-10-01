import React, { useState, useRef, useEffect, useCallback } from "react";
import { Reel, ReelMedia, Product, User, Comment, CartItem, NavigationTab } from "../../types";
import { Heart, MessageCircle, Share2, Bookmark, ShoppingBag, Volume2, VolumeX, Plus, Send, X, RefreshCw, Video, Minus, Trash2, CreditCard, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MovilVideoPlay, MovilVideoPlayHandle } from "./components/videoplay";
import { AndroidProgressBar } from "./components/barraprogreso";
import { AndroidAuthModal } from "./components/AndroidAuthModal";
import { MovilHamburgerButton, MovilHamburgerMenu } from "./components/MovilHamburgerMenu";
import { getMediaUrl } from "../../config";
import { getInicioShareUrl, findReelByInicioParam } from "../../router";

export interface AndroidInicioProps {
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
  totalUnreads?: number;
  onNavigateToTab?: (tab: NavigationTab) => void;
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
  initialReelId?: string | null;
  onActiveReelChange?: (reelId: string) => void;
}

export default function Inicio({
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
  unreadCount = 0,
  totalUnreads = 0,
  onNavigateToTab,
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
  initialReelId,
  onActiveReelChange,
}: AndroidInicioProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialReelId && reels.length > 0) {
      const matched = findReelByInicioParam(reels, initialReelId);
      const idx = matched ? reels.findIndex((r) => r.id === matched.id) : -1;
      if (idx !== -1) return idx;
    }
    return 0;
  });
  const lastSeenInitialReelIdPropRef = useRef<string | null>(
    initialReelId && reels.length > 0 ? initialReelId : null
  );
  const internalSwipedReelIdsRef = useRef<Set<string>>(new Set());
  const onActiveReelChangeRef = useRef(onActiveReelChange);
  onActiveReelChangeRef.current = onActiveReelChange;
  const [localMuted, setLocalMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDescription, setAuthDescription] = useState("");
  const [actualNavHeight, setActualNavHeight] = useState<number>(bottomNavHeight || 56);
  const [imageAspect, setImageAspect] = useState<'vertical' | 'horizontal' | 'square'>('square');
  const [progressVideo, setProgressVideo] = useState<HTMLVideoElement | null>(null);
  const [showCartPanel, setShowCartPanel] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<{ [key: string]: boolean }>({});

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
        setActualNavHeight(navEl.getBoundingClientRect().height || navEl.offsetHeight || 56);
      } else if (bottomNavHeight) {
        setActualNavHeight(bottomNavHeight);
      }
    };
    updateHeight();
    const navEl = document.getElementById("android-bottom-nav-bar");
    let ro: ResizeObserver | null = null;
    if (navEl && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(updateHeight);
      ro.observe(navEl);
    }
    window.addEventListener("resize", updateHeight);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
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

  const playerRef = useRef<MovilVideoPlayHandle>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const mouseStartX = useRef<number>(0);
  const isMouseDownRef = useRef<boolean>(false);
  const isGuest = !currentUser || currentUser.isGuest || currentUser.username === "invitado";

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const prevReelIdRef = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const currentReel = reels[currentIndex] || reels[0];
  const isProductPublication = Boolean(
    currentReel?.type === "product" ||
    currentReel?.id?.startsWith("reel_prod_") ||
    currentReel?.productId ||
    (currentReel as any)?.taggedProductId
  );

  useEffect(() => {
    if (!initialReelId || reels.length === 0) return;
    if (lastSeenInitialReelIdPropRef.current === initialReelId) {
      return;
    }
    const matched = findReelByInicioParam(reels, initialReelId);
    const idx = matched ? reels.findIndex((r) => r.id === matched.id) : -1;
    if (idx !== -1) {
      lastSeenInitialReelIdPropRef.current = initialReelId;
      if (internalSwipedReelIdsRef.current.has(initialReelId) || internalSwipedReelIdsRef.current.has(matched!.id)) {
        internalSwipedReelIdsRef.current.delete(initialReelId);
        internalSwipedReelIdsRef.current.delete(matched!.id);
        return;
      }
      if (idx !== currentIndex) {
        setCurrentIndex(idx);
      }
    }
  }, [initialReelId, reels, currentIndex]);

  useEffect(() => {
    const activeId = reels[currentIndex]?.id || reels[0]?.id;
    if (!activeId) return;
    if (prevReelIdRef.current !== activeId) {
      prevReelIdRef.current = activeId;
      setActiveMediaIndex(0);
      setImageAspect("square");
    }
    if (initialReelId && lastSeenInitialReelIdPropRef.current !== initialReelId) {
      const matched = findReelByInicioParam(reels, initialReelId);
      const targetIdx = matched ? reels.findIndex((r) => r.id === matched.id) : -1;
      if (targetIdx !== -1 && targetIdx !== currentIndex) {
        return;
      }
    }
    internalSwipedReelIdsRef.current.add(activeId);
    onActiveReelChangeRef.current?.(activeId);
  }, [currentIndex, reels, initialReelId]);

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
    if (showComments || showCartPanel || showHamburgerMenu) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showComments || showCartPanel || showHamburgerMenu) return;
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
    if (showComments || showCartPanel || showHamburgerMenu) return;
    isMouseDownRef.current = true;
    mouseStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (showComments || showCartPanel || showHamburgerMenu || !isMouseDownRef.current) return;
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
      if (showComments || showCartPanel || showHamburgerMenu) return;
      if (e.key === "ArrowDown") handleNext();
      if (e.key === "ArrowUp") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, showComments, showCartPanel, showHamburgerMenu]);

  // Infinite mouse wheel scroll navigation
  useEffect(() => {
    let lastWheelTime = 0;
    const handleWheel = (e: WheelEvent) => {
      if (showComments || showCartPanel || showHamburgerMenu) return;
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
  }, [handleNext, handlePrev, showComments, showCartPanel, showHamburgerMenu]);

  const applyDetectedImageDimensions = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      if (isProductPublication) {
        setImageAspect(ratio > 1.05 ? "horizontal" : "square");
        return;
      }
      if (ratio > 1.05) setImageAspect("horizontal");
      else if (ratio < 0.95) setImageAspect("vertical");
      else setImageAspect("square");
    },
    [isProductPublication]
  );

  useEffect(() => {
    if (isProductPublication) {
      setImageAspect("square");
    }
    if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
      applyDetectedImageDimensions(imageRef.current);
    }
  }, [currentReel?.id, activeMediaIndex, currentMedia?.url, isProductPublication, applyDetectedImageDimensions]);

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
    applyDetectedImageDimensions(e.currentTarget);
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
    const shareUrl = getInicioShareUrl(currentReel);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: currentReel.description || "Inicio",
          text: currentReel.description,
          url: shareUrl,
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText?.(shareUrl);
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
        height: `calc(100dvh - ${actualNavHeight}px)`,
        minHeight: `calc(100dvh - ${actualNavHeight}px)`,
        maxHeight: `calc(100dvh - ${actualNavHeight}px)`,
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      id="android-reels-view"
    >
      {/* Media Player Container: Dynamic Aspect Architecture (Vertical 100% from nav bar, Horizontal 16:9, Square 1:1) */}
      {isVideo ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <MovilVideoPlay
            key={`${currentReel.id}-${activeMediaIndex}`}
            ref={playerRef}
            src={getMediaUrl(currentMedia.url)}
            hlsUrl={getMediaUrl(currentMedia.hlsUrl || (currentMedia.url?.includes(".m3u8") ? currentMedia.url : currentReel.hlsUrl))}
            poster={undefined}
            autoPlay={true}
            loop={true}
            muted={isMuted}
            isCurrent={isFeedActive}
            aspectRatio={isProductPublication ? "square" : currentReel.aspectRatio}
            onDoubleTap={handleDoubleTap}
            onMuteChange={handleMuteChange}
            onVideoReady={handleVideoReady}
            className="w-full h-full"
          />
        </div>
      ) : (
        /* Image / Carousel publication */
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black">
          <div
            className={
              !isProductPublication && imageAspect === "vertical"
                ? "absolute inset-0 w-full h-full overflow-hidden bg-black"
                : "w-full h-full flex items-center justify-center bg-black overflow-hidden"
            }
          >
            <img
              ref={imageRef}
              src={getMediaUrl(currentMedia?.url || currentReel.thumbnailUrl || (currentReel.images && currentReel.images[0]))}
              alt={currentReel.description}
              onLoad={handleImageLoad}
              className={
                !isProductPublication && imageAspect === "vertical"
                  ? "w-full h-full object-cover object-center block"
                  : "w-full h-auto max-h-full object-contain object-center block bg-black"
              }
            />
          </div>
        </div>
      )}

      {nextMedia && nextReel && nextReel.id !== currentReel.id && (
        <MovilVideoPlay
          key={`preload-${nextReel.id}`}
          src={getMediaUrl(nextMedia.url)}
          hlsUrl={getMediaUrl(nextMedia.hlsUrl || (nextMedia.url?.includes(".m3u8") ? nextMedia.url : nextReel.hlsUrl))}
          poster={undefined}
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
        <div className="flex items-center space-x-2 pointer-events-auto">
          <MovilHamburgerButton
            onOpen={() => setShowHamburgerMenu(true)}
            totalUnreads={totalUnreads || unreadCount || 0}
          />
        </div>
        <div className="flex items-center space-x-2 pointer-events-auto">
          {mediaItems.length > 1 && <div className="inline-flex items-center space-x-1 px-1.5 py-1 bg-transparent text-xs font-extrabold text-white drop-shadow-md"><span className="text-amber-400 font-mono font-black">{activeMediaIndex + 1}</span><span className="text-white/70 font-mono">/</span><span className="text-white font-mono font-bold">{mediaItems.length}</span></div>}
          <button onClick={() => setShowCartPanel(true)} className="relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto" id="android-reels-cart-btn" title="Ver carrito de compras">
            <ShoppingBag className="w-5 h-5 text-amber-400 drop-shadow-md" />
            {totalCartCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">{totalCartCount}</span>}
          </button>
        </div>
      </header>

      <MovilHamburgerMenu
        isOpen={showHamburgerMenu}
        onOpen={() => setShowHamburgerMenu(true)}
        onClose={() => setShowHamburgerMenu(false)}
        currentUser={currentUser}
        totalUnreads={totalUnreads || unreadCount || 0}
        onNavigateToTab={onNavigateToTab}
        onRefreshReels={onRefreshReels}
        onNavigateToShop={onNavigateToShop}
        onNavigateToProfile={onNavigateToProfile}
      />

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
            {currentReel.description && (
              <p className={`text-sm text-white/95 font-medium mt-1.5 leading-relaxed drop-shadow-sm pointer-events-auto break-words ${expandedDescriptions[currentReel.id] ? "whitespace-pre-line max-h-40 overflow-y-auto no-scrollbar" : ""}`}>
                {currentReel.description.length > 25 && !expandedDescriptions[currentReel.id] ? (
                  <>
                    <span>{currentReel.description.slice(0, 25)}...</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setExpandedDescriptions((prev) => ({ ...prev, [currentReel.id]: true }));
                      }}
                      className="font-bold text-white hover:text-amber-400 cursor-pointer pointer-events-auto transition-colors"
                    >
                      mas
                    </button>
                  </>
                ) : (
                  <>
                    <span>{currentReel.description}</span>
                    {currentReel.description.length > 25 && expandedDescriptions[currentReel.id] && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setExpandedDescriptions((prev) => ({ ...prev, [currentReel.id]: false }));
                        }}
                        className="font-bold text-white/75 hover:text-amber-400 cursor-pointer pointer-events-auto transition-colors ml-1.5 text-xs"
                      >
                        menos
                      </button>
                    )}
                  </>
                )}
              </p>
            )}
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
                      const shippingFee =
                        item.selectedShippingCost !== undefined
                          ? Number(item.selectedShippingCost)
                          : Number(item.product.shippingCost ?? 0);
                      const carrierName = item.selectedCarrier || item.product.selectedCarrier;

                      return (
                        <div
                          key={`${item.product.id}-${idx}`}
                          className={`flex items-stretch rounded-2xl border transition-all shadow-sm overflow-hidden h-28 shrink-0 relative ${
                            isSelected
                              ? "bg-amber-500/[0.04] border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/40"
                              : "bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden">
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              onClick={() => {
                                setShowCartPanel(false);
                                if (handleProductSelect) handleProductSelect(item.product);
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between h-full">
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <h4
                                  className="text-xs font-extrabold text-slate-900 truncate cursor-pointer hover:text-amber-600 transition-colors"
                                  title={item.product.name}
                                  onClick={() => {
                                    setShowCartPanel(false);
                                    if (handleProductSelect) handleProductSelect(item.product);
                                  }}
                                >
                                  {item.product.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onRemoveFromCart) onRemoveFromCart(item.product.id, idx);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 -mt-1 -mr-1"
                                  title="Eliminar del carrito"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-mono font-extrabold text-amber-600">
                                  ${item.product.price.toFixed(2)}
                                </span>
                                <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded leading-tight">
                                  Envío: {shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : "Gratis"}
                                  {carrierName ? ` (${carrierName})` : ""}
                                </span>
                              </div>
                            </div>

                            {/* Incrementor buttons & Selection in bottom-right */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newQty = Math.max(1, (item.quantity || 1) - 1);
                                    if (onUpdateCartQuantity) onUpdateCartQuantity(item.product.id, newQty, idx);
                                    else if (onRemoveFromCart) onRemoveFromCart(item.product.id, idx);
                                  }}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-mono font-extrabold text-slate-900 px-1">
                                  {item.quantity || 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onUpdateCartQuantity) onUpdateCartQuantity(item.product.id, (item.quantity || 1) + 1, idx);
                                  }}
                                  disabled={item.product.stock !== undefined && (item.quantity || 1) >= item.product.stock}
                                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Selector in bottom-right corner */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectCartItem(idx);
                                }}
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                  isSelected
                                    ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 scale-105"
                                    : "bg-white border-slate-300 hover:border-amber-400 text-transparent hover:text-slate-300"
                                }`}
                                title={isSelected ? "Deseleccionar producto para pago" : "Seleccionar producto para pagar"}
                                aria-label={isSelected ? "Deseleccionar producto" : "Seleccionar producto"}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
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
