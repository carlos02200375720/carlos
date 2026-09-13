import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  ArrowLeft,
  X,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ShoppingBag,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Trash2,
  Send,
  UserPlus,
  UserCheck,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Reel, Product, Comment, User } from "../../../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../../config";
import { ReelProgressBar } from "./ReelProgressBar";

interface UserPublicationsFeedProps {
  user: User;
  reels: Reel[];
  products?: Product[];
  initialReelId: string;
  currentUser: User;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
  onToggleFollowUser?: (creatorId: string) => void;
  onDeleteReel?: (reelId: string) => void;
  onUpdateReels?: (reels: Reel[]) => void;
  savedReelIds?: string[];
  onToggleSaveReel?: (reelId: string) => void;
}

// Dedicated single video item to ensure stable refs and prevent decoder memory leaks
interface UserReelVideoProps {
  reel: Reel;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onDoubleTap: () => void;
  onRegisterRef: (index: number, el: HTMLVideoElement | null) => void;
}

const UserReelVideo = memo(function UserReelVideo({
  reel,
  index,
  isCurrent,
  isPlaying,
  isMuted,
  onTogglePlay,
  onDoubleTap,
  onRegisterRef,
}: UserReelVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Synchronize playback with active focus
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isCurrent && isPlaying) {
      video.muted = isMuted;
      video.volume = isMuted ? 0 : 1.0;
      const p = video.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err?.name === "AbortError" || !isPlayingRef.current || !isCurrent) return;
          if (err?.name === "NotAllowedError") {
            video.muted = true;
            video.play().catch(() => {});
          }
        });
      }
    } else {
      video.pause();
    }
  }, [isCurrent, isPlaying, isMuted]);

  // Clean unmount - pause video safely
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
        } catch {}
      }
      onRegisterRef(index, null);
    };
  }, [index, onRegisterRef]);

  const rawVid = reel.hlsUrl || "";
  const videoSrc = rawVid && rawVid.trim().length > 0 && rawVid.includes(".m3u8") ? rawVid.trim() : undefined;
  const posterUrl =
    reel.thumbnailUrl && !reel.thumbnailUrl.endsWith(".m3u8") ? reel.thumbnailUrl : undefined;

  const handlePointerDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    if (timeSinceLastTap < 300) {
      // Double tap detected
      onDoubleTap();
    } else {
      onTogglePlay();
    }
    lastTapRef.current = now;
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-black cursor-pointer select-none"
      onClick={handlePointerDown}
    >
      {videoSrc ? (
        <video
          ref={(el) => {
            videoRef.current = el;
            onRegisterRef(index, el);
          }}
          src={videoSrc}
          poster={posterUrl}
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload={isCurrent ? "auto" : "metadata"}
          loop
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={reel.description || "Publicación"}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-white/40 flex flex-col items-center">
              <Play className="w-12 h-12 stroke-1 mb-2" />
              <p className="text-xs">Video no disponible</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const dedupeReels = (list: Reel[]): Reel[] => {
  const seen = new Set<string>();
  return (list || []).filter((r) => {
    if (!r || !r.id || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
};

export default function UserPublicationsFeed({
  user,
  reels: initialReels,
  products = [],
  initialReelId,
  currentUser,
  onClose,
  onSelectProduct,
  onToggleFollowUser,
  onDeleteReel,
  onUpdateReels,
  savedReelIds = [],
  onToggleSaveReel,
}: UserPublicationsFeedProps) {
  // Local list of reels to allow instantaneous optimistic updates
  const [reels, setReels] = useState<Reel[]>(() => dedupeReels(initialReels));

  // Keep synced if parent's reels change
  useEffect(() => {
    setReels(dedupeReels(initialReels));
  }, [initialReels]);

  // Determine starting index from the clicked publication
  const initialIndex = Math.max(
    0,
    reels.findIndex((r) => r.id === initialReelId)
  );

  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showPlayIcon, setShowPlayIcon] = useState<boolean>(false);
  const [heartAnim, setHeartAnim] = useState<string | null>(null);
  const [expandedDesc, setExpandedDesc] = useState<{ [key: string]: boolean }>({});
  const [showCommentsForReel, setShowCommentsForReel] = useState<Reel | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deletingReelId, setDeletingReelId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const isInitialScrollDone = useRef(false);

  // Register video refs safely
  const handleRegisterRef = useCallback((idx: number, el: HTMLVideoElement | null) => {
    if (!el) {
      delete videoRefs.current[idx];
    } else {
      videoRefs.current[idx] = el;
    }
  }, []);

  // Stop all video instances on unmount to eliminate background audio
  useEffect(() => {
    return () => {
      Object.keys(videoRefs.current).forEach((key) => {
        const v = videoRefs.current[Number(key)];
        if (v) {
          try {
            v.pause();
          } catch {}
        }
      });
      videoRefs.current = {};
    };
  }, []);

  // Pause playback when browser tab or app window is hidden
  useEffect(() => {
    const handleVisChange = () => {
      if (document.hidden) {
        const activeVideo = videoRefs.current[activeIndex];
        if (activeVideo) {
          try {
            activeVideo.pause();
          } catch {}
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
    };
  }, [activeIndex]);

  // Jump to the clicked publication on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targetScroll = initialIndex * container.clientHeight;
    container.scrollTo({
      top: targetScroll,
      behavior: "instant" as ScrollBehavior,
    });
    isInitialScrollDone.current = true;
  }, [initialIndex]);

  // Handle scroll snap detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollPos = container.scrollTop;
    const itemHeight = container.clientHeight;
    if (!itemHeight) return;

    const newIndex = Math.round(scrollPos / itemHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      // Pause prior video
      const prevVideo = videoRefs.current[activeIndex];
      if (prevVideo) {
        try {
          prevVideo.pause();
          prevVideo.muted = true;
        } catch {}
      }

      setActiveIndex(newIndex);
      setIsPlaying(true);

      // Register view
      const targetReel = reels[newIndex];
      if (targetReel) {
        apiFetch(`/api/reels/${targetReel.id}/view`, { method: "POST" }).catch(() => {});
      }
    }
  };

  // Toggle play/pause on tap
  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    const activeVideo = videoRefs.current[activeIndex];
    if (activeVideo) {
      if (!next) {
        activeVideo.pause();
      } else {
        activeVideo.muted = isMuted;
        activeVideo.volume = isMuted ? 0 : 1.0;
        const p = activeVideo.play();
        if (p !== undefined) {
          p.catch((err) => {
            if (err?.name === "AbortError") return;
            if (err?.name === "NotAllowedError") {
              activeVideo.muted = true;
              activeVideo.play().catch(() => {});
            }
          });
        }
      }
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 600);
  };

  const handleClose = () => {
    setIsPlaying(false);
    Object.keys(videoRefs.current).forEach((key) => {
      const v = videoRefs.current[Number(key)];
      if (v) {
        try {
          v.pause();
          v.muted = true;
        } catch {}
      }
    });
    onClose();
  };

  // Double tap to like
  const handleDoubleTap = (reel: Reel) => {
    setHeartAnim(reel.id);
    setTimeout(() => setHeartAnim(null), 800);
    handleLikeReel(reel);
  };

  // Like publication
  const handleLikeReel = (reel: Reel) => {
    const isLiked =
      currentUser &&
      ((currentUser.id && reel.likedBy?.includes(currentUser.id)) ||
        (currentUser.username && reel.likedBy?.includes(currentUser.username)) ||
        (currentUser.originalId && reel.likedBy?.includes(currentUser.originalId)));

    const nextLikes = isLiked ? Math.max(0, reel.likes - 1) : reel.likes + 1;
    const nextLikedBy = isLiked
      ? (reel.likedBy || []).filter(
          (u) =>
            u !== currentUser.id &&
            u !== currentUser.username &&
            u !== currentUser.originalId
        )
      : [...(reel.likedBy || []), currentUser.id || currentUser.username];

    const updated = reels.map((r) =>
      r.id === reel.id ? { ...r, likes: nextLikes, likedBy: nextLikedBy } : r
    );
    setReels(updated);
    if (onUpdateReels) onUpdateReels(updated);

    apiFetch(`/api/reels/${reel.id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUser.id,
        username: currentUser.username,
      }),
    }).catch((err) => console.error("Error liking reel:", err));
  };

  // Add comment
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCommentsForReel || !commentText.trim() || isSubmittingComment) return;

    const reelId = showCommentsForReel.id;
    const newComment: Comment = {
      id: `comm_${Date.now()}`,
      username: currentUser.username || "Usuario",
      avatar: currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80",
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    };

    setIsSubmittingComment(true);
    setCommentText("");

    try {
      const updatedReels = reels.map((r) => {
        if (r.id === reelId) {
          return {
            ...r,
            comments: [...(r.comments || []), newComment],
          };
        }
        return r;
      });
      setReels(updatedReels);
      if (onUpdateReels) onUpdateReels(updatedReels);
      setShowCommentsForReel((prev) =>
        prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null
      );

      await apiFetch(`/api/reels/${reelId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          avatar: currentUser.avatar,
          text: newComment.text,
        }),
      });
    } catch (err) {
      console.error("Error submitting comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Share publication
  const handleShare = async (reel: Reel) => {
    const shareUrl = `${window.location.origin}/#reel-${reel.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: reel.description || `Publicación de @${reel.creatorUsername || user.username}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setToastMessage("Enlace copiado al portapapeles");
        setTimeout(() => setToastMessage(null), 3000);
      } catch {}
    }
    apiFetch(`/api/reels/${reel.id}/share`, { method: "POST" }).catch(() => {});
  };

  // Confirm delete publication
  const handleConfirmDelete = async () => {
    if (!deletingReelId) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/reels/${deletingReelId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        const remaining = reels.filter((r) => r.id !== deletingReelId);
        setReels(remaining);
        if (onUpdateReels) onUpdateReels(remaining);
        if (onDeleteReel) onDeleteReel(deletingReelId);

        setToastMessage("Publicación eliminada");
        setTimeout(() => setToastMessage(null), 3000);

        if (remaining.length === 0) {
          onClose();
        } else if (activeIndex >= remaining.length) {
          setActiveIndex(remaining.length - 1);
        }
      }
    } catch (err) {
      console.error("Error deleting reel:", err);
    } finally {
      setIsDeleting(false);
      setDeletingReelId(null);
    }
  };

  const isFollowing =
    currentUser.followingUserIds?.includes(user.id) ||
    currentUser.followingUserIds?.includes(user.username) ||
    currentUser.followingUserIds?.includes(user.originalId || "");

  const activeReel = reels[activeIndex];
  const activeVideoEl = videoRefs.current[activeIndex] || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-white flex flex-col select-none overflow-hidden"
      id="user-publications-feed-container"
    >
      {/* Top Header Bar */}
      <div className="absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 sm:p-4 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 active:scale-95 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-lg"
            title="Volver al perfil"
            id="btn-feed-back-to-profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5">
            <img
              src={
                user.avatar ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
              }
              alt={user.name || user.username}
              className="w-8 h-8 rounded-full object-cover border border-white/30 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xs text-white truncate drop-shadow-sm">
                  @{user.username || user.name}
                </span>
                {user.isOnline && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </div>
              <p className="text-[10px] text-white/70 font-medium">
                Publicación {reels.length > 0 ? activeIndex + 1 : 0} de {reels.length}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted((prev) => !prev)}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 active:scale-95 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-lg"
            title={isMuted ? "Activar sonido" : "Silenciar"}
            id="btn-feed-toggle-sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 active:scale-95 text-white flex items-center justify-center transition-all border border-white/15 cursor-pointer shadow-lg"
            title="Cerrar"
            id="btn-feed-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Snap-Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        id="user-publications-scroll-feed"
      >
        {reels.map((reel, index) => {
          const isCurrent = index === activeIndex;
          const isLiked =
            currentUser &&
            ((currentUser.id && reel.likedBy?.includes(currentUser.id)) ||
              (currentUser.username && reel.likedBy?.includes(currentUser.username)) ||
              (currentUser.originalId && reel.likedBy?.includes(currentUser.originalId)));
          const isSaved = savedReelIds.includes(reel.id);
          const isOwner =
            currentUser &&
            (currentUser.id === reel.creatorId ||
              currentUser.originalId === reel.creatorId ||
              currentUser.username === reel.creatorUsername);

          // Find tagged product if applicable
          const taggedProduct = reel.productId
            ? products.find((p) => p.id === reel.productId)
            : null;

          return (
            <div
              key={`${reel.id}-${index}`}
              className="w-full h-full shrink-0 snap-center relative flex items-center justify-center bg-black overflow-hidden"
              id={`user-feed-item-${reel.id}`}
            >
              {/* Video Item */}
              <UserReelVideo
                reel={reel}
                index={index}
                isCurrent={isCurrent}
                isPlaying={isPlaying}
                isMuted={isMuted}
                onTogglePlay={handleTogglePlay}
                onDoubleTap={() => handleDoubleTap(reel)}
                onRegisterRef={handleRegisterRef}
              />

              {/* Heart burst animation on double tap */}
              <AnimatePresence>
                {heartAnim === reel.id && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                  >
                    <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Central play/pause indicator animation */}
              <AnimatePresence>
                {showPlayIcon && isCurrent && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.9 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                  >
                    <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-2xl">
                      {isPlaying ? (
                        <Play className="w-8 h-8 fill-white ml-1" />
                      ) : (
                        <Pause className="w-8 h-8 fill-white" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Sidebar (Right side) */}
              <div className="absolute right-3 bottom-24 sm:bottom-28 z-30 flex flex-col items-center space-y-4">
                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => handleLikeReel(reel)}
                  className="flex flex-col items-center group cursor-pointer"
                  id={`feed-btn-like-${reel.id}`}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-75 shadow-lg ${
                      isLiked
                        ? "bg-rose-500 text-white"
                        : "bg-black/45 hover:bg-black/65 text-white border border-white/20"
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isLiked ? "fill-white" : ""}`} />
                  </div>
                  <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md">
                    {reel.likes}
                  </span>
                </button>

                {/* Comment Button */}
                <button
                  type="button"
                  onClick={() => setShowCommentsForReel(reel)}
                  className="flex flex-col items-center group cursor-pointer"
                  id={`feed-btn-comments-${reel.id}`}
                >
                  <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 active:scale-75 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-lg">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md">
                    {reel.comments ? reel.comments.length : 0}
                  </span>
                </button>

                {/* Save/Bookmark Button */}
                <button
                  type="button"
                  onClick={() => onToggleSaveReel && onToggleSaveReel(reel.id)}
                  className="flex flex-col items-center group cursor-pointer"
                  id={`feed-btn-save-${reel.id}`}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-75 shadow-lg ${
                      isSaved
                        ? "bg-amber-500 text-white"
                        : "bg-black/45 hover:bg-black/65 text-white border border-white/20"
                    }`}
                  >
                    <Bookmark className={`w-5 h-5 ${isSaved ? "fill-white" : ""}`} />
                  </div>
                  <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md">
                    {reel.saves || 0}
                  </span>
                </button>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={() => handleShare(reel)}
                  className="flex flex-col items-center group cursor-pointer"
                  id={`feed-btn-share-${reel.id}`}
                >
                  <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 active:scale-75 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-lg">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-white mt-1 drop-shadow-md">
                    {reel.shares || 0}
                  </span>
                </button>

                {/* Tagged Product Button */}
                {taggedProduct && (
                  <button
                    type="button"
                    onClick={() => onSelectProduct && onSelectProduct(taggedProduct)}
                    className="flex flex-col items-center group cursor-pointer"
                    id={`feed-btn-product-${reel.id}`}
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-75 text-white flex items-center justify-center backdrop-blur-md border border-emerald-400/40 transition-all shadow-lg animate-pulse">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-300 mt-1 drop-shadow-md">
                      ${taggedProduct.price}
                    </span>
                  </button>
                )}

                {/* Delete Button (if owned by active user) */}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setDeletingReelId(reel.id)}
                    className="flex flex-col items-center group cursor-pointer"
                    title="Eliminar publicación"
                    id={`feed-btn-delete-${reel.id}`}
                  >
                    <div className="w-11 h-11 rounded-full bg-black/45 hover:bg-rose-600 active:scale-75 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-lg">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-medium text-white/60 mt-1">Borrar</span>
                  </button>
                )}
              </div>

              {/* Bottom Caption and Creator Section */}
              <div className="absolute bottom-4 left-3 right-16 sm:right-20 z-30 flex flex-col space-y-2 pointer-events-auto">
                {/* Creator tag and Follow button */}
                <div className="flex items-center space-x-2.5">
                  <span className="font-extrabold text-sm text-white drop-shadow-md">
                    @{reel.creatorUsername || user.username}
                  </span>

                  {currentUser.id !== user.id && onToggleFollowUser && (
                    <button
                      type="button"
                      onClick={() => onToggleFollowUser(user.id)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center space-x-1 backdrop-blur-md shadow cursor-pointer ${
                        isFollowing
                          ? "bg-white/20 text-white hover:bg-white/30 border border-white/30"
                          : "bg-rose-600 text-white hover:bg-rose-500"
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span>Siguiendo</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>Seguir</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Caption / Description */}
                {reel.description && (
                  <div className="text-xs text-white/95 leading-relaxed drop-shadow-md">
                    <p
                      className={
                        expandedDesc[reel.id] ? "whitespace-pre-line" : "line-clamp-2"
                      }
                    >
                      {reel.description}
                    </p>
                    {reel.description.length > 80 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDesc((prev) => ({
                            ...prev,
                            [reel.id]: !prev[reel.id],
                          }))
                        }
                        className="text-[11px] font-extrabold text-white/70 hover:text-white mt-0.5 underline cursor-pointer"
                      >
                        {expandedDesc[reel.id] ? "menos" : "más"}
                      </button>
                    )}
                  </div>
                )}

                {/* Attached Product Floating Card Banner */}
                {taggedProduct && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/20 flex items-center space-x-3 shadow-xl max-w-sm"
                  >
                    <img
                      src={taggedProduct.imageUrl}
                      alt={taggedProduct.name}
                      className="w-10 h-10 rounded-lg object-cover bg-white shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-white truncate">
                        {taggedProduct.name}
                      </p>
                      <p className="text-emerald-400 font-extrabold text-xs">
                        ${Number(taggedProduct.price || 0).toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectProduct && onSelectProduct(taggedProduct)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-extrabold rounded-lg transition-all shadow shrink-0 cursor-pointer"
                    >
                      Ver
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Progress Bar (Video Scrubber) */}
              {isCurrent && activeVideoEl && (
                <div className="absolute bottom-0 inset-x-0 z-40">
                  <ReelProgressBar video={activeVideoEl} isActive={isCurrent} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* COMMENTS DRAWER / MODAL */}
      <AnimatePresence>
        {showCommentsForReel && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            id="modal-feed-comments-backdrop"
            onClick={() => setShowCommentsForReel(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-slate-900 text-white rounded-t-3xl sm:rounded-3xl h-[65vh] sm:h-[550px] flex flex-col shadow-2xl border border-slate-800"
              id="modal-feed-comments-content"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-white flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4 text-rose-500" />
                  <span>
                    Comentarios ({showCommentsForReel.comments ? showCommentsForReel.comments.length : 0})
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCommentsForReel(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(!showCommentsForReel.comments || showCommentsForReel.comments.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-6">
                    <MessageCircle className="w-10 h-10 stroke-1 text-slate-600 mb-2" />
                    <p className="text-xs font-semibold">Aún no hay comentarios</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Sé el primero en dejar un comentario sobre esta publicación.
                    </p>
                  </div>
                ) : (
                  showCommentsForReel.comments.map((comment, cIdx) => (
                    <div key={`${comment.id || 'comment'}-${cIdx}`} className="flex space-x-3 text-left">
                      <img
                        src={
                          comment.avatar ||
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                        }
                        alt={comment.username}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0 mt-0.5"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0 bg-slate-800/60 p-3 rounded-2xl border border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-white">
                            @{comment.username}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {comment.createdAt ? new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Footer */}
              <form
                onSubmit={handleSendComment}
                className="p-3 border-t border-slate-800 bg-slate-900/95 flex items-center space-x-2"
              >
                <img
                  src={
                    currentUser.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80"
                  }
                  alt={currentUser.username}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmittingComment}
                  className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DELETE PUBLICATION CONFIRMATION */}
      <AnimatePresence>
        {deletingReelId && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
            id="modal-feed-delete-backdrop"
            onClick={() => {
              if (!isDeleting) setDeletingReelId(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center border border-slate-800 shadow-2xl"
              id="modal-feed-delete-content"
            >
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-500">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-extrabold text-base text-white">¿Eliminar publicación?</h3>
              <p className="text-xs text-slate-400 mt-2 mb-5 leading-relaxed">
                Esta acción eliminará el video permanentemente de MongoDB y Google Cloud Storage.
              </p>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingReelId(null)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
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
      </AnimatePresence>

      {/* TOAST FEEDBACK */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/90 text-white text-xs font-bold rounded-xl border border-white/20 shadow-2xl flex items-center space-x-2 backdrop-blur-md"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
