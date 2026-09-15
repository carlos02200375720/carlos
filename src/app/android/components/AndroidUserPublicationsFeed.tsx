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
  // Videos start with sound enabled. The browser/WebView may still block unmuted autoplay until a gesture.
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const [activeVideoEl, setActiveVideoEl] = useState<HTMLVideoElement | null>(null);
  const [activeReels, setActiveReels] = useState<Reel[]>(reels);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentReel = activeReels[activeIndex] || activeReels[0];

  useEffect(() => {
    setActiveReels(reels);
  }, [reels]);

  useEffect(() => {
    const el = videoRefs.current[activeIndex] || null;
    setActiveVideoEl(el);
    if (el) {
      el.muted = isMuted;
      el.defaultMuted = isMuted;
      el.volume = isMuted ? 0 : 1.0;
      el.play().catch(() => {});
    }
  }, [activeIndex, isMuted]);

  useEffect(() => {
    setActiveVideoEl(videoRefs.current[activeIndex] || null);
  }, [activeIndex]);

  const handleLike = async (reelId: string) => {
    try {
      const res = await androidApiFetch(`/reels/${reelId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.originalId || currentUser.id, username: currentUser.username }),
      });
      const data = await res.json();
      if (data && !data.error) {
        setActiveReels((prev) => prev.map((r) => (r.id === reelId ? { ...r, likes: data.likes, likedBy: data.likedBy || [] } : r)));
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
        body: JSON.stringify({ userId: currentUser.originalId || currentUser.id, username: currentUser.username, avatar: currentUser.avatar, text: commentText.trim() }),
      });
      const newComment = await res.json();
      if (newComment && newComment.id) {
        setActiveReels((prev) => prev.map((r) => r.id === reelId ? { ...r, comments: [...(r.comments || []), newComment] } : r));
        setCommentText("");
      }
    } catch (err) {
      console.error("Error adding comment in Android feed:", err);
    }
  };

  if (!currentReel) return null;

  const isLiked = currentReel.likedBy?.includes(currentUser.originalId || currentUser.id) || false;
  const isSaved = savedReelIds.includes(currentReel.id);
  const canDeleteCurrent = Boolean(onDeleteReel) && (
    currentUser.id === currentReel.creatorId ||
    (currentUser as any)?.role === "admin" ||
    (currentUser as any)?.isAdmin === true ||
    currentReel.creatorId === "current_user" ||
    (Boolean(currentUser.username) && Boolean(currentReel.creatorUsername) && currentUser.username.toLowerCase() === currentReel.creatorUsername.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white select-none" id="android-publications-feed">
      <div className="absolute top-0 inset-x-0 z-40 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md active:bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex items-center space-x-2"><img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-amber-500" /><span className="text-xs font-semibold">{user.username}</span></div>
        <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full bg-black/40 text-white backdrop-blur-md active:bg-white/20">
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-slate-950">
        <video
          ref={(el) => { videoRefs.current[activeIndex] = el; }}
          src={currentReel.hlsUrl && currentReel.hlsUrl.includes(".m3u8") ? currentReel.hlsUrl : (currentReel.videoUrl || undefined)}
          playsInline
          loop
          autoPlay
          muted={isMuted}
          className="w-full h-full object-cover"
          onClick={() => {
            const v = videoRefs.current[activeIndex];
            if (v) {
              if (v.paused) { v.play(); setIsPlaying(true); }
              else { v.pause(); setIsPlaying(false); }
            }
          }}
        />

        <AndroidProgressBar video={activeVideoEl || videoRefs.current[activeIndex] || null} isActive={true} />

        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-3">
          <div className="flex flex-col items-center">
            <button onClick={() => handleLike(currentReel.id)} className="group flex flex-col items-center cursor-pointer active:scale-95 transition-all duration-300" aria-label="Me gusta">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/20 shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-all duration-300 ${isLiked ? "bg-rose-500 text-white ring-2 ring-rose-300/70" : "bg-transparent text-white hover:bg-white/10"}`}><Heart className={`w-6 h-6 transition-all duration-300 ${isLiked ? "fill-white scale-110" : ""}`} /></span>
              <span className="mt-1 text-[11px] font-semibold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">{currentReel.likes || 0}</span>
            </button>
          </div>
          <div className="flex flex-col items-center">
            <button onClick={() => setShowComments(true)} className="group flex flex-col items-center cursor-pointer active:scale-95 transition-all duration-300" aria-label="Comentarios"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-transparent text-white shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-white/10"><MessageCircle className="w-6 h-6" /></span><span className="mt-1 text-[11px] font-semibold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">{currentReel.comments?.length || 0}</span></button>
          </div>
          {onToggleSaveReel && <div className="flex flex-col items-center"><button onClick={() => onToggleSaveReel(currentReel.id)} className="group flex flex-col items-center cursor-pointer active:scale-95 transition-all duration-300" aria-label="Guardar reel"><span className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/20 shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-all duration-300 ${isSaved ? "bg-amber-400 text-slate-950 ring-2 ring-amber-200/80" : "bg-transparent text-white hover:bg-white/10"}`}><Bookmark className={`w-6 h-6 transition-all duration-300 ${isSaved ? "fill-slate-950 scale-110" : ""}`} /></span><span className="mt-1 text-[11px] font-semibold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">Guardar</span></button></div>}
          {canDeleteCurrent && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                id={`btn-feed-delete-${currentReel.id}`}
                onClick={() => setShowDeleteModal(true)}
                className="group flex flex-col items-center cursor-pointer active:scale-90 transition-all duration-300"
                aria-label="Eliminar publicación"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/40 bg-rose-600/90 text-white shadow-[0_8px_22px_rgba(0,0,0,0.5)] transition-all duration-300 hover:bg-rose-600">
                  <Trash2 className="w-5 h-5" />
                </span>
                <span className="mt-1 text-[11px] font-semibold text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
                  Eliminar
                </span>
              </button>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-16 z-30 pointer-events-none"><p className="text-sm font-semibold drop-shadow-md">{currentReel.creatorName || currentReel.creatorUsername}</p><p className="text-xs text-slate-200 mt-1 line-clamp-2 drop-shadow-md">{currentReel.description}</p></div>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute inset-x-0 bottom-0 h-2/3 bg-slate-900 rounded-t-3xl z-50 flex flex-col border-t border-slate-800 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800"><span className="text-sm font-bold">Comentarios ({currentReel.comments?.length || 0})</span><button onClick={() => setShowComments(false)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {(!currentReel.comments || currentReel.comments.length === 0) ? <div className="text-center py-8 text-xs text-slate-500">Sé el primero en comentar en Android.</div> : currentReel.comments.map((c) => <div key={c.id} className="flex space-x-3 text-xs"><img src={c.avatar || user.avatar} alt={c.username} className="w-8 h-8 rounded-full object-cover shrink-0" /><div><span className="font-semibold text-amber-400">@{c.username}</span><p className="text-slate-200 mt-0.5">{c.text}</p></div></div>)}
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center space-x-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}><input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Añadir comentario..." className="flex-1 px-3 py-2 bg-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500" onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(currentReel.id); }} /><button onClick={() => handleAddComment(currentReel.id)} className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold active:scale-95"><Send className="w-4 h-4" /></button></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación in-app en feed */}
      <AnimatePresence>
        {showDeleteModal && (
          <div
            id="modal-feed-confirm-delete"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 text-slate-900"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                ¿Eliminar publicación?
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Esta publicación se eliminará permanentemente de MongoDB Atlas, Google Cloud Storage y de todos los servidores.
              </p>

              <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setShowDeleteModal(false)}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="btn-feed-execute-delete"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      if (onDeleteReel) {
                        await onDeleteReel(currentReel.id);
                      }
                      onClose();
                    } catch (err) {
                      console.error("Error al eliminar reel:", err);
                    } finally {
                      setIsDeleting(false);
                      setShowDeleteModal(false);
                    }
                  }}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-md hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <span>Eliminar</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
