import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Heart, MessageCircle, Share2, ShoppingBag, ShoppingCart, Volume2, VolumeX, Send, X, Play, Bookmark, Trash2, Check, ArrowLeft, Plus, Minus } from "lucide-react";
import { Reel, Product, Comment, User, CartItem } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../config";
import { ReelProgressBar } from "./components/ReelProgressBar";

interface ReelsViewProps {
  reels: Reel[];
  currentUser: User;
  cart?: CartItem[];
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
}

export default function ReelsView({
  reels,
  currentUser,
  cart = [],
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
}: ReelsViewProps) {
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [displayCount, setDisplayCount] = useState<number>(() => (reels.length <= 2 ? Math.max(reels.length * 4, 4) : reels.length));
  const [isMuted, setIsMuted] = useState(true);
  const [activeVideoElement, setActiveVideoElement] = useState<HTMLVideoElement | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [likedAnim, setLikedAnim] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [carouselIndices, setCarouselIndices] = useState<{ [key: string]: number }>({});
  const [mediaAspectRatios, setMediaAspectRatios] = useState<{ [key: string]: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square' }>({});

  // Listen for user interaction to allow unmuting seamlessly according to browser policy
  useEffect(() => {
    const handleFirstGesture = () => {
      setHasUserInteracted(true);
    };
    window.addEventListener("pointerdown", handleFirstGesture, { once: true });
    window.addEventListener("keydown", handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };
  }, []);

  // Cleanup all videos and release hardware decoders on unmount
  useEffect(() => {
    return () => {
      Object.keys(videoRefs.current).forEach((key) => {
        const video = videoRefs.current[Number(key)];
        if (video) {
          try {
            video.pause();
            video.removeAttribute("src");
            video.load();
          } catch {}
        }
      });
      videoRefs.current = {};
    };
  }, []);

  // Helper to safely play active video with fallback to muted if autoplay audio is blocked
  const playVideoSafely = useCallback((video: HTMLVideoElement) => {
    if (!isPlaying) {
      video.pause();
      return;
    }
    video.muted = isMuted;
    video.volume = isMuted ? 0 : 1.0;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err?.name === "AbortError" || !isPlaying) return;
        if (err?.name === "NotAllowedError") {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    }
  }, [isMuted, isPlaying]);

  // Pause playback when browser tab or app window is hidden/minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const activeVideo = videoRefs.current[activeReelIndex];
        if (activeVideo) {
          activeVideo.pause();
        }
      } else if (isPlaying) {
        const activeVideo = videoRefs.current[activeReelIndex];
        if (activeVideo) {
          playVideoSafely(activeVideo);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeReelIndex, isPlaying, playVideoSafely]);

  // Reset or extend displayCount when reels source changes
  useEffect(() => {
    if (reels.length > 0) {
      setDisplayCount((prev) => (reels.length <= 2 ? Math.max(reels.length * 4, 4) : Math.max(prev, reels.length)));
    }
  }, [reels.length]);

  // Construct continuous looping reels array for infinite scroll
  const displayedReels = React.useMemo(() => {
    if (reels.length === 0) return [];
    const list: Reel[] = [];
    for (let i = 0; i < displayCount; i++) {
      list.push(reels[i % reels.length]);
    }
    return list;
  }, [reels, displayCount]);

  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>([]);

  // Automatically sync cart selections when cart items change
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
    setSelectedCartIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isAllCartSelected = cart.length > 0 && selectedCartIndices.length === cart.length;

  const toggleSelectAllCart = () => {
    if (isAllCartSelected) {
      setSelectedCartIndices([]);
    } else {
      setSelectedCartIndices(cart.map((_, i) => i));
    }
  };

  const selectedCartItems = cart.filter((_, idx) => selectedCartIndices.includes(idx));
  const effectiveCheckoutItems = selectedCartItems.length > 0 ? selectedCartItems : cart;

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCartCount = selectedCartItems.reduce((sum, item) => sum + item.quantity, 0);
  const effectiveSubtotal = effectiveCheckoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const effectiveShipping = effectiveCheckoutItems.reduce((sum, item) => {
    const shippingFee = item.selectedShippingCost !== undefined 
      ? item.selectedShippingCost 
      : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
    return sum + shippingFee * item.quantity;
  }, 0);
  const effectiveTotal = effectiveSubtotal + effectiveShipping;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  const handleRegisterRef = useCallback((idx: number, el: HTMLVideoElement | null) => {
    if (!el) {
      delete videoRefs.current[idx];
      if (idx === activeReelIndex) {
        setActiveVideoElement(null);
      }
    } else {
      videoRefs.current[idx] = el;
      if (idx === activeReelIndex) {
        setActiveVideoElement(el);
      }
    }
  }, [activeReelIndex]);

  const handleAspectRatioDetected = useCallback((reelId: string, ratio: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square') => {
    setMediaAspectRatios((prev) => {
      if (prev[reelId] === ratio) return prev;
      return { ...prev, [reelId]: ratio };
    });
  }, []);

  // Handle scroll detection for snap scroll & continuous infinite expansion with INSTANT response
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    const childHeight = container.clientHeight;
    if (!childHeight) return;
    const index = Math.round(scrollPos / childHeight);
    if (index !== activeReelIndex && index >= 0 && index < displayedReels.length) {
      // 1. Immediately pause previous active video
      const prevVideo = videoRefs.current[activeReelIndex];
      if (prevVideo) {
        try {
          prevVideo.pause();
          prevVideo.muted = true;
        } catch {}
      }

      // Also ensure any non-target active videos in the small 3-item window are paused
      Object.keys(videoRefs.current).forEach((key) => {
        const k = Number(key);
        if (k !== index) {
          const v = videoRefs.current[k];
          if (v && !v.paused) {
            try {
              v.pause();
              v.muted = true;
            } catch {}
          }
        }
      });

      // 2. Instantly start playing the target video directly within the scroll gesture
      const nextVideo = videoRefs.current[index];
      if (nextVideo) {
        nextVideo.muted = isMuted;
        nextVideo.defaultMuted = isMuted;
        nextVideo.volume = isMuted ? 0 : 1.0;
        const p = nextVideo.play();
        if (p !== undefined) {
          p.catch((err) => {
            if (err?.name === "AbortError") return;
            if (err?.name === "NotAllowedError") {
              nextVideo.muted = true;
              nextVideo.defaultMuted = true;
              nextVideo.play().catch(() => {});
            }
          });
        }
      }

      setActiveReelIndex(index);
      setActiveVideoElement(videoRefs.current[index] || null);
      setIsPlaying(true);
    }

    // Trigger infinite scroll expansion as we approach the end of the loaded reel batch
    if (index >= displayedReels.length - 2 && reels.length > 0) {
      setDisplayCount((prev) => prev + Math.min(reels.length, 10));
    }
  };

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const activeVideo = activeVideoElement || videoRefs.current[activeReelIndex];
    if (activeVideo) {
      activeVideo.muted = nextMuted;
      activeVideo.defaultMuted = nextMuted;
      activeVideo.volume = nextMuted ? 0 : 1.0;
      if (!nextMuted && isPlaying && activeVideo.paused) {
        activeVideo.play().catch(() => {});
      }
    }
  };

  const handleVideoClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const video = videoRefs.current[index];
    if (!video) return;

    if (video.paused) {
      // If paused, ensure others are paused and play this one
      Object.keys(videoRefs.current).forEach((key) => {
        const k = Number(key);
        if (k !== index) {
          const other = videoRefs.current[k];
          if (other) {
            try {
              other.pause();
              other.muted = true;
            } catch {}
          }
        }
      });
      video.muted = isMuted;
      video.defaultMuted = isMuted;
      video.volume = isMuted ? 0 : 1.0;
      const p = video.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch((err) => {
          if (err?.name === "AbortError") return;
          video.muted = true;
          video.defaultMuted = true;
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
      } else {
        setIsPlaying(true);
      }
    } else {
      // If playing, pause it
      try {
        video.pause();
      } catch {}
      setIsPlaying(false);
    }
  };

  const isGuestUser = !currentUser || currentUser.isGuest || currentUser.username === "invitado" || !currentUser.username;

  const handleDoubleTap = (reelId: string) => {
    if (isGuestUser) {
      onGuestInteraction("dar me gusta");
      return;
    }
    onLikeReel(reelId);
    setLikedAnim(reelId);
    setTimeout(() => setLikedAnim(null), 800);
  };

  const handleShare = (reelId: string) => {
    if (isGuestUser) {
      onGuestInteraction("compartir publicaciones");
      return;
    }
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
    const dummyUrl = `${window.location.origin}/reel/${reelId}`;
    navigator.clipboard.writeText(dummyUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const currentReel = displayedReels[activeReelIndex];

  const viewedReelsRef = useRef<Set<string>>(new Set());

  // Track video views persistently
  useEffect(() => {
    if (currentReel?.id && !viewedReelsRef.current.has(currentReel.id)) {
      viewedReelsRef.current.add(currentReel.id);
      apiFetch(`/api/reels/${currentReel.id}/view`, { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.views !== undefined) {
            currentReel.views = data.views;
          }
        })
        .catch((err) => console.error("Error updating views:", err));
    }
  }, [currentReel?.id]);

  // Pre-fetch tagged products for all reels to prevent product content swapping on focus
  const [taggedProductsMap, setTaggedProductsMap] = useState<Record<string, Product>>({});

  useEffect(() => {
    const productIds = Array.from(
      new Set(reels.map((r) => r.productId).filter(Boolean))
    ) as string[];

    productIds.forEach((pid) => {
      apiFetch(`/api/products/${pid}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setTaggedProductsMap((prev) => ({ ...prev, [pid]: data }));
          }
        })
        .catch(() => {});
    });
  }, [reels]);

  const [navBarHeight, setNavBarHeight] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const navBar = document.getElementById("bottom-nav-bar");
      if (navBar) return navBar.getBoundingClientRect().height || navBar.offsetHeight || 56;
      return 56;
    }
    return 0;
  });

  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    const updateNavBarHeight = () => {
      if (window.innerWidth >= 768) {
        setNavBarHeight(0);
        return;
      }
      const navBar = document.getElementById("bottom-nav-bar");
      if (navBar) {
        setNavBarHeight(navBar.getBoundingClientRect().height || navBar.offsetHeight || 56);
      } else {
        setNavBarHeight(56);
      }
    };

    updateNavBarHeight();
    const navBar = document.getElementById("bottom-nav-bar");
    let navObserver: ResizeObserver | null = null;
    if (navBar) {
      navObserver = new ResizeObserver(() => updateNavBarHeight());
      navObserver.observe(navBar);
    }
    window.addEventListener("resize", updateNavBarHeight);
    return () => {
      navObserver?.disconnect();
      window.removeEventListener("resize", updateNavBarHeight);
    };
  }, []);

  // Strict container height measurement to ensure exact 100% viewport coverage per slide
  useEffect(() => {
    const updateContainerDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateContainerDimensions();
    let containerObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      containerObserver = new ResizeObserver(() => {
        updateContainerDimensions();
      });
      containerObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", updateContainerDimensions);
    return () => {
      containerObserver?.disconnect();
      window.removeEventListener("resize", updateContainerDimensions);
    };
  }, []);

  const submitComment = (e: React.FormEvent, reelId: string) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(reelId, commentText);
    setCommentText("");
  };

  return (
    <div
      className="relative w-full bg-slate-950 overflow-hidden flex flex-col"
      id="reels-panel"
      style={{
        height: navBarHeight > 0 ? `calc(100dvh - ${navBarHeight}px)` : "100dvh",
        maxHeight: navBarHeight > 0 ? `calc(100dvh - ${navBarHeight}px)` : "100dvh",
      }}
    >
      {/* Cabecera fija con fondo transparente que respeta la barra de estado */}
      <header
        className="absolute top-0 inset-x-0 z-40 flex items-center justify-between px-4 pointer-events-none"
        style={{
          paddingTop: "max(2rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))",
          paddingBottom: "0.75rem",
        }}
        id="reels-fixed-header"
      >
        {/* Botón del Carrito */}
        <button
          onClick={() => setShowCartDrawer(true)}
          className="relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto"
          id="reels-header-cart-btn"
          title="Ver carrito de compras"
        >
          <ShoppingBag className="w-5 h-5 text-amber-400 drop-shadow-md" />
          {totalCartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-950 shadow-md animate-pulse">
              {totalCartCount}
            </span>
          )}
        </button>

        {/* Grupo derecho: Contador de imágenes y Botón de Sonido */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          {/* Contador de imágenes (solo si la publicación contiene únicamente imágenes) */}
          {currentReel && !currentReel.videoUrl && currentReel.type !== "video" && ((currentReel.type === "carousel" && (currentReel.images?.length || 0) > 1) || (currentReel.images && currentReel.images.length > 1)) && (
            <div
              className="inline-flex items-center space-x-1 px-1.5 py-1 bg-transparent text-xs font-extrabold text-white drop-shadow-md"
              id={`carousel-counter-${currentReel.id}`}
            >
              <span className="text-amber-400 font-mono font-black">{(carouselIndices[`${currentReel.id}_${activeReelIndex}`] ?? carouselIndices[currentReel.id] ?? 0) + 1}</span>
              <span className="text-white/70 font-mono">/</span>
              <span className="text-white font-mono font-bold">{currentReel.images?.length || 1}</span>
            </div>
          )}

          {/* Botón de Sonido (Activar / Silenciar) */}
          <button
            onClick={handleToggleMute}
            className="p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto"
            id="reels-header-mute-btn"
            title={isMuted ? "Activar sonido" : "Silenciar video"}
          >
            {isMuted ? <VolumeX className="w-5 h-5 drop-shadow-md" /> : <Volume2 className="w-5 h-5 drop-shadow-md" />}
          </button>
        </div>
      </header>

      {/* Scrollable Feed Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full min-h-0 flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar relative"
        style={{
          scrollbarWidth: "none",
          scrollSnapType: "y mandatory",
        }}
      >
        {displayedReels.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Play className="w-12 h-12 stroke-1 text-slate-600 mb-3 animate-pulse" />
            <p className="font-display font-medium text-slate-300">No hay videos disponibles</p>
            <p className="text-xs text-slate-500 mt-1">Sube contenido o inicia una transmisión para empezar</p>
          </div>
        ) : (
          displayedReels.map((reel, index) => {
            const isCurrent = index === activeReelIndex;
            const reelProduct = reel.productId ? taggedProductsMap[reel.productId] : null;
            const isLiked = Boolean(
              currentUser && (
                (currentUser.originalId && (reel.likedBy || []).includes(currentUser.originalId)) ||
                (currentUser.id && currentUser.id !== "current_user" && (reel.likedBy || []).includes(currentUser.id)) ||
                (currentUser.username && currentUser.username !== "invitado" && (reel.likedBy || []).includes(currentUser.username))
              )
            );
            return (
              <div
                key={`${reel.id}_${index}`}
                className="w-full shrink-0 snap-start snap-always relative flex items-center justify-center bg-slate-950 overflow-hidden py-0 md:py-1 lg:py-1.5 px-0 md:px-3 lg:px-4"
                style={{
                  height: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  minHeight: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  maxHeight: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  scrollSnapAlign: "start",
                  scrollSnapStop: "always",
                }}
              >
                {/* Publication Container */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  {/* Desktop Layout Wrapper: Holds the Video Frame and the Lateral Interaction Bar side-by-side */}
                  <div className="relative flex items-end justify-center md:gap-3.5 lg:gap-5 w-full md:w-auto h-full md:max-h-[920px] lg:max-h-[980px] xl:max-h-[1050px] 2xl:max-h-[1140px] my-auto">
                    {/* Publication Frame: Full width on mobile, expanded vertical card frame on desktop */}
                    <div
                      className="relative w-full h-full md:w-auto md:aspect-[9/16] md:h-full md:max-w-[520px] lg:max-w-[580px] xl:max-w-[640px] 2xl:max-w-[700px] md:rounded-2xl md:border md:border-white/15 md:shadow-[0_16px_50px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center bg-black select-none shrink-0"
                      id={`reel-card-${reel.id}`}
                    >
                    {/* Desktop Sound Mute Button inside Frame */}
                    <div className="hidden md:flex absolute top-3.5 right-3.5 z-30 items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleToggleMute}
                        className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20 cursor-pointer shadow-lg"
                        title={isMuted ? "Activar sonido" : "Silenciar video"}
                        id={`desktop-frame-mute-btn-${reel.id}`}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Bottom gradient protector for readability */}
                    <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

                    {/* Media Element: Smart detection by videoUrl & type */}
                    {(!reel.videoUrl || reel.videoUrl.trim() === "") && (!reel.thumbnailUrl || !reel.thumbnailUrl.endsWith(".mp4")) ? (
                      ((reel.images && reel.images.length > 1) || reel.type === "carousel") ? (
                        <div className="w-full h-full flex items-center justify-center bg-black">
                          <ReelCarousel 
                            images={(reel.images && reel.images.length > 0 ? reel.images : [reel.thumbnailUrl]).filter((img): img is string => !!img && !img.includes("1618005182384"))} 
                            onDoubleClick={() => handleDoubleTap(reel.id)}
                            onIndexChange={(idx) => setCarouselIndices((prev) => ({ ...prev, [`${reel.id}_${index}`]: idx }))}
                          />
                        </div>
                      ) : (() => {
                        const singleImg = (reel.images?.[0] && !reel.images[0].includes("1618005182384"))
                          ? reel.images[0]
                          : (reel.thumbnailUrl && !reel.thumbnailUrl.includes("1618005182384") ? reel.thumbnailUrl : null);

                        return (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                            {singleImg ? (
                              <img
                                src={singleImg}
                                alt={reel.description || ""}
                                draggable={false}
                                onClick={() => setIsPlaying(!isPlaying)}
                                onDoubleClick={() => handleDoubleTap(reel.id)}
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  const ratio = img.naturalWidth / img.naturalHeight;
                                  let detected: 'vertical' | 'square' | 'horizontal' = 'vertical';
                                  if (ratio > 1.15) {
                                    detected = 'horizontal';
                                  } else if (ratio >= 0.85 && ratio <= 1.15) {
                                    detected = 'square';
                                  } else {
                                    detected = 'vertical';
                                  }
                                  setMediaAspectRatios((prev) => ({
                                    ...prev,
                                    [reel.id]: detected,
                                  }));
                                }}
                                className={`w-full h-full cursor-pointer select-none block touch-auto object-center ${
                                  (mediaAspectRatios[reel.id] === 'vertical' || !mediaAspectRatios[reel.id])
                                    ? "object-cover md:object-contain"
                                    : "object-contain"
                                }`}
                                style={{ touchAction: "pan-y" }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-black text-slate-600 text-xs">
                                <span>Publicación de imagen</span>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
                        {/* Virtualized Video Slot: Mount video player for current reel and nearby buffer (window <= 2) */}
                        {Math.abs(index - activeReelIndex) <= 2 ? (
                          <ReelVideoItem
                            key={`${reel.id}_${index}`}
                            reel={reel}
                            index={index}
                            isCurrent={isCurrent}
                            isPlaying={isPlaying}
                            isMuted={isMuted}
                            mediaAspectRatio={mediaAspectRatios[reel.id]}
                            onVideoClick={handleVideoClick}
                            onDoubleTap={handleDoubleTap}
                            onAspectRatioDetected={handleAspectRatioDetected}
                            onRegisterRef={handleRegisterRef}
                          />
                        ) : (
                          /* Faraway placeholder: Lightweight image poster with ZERO video decoder overhead */
                          <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
                            {reel.thumbnailUrl && !reel.thumbnailUrl.endsWith(".mp4") && !reel.thumbnailUrl.includes("1618005182384") ? (
                              <img
                                src={reel.thumbnailUrl}
                                alt={reel.description || ""}
                                draggable={false}
                                className={`w-full h-full block relative z-10 select-none object-center ${
                                  (mediaAspectRatios[reel.id] === 'vertical' || !mediaAspectRatios[reel.id])
                                    ? "object-cover md:object-contain"
                                    : "object-contain"
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
                    )}

                    {/* Floating Large Double Tap Heart Animation */}
                    <AnimatePresence>
                      {likedAnim === reel.id && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: [1, 1.3, 1], opacity: [0, 1, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6 }}
                          className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-30"
                        >
                          <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-lg" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Video Play Overlay Indicator */}
                    {!isPlaying && isCurrent && (
                      <div className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-10 bg-black/20 rounded-full w-16 h-16 bg-opacity-40">
                        <Play className="w-8 h-8 text-white fill-white translate-x-0.5" />
                      </div>
                    )}



                    {/* Bottom Info Banner (Creator, Description, Tagged Product) */}
                    <div className="absolute left-4 sm:left-6 bottom-4 sm:bottom-6 right-20 sm:right-24 md:right-6 lg:right-8 z-20 flex flex-col space-y-3 max-w-xl">
                      {/* Creator Info and Description */}
                      <div
                        className="text-white bg-transparent p-3 rounded-xl drop-shadow-md"
                        style={{ marginLeft: "-15px", marginBottom: "-10px" }}
                      >
                        <h3 className="font-display font-bold text-base sm:text-lg tracking-wide flex items-center space-x-2.5">
                          <span
                            className="cursor-pointer hover:underline text-white font-bold drop-shadow-sm"
                            onClick={() => {
                              const target = (reel.creatorUsername && reel.creatorUsername !== "invitado")
                                ? reel.creatorUsername
                                : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user"));
                              onCreatorClick(target);
                            }}
                          >
                            @{reel.creatorUsername || reel.creatorName.toLowerCase().replace(/\s+/g, "")}
                          </span>
                          {(() => {
                            const isSelf =
                              currentUser.id === reel.creatorId ||
                              reel.creatorId === "current_user" ||
                              (currentUser.originalId && currentUser.originalId === reel.creatorId) ||
                              (currentUser.username && reel.creatorUsername && currentUser.username.toLowerCase() === reel.creatorUsername.toLowerCase());
                            if (isSelf) {
                              return null;
                            }
                            const targetId = reel.creatorId || reel.creatorUsername;
                            const isFollowing = Boolean(
                              currentUser.followingUserIds?.some((id) =>
                                id === reel.creatorId ||
                                id === reel.creatorUsername ||
                                (reel.creatorUsername && id.toLowerCase() === reel.creatorUsername.toLowerCase()) ||
                                (reel.creatorId && id.toLowerCase() === reel.creatorId.toLowerCase())
                              )
                            );
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (currentUser.username === "invitado" || currentUser.isGuest) {
                                    onGuestInteraction("seguir a creadores");
                                  } else if (onToggleFollowUser) {
                                    onToggleFollowUser(targetId);
                                  }
                                }}
                                id={`follow-creator-btn-${reel.id}`}
                                className={`text-xs font-bold px-3 py-1 rounded-full transition-all cursor-pointer border bg-transparent backdrop-blur-sm ${
                                  isFollowing
                                    ? "text-white/80 border-white/60 hover:text-rose-300 hover:border-rose-400 hover:bg-rose-500/10"
                                    : "text-white border-white hover:bg-white/15 active:scale-95 font-extrabold"
                                }`}
                              >
                                {isFollowing ? "Siguiendo" : "+ Seguir"}
                              </button>
                            );
                          })()}
                        </h3>
                        <p className="text-sm sm:text-base text-white/95 font-medium mt-1.5 line-clamp-3 leading-relaxed drop-shadow-sm">
                          {reel.description || ""}
                        </p>
                      </div>

                      {/* Tagged Product Box */}
                      {reelProduct && (
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          onClick={() => onProductClick(reelProduct)}
                          className="bg-black/10 backdrop-blur-md border border-white/15 text-white rounded-xl flex items-stretch cursor-pointer hover:bg-black/20 hover:border-amber-500/40 active:scale-[0.98] transition-all shadow-lg overflow-hidden"
                          id={`tagged-product-${reel.id}`}
                          style={{
                            marginLeft: "-4px",
                            width: "285.606px",
                            height: "68.3438px"
                          }}
                        >
                          <div className="w-20 shrink-0 h-full relative overflow-hidden bg-black/10 border-r border-white/10">
                            {reelProduct.imageUrl ? (
                              <img
                                src={reelProduct.imageUrl}
                                alt={reelProduct.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-amber-400">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 px-2.5 py-1.5 flex flex-col justify-between bg-black/10">
                            <span className="text-[9.5px] uppercase tracking-wider font-bold text-amber-400 flex items-center">
                              <ShoppingBag className="w-2.5 h-2.5 mr-1 shrink-0" /> Producto Destacado
                            </span>
                            <h4 className="text-xs font-bold truncate text-slate-100">{reelProduct.name}</h4>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-emerald-400 font-mono">${reelProduct.price.toFixed(2)}</span>
                              <span className="text-[9px] text-amber-400 font-semibold">Ver detalles →</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Video Progress Bar */}
                    {isCurrent && reel.type !== "image" && reel.type !== "carousel" && (
                      <ReelProgressBar
                        video={activeVideoElement || videoRefs.current[index]}
                        isActive={isCurrent}
                      />
                    )}

                    {/* Lateral Interaction Bar on Mobile (inside Frame) */}
                    <div
                      className="md:hidden absolute right-2.5 sm:right-3.5 bottom-6 sm:bottom-8 z-20 flex flex-col items-center space-y-3.5 select-none p-0 ml-0"
                      id={`mobile-interaction-bar-${reel.id}`}
                    >
                      {/* Creator Avatar with follow button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            const target = (reel.creatorUsername && reel.creatorUsername !== "invitado")
                              ? reel.creatorUsername
                              : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user"));
                            onCreatorClick(target);
                          }}
                          className="relative rounded-full transform hover:scale-110 transition-transform cursor-pointer drop-shadow-sm"
                          id={`mobile-creator-avatar-btn-${reel.id}`}
                        >
                          <img
                            src={reel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                            alt={reel.creatorName}
                            referrerPolicy="no-referrer"
                            className="w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-full object-cover"
                          />
                        </button>
                      </div>

                      {/* Likes Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (isGuestUser) {
                              onGuestInteraction("dar me gusta");
                            } else {
                              onLikeReel(reel.id);
                            }
                          }}
                          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${
                            isLiked
                              ? "text-rose-500"
                              : "text-white hover:text-rose-400"
                          }`}
                          id={`mobile-like-btn-${reel.id}`}
                        >
                          <Heart
                            strokeWidth={2.2}
                            className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${
                              isLiked
                                ? "fill-rose-500 text-rose-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                                : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                            }`}
                          />
                        </button>
                        <span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                          {reel.likes}
                        </span>
                      </div>

                      {/* Comments Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (isGuestUser) {
                              onGuestInteraction("comentar");
                            } else {
                              setShowComments(reel.id);
                            }
                          }}
                          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-amber-400 hover:scale-115 active:scale-95 transition-all cursor-pointer"
                          id={`mobile-comment-btn-${reel.id}`}
                        >
                          <MessageCircle
                            strokeWidth={2.2}
                            className="w-8 h-7 sm:w-9 sm:h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                          />
                        </button>
                        <span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                          {reel.comments.length}
                        </span>
                      </div>

                      {/* Save (Bookmark) Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (isGuestUser) {
                              onGuestInteraction("guardar publicaciones");
                            } else {
                              onToggleSaveReel(reel.id);
                            }
                          }}
                          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center hover:scale-115 active:scale-95 transition-all cursor-pointer ${
                            savedReelIds.includes(reel.id)
                              ? "text-amber-400"
                              : "text-white hover:text-amber-300"
                          }`}
                          id={`mobile-save-btn-${reel.id}`}
                        >
                          <Bookmark
                            strokeWidth={2.2}
                            className={`w-8 h-7 sm:w-9 sm:h-8 scale-x-110 ${
                              savedReelIds.includes(reel.id)
                                ? "fill-amber-400 text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                                : "fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                            }`}
                          />
                        </button>
                        <span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                          {reel.saves ?? 0}
                        </span>
                      </div>

                      {/* Share Button */}
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (isGuestUser) {
                              onGuestInteraction("compartir");
                            } else {
                              handleShare(reel.id);
                            }
                          }}
                          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center text-white hover:text-cyan-400 hover:scale-115 active:scale-95 transition-all cursor-pointer"
                          id={`mobile-share-btn-${reel.id}`}
                        >
                          <Share2
                            strokeWidth={2.2}
                            className="w-8 h-7 sm:w-9 sm:h-8 scale-x-110 fill-white text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                          />
                        </button>
                        <span className="text-white text-xs font-bold mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                          {reel.shares}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* End of Publication Frame */}

                  {/* Lateral Interaction Bar on Desktop Web: OUTSIDE and on the right side of the video */}
                  <div
                    className="hidden md:flex flex-col items-center justify-end pb-3 lg:pb-5 space-y-4 lg:space-y-4.5 select-none shrink-0 z-20"
                    id={`interaction-bar-${reel.id}`}
                  >
                    {/* Creator Avatar with follow button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          const target = (reel.creatorUsername && reel.creatorUsername !== "invitado")
                            ? reel.creatorUsername
                            : (reel.creatorId && reel.creatorId !== "current_user" ? reel.creatorId : (reel.creatorName || "current_user"));
                          onCreatorClick(target);
                        }}
                        className="relative rounded-full transform hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-lg"
                        id={`creator-avatar-btn-${reel.id}`}
                        title={reel.creatorName}
                      >
                        <img
                          src={reel.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                          alt={reel.creatorName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover border-2 border-white/25 hover:border-amber-400 transition-colors shadow-md"
                        />
                      </button>
                    </div>

                    {/* Likes Button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          if (isGuestUser) {
                            onGuestInteraction("dar me gusta");
                          } else {
                            onLikeReel(reel.id);
                          }
                        }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg transition-all cursor-pointer ${
                          isLiked
                            ? "text-rose-500"
                            : "text-white hover:text-rose-400"
                        }`}
                        id={`like-btn-${reel.id}`}
                        title="Me gusta"
                      >
                        <Heart
                          strokeWidth={2.2}
                          className={`w-6 h-6 ${
                            isLiked
                              ? "fill-rose-500 text-rose-500"
                              : "fill-white text-white"
                          }`}
                        />
                      </button>
                      <span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">
                        {reel.likes}
                      </span>
                    </div>

                    {/* Comments Button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          if (isGuestUser) {
                            onGuestInteraction("comentar");
                          } else {
                            setShowComments(reel.id);
                          }
                        }}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg text-white hover:text-amber-400 transition-all cursor-pointer"
                        id={`comment-btn-${reel.id}`}
                        title="Comentarios"
                      >
                        <MessageCircle
                          strokeWidth={2.2}
                          className="w-6 h-6 fill-white text-white"
                        />
                      </button>
                      <span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">
                        {reel.comments.length}
                      </span>
                    </div>

                    {/* Save (Bookmark) Button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          if (isGuestUser) {
                            onGuestInteraction("guardar publicaciones");
                          } else {
                            onToggleSaveReel(reel.id);
                          }
                        }}
                        className={`w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg transition-all cursor-pointer ${
                          savedReelIds.includes(reel.id)
                            ? "text-amber-400"
                            : "text-white hover:text-amber-300"
                        }`}
                        id={`save-btn-${reel.id}`}
                        title="Guardar"
                      >
                        <Bookmark
                          strokeWidth={2.2}
                          className={`w-6 h-6 ${
                            savedReelIds.includes(reel.id)
                              ? "fill-amber-400 text-amber-400"
                              : "fill-white text-white"
                          }`}
                        />
                      </button>
                      <span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">
                        {reel.saves ?? 0}
                      </span>
                    </div>

                    {/* Share Button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          if (isGuestUser) {
                            onGuestInteraction("compartir");
                          } else {
                            handleShare(reel.id);
                          }
                        }}
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900/80 hover:bg-slate-800/90 active:scale-90 border border-white/15 backdrop-blur-md shadow-lg text-white hover:text-cyan-400 transition-all cursor-pointer"
                        id={`share-btn-${reel.id}`}
                        title="Compartir"
                      >
                        <Share2
                          strokeWidth={2.2}
                          className="w-6 h-6 fill-white text-white"
                        />
                      </button>
                      <span className="text-white/90 text-xs font-bold mt-1 drop-shadow-sm">
                        {reel.shares}
                      </span>
                    </div>
                  </div>
                </div>
                {/* End of Desktop Layout Wrapper */}
              </div>
              {/* End of Publication Container */}
            </div>
          );
        })
      )}
    </div>

      {/* Slide-Up Comments Overlay Drawer */}
      <AnimatePresence>
        {showComments && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(null)}
              className="fixed inset-0 bg-black z-50 backdrop-blur-xs"
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 inset-x-0 bg-white border-t border-white rounded-t-2xl h-[500px] max-h-[85vh] z-50 flex flex-col overflow-hidden text-slate-900 shadow-2xl font-bold"
            >
              {/* Header */}
              <div className="px-4 py-0 border-b border-white flex items-center justify-between bg-white">
                <span className="font-display font-extrabold text-sm tracking-wide text-slate-900">
                  Comentarios ({reels.find((r) => r.id === showComments)?.comments.length || 0})
                </span>
                <button
                  onClick={() => setShowComments(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {reels.find((r) => r.id === showComments)?.comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center font-bold">
                    <MessageCircle className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-extrabold text-slate-800">No hay comentarios aún</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-bold">Sé el primero en compartir tu opinión</p>
                  </div>
                ) : (
                  reels
                    .find((r) => r.id === showComments)
                    ?.comments.map((comm, cIdx) => (
                      <div key={`${comm.id || 'comment'}-${cIdx}`} className="flex space-x-3 items-start">
                        <img
                          src={comm.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                          alt={comm.username}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs"
                        />
                        <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">@{comm.username}</span>
                            <span className="text-[10px] text-slate-500 font-bold font-mono">
                              {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-900 font-bold mt-1 leading-relaxed">{comm.text}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Comment Input Form */}
              <form
                onSubmit={(e) => submitComment(e, showComments)}
                className="p-4 border-t border-slate-100 bg-white flex items-center space-x-2"
                style={{
                  paddingBottom: "max(1rem, calc(1rem + env(safe-area-inset-bottom, 0px)))",
                }}
              >
                <input
                  type="text"
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-100 text-xs rounded-full px-4 py-3 text-slate-900 font-bold border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-400"
                />
                <button
                  type="submit"
                  className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-full transition-all cursor-pointer shadow-sm shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Modal Dialog */}
      <AnimatePresence>
        {showShareModal && (
          <div className="absolute inset-0 flex items-center justify-center z-50 p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(null)}
              className="absolute inset-0 bg-black"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm relative z-10 text-slate-200 shadow-2xl"
            >
              <button
                onClick={() => setShowShareModal(null)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="font-display font-bold text-base text-slate-100 flex items-center space-x-2">
                <Share2 className="w-5 h-5 text-amber-500" />
                <span>Compartir Publicación</span>
              </h3>
              <p className="text-xs text-slate-400 mt-2">
                Comparte este video con tus amigos para descubrir nuevos productos en vivo.
              </p>

              {/* Direct copy field */}
              <div className="mt-4 flex items-center space-x-2">
                <div className="flex-1 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 font-mono truncate">
                  {window.location.origin}/reel/{showShareModal}
                </div>
                <button
                  onClick={() => copyToClipboard(showShareModal)}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer"
                >
                  {copiedLink ? "Copiado!" : "Copiar"}
                </button>
              </div>

              {/* QR and details info */}
              <div className="mt-4 border-t border-slate-800/60 pt-4 flex items-center justify-between text-[11px] text-slate-500">
                <span>Latencia de transmisión: 180ms (WebRTC)</span>
                <span className="text-amber-500/80 font-bold">LiveStream activo</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer Modal */}
      <AnimatePresence>
        {showCartDrawer && (
          <div className="fixed inset-0 z-50 flex justify-start bg-black/60 backdrop-blur-sm" id="cart-drawer-overlay">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="w-full max-w-xs sm:max-w-sm h-full bg-white border-r border-slate-200 flex flex-col shadow-2xl text-slate-900"
              id="cart-drawer-panel"
            >
              {/* Drawer Header */}
              <div 
                className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0"
                style={{
                  paddingTop: "max(2rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))"
                }}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 leading-tight">Carrito</h3>
                    <p className="text-[11px] text-slate-500 font-semibold">{totalCartCount} {totalCartCount === 1 ? 'producto' : 'productos'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllCart}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-transparent border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-slate-700 active:scale-95"
                      id="reel-cart-select-all-btn"
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                          isAllCartSelected
                            ? "bg-amber-500 text-slate-950"
                            : selectedCartIndices.length > 0
                            ? "bg-amber-200 text-amber-900"
                            : "border border-slate-300 bg-white"
                        }`}
                      >
                        {isAllCartSelected ? (
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        ) : selectedCartIndices.length > 0 ? (
                          <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" />
                        ) : null}
                      </div>
                      <span className="text-[10.5px]">
                        {isAllCartSelected ? "Quitar" : "Todo"} ({selectedCartIndices.length}/{cart.length})
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowCartDrawer(false)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    id="close-cart-drawer-btn"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12 space-y-3">
                    <div className="p-4 bg-slate-100 rounded-full border border-slate-200">
                      <ShoppingBag className="w-10 h-10 stroke-1 text-slate-400" />
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">Tu carrito está vacío</p>
                    <p className="text-xs text-slate-500 max-w-[200px]">
                      Haz clic en los productos etiquetados en los reels para añadirlos a tu carrito.
                    </p>
                    {onNavigateToShop && (
                      <button
                        onClick={() => {
                          setShowCartDrawer(false);
                          onNavigateToShop();
                        }}
                        className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20"
                        id="empty-cart-go-shop-btn"
                      >
                        Ir al Mercado
                      </button>
                    )}
                  </div>
                ) : (
                  cart.map((item, idx) => {
                    const isSelected = selectedCartIndices.includes(idx);
                    const shippingFee = item.selectedShippingCost !== undefined 
                      ? item.selectedShippingCost 
                      : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
                    const carrierName = item.selectedCarrier || item.product.selectedCarrier;

                    return (
                      <div
                        key={`${item.product.id}_${idx}`}
                        className={`flex items-stretch rounded-2xl border transition-all shadow-sm overflow-hidden h-28 shrink-0 relative ${
                          isSelected
                            ? "bg-amber-500/[0.04] border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/40"
                            : "bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-100"
                        }`}
                        id={`reel-cart-item-${item.product.id}-${idx}`}
                      >
                        <div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden flex items-center justify-center">
                          {item.product.imageUrl ? (
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                              onClick={() => {
                                setShowCartDrawer(false);
                                onProductClick(item.product);
                              }}
                            />
                          ) : (
                            <ShoppingBag className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between h-full">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4
                                className="text-xs font-extrabold text-slate-900 truncate cursor-pointer hover:text-amber-600 transition-colors"
                                onClick={() => {
                                  setShowCartDrawer(false);
                                  onProductClick(item.product);
                                }}
                              >
                                {item.product.name}
                              </h4>
                              <button
                                onClick={() => onRemoveFromCart?.(item.product.id, idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 -mt-1 -mr-1"
                                title="Eliminar producto"
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

                          {/* Quantity Controls & Bottom-Right Corner Selector */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    onUpdateCartQuantity?.(item.product.id, item.quantity - 1, idx);
                                  } else {
                                    onRemoveFromCart?.(item.product.id, idx);
                                  }
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-mono font-extrabold text-slate-900 px-1">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateCartQuantity?.(item.product.id, item.quantity + 1, idx)}
                                disabled={item.product.stock !== undefined && item.quantity >= item.product.stock}
                                className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Selector in bottom right corner */}
                            <button
                              type="button"
                              onClick={(e) => toggleItemSelection(idx, e)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 scale-105"
                                  : "bg-white border-slate-300 hover:border-amber-400 text-transparent hover:text-slate-300"
                              }`}
                              title={isSelected ? "Deseleccionar producto para pago" : "Seleccionar producto para pagar"}
                              id={`reel-cart-select-${idx}`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div 
                  className="p-4 border-t border-slate-100 bg-white space-y-2.5 shrink-0"
                  style={{ 
                    paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))'
                  }}
                >
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Subtotal ({selectedCartItems.length} de {cart.length} selec.):</span>
                    <span className="font-mono text-slate-800 font-semibold">${effectiveSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Envío estimado:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {effectiveShipping > 0 ? `$${effectiveShipping.toFixed(2)}` : "Gratis"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-100 pt-2">
                    <span>Total a Pagar:</span>
                    <span className="font-mono text-slate-950 font-black text-sm">${effectiveTotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => {
                      setShowCartDrawer(false);
                      if (onNavigateToCheckout) {
                        onNavigateToCheckout(selectedCartIndices);
                      } else if (onNavigateToShop) {
                        onNavigateToShop();
                      }
                    }}
                    disabled={selectedCartItems.length === 0}
                    className={`w-full font-black py-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1 shadow-lg ${
                      selectedCartItems.length > 0
                        ? "bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-amber-500/25"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                    id="cart-checkout-btn"
                  >
                    {selectedCartItems.length > 0 ? (
                      <>
                        <ShoppingCart className="w-4 h-4 text-slate-950" />
                        <span>Pagar ({selectedCartItems.length} {selectedCartItems.length === 1 ? 'producto' : 'productos'})</span>
                        <ArrowLeft className="w-4 h-4 rotate-180 text-slate-950" />
                      </>
                    ) : (
                      <span>Selecciona productos para pagar</span>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReelCarousel({
  images,
  onDoubleClick,
  onIndexChange,
}: {
  images: string[];
  onDoubleClick: () => void;
  onIndexChange?: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideAspectRatios, setSlideAspectRatios] = useState<{ [index: number]: boolean }>({});

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const hasMoved = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    isDragging.current = true;
    hasMoved.current = false;
    startX.current = e.pageX - containerRef.current.offsetLeft;
    scrollLeft.current = containerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > 5) {
      hasMoved.current = true;
    }
    containerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging.current || !containerRef.current) return;
    isDragging.current = false;
    if (containerRef.current) {
      const container = containerRef.current;
      const idx = Math.round(container.scrollLeft / container.clientWidth);
      container.scrollTo({
        left: idx * container.clientWidth,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.clientWidth > 0) {
      const idx = Math.round(container.scrollLeft / container.clientWidth);
      if (idx !== currentIndex && idx >= 0 && idx < images.length) {
        setCurrentIndex(idx);
        if (onIndexChange) onIndexChange(idx);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onDoubleClick={() => {
        if (!hasMoved.current) {
          onDoubleClick();
        }
      }}
      className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none select-none bg-black cursor-grab active:cursor-grabbing touch-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x pan-y" }}
    >
      {images.filter((img) => Boolean(img && typeof img === "string" && img.trim().length > 0)).map((img, idx) => (
        <div
          key={idx}
          className="w-full h-full shrink-0 snap-center flex items-center justify-center relative overflow-hidden bg-black"
          style={{ touchAction: "pan-x pan-y" }}
        >
          <img
            src={img}
            alt={`Carousel ${idx + 1}`}
            draggable={false}
            onLoad={(e) => {
              const isVert = e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.05;
              setSlideAspectRatios((prev) => ({ ...prev, [idx]: isVert }));
            }}
            className={`w-full h-full pointer-events-none select-none block object-center ${
              slideAspectRatios[idx] !== false
                ? "object-cover md:object-contain"
                : "object-contain"
            }`}
            style={{ touchAction: "pan-x pan-y" }}
            referrerPolicy="no-referrer"
          />
        </div>
      ))}
    </div>
  );
}

interface ReelVideoItemProps {
  reel: Reel;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  mediaAspectRatio?: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square';
  onVideoClick: (e: React.MouseEvent, index: number) => void;
  onDoubleTap: (reelId: string) => void;
  onAspectRatioDetected: (reelId: string, ratio: 'vertical' | 'square' | 'horizontal' | 'horizontal_or_square') => void;
  onRegisterRef: (index: number, el: HTMLVideoElement | null) => void;
}

const ReelVideoItem = memo(function ReelVideoItem({
  reel,
  index,
  isCurrent,
  isPlaying,
  isMuted,
  mediaAspectRatio,
  onVideoClick,
  onDoubleTap,
  onAspectRatioDetected,
  onRegisterRef,
}: ReelVideoItemProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Play or pause strictly based on whether this reel is in focus (isCurrent) and isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isCurrent && isPlaying) {
      video.muted = isMuted;
      video.defaultMuted = isMuted;
      video.volume = isMuted ? 0 : 1.0;
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err?.name === "AbortError" || !isPlayingRef.current || !isCurrent) return;
          if (err?.name === "NotAllowedError") {
            video.muted = true;
            video.defaultMuted = true;
            video.play().catch(() => {});
          }
        });
      }
    } else {
      video.pause();
      if (!isCurrent) {
        video.muted = true;
      }
    }
  }, [isCurrent, isPlaying, isMuted]);

  const handleRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el) {
      onRegisterRef(index, el);
    }
  }, [index, onRegisterRef]);

  // Safely release hardware decoder when THIS component unmounts from the DOM
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.muted = true;
          video.removeAttribute("src");
          video.load(); // Vital: immediately releases hardware decoder context in browser/OS
        } catch {}
      }
      onRegisterRef(index, null);
    };
  }, [index, onRegisterRef]);

  const rawVid = reel.videoUrl || (reel.thumbnailUrl?.endsWith(".mp4") ? reel.thumbnailUrl : "");
  const videoSrc = rawVid && rawVid.trim().length > 0 ? rawVid.trim() : undefined;
  const posterUrl = reel.thumbnailUrl && !reel.thumbnailUrl.includes("1618005182384") && !reel.thumbnailUrl.endsWith(".mp4")
    ? reel.thumbnailUrl
    : undefined;

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.videoHeight && video.videoWidth) {
      const ratio = video.videoWidth / video.videoHeight;
      let detected: 'vertical' | 'square' | 'horizontal' = 'vertical';
      if (ratio > 1.15) {
        detected = 'horizontal';
      } else if (ratio >= 0.85 && ratio <= 1.15) {
        detected = 'square';
      } else {
        detected = 'vertical';
      }
      onAspectRatioDetected(reel.id, detected);
    }
  };

  return (
    <video
      ref={handleRef}
      src={videoSrc}
      poster={posterUrl}
      autoPlay={isCurrent}
      playsInline
      loop
      muted={isMuted}
      preload={isCurrent ? "auto" : "metadata"}
      className={`w-full h-full block relative z-10 select-none cursor-pointer object-center ${
        (mediaAspectRatio === 'vertical' || !mediaAspectRatio)
          ? "object-cover md:object-contain"
          : "object-contain"
      }`}
      style={{ touchAction: "pan-y" }}
      onClick={(e) => onVideoClick(e, index)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleTap(reel.id);
      }}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={(e) => {
        const v = e.currentTarget;
        if (isCurrent && isPlaying && v.paused) {
          v.play().catch(() => {
            v.muted = true;
            v.defaultMuted = true;
            v.play().catch(() => {});
          });
        }
      }}
    />
  );
});

