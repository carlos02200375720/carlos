import React, { useState, useRef, useEffect, memo } from "react";
import { ArrowLeft, X, Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, Play, Pause, Trash2, Send, Check } from "lucide-react";
import { Reel, Product, Comment, User } from "../../../types";
import { motion, AnimatePresence } from "motion/react";
import { androidApiFetch } from "../api";
import { AndroidProgressBar } from "./AndroidProgressBar";

interface AndroidUserPublicationsFeedProps {
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

export default function AndroidUserPublicationsFeed({
  user,
  reels,
  products = [],
  initialReelId,
  currentUser,
  onClose,
  onSelectProduct,
  onDeleteReel,
  savedReelIds = [],
  onToggleSaveReel,
}: AndroidUserPublicationsFeedProps) {
  const initialIndex = Math.max(0, reels.findIndex((r) => r.id === initialReelId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const [activeReels, setActiveReels] = useState<Reel[]>(reels);

  const currentReel = activeReels[activeIndex] || activeReels[0];

  useEffect(() => {
    setActiveReels(reels);
  }, [reels]);

  const handleLike = async (reelId: string) => {
    try {
      const res = await androidApiFetch(`/reels/${reelId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.originalId || currentUser.id,
          username: currentUser.username,
        }),
      });
      const data = await res.json();
      if (data && !data.error) {
        setActiveReels((prev) =>
          prev.map((r) => (r.id === reelId ? { ...r, likes: data.likes, likedBy: data.likedBy || [] } : r))
        );
      }
    } catch (err) {
      console.error("Error liking reel in Android feed:", err);
    }
  };

  const handleAddComment = async (reelId: string) => {
    if (!commentText.trim()) return;
    try {
      const res = await androidApiFetch(`/reels/${reelId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.originalId || currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar,
          text: commentText.trim(),
        }),
      });
      const newComment = await res.json();
      if (newComment && newComment.id) {
        setActiveReels((prev) =>
          prev.map((r) =>
            r.id === reelId ? { ...r, comments: [...(r.comments || []), newComment] } : r
          )
        );
        setCommentText("");
      }
    } catch (err) {
      console.error("Error adding comment in Android feed:", err);
    }
  };

  if (!currentReel) return null;

  const isLiked = currentReel.likedBy?.includes(currentUser.originalId || currentUser.id) || false;
  const isSaved = savedReelIds.includes(currentReel.id);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white select-none" id="android-publications-feed">
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 z-40 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md active:bg-white/20"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-amber-500" />
          <span className="text-xs font-semibold">{user.username}</span>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md active:bg-white/20"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Video View */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
        <video
          ref={(el) => { videoRefs.current[activeIndex] = el; }}
          src={currentReel.videoUrl}
          playsInline
          loop
          autoPlay
          muted={isMuted}
          className="w-full h-full object-cover"
          onClick={() => {
            const v = videoRefs.current[activeIndex];
            if (v) {
              if (v.paused) {
                v.play();
                setIsPlaying(true);
              } else {
                v.pause();
                setIsPlaying(false);
              }
            }
          }}
        />

        <AndroidProgressBar video={videoRefs.current[activeIndex]} isActive={true} />

        {/* Right Interaction Column */}
        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center space-y-4">
          <button
            onClick={() => handleLike(currentReel.id)}
            className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
          >
            <div className={`p-3 rounded-full backdrop-blur-md ${isLiked ? "bg-rose-500 text-white" : "bg-black/40 text-white"}`}>
              <Heart className={`w-6 h-6 ${isLiked ? "fill-white" : ""}`} />
            </div>
            <span className="text-[11px] font-medium mt-1 drop-shadow-md">{currentReel.likes || 0}</span>
          </button>

          <button
            onClick={() => setShowComments(true)}
            className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
          >
            <div className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-medium mt-1 drop-shadow-md">{currentReel.comments?.length || 0}</span>
          </button>

          {onToggleSaveReel && (
            <button
              onClick={() => onToggleSaveReel(currentReel.id)}
              className="flex flex-col items-center group cursor-pointer active:scale-90 transition-transform"
            >
              <div className={`p-3 rounded-full backdrop-blur-md ${isSaved ? "bg-amber-500 text-slate-950" : "bg-black/40 text-white"}`}>
                <Bookmark className={`w-6 h-6 ${isSaved ? "fill-slate-950" : ""}`} />
              </div>
              <span className="text-[11px] font-medium mt-1 drop-shadow-md">Guardar</span>
            </button>
          )}

          {currentUser.id === currentReel.creatorId && onDeleteReel && (
            <button
              onClick={() => {
                if (window.confirm("¿Eliminar publicación de Android?")) {
                  onDeleteReel(currentReel.id);
                  onClose();
                }
              }}
              className="p-3 rounded-full bg-rose-600/80 text-white backdrop-blur-md active:scale-90 transition-transform"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom Details Overlay */}
        <div className="absolute bottom-4 left-4 right-16 z-30 pointer-events-none">
          <p className="text-sm font-semibold drop-shadow-md">{currentReel.creatorName || currentReel.creatorUsername}</p>
          <p className="text-xs text-slate-200 mt-1 line-clamp-2 drop-shadow-md">{currentReel.description}</p>
        </div>
      </div>

      {/* Android Comments Bottom Sheet */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 h-2/3 bg-slate-900 rounded-t-3xl z-50 flex flex-col border-t border-slate-800 p-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-sm font-bold">Comentarios ({currentReel.comments?.length || 0})</span>
              <button onClick={() => setShowComments(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {(!currentReel.comments || currentReel.comments.length === 0) ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Sé el primero en comentar en Android.
                </div>
              ) : (
                currentReel.comments.map((c) => (
                  <div key={c.id} className="flex space-x-3 text-xs">
                    <img src={c.avatar || user.avatar} alt={c.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div>
                      <span className="font-semibold text-amber-400">@{c.username}</span>
                      <p className="text-slate-200 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Añadir comentario..."
                className="flex-1 px-3 py-2 bg-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddComment(currentReel.id);
                }}
              />
              <button
                onClick={() => handleAddComment(currentReel.id)}
                className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
