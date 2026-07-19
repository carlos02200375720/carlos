import React, { useState, useEffect, useRef } from "react";
import { Heart, MessageCircle, Share2, ShoppingBag, Volume2, VolumeX, Send, X, Play, Bookmark } from "lucide-react";
import { Reel, Product, Comment, User } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface ReelsViewProps {
  reels: Reel[];
  currentUser: User;
  onProductClick: (product: Product) => void;
  onCreatorClick: (creatorId: string) => void;
  onLikeReel: (reelId: string) => void;
  onAddComment: (reelId: string, text: string) => void;
  savedReelIds: string[];
  onToggleSaveReel: (reelId: string) => void;
  onGuestInteraction: (action: string) => void;
}

export default function ReelsView({
  reels,
  currentUser,
  onProductClick,
  onCreatorClick,
  onLikeReel,
  onAddComment,
  savedReelIds,
  onToggleSaveReel,
  onGuestInteraction,
}: ReelsViewProps) {
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [likedAnim, setLikedAnim] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  useEffect(() => {
    // Play active video, pause others
    reels.forEach((reel, idx) => {
      const video = videoRefs.current[reel.id];
      if (video) {
        if (idx === activeReelIndex && isPlaying) {
          video.play().catch(() => {
            // Browser blocked autoplay
          });
        } else {
          video.pause();
        }
      }
    });
  }, [activeReelIndex, reels, isPlaying]);

  // Handle scroll detection for snap scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    const childHeight = container.clientHeight;
    const index = Math.round(scrollPos / childHeight);
    if (index !== activeReelIndex && index >= 0 && index < reels.length) {
      setActiveReelIndex(index);
      setIsPlaying(true);
    }
  };

  const handleVideoClick = (reelId: string) => {
    const video = videoRefs.current[reelId];
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

  const handleDoubleTap = (reelId: string) => {
    if (currentUser?.username === "invitado") {
      onGuestInteraction("dar me gusta");
      return;
    }
    onLikeReel(reelId);
    setLikedAnim(reelId);
    setTimeout(() => setLikedAnim(null), 800);
  };

  const handleShare = (reelId: string) => {
    if (currentUser?.username === "invitado") {
      onGuestInteraction("compartir publicaciones");
      return;
    }
    setShowShareModal(reelId);
    setCopiedLink(false);
  };

  const copyToClipboard = (reelId: string) => {
    const dummyUrl = `${window.location.origin}/reel/${reelId}`;
    navigator.clipboard.writeText(dummyUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const currentReel = reels[activeReelIndex];

  // Look up tagged product details
  const [taggedProduct, setTaggedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (currentReel?.productId) {
      fetch(`/api/products/${currentReel.productId}`)
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) setTaggedProduct(data);
        })
        .catch(() => setTaggedProduct(null));
    } else {
      setTaggedProduct(null);
    }
  }, [currentReel]);

  const [navBarHeight, setNavBarHeight] = useState(64);

  useEffect(() => {
    const navBar = document.getElementById("bottom-nav-bar");
    if (navBar) {
      setNavBarHeight(navBar.offsetHeight);
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setNavBarHeight(entry.target.clientHeight);
        }
      });
      observer.observe(navBar);
      return () => observer.disconnect();
    }
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
      style={{ height: `calc(100dvh - ${navBarHeight}px)` }}
    >
      {/* Scrollable Feed Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar relative"
        style={{ scrollbarWidth: "none" }}
      >
        {reels.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <Play className="w-12 h-12 stroke-1 text-slate-600 mb-3 animate-pulse" />
            <p className="font-display font-medium text-slate-300">No hay videos disponibles</p>
            <p className="text-xs text-slate-500 mt-1">Sube contenido o inicia una transmisión para empezar</p>
          </div>
        ) : (
          reels.map((reel, index) => {
            const isCurrent = index === activeReelIndex;
            return (
              <div
                key={reel.id}
                className="h-full w-full snap-start relative flex items-center justify-center bg-black overflow-hidden"
                style={{ height: "100%" }}
              >
                {/* Type-Responsive Media Element */}
                {reel.type === "image" ? (
                  <img
                    src={reel.images?.[0] || reel.thumbnailUrl}
                    alt={reel.description}
                    onClick={() => setIsPlaying(!isPlaying)}
                    onDoubleClick={() => handleDoubleTap(reel.id)}
                    className="w-full h-full object-cover cursor-pointer"
                    referrerPolicy="no-referrer"
                  />
                ) : reel.type === "carousel" ? (
                  <ReelCarousel 
                    images={reel.images || [reel.thumbnailUrl]} 
                    onDoubleClick={() => handleDoubleTap(reel.id)}
                  />
                ) : (
                  <video
                    ref={(el) => {
                      videoRefs.current[reel.id] = el;
                    }}
                    src={reel.videoUrl}
                    loop
                    muted={isMuted}
                    playsInline
                    onClick={() => handleVideoClick(reel.id)}
                    onDoubleClick={() => handleDoubleTap(reel.id)}
                    className="w-full h-full object-cover cursor-pointer"
                  />
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

                {/* Header Controls (Mute / Sound) */}
                <div className="absolute top-4 right-4 z-20">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2.5 rounded-full bg-slate-900/60 backdrop-blur-md text-white border border-white/10 hover:bg-slate-900/80 transition-colors cursor-pointer"
                    id={`mute-btn-${reel.id}`}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                </div>

                {/* Lateral Interaction Bar (Likes, Comments, Shares, Avatar) */}
                <div
                  className="absolute right-3 z-20 flex flex-col items-center space-y-6"
                  style={{ bottom: "5px" }}
                >
                  {/* Creator Avatar with follow button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => onCreatorClick(reel.creatorId)}
                      className="relative border-2 border-amber-500 rounded-full p-0.5 shadow-md transform hover:scale-110 transition-transform cursor-pointer"
                      id={`creator-avatar-btn-${reel.id}`}
                    >
                      <img
                        src={reel.creatorAvatar}
                        alt={reel.creatorName}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover"
                      />
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-[9px] font-bold text-slate-950 px-1 rounded-full border border-slate-950">
                        LIVE
                      </span>
                    </button>
                  </div>

                  {/* Likes Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (currentUser?.username === "invitado") {
                          onGuestInteraction("dar me gusta");
                        } else {
                          onLikeReel(reel.id);
                        }
                      }}
                      className="p-3 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white hover:text-rose-500 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      id={`like-btn-${reel.id}`}
                    >
                      <Heart className="w-5 h-5 fill-white/10 text-white" />
                    </button>
                    <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
                      {reel.likes}
                    </span>
                  </div>

                  {/* Comments Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (currentUser?.username === "invitado") {
                          onGuestInteraction("comentar");
                        } else {
                          setShowComments(reel.id);
                        }
                      }}
                      className="p-3 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white hover:text-amber-400 hover:scale-110 transition-all cursor-pointer"
                      id={`comment-btn-${reel.id}`}
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                    <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
                      {reel.comments.length}
                    </span>
                  </div>

                  {/* Share Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (currentUser?.username === "invitado") {
                          onGuestInteraction("compartir");
                        } else {
                          handleShare(reel.id);
                        }
                      }}
                      className="p-3 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 text-white hover:text-cyan-400 hover:scale-110 transition-all cursor-pointer"
                      id={`share-btn-${reel.id}`}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <span className="text-white text-xs font-semibold mt-1 drop-shadow-md">
                      {reel.shares}
                    </span>
                  </div>

                  {/* Save (Bookmark) Button */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (currentUser?.username === "invitado") {
                          onGuestInteraction("guardar publicaciones");
                        } else {
                          onToggleSaveReel(reel.id);
                        }
                      }}
                      className={`p-3 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 hover:scale-110 active:scale-95 transition-all cursor-pointer ${savedReelIds.includes(reel.id) ? "text-amber-500" : "text-white hover:text-amber-400"}`}
                      id={`save-btn-${reel.id}`}
                    >
                      <Bookmark className={`w-5 h-5 ${savedReelIds.includes(reel.id) ? "fill-amber-500" : ""}`} />
                    </button>
                    <span className="text-white text-[10px] font-bold mt-1 drop-shadow-md uppercase tracking-tight">
                      {savedReelIds.includes(reel.id) ? "Guardado" : "Guardar"}
                    </span>
                  </div>
                </div>

                {/* Bottom Info Banner (Creator, Description, Tagged Product) */}
                <div className="absolute left-4 bottom-4 right-16 z-20 flex flex-col space-y-3">
                  {/* Creator Info and Description */}
                  <div className="text-white bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 rounded-xl backdrop-blur-[1px]">
                    <h3
                      className="font-display font-bold text-sm tracking-wide flex items-center space-x-1.5 cursor-pointer hover:underline"
                      onClick={() => onCreatorClick(reel.creatorId)}
                    >
                      <span>@{reel.creatorName.toLowerCase().replace(/\s+/g, "")}</span>
                      <span className="bg-amber-500/20 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                        Vendedor
                      </span>
                    </h3>
                    <p className="text-xs text-slate-200 mt-1 line-clamp-2 leading-relaxed">
                      {reel.description}
                    </p>
                  </div>

                  {/* Tagged Product Box */}
                  {taggedProduct && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      onClick={() => onProductClick(taggedProduct)}
                      className="glass-panel text-white p-2.5 rounded-xl flex items-center space-x-3 cursor-pointer hover:bg-white/10 hover:border-amber-500/30 active:scale-[0.98] transition-all"
                      id={`tagged-product-${reel.id}`}
                    >
                      <img
                        src={taggedProduct.imageUrl}
                        alt={taggedProduct.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 object-cover rounded-lg border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 flex items-center space-x-1">
                          <ShoppingBag className="w-2.5 h-2.5 mr-0.5" /> Producto Destacado
                        </span>
                        <h4 className="text-xs font-bold truncate text-slate-100 mt-0.5">{taggedProduct.name}</h4>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs font-semibold text-emerald-400 font-mono">${taggedProduct.price.toFixed(2)}</span>
                          <span className="text-[9px] text-amber-500 font-medium">Ver detalles →</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
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
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComments(null)}
              className="absolute inset-0 bg-black z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 rounded-t-2xl h-[450px] z-50 flex flex-col overflow-hidden text-slate-100"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <span className="font-display font-bold text-sm tracking-wide">
                  Comentarios ({reels.find((r) => r.id === showComments)?.comments.length || 0})
                </span>
                <button
                  onClick={() => setShowComments(null)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {reels.find((r) => r.id === showComments)?.comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                    <MessageCircle className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-sm">No hay comentarios aún</p>
                    <p className="text-xs text-slate-600 mt-0.5">Sé el primero en compartir tu opinión</p>
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
                          className="w-8 h-8 rounded-full object-cover border border-slate-800"
                        />
                        <div className="flex-1 bg-slate-800/50 p-2.5 rounded-2xl border border-slate-800/30">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">@{comm.username}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{comm.text}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Comment Input Form */}
              <form
                onSubmit={(e) => submitComment(e, showComments)}
                className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center space-x-2"
              >
                <input
                  type="text"
                  placeholder="Escribe un comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-800 text-xs rounded-xl px-4 py-3 text-white border border-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="p-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl transition-all cursor-pointer"
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
    </div>
  );
}

function ReelCarousel({ images, onDoubleClick }: { images: string[]; onDoubleClick: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black select-none" onDoubleClick={onDoubleClick}>
      <img
        src={images[currentIndex]}
        alt={`Carousel ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      {images.length > 1 && (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={prevImage}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer z-10"
          >
            ←
          </button>
          <button
            onClick={nextImage}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-colors cursor-pointer z-10"
          >
            →
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
            {images.map((_, idx) => (
              <span
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? "bg-amber-500 scale-125" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
