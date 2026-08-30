import React, { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Share2, ShoppingBag, ShoppingCart, Volume2, VolumeX, Send, X, Play, Bookmark, Trash2, Check, ArrowLeft, Plus, Minus } from "lucide-react";
import { Reel, Product, Comment, User, CartItem } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../config";

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
  const [displayCount, setDisplayCount] = useState<number>(() => Math.max(reels.length * 2, 8));
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [likedAnim, setLikedAnim] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [mediaLoading, setMediaLoading] = useState<{ [key: string]: boolean }>({});
  const [carouselIndices, setCarouselIndices] = useState<{ [key: string]: number }>({});
  const [mediaAspectRatios, setMediaAspectRatios] = useState<{ [key: string]: 'vertical' | 'horizontal_or_square' }>({});

  // Reset or extend displayCount when reels source changes
  useEffect(() => {
    if (reels.length > 0) {
      setDisplayCount((prev) => Math.max(prev, reels.length * 2, 8));
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

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  useEffect(() => {
    // Play active video immediately, pause others, and proactively preload/buffer adjacent reels
    displayedReels.forEach((reel, idx) => {
      const video = videoRefs.current[idx];
      if (video) {
        if (idx === activeReelIndex) {
          if (isPlaying) {
            video.muted = isMuted;
            video.defaultMuted = isMuted;
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                // If browser blocks unmuted autoplay without user interaction, mute and retry immediately
                if (err?.name === "NotAllowedError" && !video.muted) {
                  video.muted = true;
                  video.play().catch(() => {});
                }
              });
            }
          } else {
            video.pause();
          }
        } else {
          video.pause();
          // For adjacent reels (next 2 and previous 1), set preload to auto and load buffer ahead of time
          const dist = Math.abs(idx - activeReelIndex);
          if (dist <= 2) {
            video.preload = "auto";
            if (video.readyState === 0 && reel.videoUrl) {
              video.load();
            }
          } else if (dist > 3) {
            // Far away reels: pause and reset time to release GPU memory
            video.currentTime = 0;
          }
        }
      }
    });

    // Proactively pre-fetch next upcoming video URLs in the network cache
    const nextReels = [
      displayedReels[activeReelIndex + 1]?.videoUrl,
      displayedReels[activeReelIndex + 2]?.videoUrl
    ].filter(Boolean);

    nextReels.forEach((url) => {
      if (url && typeof document !== "undefined") {
        const existing = document.querySelector(`link[href="${url}"]`);
        if (!existing) {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.as = "video";
          link.href = url;
          document.head.appendChild(link);
        }
      }
    });
  }, [activeReelIndex, displayedReels, isPlaying, isMuted]);

  // Handle scroll detection for snap scroll & continuous infinite expansion
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    const childHeight = container.clientHeight;
    if (!childHeight) return;
    const index = Math.round(scrollPos / childHeight);
    if (index !== activeReelIndex && index >= 0 && index < displayedReels.length) {
      setActiveReelIndex(index);
      setIsPlaying(true);
    }

    // Trigger infinite scroll expansion as we approach the end of the loaded reel batch
    if (index >= displayedReels.length - 2 && reels.length > 0) {
      setDisplayCount((prev) => prev + Math.max(reels.length, 6));
    }
  };

  const handleVideoClick = (index: number) => {
    const video = videoRefs.current[index];
    if (video) {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        video.play().catch(() => {});
        setIsPlaying(true);
      }
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

  // Reset time and duration state on active reel change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    const video = videoRefs.current[activeReelIndex];
    if (video) {
      setCurrentTime(video.currentTime || 0);
      setDuration(video.duration || 0);
    }
  }, [activeReelIndex]);

  const handleSeekFromEvent = (clientX: number) => {
    if (!progressBarRef.current || !currentReel || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    const video = videoRefs.current[activeReelIndex];
    if (video) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSeekFromEvent(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    handleSeekFromEvent(clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        handleSeekFromEvent(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isScrubbing && e.touches[0]) {
        handleSeekFromEvent(e.touches[0].clientX);
      }
    };

    if (isScrubbing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isScrubbing, duration, currentReel]);

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
            onClick={() => setIsMuted(!isMuted)}
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
                className="w-full shrink-0 snap-start snap-always relative flex items-center justify-center bg-slate-950 overflow-hidden py-0 px-0"
                style={{
                  height: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  minHeight: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  maxHeight: containerHeight > 0 ? `${containerHeight}px` : "100%",
                  scrollSnapAlign: "start",
                  scrollSnapStop: "always",
                }}
              >
                {/* Full-Width Publication Container */}
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  {/* Publication Frame: 100% width and full viewport height */}
                  <div
                    className="relative w-full h-full rounded-none overflow-hidden flex items-center justify-center bg-black"
                  >
                    {/* Media Element: 100% width and height */}
                    {reel.type === "image" ? (
                      <img
                        src={(reel.images?.[0] && !reel.images[0].includes("1618005182384")) ? reel.images[0] : (reel.thumbnailUrl && !reel.thumbnailUrl.includes("1618005182384") ? reel.thumbnailUrl : "")}
                        alt={reel.description}
                        draggable={false}
                        onClick={() => setIsPlaying(!isPlaying)}
                        onDoubleClick={() => handleDoubleTap(reel.id)}
                        onLoadStart={() => setMediaLoading((prev) => ({ ...prev, [reel.id]: true }))}
                        onLoad={(e) => {
                          setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                          const isVert = e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.08;
                          setMediaAspectRatios((prev) => ({
                            ...prev,
                            [reel.id]: isVert ? "vertical" : "horizontal_or_square",
                          }));
                        }}
                        onError={() => setMediaLoading((prev) => ({ ...prev, [reel.id]: false }))}
                        className={`w-full h-full cursor-pointer select-none block touch-auto ${
                          mediaAspectRatios[reel.id] === "horizontal_or_square"
                            ? "object-contain"
                            : "object-cover"
                        }`}
                        style={{ touchAction: "pan-y" }}
                        referrerPolicy="no-referrer"
                      />
                    ) : reel.type === "carousel" ? (
                      <div className="w-full h-full flex items-center justify-center bg-black">
                        <ReelCarousel 
                          images={(reel.images || [reel.thumbnailUrl]).filter((img): img is string => !!img && !img.includes("1618005182384"))} 
                          onDoubleClick={() => handleDoubleTap(reel.id)}
                          onIndexChange={(idx) => setCarouselIndices((prev) => ({ ...prev, [`${reel.id}_${index}`]: idx }))}
                        />
                      </div>
                    ) : (
                      <video
                        ref={(el) => {
                          videoRefs.current[index] = el;
                          if (el) {
                            el.muted = isMuted;
                            el.defaultMuted = isMuted;
                          }
                        }}
                        src={reel.videoUrl}
                        poster={(reel.thumbnailUrl && !reel.thumbnailUrl.includes("1618005182384") && !reel.thumbnailUrl.endsWith(".mp4")) ? reel.thumbnailUrl : undefined}
                        loop
                        autoPlay={isCurrent}
                        muted={isMuted}
                        playsInline
                        // @ts-ignore
                        webkit-playsinline="true"
                        // @ts-ignore
                        x5-playsinline="true"
                        // @ts-ignore
                        x5-video-player-type="h5-page"
                        disablePictureInPicture
                        disableRemotePlayback
                        controls={false}
                        preload={Math.abs(index - activeReelIndex) <= 2 ? "auto" : "metadata"}
                        onClick={() => handleVideoClick(index)}
                        onDoubleClick={() => handleDoubleTap(reel.id)}
                        onLoadStart={() => {
                          if (isCurrent) {
                            setMediaLoading((prev) => ({ ...prev, [reel.id]: true }));
                          }
                        }}
                        onWaiting={() => {
                          if (isCurrent) {
                            setMediaLoading((prev) => ({ ...prev, [reel.id]: true }));
                          }
                        }}
                        onPlaying={() => {
                          setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                        }}
                        onCanPlay={(e) => {
                          setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                          if (isCurrent && isPlaying) {
                            const p = e.currentTarget.play();
                            if (p !== undefined) {
                              p.catch(() => {});
                            }
                          }
                        }}
                        onLoadedData={() => {
                          setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                        }}
                        onError={() => {
                          setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                        }}
                        onTimeUpdate={(e) => {
                          if (isCurrent) {
                            if (mediaLoading[reel.id]) {
                              setMediaLoading((prev) => ({ ...prev, [reel.id]: false }));
                            }
                            setCurrentTime(e.currentTarget.currentTime);
                            setDuration(e.currentTarget.duration || 0);
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          if (isCurrent) {
                            setDuration(e.currentTarget.duration || 0);
                          }
                          const isVert = e.currentTarget.videoHeight > e.currentTarget.videoWidth * 1.08;
                          setMediaAspectRatios((prev) => ({
                            ...prev,
                            [reel.id]: isVert ? "vertical" : "horizontal_or_square",
                          }));
                        }}
                        className={`w-full h-full cursor-pointer block bg-black ${
                          mediaAspectRatios[reel.id] === "horizontal_or_square"
                            ? "object-contain"
                            : "object-cover"
                        }`}
                      />
                    )}

                    {/* Black Loading Spinner Overlay for Media Buffering */}
                    {isCurrent && mediaLoading[reel.id] && (
                      <div className="absolute inset-0 z-15 bg-black flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300">
                        <div className="w-10 h-10 border-2 border-white/20 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-[11px] text-white/60 font-semibold tracking-wider mt-3">Cargando publicación...</span>
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
                    <div className="absolute left-4 sm:left-6 bottom-4 sm:bottom-6 right-20 sm:right-24 z-20 flex flex-col space-y-3 max-w-xl">
                      {/* Creator Info and Description */}
                      <div
                        className="text-white bg-transparent p-3 rounded-xl drop-shadow-md"
                        style={{ marginLeft: "-15px", marginBottom: "-10px" }}
                      >
                        <h3 className="font-display font-bold text-base sm:text-lg tracking-wide flex items-center space-x-2.5">
                          <span
                            className="cursor-pointer hover:underline text-white font-bold drop-shadow-sm"
                            onClick={() => onCreatorClick(reel.creatorId)}
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
                            <img
                              src={reelProduct.imageUrl}
                              alt={reelProduct.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
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
                    {isCurrent && reel.type !== "image" && reel.type !== "carousel" && duration > 0 && (
                      <div
                        ref={progressBarRef}
                        className="absolute bottom-0 left-0 right-0 z-30 h-3 flex items-end cursor-pointer group select-none touch-none"
                        onClick={handleProgressBarClick}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        id="video-progress-bar"
                      >
                        {/* Background Track with uniform solid thickness */}
                        <div className="w-full h-[3px] bg-white/30 backdrop-blur-md relative overflow-hidden">
                          {/* Filled Progress */}
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.9)] transition-all duration-75 relative"
                            style={{ width: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%` }}
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lateral Interaction Bar (Likes, Comments, Saves, Shares, Avatar) */}
                  <div
                    className="absolute right-3.5 sm:right-6 bottom-6 sm:bottom-8 z-20 flex flex-col items-center space-y-3.5 select-none p-0 ml-0 -mr-[5px]"
                    id={`interaction-bar-${reel.id}`}
                  >
                    {/* Creator Avatar with follow button */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => onCreatorClick(reel.creatorId)}
                        className="relative rounded-full transform hover:scale-110 transition-transform cursor-pointer drop-shadow-sm"
                        id={`creator-avatar-btn-${reel.id}`}
                      >
                        <img
                          src={reel.creatorAvatar}
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
                        id={`like-btn-${reel.id}`}
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
                        id={`comment-btn-${reel.id}`}
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
                        id={`save-btn-${reel.id}`}
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
                        id={`share-btn-${reel.id}`}
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {reels.find((r) => r.id === showComments)?.comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center font-bold">
                    <MessageCircle className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm font-extrabold text-slate-800">No hay comentarios aún</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-bold">Sé el primero en compartir tu opinión</p>
                  </div>
                ) : (
                  reels
                    .find((r) => r.id === showComments)
                    ?.comments.map((comm) => (
                      <div key={comm.id} className="flex space-x-3 items-start">
                        <img
                          src={comm.avatar}
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
                        <div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden">
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
      {images.map((img, idx) => (
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
              const isVert = e.currentTarget.naturalHeight > e.currentTarget.naturalWidth * 1.08;
              setSlideAspectRatios((prev) => ({ ...prev, [idx]: isVert }));
            }}
            className={`w-full h-full pointer-events-none select-none block ${
              slideAspectRatios[idx] ? "object-cover" : "object-contain"
            }`}
            style={{ touchAction: "pan-x pan-y" }}
            referrerPolicy="no-referrer"
          />
        </div>
      ))}
    </div>
  );
}
