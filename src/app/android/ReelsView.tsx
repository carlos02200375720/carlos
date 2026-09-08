import React, { useState, useRef, useEffect, useCallback } from "react";
import { Reel, Product, User, Comment, CartItem } from "../../types";
import { Heart, MessageCircle, Share2, Bookmark, ShoppingBag, Volume2, VolumeX, Plus, Send, X } from "lucide-react";
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
  isMuted?: boolean;
  onToggleMute?: () => void;
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
  isMuted: propIsMuted,
  onToggleMute: propOnToggleMute,
}: AndroidReelsViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localMuted, setLocalMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authDescription, setAuthDescription] = useState("");

  const isMuted = propIsMuted !== undefined ? propIsMuted : localMuted;
  const toggleMute = propOnToggleMute || (() => setLocalMuted((m) => !m));

  const playerRef = useRef<AndroidVideoPlayerHandle>(null);
  const touchStartY = useRef<number>(0);
  const isGuest = !currentUser || currentUser.isGuest || currentUser.username === "invitado";

  const currentReel = reels[currentIndex] || reels[0];

  const handleProductSelect = onProductClick || onSelectProduct;

  const handleNext = useCallback(() => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, reels.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    const SWIPE_THRESHOLD = 50;

    if (diff > SWIPE_THRESHOLD) {
      handleNext();
    } else if (diff < -SWIPE_THRESHOLD) {
      handlePrev();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") handleNext();
      if (e.key === "ArrowUp") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  if (!currentReel) {
    return (
      <div className="w-full h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="text-sm font-semibold text-slate-400">No hay Reels disponibles en este momento.</p>
      </div>
    );
  }

  const isLiked = currentReel.likedBy?.includes(currentUser?.originalId || currentUser?.id) || false;
  const isSaved = savedReelIds.includes(currentReel.id);
  const taggedProduct = products.find((p) => p.id === (currentReel.productId || (currentReel as any).taggedProductId));
  const isFollowing = currentUser?.followingUserIds?.includes(currentReel.creatorId) || false;

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
      className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center select-none font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      id="android-reels-view"
    >
      <AndroidVideoPlayer
        ref={playerRef}
        src={currentReel.videoUrl}
        hlsUrl={currentReel.hlsUrl}
        poster={currentReel.thumbnailUrl}
        autoPlay={true}
        loop={true}
        muted={isMuted}
        isCurrent={isFeedActive}
        onDoubleTap={handleDoubleTap}
        className="w-full h-full object-cover"
      />

      <AndroidProgressBar
        video={playerRef.current?.getVideoElement() || null}
        isActive={isFeedActive}
      />

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

      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/40 text-white backdrop-blur-md active:scale-95 transition-transform"
        id="android-mute-toggle"
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Right Actions */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center space-y-4 text-white">
        <div className="relative mb-2">
          <img
            src={currentReel.creatorAvatar}
            alt={currentReel.creatorUsername}
            onClick={handleCreatorNav}
            className="w-11 h-11 rounded-full object-cover border-2 border-amber-500 shadow-md cursor-pointer"
          />
          {!isFollowing && currentUser?.id !== currentReel.creatorId && onToggleFollowUser && (
            <button
              onClick={() => onToggleFollowUser(currentReel.creatorId)}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow"
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
          className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
        >
          <div className={`p-3 rounded-full backdrop-blur-md ${isLiked ? "bg-rose-500 text-white" : "bg-black/40 text-white"}`}>
            <Heart className={`w-6 h-6 ${isLiked ? "fill-white" : ""}`} />
          </div>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">{currentReel.likes || 0}</span>
        </button>

        <button
          onClick={() => setShowComments(true)}
          className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
        >
          <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md">
            <MessageCircle className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">{currentReel.comments?.length || 0}</span>
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
          className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
        >
          <div className={`p-3 rounded-full backdrop-blur-md ${isSaved ? "bg-amber-500 text-slate-950" : "bg-black/40 text-white"}`}>
            <Bookmark className={`w-6 h-6 ${isSaved ? "fill-slate-950" : ""}`} />
          </div>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">Guardar</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
        >
          <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md">
            <Share2 className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold mt-1 drop-shadow-md">Compartir</span>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-6 left-4 right-16 z-30 pointer-events-none text-white drop-shadow-lg">
        {taggedProduct && handleProductSelect && (
          <div
            onClick={() => handleProductSelect(taggedProduct)}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/40 backdrop-blur-md mb-2 pointer-events-auto cursor-pointer active:scale-95 transition-transform"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white line-clamp-1">{taggedProduct.name}</span>
            <span className="text-xs font-black text-amber-400">${taggedProduct.price}</span>
          </div>
        )}

        <h3 className="text-sm font-bold text-white">@{currentReel.creatorUsername}</h3>
        <p className="text-xs text-slate-200 mt-1 line-clamp-2">{currentReel.description}</p>
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
