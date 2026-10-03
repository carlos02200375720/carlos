import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Heart, MessageCircle, Share2, ShoppingBag, ShoppingCart, Volume2, VolumeX, Send, X, Play, Bookmark, Trash2, Check, ArrowLeft, Plus, Minus, ChevronLeft, ChevronRight, Menu, MessageSquare, User as UserIcon, ShieldCheck, Sparkles } from "lucide-react";
import { Reel, ReelMedia, Product, Comment, User, CartItem, NavigationTab } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch, getMediaUrl } from "../../config";
import { ReelProgressBar } from "./components/ReelProgressBar";
import Hls from "hls.js";
import { getInicioShareUrl, getInicioPath, findReelByInicioParam, navigateTo, getProfilePath } from "../../router";
import { isSuperAdmin } from "../../superAdmin";

export interface InicioProps {
  reels: Reel[];
  currentUser: User;
  cart?: CartItem[];
  totalUnreads?: number;
  onRefreshReels?: () => void;
  onNavigateToTab?: (tab: NavigationTab) => void;
  onRemoveFromCart?: (productId: string, idx?: number) => void;
  onUpdateCartQuantity?: (productId: string, qty: number, idx?: number) => void;
  onNavigateToShop?: () => void;
  onNavigateToCheckout?: (selectedIndices?: number[]) => void;
  onProductClick: (product: Product) => void;
  onCreatorClick: (creatorId: string) => void;
  onLikeReel: (reelId: string) => void;
  onAddComment: (reelId: string, text: string) => void;
  savedReelIds: string[];
  onToggleSaveReel: (reelId: string) => void;
  onToggleFollowUser?: (creatorId: string) => void;
  onGuestInteraction: (action: string) => void;
  initialReelId?: string | null;
  onActiveReelChange?: (reelId: string) => void;
}

