import React, { useState, useEffect } from "react";
import { Play, Eye, Heart, X, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reel } from "../../../types";
import { apiFetch } from "../../../config";
import { PublicationCover } from "./guardado";

export interface PublicacionesPerfilViewProps {
  userReels: Reel[];
  onSelectReel: (reelId: string) => void;
  onUpdateReels?: React.Dispatch<React.SetStateAction<Reel[]>>;
  onPublishSuccess?: () => void;
  canDelete?: boolean;
  showHeader?: boolean;
}

export default function PublicacionesPerfilView({
  userReels,
  onSelectReel,
  onUpdateReels,
  onPublishSuccess,
  canDelete = true,
  showHeader = true,
}: PublicacionesPerfilViewProps) {
  const [deletingReel, setDeletingReel] = useState<Reel | null>(null);
  const [isDeletingReel, setIsDeletingReel] = useState(false);
  const [reelActionMessage, setReelActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Auto-clear publication feedback banner
  useEffect(() => {
    if (reelActionMessage) {
      const timer = setTimeout(() => {
        setReelActionMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [reelActionMessage]);

  const handleOpenDeleteReel = (reel: Reel, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingReel(reel);
  };

  const handleConfirmDeleteReel = async () => {
    if (!deletingReel) return;
    const reelId = deletingReel.id;
    try {
      setIsDeletingReel(true);
      const res = await apiFetch(`/api/reels/${reelId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (onUpdateReels) {
          onUpdateReels((prev) => prev.filter((r) => r.id !== reelId));
        }
        setReelActionMessage({
          type: "success",
          text: "Publicación eliminada permanentemente de MongoDB y Cloud Storage.",
        });
        setDeletingReel(null);
        if (onPublishSuccess) {
          onPublishSuccess();
        }
      } else {
        setReelActionMessage({
          type: "error",
          text: "No se pudo eliminar la publicación: " + (data.error || "Error desconocido"),
        });
      }
    } catch (err: any) {
      console.error("Error al eliminar la publicación:", err);
      setReelActionMessage({
        type: "error",
        text: "Error de red al intentar eliminar la publicación.",
      });
    } finally {
      setIsDeletingReel(false);
    }
  };

  return (
    <motion.div
      key="admin-publications"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2">
            <Play className="w-4 h-4 text-amber-500 fill-amber-500/10" />
            <span>Mis Publicaciones ({userReels.length})</span>
          </h3>
        </div>
      )}

      {userReels.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
          <Play className="w-10 h-10 stroke-1 text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-500">
            No has compartido ninguna publicación aún
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Tus videos publicados aparecerán en esta sección.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {userReels.map((reel, index) => (
            <div
              key={`${reel.id}-${index}`}
              onClick={() => onSelectReel(reel.id)}
              className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
              id={`admin-my-reel-${reel.id}`}
            >
              <PublicationCover reel={reel} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />

              {/* Botón (X) para eliminar publicación de MongoDB y Google Cloud Storage con fondo transparente */}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => handleOpenDeleteReel(reel, e)}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="Eliminar publicación"
                  className="absolute top-1.5 right-1.5 w-8 h-8 bg-transparent hover:text-rose-400 active:scale-90 text-white flex items-center justify-center transition-all z-30 cursor-pointer drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  id={`btn-delete-reel-${reel.id}`}
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}

              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                <span className="flex items-center space-x-0.5">
                  <Eye className="w-3 h-3 text-slate-200" />
                  <span>{reel.views}</span>
                </span>
                <span className="flex items-center space-x-0.5">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                  <span>{reel.likes}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN ELIMINAR PUBLICACIÓN / REEL */}
      <AnimatePresence>
        {deletingReel && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            id="modal-delete-reel-backdrop"
            onClick={() => {
              if (!isDeletingReel) setDeletingReel(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center"
              id="modal-delete-reel-content"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-display font-extrabold text-base text-slate-900">
                ¿Eliminar esta publicación?
              </h3>

              <div className="my-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center space-x-3 text-left">
                {deletingReel.thumbnailUrl && !deletingReel.thumbnailUrl.endsWith(".m3u8") ? (
                  <img
                    src={deletingReel.thumbnailUrl}
                    alt={deletingReel.description || "Publicación"}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-lg object-cover bg-black border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <Play className="w-5 h-5 text-white/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {deletingReel.description || "Publicación de video"}
                  </p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {deletingReel.views || 0} vistas • {deletingReel.likes || 0} me gusta
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Esta acción eliminará el video y sus archivos permanentemente de MongoDB y Google Cloud Storage. No se puede deshacer.
              </p>

              <div className="flex items-center justify-center space-x-2.5">
                <button
                  type="button"
                  disabled={isDeletingReel}
                  onClick={() => setDeletingReel(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  id="btn-cancel-delete-reel"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingReel}
                  onClick={handleConfirmDeleteReel}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-confirm-delete-reel"
                >
                  {isDeletingReel ? (
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

        {/* TOAST NOTIFICATION FOR REEL ACTIONS */}
        {reelActionMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-bold border ${
              reelActionMessage.type === "success"
                ? "bg-slate-900 text-white border-emerald-500/30"
                : "bg-rose-600 text-white border-rose-400/30"
            }`}
          >
            {reelActionMessage.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white" />
            )}
            <span>{reelActionMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export { PublicacionesPerfilView as Publicaciones };