export default function Inicio({
  reels,
  currentUser,
  cart = [],
  totalUnreads = 0,
  onRefreshReels,
  onNavigateToTab,
  onRemoveFromCart,
  onUpdateCartQuantity,
  onNavigateToShop,
  onNavigateToCheckout,
  onProductClick,
  onCreatorClick,
  onLikeReel,
  onAddComment,
  savedReelIds,
  onToggleSaveReel,
  onToggleFollowUser,
  onGuestInteraction,
  initialReelId,
  onActiveReelChange,
}: InicioProps) {
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [activeVideoElement, setActiveVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [likedAnim, setLikedAnim] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showMobileNavMenu, setShowMobileNavMenu] = useState(false);
  const [carouselIndices, setCarouselIndices] = useState<{ [key: string]: number }>({});
  const [mediaAspectRatios, setMediaAspectRatios] = useState<{ [key: string]: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square' }>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<{ [key: string]: boolean }>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const activeIndexRef = useRef(activeReelIndex);
  activeIndexRef.current = activeReelIndex;

  const handleRegisterRef = useCallback((idx: number, el: HTMLVideoElement | null) => {
    if (!el) {
      delete videoRefs.current[idx];
      if (idx === activeIndexRef.current) setActiveVideoElement(null);
      return;
    }
    videoRefs.current[idx] = el;
    if (idx === activeIndexRef.current) setActiveVideoElement(el);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const activeVideo = videoRefs.current[activeIndexRef.current];
      if (!activeVideo) return;
      if (document.hidden) {
        activeVideo.pause();
      } else if (isPlaying) {
        activeVideo.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isPlaying]);

  // Render each real Reel exactly once. The previous implementation duplicated
  // Reel objects to simulate an infinite feed, which increased DOM/layout work
  // and could repeatedly mount expensive media content.
  const displayedReels = reels;

  // Auto-retry fetching reels if array is initially empty
  useEffect(() => {
    if (reels.length === 0 && onRefreshReels) {
      const timer = setTimeout(() => {
        onRefreshReels();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [reels.length, onRefreshReels]);

  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>([]);

  useEffect(() => {
    setSelectedCartIndices((prev) => {
      if (cart.length === 0) return [];
      if (prev.length === 0) return cart.map((_, i) => i);
      const valid = prev.filter((i) => i < cart.length);
      return valid.length > 0 ? valid : cart.map((_, i) => i);
    });
  }, [cart.length]);

  const toggleItemSelection = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCartIndices((prev) => prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]);
  };

  const isAllCartSelected = cart.length > 0 && selectedCartIndices.length === cart.length;

  const toggleSelectAllCart = () => {
    setSelectedCartIndices(isAllCartSelected ? [] : cart.map((_, i) => i));
  };

  const selectedCartItems = cart.filter((_, idx) => selectedCartIndices.includes(idx));
  const effectiveCheckoutItems = selectedCartItems.length > 0 ? selectedCartItems : cart;
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCartCount = selectedCartItems.reduce((sum, item) => sum + item.quantity, 0);
  const effectiveSubtotal = effectiveCheckoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const effectiveShipping = effectiveCheckoutItems.reduce((sum, item) => {
    const shippingFee = item.selectedShippingCost !== undefined ? item.selectedShippingCost : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
    return sum + shippingFee * item.quantity;
  }, 0);
  const effectiveTotal = effectiveSubtotal + effectiveShipping;

  const handleAspectRatioDetected = useCallback((reelId: string, ratio: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square') => {
    setMediaAspectRatios((prev) => prev[reelId] === ratio ? prev : { ...prev, [reelId]: ratio });
  }, []);

  const lastSeenInitialReelIdPropRef = useRef<string | null>(null);
  const internalScrolledReelIdsRef = useRef<Set<string>>(new Set());
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const programmaticScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActiveReelChangeRef = useRef(onActiveReelChange);
  onActiveReelChangeRef.current = onActiveReelChange;

  // Auto-scroll to initialReelId ONLY when externally deep-linked via URL, never overwriting user scroll
  useEffect(() => {
    if (displayedReels.length === 0) return;

    if (!initialReelId) {
      if (!lastSeenInitialReelIdPropRef.current) {
        const activeReel = displayedReels[activeIndexRef.current] || displayedReels[0];
        if (activeReel?.id) {
          lastSeenInitialReelIdPropRef.current = activeReel.id;
          internalScrolledReelIdsRef.current.add(activeReel.id);
          const targetPath = getInicioPath(activeReel.id);
          navigateTo(targetPath, { replace: true });
          onActiveReelChangeRef.current?.(activeReel.id);
        }
      }
      return;
    }

    const matched = findReelByInicioParam(displayedReels, initialReelId);
    const idx = matched ? displayedReels.findIndex((r) => r.id === matched.id) : -1;
    if (idx === -1) return;

    const resolvedId = displayedReels[idx].id;

    // If initialReelId prop has not changed since we last processed it, or came from user scroll, do not re-scroll
    if (
      lastSeenInitialReelIdPropRef.current === initialReelId ||
      lastSeenInitialReelIdPropRef.current === resolvedId
    ) {
      return;
    }

    lastSeenInitialReelIdPropRef.current = resolvedId;

    if (
      internalScrolledReelIdsRef.current.has(initialReelId) ||
      internalScrolledReelIdsRef.current.has(resolvedId) ||
      idx === activeIndexRef.current
    ) {
      internalScrolledReelIdsRef.current.delete(initialReelId);
      internalScrolledReelIdsRef.current.delete(resolvedId);
      return;
    }

    activeIndexRef.current = idx;
    setActiveReelIndex(idx);
    setActiveVideoElement(null);
    setIsPlaying(true);

    const scrollToTarget = () => {
      if (!containerRef.current) return;
      const childHeight = containerRef.current.clientHeight;
      if (childHeight > 0) {
        isProgrammaticScrollRef.current = true;
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current);
        }
        containerRef.current.scrollTo({ top: idx * childHeight, behavior: 'instant' });
        programmaticScrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 150);
      }
    };

    scrollToTarget();
    requestAnimationFrame(scrollToTarget);

    const targetPath = getInicioPath(resolvedId);
    navigateTo(targetPath, { replace: true });
    onActiveReelChangeRef.current?.(resolvedId);
  }, [initialReelId, displayedReels]);

  useEffect(() => {
    return () => {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;
    const container = e.currentTarget;
    const childHeight = container.clientHeight;
    if (!childHeight) return;
    const index = Math.round(container.scrollTop / childHeight);
    if (index !== activeIndexRef.current && index >= 0 && index < displayedReels.length) {
      activeIndexRef.current = index;
      setActiveReelIndex(index);
      setActiveVideoElement(null);
      setIsPlaying(true);
      const nextReel = displayedReels[index];
      if (nextReel?.id) {
        internalScrolledReelIdsRef.current.add(nextReel.id);
        navigateTo(getInicioPath(nextReel.id), { replace: true });
        onActiveReelChangeRef.current?.(nextReel.id);
      }
    }
  };

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const activeVideo = activeVideoElement;
    if (activeVideo) {
      activeVideo.muted = nextMuted;
      activeVideo.defaultMuted = nextMuted;
      activeVideo.volume = nextMuted ? 0 : 1;
      if (!nextMuted && isPlaying && activeVideo.paused) activeVideo.play().catch(() => {});
    }
  };

  const handleVideoClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index !== activeIndexRef.current) return;
    const video =
      e.currentTarget instanceof HTMLVideoElement
        ? e.currentTarget
        : videoRefs.current[index] || activeVideoElement;
    if (!video) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (video.paused || !isPlaying) {
      video.muted = isMuted;
      video.defaultMuted = isMuted;
      video.volume = isMuted ? 0 : 1;
      setIsPlaying(true);
      video.play().catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const isGuestUser = !currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username;

  const handleDoubleTap = (reelId: string) => {
    if (isGuestUser) { onGuestInteraction("dar me gusta"); return; }
    onLikeReel(reelId);
    setLikedAnim(reelId);
    setTimeout(() => setLikedAnim(null), 800);
  };

  const handleShare = (reelId: string) => {
    if (isGuestUser) { onGuestInteraction("compartir publicaciones"); return; }
    setShowShareModal(reelId);
    setCopiedLink(false);
    apiFetch(`/api/reels/${reelId}/share`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.shares !== undefined) {
          const reel = reels.find((r) => r.id === reelId);
          if (reel) reel.shares = data.shares;
        }
      })
      .catch((err) => console.error("Error updating shares:", err));
  };

  const copyToClipboard = (reelId: string) => {
    const reel = reels.find((r) => r.id === reelId);
    const shareUrl = getInicioShareUrl(reel || reelId);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const [taggedProductsMap, setTaggedProductsMap] = useState<Record<string, Product>>({});

  useEffect(() => {
    const productIds = Array.from(new Set(reels.map((r) => r.productId).filter(Boolean))) as string[];
    productIds.forEach((pid) => {
      apiFetch(`/api/products/${pid}`)
        .then((res) => res.json())
        .then((data) => { if (!data.error) setTaggedProductsMap((prev) => ({ ...prev, [pid]: data })); })
        .catch(() => {});
    });
  }, [reels]);

  const currentReel = displayedReels[activeReelIndex];
  const currentReelProduct = currentReel?.productId ? taggedProductsMap[currentReel.productId] : null;
  const currentReelMediaItems = currentReel ? resolveReelMediaItems(currentReel, currentReelProduct) : [];
  const viewedReelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentReel?.id && !viewedReelsRef.current.has(currentReel.id)) {
      viewedReelsRef.current.add(currentReel.id);
      apiFetch(`/api/reels/${currentReel.id}/view`, { method: "POST" })
        .then((res) => res.json())
        .then((data) => { if (data.success && data.views !== undefined) currentReel.views = data.views; })
        .catch((err) => console.error("Error updating views:", err));
    }
  }, [currentReel?.id]);

  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    const updateContainerDimensions = () => { if (containerRef.current) setContainerHeight(containerRef.current.clientHeight); };
    updateContainerDimensions();
    let containerObserver: ResizeObserver | null = null;
    if (containerRef.current) { containerObserver = new ResizeObserver(updateContainerDimensions); containerObserver.observe(containerRef.current); }
    window.addEventListener("resize", updateContainerDimensions);
    return () => { containerObserver?.disconnect(); window.removeEventListener("resize", updateContainerDimensions); };
  }, []);

  const handleMobileNavSelect = (tab: NavigationTab) => {
    setShowMobileNavMenu(false);
    if (onNavigateToTab) {
      onNavigateToTab(tab);
      return;
    }
    if (tab === 'inicio' || tab === 'reels') {
      onRefreshReels?.();
      navigateTo('/inicio');
    } else if (tab === 'shop') {
      if (onNavigateToShop) onNavigateToShop();
      else navigateTo('/tienda/catalogo');
    } else if (tab === 'messages') {
      navigateTo('/messages');
    } else if (tab === 'profile') {
      navigateTo(getProfilePath(currentUser));
    } else if (tab === 'admin') {
      navigateTo('/admin');
    }
  };

  const submitComment = (e: React.FormEvent, reelId: string) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(reelId, commentText);
    setCommentText("");
  };

  return (
    <div className="relative w-full bg-slate-950 overflow-hidden flex flex-col" id="reels-panel" style={{ height: "100dvh", maxHeight: "100dvh" }}>
      <header className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-4 pt-2 pb-1.5 md:pt-8 md:pb-3 pointer-events-none" id="reels-fixed-header">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowMobileNavMenu(true)}
            className="md:hidden relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center"
            id="reels-header-hamburger-btn"
            title="Abrir menú de navegación"
          >
            <Menu className="w-6 h-6 text-white drop-shadow-md" />
            {totalUnreads > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-950" />
            )}
          </button>
        </div>
        <div className="flex items-center space-x-2 pointer-events-auto">
          {currentReel && currentReelMediaItems.length > 1 && (
            <div className="inline-flex items-center space-x-1 px-1.5 py-1 bg-transparent text-xs font-extrabold text-white drop-shadow-md" id={`carousel-counter-${currentReel.id}`}>
              <span className="text-amber-400 font-mono font-black">
                {(carouselIndices[`${currentReel.id}_${activeReelIndex}`] ?? 0) + 1}
              </span>
              <span className="text-white/70 font-mono">/</span>
              <span className="text-white font-mono font-bold">
                {currentReelMediaItems.length}
              </span>
            </div>
          )}
          <button onClick={() => setShowCartDrawer(true)} className="relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto" id="reels-header-cart-btn" title="Ver carrito de compras">
            <ShoppingBag className="w-5 h-5 text-amber-400 drop-shadow-md" />
            {totalCartCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">{totalCartCount}</span>}
          </button>
        </div>
      </header>

      <div ref={containerRef} onScroll={handleScroll} className="w-full h-full min-h-0 flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar relative" style={{ scrollbarWidth: "none", scrollSnapType: "y mandatory" }}>
        {displayedReels.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Play className="w-12 h-12 stroke-1 text-slate-600 mb-3 animate-pulse" />
            <p className="font-display font-medium text-slate-300">No hay videos disponibles</p>
            <p className="text-xs text-slate-500 mt-1">Sube contenido o inicia una transmisión para empezar</p>
            {onRefreshReels && (
              <button
                type="button"
                onClick={() => onRefreshReels()}
                className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Cargar publicaciones
              </button>
            )}
          </div>
        ) : displayedReels.map((reel, index) => {
          const isCurrent = index === activeReelIndex;
          const reelProduct = reel.productId ? taggedProductsMap[reel.productId] : null;
          const isLiked = Boolean(currentUser && ((currentUser.originalId && (reel.likedBy || []).includes(currentUser.originalId)) || (currentUser.id && currentUser.id !== "current_user" && (reel.likedBy || []).includes(currentUser.id)) || (currentUser.username && currentUser.username !== "invitado" && (reel.likedBy || []).includes(currentUser.username))));

          const reelMediaItems: ReelMedia[] = resolveReelMediaItems(reel, reelProduct);

          const currentMediaIdx = carouselIndices[`${reel.id}_${index}`] ?? 0;
          const currentMedia = reelMediaItems[currentMediaIdx] || reelMediaItems[0];
          const isMediaVideo = currentMedia?.type === "video" && !!currentMedia.url;

          return (
            <div key={`${reel.id}_${index}`} className="w-full shrink-0 snap-start snap-always relative flex items-center justify-center bg-slate-950 overflow-hidden py-0 md:py-1 px-0 md:px-2 lg:px-4" style={{ height: containerHeight > 0 ? `${containerHeight}px` : "100%", minHeight: containerHeight > 0 ? `${containerHeight}px` : "100%", maxHeight: containerHeight > 0 ? `${containerHeight}px` : "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}>
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <div className="relative flex items-end justify-center md:gap-3.5 lg:gap-5 w-full md:w-auto h-full md:max-h-full my-auto">
                  <div className="relative w-full h-full md:w-[540px] lg:w-[680px] xl:w-[780px] 2xl:w-[880px] md:max-w-[calc(100vw-340px)] md:h-full md:rounded-2xl md:border md:border-white/15 md:shadow-[0_16px_50px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center bg-black select-none shrink-0" id={`reel-card-${reel.id}`}>
                    <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

                    {/* Media element: Carousel (horizontal scroll) or Single Video/Image */}
                    {reelMediaItems.length > 1 ? (
                      <ReelCarousel
                        reel={reel}
                        reelIndex={index}
                        mediaItems={reelMediaItems}
                        activeSlideIndex={currentMediaIdx}
                        isCurrentReel={isCurrent}
                        shouldPreload={isCurrent || index === activeReelIndex + 1}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        mediaAspectRatio={mediaAspectRatios[reel.id]}
                        onIndexChange={(newIdx) =>
                          setCarouselIndices((prev) =>
                            prev[`${reel.id}_${index}`] === newIdx
                              ? prev
                              : { ...prev, [`${reel.id}_${index}`]: newIdx }
                          )
                        }
                        onTogglePlay={() => setIsPlaying((prev) => !prev)}
                        onVideoClick={handleVideoClick}
                        onDoubleTap={handleDoubleTap}
                        onAspectRatioDetected={handleAspectRatioDetected}
                        onRegisterRef={handleRegisterRef}
                      />
                    ) : isMediaVideo ? (
                      <div
                        className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden cursor-pointer"
                        onClick={(e) => handleVideoClick(e, index)}
                      >
                        {reel.thumbnailUrl && !reel.thumbnailUrl.endsWith(".m3u8") && !reel.thumbnailUrl.includes("1618005182384") && (
                          <img
                            src={getMediaUrl(reel.thumbnailUrl)}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-125 pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {isCurrent || index === activeReelIndex + 1 ? (
                          <ReelVideoItem
                            key={`${reel.id}_${index}_media_${currentMediaIdx}`}
                            reel={{
                              ...reel,
                              videoUrl: currentMedia.url,
                              hlsUrl: currentMedia.hlsUrl || (currentMedia.url.includes(".m3u8") ? currentMedia.url : reel.hlsUrl),
                            }}
                            index={index}
                            isCurrent={isCurrent}
                            shouldPreload={isCurrent || index === activeReelIndex + 1}
                            isPlaying={isPlaying}
                            isMuted={isMuted}
                            mediaAspectRatio={mediaAspectRatios[reel.id]}
                            onVideoClick={handleVideoClick}
                            onDoubleTap={handleDoubleTap}
                            onAspectRatioDetected={handleAspectRatioDetected}
                            onRegisterRef={handleRegisterRef}
                          />
                        ) : (
                          <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
                            {reel.thumbnailUrl && !reel.thumbnailUrl.endsWith(".m3u8") && !reel.thumbnailUrl.includes("1618005182384") ? (
                              <img
                                src={getMediaUrl(reel.thumbnailUrl)}
                                alt={reel.description || ""}
                                draggable={false}
                                className={`w-full h-full block relative z-10 select-none object-center ${mediaAspectRatios[reel.id] === 'vertical' ? "object-cover md:object-contain" : "object-contain"}`}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
                                <Play className="w-12 h-12 text-white/20 mb-2 fill-white/10" />
                                <span className="text-xs text-white/30 font-medium">Video</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                        {currentMedia?.url && (
                          <img
                            src={currentMedia.url}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-125 pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {currentMedia?.url ? (
                          <img
                            src={currentMedia.url}
                            alt={reel.description || ""}
                            draggable={false}
                            onClick={() => setIsPlaying(!isPlaying)}
                            onDoubleClick={() => handleDoubleTap(reel.id)}
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              const ratio = img.naturalWidth / img.naturalHeight;
                              const isProd = reel.type === "product" || Boolean(reel.productId) || reel.id?.startsWith("reel_prod_");
                              let detected: 'vertical' | 'square' | 'horizontal' = isProd ? 'square' : 'vertical';
                              if (ratio > 1.15) detected = 'horizontal';
                              else if (ratio >= 0.85 && ratio <= 1.15) detected = 'square';
                              setMediaAspectRatios((prev) => ({ ...prev, [reel.id]: detected }));
                            }}
                            className={`w-full h-full cursor-pointer select-none block touch-auto object-center relative z-10 ${(reel.type !== "product" && !reel.productId && !reel.id?.startsWith("reel_prod_") && mediaAspectRatios[reel.id] === 'vertical') ? "object-cover md:object-contain" : "object-contain"}`}
                            style={{ touchAction: "pan-y" }}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-600 text-xs">
                            <span>Publicación</span>
                          </div>
                        )}
                      </div>
                    )}

                    <AnimatePresence>{likedAnim === reel.id && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [1, 1.3, 1], opacity: [0, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-30"><Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-lg" /></motion.div>}</AnimatePresence>
                    {!isPlaying && isCurrent && isMediaVideo && <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-20 bg-black/40 rounded-full w-16 h-16 backdrop-blur-xs"><Play className="w-8 h-8 text-white fill-white translate-x-0.5" /></div>}

                    <div className="absolute left-4 sm:left-6 bottom-[26px] sm:bottom-6 right-20 sm:right-24 md:right-6 lg:right-8 z-20 flex flex-col space-y-3 max-w-xl pointer-events-none">
                      <div className="text-white bg-transparent p-3 rounded-xl drop-shadow-md pointer-events-none" style={{ marginLeft: "-15px", marginBottom: "-10px" }}><h3 className="font-display font-bold text-base sm:text-lg tracking-wide flex items-center space-x-2.5"><span className="cursor-pointer hover:underline text-white font-bold drop-shadow-sm pointer-events-auto" onClick={() => { const target = (reel.creatorUsername && reel.creatorUsername !== "invitado") ? reel.creatorUsername : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user")); onCreatorClick(target); }}>@{reel.creatorUsername || reel.creatorName.toLowerCase().replace(/\s+/g, "")}</span>{(() => { const isSelf = currentUser.id === reel.creatorId || reel.creatorId === "current_user" || (currentUser.originalId && currentUser.originalId === reel.creatorId) || (currentUser.username && reel.creatorUsername && currentUser.username.toLowerCase() === reel.creatorUsername.toLowerCase()); if (isSelf) return null; const targetId = reel.creatorId || reel.creatorUsername; const isFollowing = Boolean(currentUser.followingUserIds?.some((id) => id === reel.creatorId || id === reel.creatorUsername || (reel.creatorUsername && id.toLowerCase() === reel.creatorUsername.toLowerCase()) || (reel.creatorId && id.toLowerCase() === reel.creatorId.toLowerCase()))); return <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (currentUser.username === "invitado" || currentUser.isGuest) onGuestInteraction("seguir a creadores"); else if (onToggleFollowUser) onToggleFollowUser(targetId); }} id={`follow-creator-btn-${reel.id}`} className={`text-xs font-bold px-3 py-1 rounded-full transition-all cursor-pointer border bg-transparent backdrop-blur-sm pointer-events-auto ${isFollowing ? "text-white/80 border-white/60 hover:text-rose-300 hover:border-rose-400 hover:bg-rose-500/10" : "text-white border-white hover:bg-white/15 active:scale-95 font-extrabold"}`}>{isFollowing ? "Siguiendo" : "+ Seguir"}</button>; })()}</h3>{reel.description && (
                        <p className={`text-sm sm:text-base text-white/95 font-medium mt-1.5 leading-relaxed drop-shadow-sm pointer-events-auto break-words ${expandedDescriptions[reel.id] ? "whitespace-pre-line max-h-44 overflow-y-auto no-scrollbar" : ""}`} id={`reel-description-${reel.id}`}>
                          {reel.description.length > 25 && !expandedDescriptions[reel.id] ? (
                            <>
                              <span>{reel.description.slice(0, 25)}...</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setExpandedDescriptions((prev) => ({ ...prev, [reel.id]: true }));
                                }}
                                className="font-bold text-white hover:text-amber-400 cursor-pointer pointer-events-auto transition-colors"
                                id={`expand-desc-btn-${reel.id}`}
                              >
                                mas
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{reel.description}</span>
                              {reel.description.length > 25 && expandedDescriptions[reel.id] && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setExpandedDescriptions((prev) => ({ ...prev, [reel.id]: false }));
                                  }}
                                  className="font-bold text-white/75 hover:text-amber-400 cursor-pointer pointer-events-auto transition-colors ml-1.5 text-xs"
                                  id={`collapse-desc-btn-${reel.id}`}
                                >
                                  menos
                                </button>
                              )}
                            </>
                          )}
                        </p>
                      )}</div>
                      {reelProduct && <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} onClick={() => onProductClick(reelProduct)} className="bg-black/45 border border-white/20 text-white rounded-xl flex items-stretch cursor-pointer hover:bg-black/55 hover:border-amber-500/40 active:scale-[0.98] transition-all shadow-lg overflow-hidden mb-0.5 sm:mb-0 pointer-events-auto" id={`tagged-product-${reel.id}`} style={{ marginLeft: "-4px", width: "285.606px", height: "68.3438px" }}><div className="w-20 shrink-0 h-full relative overflow-hidden bg-transparent border-r border-white/15">{reelProduct.imageUrl ? <img src={reelProduct.imageUrl} alt={reelProduct.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800/60 text-amber-400"><ShoppingBag className="w-5 h-5" /></div>}</div><div className="flex-1 min-w-0 px-2.5 py-1.5 flex flex-col justify-between bg-transparent"><span className="text-[9.5px] uppercase tracking-wider font-bold text-amber-400 flex items-center"><ShoppingBag className="w-2.5 h-2.5 mr-1 shrink-0" /> Producto Destacado</span><h4 className="text-xs font-bold truncate text-slate-100">{reelProduct.name}</h4><div className="flex items-center justify-between"><span className="text-xs font-semibold text-emerald-400 font-mono">${reelProduct.price.toFixed(2)}</span><span className="text-[9px] text-amber-400 font-semibold">Ver detalles →</span></div></div></motion.div>}
                    </div>

                    {isCurrent && isMediaVideo && <ReelProgressBar video={activeVideoElement || videoRefs.current[index]} isActive={isCurrent} />}

                    <div className="md:hidden absolute right-2.5 sm:right-3.5 bottom-6 sm:bottom-8 z-20 flex flex-col items-center space-y-3.5 select-none p-0 ml-0" id={`mobile-interaction-bar-${reel.id}`}>
                      <div className="flex flex-col items-center"><button onClick={() => { const target = (reel.creatorUsername && reel.creatorUsername !== "invitado") ? reel.creatorUsername : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user")); onCreatorClick(target); }} className="relative rounded-full transform hover:scale-110 transition-transform cursor-pointer drop-shadow-sm" id={`mobile-creator-avatar-btn-${reel.id}`}><img src={reel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"} alt={reel.creatorName} referrerPolicy="no-referrer" className="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-full object-cover" /></button></div>
                      <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("dar me gusta"); else onLikeReel(reel.id); }} className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${isLiked ? "text-rose-500" : "text-white hover:text-rose-400"}`} id={`mobile-like-btn-${reel.id}`}><Heart strokeWidth={2.2} className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${isLiked ? "fill-rose-500 text-rose-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"}`} /></button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{reel.likes}</span></div>
                      <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("comentar"); else setShowComments(reel.id); }} className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-amber-400 hover:scale-115 active:scale-95 transition-all cursor-pointer" id={`mobile-comment-btn-${reel.id}`}><MessageCircle strokeWidth={2.2} className="w-8 h-7 sm:w-9 h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" /></button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{reel.comments.length}</span></div>
                      <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("guardar publicaciones"); else onToggleSaveReel(reel.id); }} className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${savedReelIds.includes(reel.id) ? "text-amber-400" : "text-white hover:text-amber-300"}`} id={`mobile-save-btn-${reel.id}`}><Bookmark strokeWidth={2.2} className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${savedReelIds.includes(reel.id) ? "fill-amber-400 text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"}`} /></button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{reel.saves ?? 0}</span></div>
                      <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("compartir"); else handleShare(reel.id); }} className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-cyan-400 hover:scale-115 active:scale-95 transition-all cursor-pointer" id={`mobile-share-btn-${reel.id}`}><Share2 strokeWidth={2.2} className="w-8 h-7 sm:w-9 h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]" /></button><span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">{reel.shares}</span></div>
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-center justify-end pb-3 lg:pb-5 space-y-4 lg:space-y-4.5 select-none shrink-0 z-20" id={`interaction-bar-${reel.id}`}>
                    <div className="flex flex-col items-center"><button onClick={() => { const target = (reel.creatorUsername && reel.creatorUsername !== "invitado") ? reel.creatorUsername : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user")); onCreatorClick(target); }} className="relative rounded-full transform hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-lg" id={`creator-avatar-btn-${reel.id}`} title={reel.creatorName}><img src={reel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"} alt={reel.creatorName} referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover border-2 border-white/25 hover:border-amber-400 transition-colors shadow-md" /></button></div>
                    <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("dar me gusta"); else onLikeReel(reel.id); }} className={`w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg transition-all cursor-pointer ${isLiked ? "text-rose-500" : "text-white hover:text-rose-400"}`} id={`like-btn-${reel.id}`} title="Me gusta"><Heart strokeWidth={2.2} className={`w-6 h-6 ${isLiked ? "fill-rose-500 text-rose-500" : "fill-white text-white"}`} /></button><span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">{reel.likes}</span></div>
                    <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("comentar"); else setShowComments(reel.id); }} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg text-white hover:text-amber-400 transition-all cursor-pointer" id={`comment-btn-${reel.id}`} title="Comentarios"><MessageCircle strokeWidth={2.2} className="w-6 h-6 fill-white text-white" /></button><span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">{reel.comments.length}</span></div>
                    <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("guardar publicaciones"); else onToggleSaveReel(reel.id); }} className={`w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg transition-all cursor-pointer ${savedReelIds.includes(reel.id) ? "text-amber-400" : "text-white hover:text-amber-300"}`} id={`save-btn-${reel.id}`} title="Guardar"><Bookmark strokeWidth={2.2} className={`w-6 h-6 ${savedReelIds.includes(reel.id) ? "fill-amber-400 text-amber-400" : "fill-white text-white"}`} /></button><span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">{reel.saves ?? 0}</span></div>
                    <div className="flex flex-col items-center"><button onClick={() => { if (isGuestUser) onGuestInteraction("compartir"); else handleShare(reel.id); }} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg text-white hover:text-cyan-400 transition-all cursor-pointer" id={`share-btn-${reel.id}`} title="Compartir"><Share2 className="w-6 h-6 fill-white text-white" /></button><span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">{reel.shares}</span></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {showComments && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={() => setShowComments(null)} className="fixed inset-0 bg-black z-50 backdrop-blur-xs" /><motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="fixed bottom-0 inset-x-0 bg-white border-t border-white rounded-t-2xl h-[500px] max-h-[85vh] z-50 flex flex-col overflow-hidden text-slate-900 shadow-2xl font-bold"><div className="px-4 py-0 border-b border-white flex items-center justify-between bg-white"><span className="font-display font-extrabold text-sm tracking-wide text-slate-900">Comentarios ({reels.find((r) => r.id === showComments)?.comments.length || 0})</span><button onClick={() => setShowComments(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"><X className="w-5 h-5" /></button></div><div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>{reels.find((r) => r.id === showComments)?.comments.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center font-bold"><MessageCircle className="w-8 h-8 text-slate-400 mb-2" /><p className="text-sm font-extrabold text-slate-800">No hay comentarios aún</p><p className="text-xs text-slate-500 mt-0.5 font-bold">Sé el primero en compartir tu opinión</p></div> : reels.find((r) => r.id === showComments)?.comments.map((comm, cIdx) => <div key={`${comm.id || 'comment'}-${cIdx}`} className="flex space-x-3 items-start"><img src={comm.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"} alt={comm.username} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs" /><div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs"><div className="flex items-center justify-between"><span className="text-xs font-black text-slate-900">@{comm.username}</span><span className="text-[10px] text-slate-500 font-bold font-mono">{new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className="text-xs text-slate-900 font-bold mt-1 leading-relaxed">{comm.text}</p></div></div>)}</div><form onSubmit={(e) => submitComment(e, showComments)} className="p-4 border-t border-slate-100 bg-white flex items-center space-x-2" style={{ paddingBottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))" }}><input type="text" placeholder="Escribe un comentario..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 bg-slate-100 text-xs rounded-full px-4 py-3 text-slate-900 font-bold border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-400" /><button type="submit" className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-full transition-all cursor-pointer shadow-sm shrink-0"><Send className="w-4 h-4" /></button></form></motion.div></>}
      </AnimatePresence>

      <AnimatePresence>
        {showShareModal && <div className="absolute inset-0 flex items-center justify-center z-50 p-4"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} onClick={() => setShowShareModal(null)} className="absolute inset-0 bg-black" /><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm relative z-10 text-slate-200 shadow-2xl"><button onClick={() => setShowShareModal(null)} className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button><h3 className="font-display font-bold text-base text-slate-100 flex items-center space-x-2"><Share2 className="w-5 h-5 text-amber-500" /><span>Compartir Publicación</span></h3><p className="text-xs text-slate-400 mt-2">Comparte este video con tus amigos para descubrir nuevos productos en vivo.</p><div className="mt-4 flex items-center space-x-2"><div className="flex-1 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 font-mono truncate">{getInicioShareUrl(reels.find((r) => r.id === showShareModal) || showShareModal)}</div><button onClick={() => copyToClipboard(showShareModal)} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer">{copiedLink ? "Copiado!" : "Copiar"}</button></div><div className="mt-4 border-t border-slate-800/60 pt-4 flex items-center justify-between text-[11px] text-slate-500"><span>Latencia de transmisión: 180ms (WebRTC)</span><span className="text-amber-500/80 font-bold">LiveStream activo</span></div></motion.div></div>}
      </AnimatePresence>

      <AnimatePresence>
        {showCartDrawer && <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-sm" id="cart-drawer-overlay"><motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 220 }} className="w-full max-w-xs sm:max-w-sm h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl text-slate-900" id="cart-drawer-panel"><div className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0" style={{ paddingTop: "max(2rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))" }}><div className="flex items-center space-x-2.5"><div className="p-2 bg-amber-500/10 rounded-xl text-amber-600"><ShoppingBag className="w-4 h-4" /></div><div><h3 className="font-extrabold text-sm text-slate-900 leading-tight">Carrito</h3><p className="text-[11px] text-slate-500 font-semibold">{totalCartCount} {totalCartCount === 1 ? 'producto' : 'productos'}</p></div></div><div className="flex items-center space-x-1.5">{cart.length > 0 && <button type="button" onClick={toggleSelectAllCart} className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-transparent border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-slate-700 active:scale-95" id="reel-cart-select-all-btn"><div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${isAllCartSelected ? "bg-amber-500 text-slate-950" : selectedCartIndices.length > 0 ? "bg-amber-200 text-amber-900" : "border border-slate-300 bg-white"}`}>{isAllCartSelected ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : selectedCartIndices.length > 0 ? <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" /> : null}</div><span className="text-[10.5px]">{isAllCartSelected ? "Quitar" : "Todo"} ({selectedCartIndices.length}/{cart.length})</span></button>}{<button onClick={() => setShowCartDrawer(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer" id="close-cart-drawer-btn"><X className="w-4 h-4" /></button>}</div></div><div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>{cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12 space-y-3"><div className="p-4 bg-slate-100 rounded-full border border-slate-200"><ShoppingBag className="w-10 h-10 stroke-1 text-slate-400" /></div><p className="text-sm font-extrabold text-slate-800">Tu carrito está vacío</p><p className="text-xs text-slate-500 max-w-[200px]">Haz clic en los productos etiquetados en los reels para añadirlos a tu carrito.</p>{onNavigateToShop && <button onClick={() => { setShowCartDrawer(false); onNavigateToShop(); }} className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20" id="empty-cart-go-shop-btn">Ir al Mercado</button>}</div> : cart.map((item, idx) => { const isSelected = selectedCartIndices.includes(idx); const shippingFee = item.selectedShippingCost !== undefined ? item.selectedShippingCost : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0); const carrierName = item.selectedCarrier || item.product.selectedCarrier; return <div key={`${item.product.id}_${idx}`} className={`flex items-stretch rounded-2xl border transition-all shadow-sm overflow-hidden h-28 shrink-0 relative ${isSelected ? "bg-amber-500/[0.04] border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/40" : "bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-100"}`} id={`reel-cart-item-${item.product.id}-${idx}`}><div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden flex items-center justify-center">{item.product.imageUrl ? <img src={item.product.imageUrl} alt={item.product.name} referrerPolicy="no-referrer" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => { setShowCartDrawer(false); onProductClick(item.product); }} /> : <ShoppingBag className="w-6 h-6 text-slate-400" />}</div><div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between h-full"><div><div className="flex items-start justify-between gap-1"><h4 className="text-xs font-extrabold text-slate-900 truncate cursor-pointer hover:text-amber-600 transition-colors" onClick={() => { setShowCartDrawer(false); onProductClick(item.product); }}>{item.product.name}</h4><button onClick={() => onRemoveFromCart?.(item.product.id, idx)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 -mt-1 -mr-1" title="Eliminar producto"><Trash2 className="w-3.5 h-3.5" /></button></div><div className="flex flex-wrap items-center gap-1.5 mt-0.5"><span className="text-xs font-mono font-extrabold text-amber-600">${item.product.price.toFixed(2)}</span><span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded leading-tight">Envío: {shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : "Gratis"}{carrierName ? ` (${carrierName})` : ""}</span></div></div><div className="flex items-center justify-between"><div className="flex items-center space-x-1.5"><button onClick={() => { if (item.quantity > 1) onUpdateCartQuantity?.(item.product.id, item.quantity - 1, idx); else onRemoveFromCart?.(item.product.id, idx); }} className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"><Minus className="w-3 h-3" /></button><span className="text-xs font-mono font-extrabold text-slate-900 px-1">{item.quantity}</span><button onClick={() => onUpdateCartQuantity?.(item.product.id, item.quantity + 1, idx)} disabled={item.product.stock !== undefined && item.quantity >= item.product.stock} className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs disabled:opacity-50 transition-colors cursor-pointer"><Plus className="w-3 h-3" /></button></div><button type="button" onClick={(e) => toggleItemSelection(idx, e)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${isSelected ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 scale-105" : "bg-white border-slate-300 hover:border-amber-400 text-transparent hover:text-slate-300"}`} title={isSelected ? "Deseleccionar producto para pago" : "Seleccionar producto para pagar"} id={`reel-cart-select-${idx}`}><Check className="w-3.5 h-3.5 stroke-[3]" /></button></div></div></div>; })}</div>{cart.length > 0 && <div className="p-4 border-t border-slate-100 bg-white space-y-2.5 shrink-0" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}><div className="flex justify-between text-xs text-slate-500 font-medium"><span>Subtotal ({selectedCartItems.length} de {cart.length} selec.):</span><span className="font-mono text-slate-800 font-semibold">${effectiveSubtotal.toFixed(2)}</span></div><div className="flex justify-between text-xs text-slate-500 font-medium"><span>Envío estimado:</span><span className="font-mono text-slate-800 font-semibold">{effectiveShipping > 0 ? `$${effectiveShipping.toFixed(2)}` : "Gratis"}</span></div><div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-100 pt-2"><span>Total a Pagar:</span><span className="font-mono text-slate-950 font-black text-sm">${effectiveTotal.toFixed(2)}</span></div><button onClick={() => { setShowCartDrawer(false); if (onNavigateToCheckout) onNavigateToCheckout(selectedCartIndices); else if (onNavigateToShop) onNavigateToShop(); }} disabled={selectedCartItems.length === 0} className={`w-full font-black py-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1 shadow-lg ${selectedCartItems.length > 0 ? "bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-amber-500/25" : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"}`} id="cart-checkout-btn">{selectedCartItems.length > 0 ? <><ShoppingCart className="w-4 h-4 text-slate-950" /><span>Pagar ({selectedCartItems.length} {selectedCartItems.length === 1 ? 'producto' : 'productos'})</span><ArrowLeft className="w-4 h-4 rotate-180 text-slate-950" /></> : <span>Selecciona productos para pagar</span>}</button></div>}</motion.div></div>}
      </AnimatePresence>

      {/* Mobile Navigation Hamburger Menu Drawer (Small screens) */}
      <AnimatePresence>
        {showMobileNavMenu && (
          <div
            className="md:hidden fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-sm"
            id="mobile-web-nav-drawer-overlay"
            onClick={() => setShowMobileNavMenu(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="w-72 max-w-[82vw] h-full bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between p-4 shadow-2xl text-white select-none"
              id="mobile-web-nav-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div
                  className="flex items-center justify-between px-2 pb-4 mb-4 border-b border-slate-800/80"
                  style={{ paddingTop: "0.75rem" }}
                >
                  <div
                    className="flex items-center space-x-2.5 cursor-pointer"
                    onClick={() => handleMobileNavSelect('inicio')}
                  >
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="font-display font-black text-lg tracking-tight leading-none bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                        Mall
                      </h2>
                      <span className="text-[10px] font-mono tracking-widest uppercase block mt-0.5 text-slate-400">
                        Menú Principal
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMobileNavMenu(false)}
                    className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    id="close-mobile-web-nav-drawer-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1.5" id="mobile-web-hamburger-nav-links">
                  <button
                    type="button"
                    onClick={() => handleMobileNavSelect('inicio')}
                    className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    id="mobile-hamburger-nav-inicio"
                  >
                    <Play strokeWidth={2.6} className="w-5 h-5 fill-slate-950" />
                    <span className="font-black tracking-wide">Inicio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMobileNavSelect('shop')}
                    className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-slate-900"
                    id="mobile-hamburger-nav-shop"
                  >
                    <ShoppingBag strokeWidth={2.6} className="w-5 h-5" />
                    <span className="font-black tracking-wide">Tienda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMobileNavSelect('messages')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-slate-900"
                    id="mobile-hamburger-nav-messages"
                  >
                    <div className="flex items-center space-x-3.5">
                      <MessageSquare strokeWidth={2.6} className="w-5 h-5" />
                      <span className="font-black tracking-wide">Mensajes</span>
                    </div>
                    {totalUnreads > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white">
                        {totalUnreads > 9 ? "9+" : totalUnreads}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMobileNavSelect('profile')}
                    className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-slate-900"
                    id="mobile-hamburger-nav-profile"
                  >
                    <UserIcon strokeWidth={2.6} className="w-5 h-5" />
                    <span className="font-black tracking-wide">
                      {currentUser.username === "invitado" ? "Perfil / Registro" : "Perfil"}
                    </span>
                  </button>

                  {isSuperAdmin(currentUser) && (
                    <button
                      type="button"
                      onClick={() => handleMobileNavSelect('admin')}
                      className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-slate-900"
                      id="mobile-hamburger-nav-admin"
                    >
                      <ShieldCheck strokeWidth={2.6} className="w-5 h-5" />
                      <span className="font-black tracking-wide">Admin</span>
                    </button>
                  )}
                </nav>
              </div>

              <div
                className="pt-4 border-t border-slate-800/80"
                style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div
                  onClick={() => handleMobileNavSelect('profile')}
                  className="flex items-center space-x-3 p-2.5 rounded-2xl border bg-slate-900/80 hover:bg-slate-900 border-slate-800/80 transition-all cursor-pointer group"
                >
                  <img
                    src={currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-amber-500/40 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate text-white group-hover:text-amber-500 transition-colors">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] truncate font-mono text-slate-400">
                      @{currentUser.username || "invitado"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function resolveReelMediaItems(reel: Reel, reelProduct?: Product | null): ReelMedia[] {
  const isVideoUrl = (u: string) =>
    /\.(m3u8|mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts)($|\?)/i.test(u) ||
    u.includes("/videos/") ||
    u.includes("/hls/");

  const items: ReelMedia[] = [];
  const seen = new Set<string>();

  const normalizeKey = (u: string) =>
    u
      .trim()
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/\?.*$/, "");

  const addItem = (candidate: ReelMedia, aliases: string[] = []) => {
    const rawUrl = (candidate.url || "").trim();
    if (!rawUrl || rawUrl.includes("1618005182384")) return;
    const key = normalizeKey(rawUrl);
    if (!key || seen.has(key) || seen.has(rawUrl)) return;
    seen.add(key);
    seen.add(rawUrl);
    for (const alias of aliases) {
      if (alias && alias.trim()) {
        seen.add(alias.trim());
        seen.add(normalizeKey(alias));
      }
    }
    items.push({ ...candidate, url: rawUrl });
  };

  // True product publication (not a normal video reel that merely tagged a product)
  const isProdReel =
    reel.type === "product" || Boolean(reel.id && reel.id.startsWith("reel_prod_"));

  // 1. Existing reel.media items
  if (Array.isArray(reel.media) && reel.media.length > 0) {
    const videoEntriesCount = reel.media.filter((x) => x?.type === "video").length;
    for (const m of reel.media) {
      const mUrl = typeof m?.url === "string" ? m.url.trim() : "";
      const type: "video" | "image" = m?.type === "video" || isVideoUrl(mUrl) ? "video" : "image";
      const isPrimaryVideo =
        type === "video" &&
        (videoEntriesCount === 1 || !mUrl || mUrl === reel.videoUrl || mUrl === reel.hlsUrl);
      const resolvedUrl =
        type === "video"
          ? isPrimaryVideo
            ? reel.hlsUrl || reel.videoUrl || mUrl
            : mUrl || reel.hlsUrl || reel.videoUrl || ""
          : mUrl;
      if (!resolvedUrl) continue;
      const hlsCandidate =
        m?.hlsUrl || (isPrimaryVideo ? reel.hlsUrl : undefined) || (resolvedUrl.includes(".m3u8") ? resolvedUrl : undefined);
      const thumbCandidate = m?.thumbnailUrl || (isPrimaryVideo ? reel.thumbnailUrl : undefined);

      addItem(
        {
          type,
          url: resolvedUrl,
          hlsUrl: hlsCandidate,
          thumbnailUrl: thumbCandidate || undefined,
        },
        isPrimaryVideo ? [reel.videoUrl || "", reel.hlsUrl || "", mUrl] : [mUrl]
      );
    }
  }

  // 2. Top-level reel.videoUrl / reel.hlsUrl if not yet added
  if ((reel.videoUrl && reel.videoUrl.trim() !== "") || (reel.hlsUrl && reel.hlsUrl.trim() !== "")) {
    const primaryVideoUrl = (reel.hlsUrl || reel.videoUrl || "").trim();
    const rawVid = (reel.videoUrl || "").trim();
    if (
      primaryVideoUrl &&
      !seen.has(normalizeKey(primaryVideoUrl)) &&
      (!rawVid || !seen.has(normalizeKey(rawVid)))
    ) {
      addItem(
        {
          type: "video",
          url: primaryVideoUrl,
          hlsUrl: reel.hlsUrl || (primaryVideoUrl.includes(".m3u8") ? primaryVideoUrl : undefined),
          thumbnailUrl: reel.thumbnailUrl || undefined,
        },
        [rawVid, reel.hlsUrl || ""]
      );
    }
  }

  // 3. If product reel, also check product's own videos
  if (isProdReel && reelProduct && Array.isArray(reelProduct.videos)) {
    for (const v of reelProduct.videos) {
      if (v && typeof v === "string" && v.trim() !== "") {
        const cleanV = v.trim();
        addItem({
          type: "video",
          url: cleanV,
          hlsUrl: cleanV.includes(".m3u8") ? cleanV : undefined,
          thumbnailUrl: reelProduct.imageUrl || reel.thumbnailUrl || undefined,
        });
      }
    }
  }

  // 4. Include reel.images when this is a carousel, a product reel, or when no video was found
  const shouldIncludeReelImages =
    items.length === 0 ||
    isProdReel ||
    reel.type === "carousel" ||
    (Array.isArray(reel.images) && reel.images.length > 1);

  if (shouldIncludeReelImages && Array.isArray(reel.images) && reel.images.length > 0) {
    for (const img of reel.images) {
      if (img && typeof img === "string" && img.trim() !== "") {
        const cleanImg = img.trim();
        if (items.length > 0 && reel.type === "video" && cleanImg === reel.thumbnailUrl) continue;
        const type: "video" | "image" = isVideoUrl(cleanImg) ? "video" : "image";
        addItem({
          type,
          url: cleanImg,
          hlsUrl: type === "video" && cleanImg.includes(".m3u8") ? cleanImg : undefined,
        });
      }
    }
  }

  // 5. If product reel, also include product's images / imageUrl so product video + image always forms a carousel
  if (isProdReel && reelProduct) {
    if (Array.isArray(reelProduct.images) && reelProduct.images.length > 0) {
      for (const pImg of reelProduct.images) {
        if (pImg && typeof pImg === "string" && pImg.trim() !== "") {
          addItem({ type: "image", url: pImg.trim() });
        }
      }
    }
    if (reelProduct.imageUrl && typeof reelProduct.imageUrl === "string" && reelProduct.imageUrl.trim() !== "") {
      addItem({ type: "image", url: reelProduct.imageUrl.trim() });
    }
  }

  // 6. If product reel has a video AND a distinct non-poster image thumbnail, or if items is still empty
  if (
    reel.thumbnailUrl &&
    typeof reel.thumbnailUrl === "string" &&
    reel.thumbnailUrl.trim() !== "" &&
    !reel.thumbnailUrl.endsWith(".m3u8")
  ) {
    const cleanThumb = reel.thumbnailUrl.trim();
    if (items.length === 0 || (isProdReel && !cleanThumb.includes("/poster.jpg") && !cleanThumb.includes("thumb_"))) {
      addItem({ type: "image", url: cleanThumb });
    }
  }

  if (items.length === 0) {
    return [{ type: "image", url: reel.thumbnailUrl || "" }];
  }

  return items;
}

interface ReelCarouselProps {
  reel: Reel;
  reelIndex: number;
  mediaItems: ReelMedia[];
  activeSlideIndex: number;
  isCurrentReel: boolean;
  shouldPreload: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  mediaAspectRatio?: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square';
  onIndexChange: (index: number) => void;
  onTogglePlay: () => void;
  onVideoClick: (e: React.MouseEvent, index: number) => void;
  onDoubleTap: (reelId: string) => void;
  onAspectRatioDetected: (reelId: string, ratio: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square') => void;
  onRegisterRef: (index: number, el: HTMLVideoElement | null) => void;
}

function ReelCarousel({
  reel,
  reelIndex,
  mediaItems,
  activeSlideIndex,
  isCurrentReel,
  shouldPreload,
  isPlaying,
  isMuted,
  mediaAspectRatio,
  onIndexChange,
  onTogglePlay,
  onVideoClick,
  onDoubleTap,
  onAspectRatioDetected,
  onRegisterRef,
}: ReelCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slideAspectRatios, setSlideAspectRatios] = useState<{ [index: number]: 'vertical' | 'square' | 'horizontal' }>({});
  const [isGrabbing, setIsGrabbing] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startScrollLeft = useRef(0);
  const dragWalk = useRef(0);
  const hasMoved = useRef(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartScrollLeft = useRef(0);
  const isProgrammaticScroll = useRef(false);
  const programmaticTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToSlide = useCallback(
    (targetIdx: number, behavior: ScrollBehavior = "smooth") => {
      const clamped = Math.max(0, Math.min(mediaItems.length - 1, targetIdx));
      onIndexChange(clamped);
      const container = containerRef.current;
      if (!container || container.clientWidth <= 0) return;
      isProgrammaticScroll.current = true;
      if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
      container.scrollTo({
        left: clamped * container.clientWidth,
        behavior,
      });
      programmaticTimeoutRef.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 380);
    },
    [mediaItems.length, onIndexChange]
  );

  useEffect(() => {
    return () => {
      if (programmaticTimeoutRef.current) clearTimeout(programmaticTimeoutRef.current);
    };
  }, []);

  // Keep horizontal scroll position aligned when container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleResize = () => {
      if (container.clientWidth > 0 && !isDragging.current) {
        container.scrollTo({ left: activeSlideIndex * container.clientWidth, behavior: "instant" as ScrollBehavior });
      }
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeSlideIndex]);

  // Keyboard Left/Right navigation for active carousel reel on desktop
  useEffect(() => {
    if (!isCurrentReel || mediaItems.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft" && activeSlideIndex > 0) {
        e.preventDefault();
        scrollToSlide(activeSlideIndex - 1);
      } else if (e.key === "ArrowRight" && activeSlideIndex < mediaItems.length - 1) {
        e.preventDefault();
        scrollToSlide(activeSlideIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCurrentReel, activeSlideIndex, mediaItems.length, scrollToSlide]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current || e.button !== 0) return;
    isDragging.current = true;
    hasMoved.current = false;
    dragWalk.current = 0;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startScrollLeft.current = containerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const walkX = e.clientX - startX.current;
    const walkY = e.clientY - startY.current;
    dragWalk.current = walkX;
    if (Math.abs(walkX) > 6 && Math.abs(walkX) >= Math.abs(walkY)) {
      if (!hasMoved.current) {
        hasMoved.current = true;
        setIsGrabbing(true);
      }
      containerRef.current.scrollLeft = startScrollLeft.current - walkX;
    }
  };

  const finishMouseDrag = () => {
    if (!isDragging.current || !containerRef.current) return;
    isDragging.current = false;
    setIsGrabbing(false);
    if (!hasMoved.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    if (width <= 0) return;

    const walk = dragWalk.current;
    let targetIdx = Math.round(container.scrollLeft / width);
    if (Math.abs(walk) > 40) {
      targetIdx = walk < 0 ? activeSlideIndex + 1 : activeSlideIndex - 1;
    }
    scrollToSlide(targetIdx, "smooth");
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.touches.length === 0) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartScrollLeft.current = containerRef.current.scrollLeft;
    hasMoved.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const dx = touchStartX.current - e.touches[0].clientX;
    const dy = touchStartY.current - e.touches[0].clientY;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      hasMoved.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.changedTouches.length === 0) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
      const targetIdx = dx > 0 ? activeSlideIndex + 1 : activeSlideIndex - 1;
      scrollToSlide(targetIdx, "smooth");
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current || isDragging.current) return;
    const container = e.currentTarget;
    if (container.clientWidth > 0) {
      const idx = Math.round(container.scrollLeft / container.clientWidth);
      if (idx !== activeSlideIndex && idx >= 0 && idx < mediaItems.length) {
        onIndexChange(idx);
      }
    }
  };

  const isProd = reel.type === "product" || Boolean(reel.productId) || reel.id?.startsWith("reel_prod_");

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Left/Right navigation buttons synced with horizontal scroll (Desktop only) */}
      {activeSlideIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollToSlide(activeSlideIndex - 1);
          }}
          className="hidden md:flex absolute left-2.5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/55 backdrop-blur-xs text-white items-center justify-center hover:bg-black/80 active:scale-90 transition-all cursor-pointer border border-white/20 shadow-lg"
          title="Elemento anterior"
          id={`carousel-prev-btn-${reel.id}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {activeSlideIndex < mediaItems.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollToSlide(activeSlideIndex + 1);
          }}
          className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/55 backdrop-blur-xs text-white items-center justify-center hover:bg-black/80 active:scale-90 transition-all cursor-pointer border border-white/20 shadow-lg"
          title="Elemento siguiente"
          id={`carousel-next-btn-${reel.id}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Horizontal Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishMouseDrag}
        onMouseLeave={finishMouseDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (!hasMoved.current) onTogglePlay();
        }}
        onDoubleClick={() => {
          if (!hasMoved.current) onDoubleTap(reel.id);
        }}
        className={`w-full h-full flex overflow-x-auto no-scrollbar select-none bg-slate-950 touch-auto ${
          isGrabbing ? "cursor-grabbing" : "snap-x snap-mandatory cursor-grab"
        }`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollSnapType: isGrabbing ? "none" : "x mandatory",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
        }}
        id={`carousel-scroll-${reel.id}`}
      >
        {mediaItems.map((item, slideIdx) => {
          const isSlideVideo = item.type === "video" && !!item.url;
          const isSlideActive = slideIdx === activeSlideIndex;
          const slideAspect = slideAspectRatios[slideIdx] || mediaAspectRatio;
          const isPrimaryReelVideo =
            item.url === reel.videoUrl || item.url === reel.hlsUrl;
          const resolvedSlideHls =
            item.hlsUrl ||
            (item.url.includes(".m3u8")
              ? item.url
              : isPrimaryReelVideo
              ? reel.hlsUrl
              : undefined);

          return (
            <div
              key={`${reel.id}_slide_${slideIdx}`}
              className="w-full h-full shrink-0 snap-center snap-always relative flex items-center justify-center overflow-hidden bg-slate-950"
              style={{
                scrollSnapAlign: "center",
                scrollSnapStop: "always",
                touchAction: "pan-x pan-y",
              }}
            >
              {isSlideVideo ? (
                <div
                  className={`w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden ${
                    isGrabbing ? "pointer-events-none" : ""
                  }`}
                  style={{ touchAction: "pan-x pan-y" }}
                >
                  {(item.thumbnailUrl || reel.thumbnailUrl) &&
                    !(item.thumbnailUrl || reel.thumbnailUrl || "").endsWith(".m3u8") &&
                    !(item.thumbnailUrl || reel.thumbnailUrl || "").includes("1618005182384") && (
                      <img
                        src={getMediaUrl(item.thumbnailUrl || reel.thumbnailUrl)}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-125 pointer-events-none"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  {isCurrentReel || (shouldPreload && slideIdx === 0) ? (
                    <ReelVideoItem
                      key={`${reel.id}_${reelIndex}_media_${slideIdx}`}
                      reel={{
                        ...reel,
                        videoUrl: item.url,
                        hlsUrl: resolvedSlideHls,
                      }}
                      index={reelIndex}
                      isCurrent={isCurrentReel && isSlideActive}
                      shouldPreload={(isCurrentReel && isSlideActive) || (shouldPreload && slideIdx === 0)}
                      isPlaying={isPlaying}
                      isMuted={isMuted}
                      mediaAspectRatio={slideAspect}
                      onVideoClick={(e, idx) => {
                        if (hasMoved.current) {
                          e.stopPropagation();
                          return;
                        }
                        onVideoClick(e, idx);
                      }}
                      onDoubleTap={onDoubleTap}
                      onAspectRatioDetected={onAspectRatioDetected}
                      onRegisterRef={onRegisterRef}
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden">
                      {(item.thumbnailUrl || reel.thumbnailUrl) &&
                      !(item.thumbnailUrl || reel.thumbnailUrl || "").endsWith(".m3u8") &&
                      !(item.thumbnailUrl || reel.thumbnailUrl || "").includes("1618005182384") ? (
                        <img
                          src={getMediaUrl(item.thumbnailUrl || reel.thumbnailUrl)}
                          alt={reel.description || ""}
                          draggable={false}
                          className={`w-full h-full block relative z-10 select-none pointer-events-none object-center ${
                            slideAspect === "vertical" ? "object-cover md:object-contain" : "object-contain"
                          }`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500">
                          <Play className="w-12 h-12 text-white/20 mb-2 fill-white/10" />
                          <span className="text-xs text-white/30 font-medium">Video</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
                  {item.url && (
                    <img
                      src={getMediaUrl(item.url)}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-125 pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {item.url ? (
                    <img
                      src={getMediaUrl(item.url)}
                      alt={`${reel.description || "Publicación"} (${slideIdx + 1}/${mediaItems.length})`}
                      draggable={false}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        const ratio = img.naturalWidth / img.naturalHeight;
                        let detected: 'vertical' | 'square' | 'horizontal' = isProd ? 'square' : 'vertical';
                        if (ratio > 1.15) detected = 'horizontal';
                        else if (ratio >= 0.85 && ratio <= 1.15) detected = 'square';
                        setSlideAspectRatios((prev) => ({ ...prev, [slideIdx]: detected }));
                        if (slideIdx === 0) onAspectRatioDetected(reel.id, detected);
                      }}
                      className={`w-full h-full pointer-events-none select-none block object-center relative z-10 ${
                        !isProd && slideAspect === "vertical"
                          ? "object-cover md:object-contain"
                          : "object-contain"
                      }`}
                      style={{ touchAction: "pan-x pan-y" }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-600 text-xs">
                      <span>Publicación</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination indicator dots */}
      <div
        className="absolute bottom-1.5 sm:bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10"
        id={`carousel-dots-${reel.id}`}
      >
        {mediaItems.map((_, dotIdx) => (
          <button
            key={dotIdx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollToSlide(dotIdx);
            }}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              dotIdx === activeSlideIndex
                ? "w-4 bg-amber-400 shadow-xs"
                : "w-1.5 bg-white/50 hover:bg-white/80"
            }`}
            title={`Ir a imagen ${dotIdx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

interface ReelVideoItemProps {
  reel: Reel;
  index: number;
  isCurrent: boolean;
  shouldPreload: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  mediaAspectRatio?: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square';
  onVideoClick: (e: React.MouseEvent, index: number) => void;
  onDoubleTap: (reelId: string) => void;
  onAspectRatioDetected: (reelId: string, ratio: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square') => void;
  onRegisterRef: (index: number, el: HTMLVideoElement | null) => void;
}

const ReelVideoItem = memo(function ReelVideoItem({ reel, index, isCurrent, shouldPreload, isPlaying, isMuted, mediaAspectRatio, onVideoClick, onDoubleTap, onAspectRatioDetected, onRegisterRef }: ReelVideoItemProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isCurrentRef = useRef(isCurrent);
  isCurrentRef.current = isCurrent;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const rawSource = (reel.hlsUrl || reel.videoUrl)?.trim();
  const hlsSource = getMediaUrl(rawSource);
  const stallTimerRef = useRef<any>(null);
  const lastProgressTimeRef = useRef<number>(0);
  const stallCountRef = useRef<number>(0);

  const clearStallTimer = () => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  };

  const handleWaitingOrStalled = () => {
    // HLS.js owns buffering/recovery. Calling play() after a fixed timeout
    // does not refill an empty buffer and can create playback churn.
    clearStallTimer();
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v) return;
    lastProgressTimeRef.current = v.currentTime;
    stallCountRef.current = 0;
    clearStallTimer();
  };

  const handlePlaying = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    lastProgressTimeRef.current = e.currentTarget.currentTime;
    stallCountRef.current = 0;
    clearStallTimer();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    clearStallTimer();
    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!isCurrent && !shouldPreload) return;

    if (hlsSource && Hls.isSupported() && hlsSource.includes(".m3u8")) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 6,
        maxBufferLength: 12,
        maxMaxBufferLength: 24,
        maxBufferSize: 24 * 1000 * 1000,
        maxBufferHole: 0.1,
        nudgeMaxRetry: 3,
        nudgeOffset: 0.1,
        startFragPrefetch: true,
        capLevelToPlayerSize: true,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 500,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isCurrentRef.current && isPlayingRef.current) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR || data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL) {
          // Allow HLS.js internal nudge mechanism to handle buffer holes seamlessly
          return;
        }
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          hls.destroy();
          hlsRef.current = null;
          if (video && hlsSource) {
            video.src = hlsSource;
            video.load();
            if (isCurrentRef.current && isPlayingRef.current) video.play().catch(() => {});
          }
        }
      });
      hls.loadSource(hlsSource);
      hls.attachMedia(video);
    } else if (hlsSource && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsSource;
    } else if (hlsSource) {
      video.src = hlsSource;
    }

    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = isMuted ? 0 : 1;

    return () => {
      clearStallTimer();
      video.pause();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [hlsSource, shouldPreload]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.defaultMuted = isMuted;
    video.volume = isMuted ? 0 : 1;
    if (!isCurrent || !isPlaying) {
      video.pause();
      clearStallTimer();
      return;
    }
    video.play().catch((err) => {
      if (err?.name !== "AbortError" && err?.name !== "NotAllowedError") console.warn("Reel playback failed:", err);
    });
  }, [isCurrent, isPlaying, isMuted]);

  const handleRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      el.muted = isMuted;
      el.defaultMuted = isMuted;
      el.volume = isMuted ? 0 : 1;
    }
    if (isCurrent) onRegisterRef(index, el);
  }, [index, isCurrent, isMuted, onRegisterRef]);

  useEffect(() => {
    if (isCurrent && videoRef.current) {
      onRegisterRef(index, videoRef.current);
    }
  }, [isCurrent, index, onRegisterRef]);

  useEffect(() => () => {
    clearStallTimer();
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (isCurrentRef.current) onRegisterRef(index, null);
  }, [index, onRegisterRef]);

  const isProductReel = reel.type === "product" || Boolean(reel.productId) || reel.id?.startsWith("reel_prod_");
  const rawPoster = !isProductReel && reel.thumbnailUrl && !reel.thumbnailUrl.includes("1618005182384") && !reel.thumbnailUrl.endsWith(".m3u8") ? reel.thumbnailUrl : undefined;
  const posterUrl = rawPoster ? getMediaUrl(rawPoster) : undefined;

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video.videoHeight || !video.videoWidth) return;
    const ratio = video.videoWidth / video.videoHeight;
    let detected: 'vertical' | 'square' | 'horizontal' = 'vertical';
    if (ratio > 1.15) detected = 'horizontal';
    else if (ratio >= 0.85 && ratio <= 1.15) detected = 'square';
    onAspectRatioDetected(reel.id, detected);
  };

  const handleEnded = () => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  };

  return (
    <video
      ref={handleRef}
      poster={posterUrl}
      autoPlay={isCurrent}
      playsInline
      loop
      muted={isMuted}
      preload="metadata"
      className={`w-full h-full block relative z-10 select-none cursor-pointer object-center ${mediaAspectRatio === 'vertical' ? "object-cover md:object-contain" : "object-contain"}`}
      style={{ touchAction: "pan-x pan-y" }}
      onClick={(e) => onVideoClick(e, index)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleTap(reel.id); }}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPlaying={handlePlaying}
      onWaiting={handleWaitingOrStalled}
      onStalled={handleWaitingOrStalled}
      onEnded={handleEnded}
    />
  );
});