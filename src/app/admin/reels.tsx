import React, { useState, useMemo } from "react";
import {
  Search,
  Eye,
  Heart,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reel } from "../../types";
import { apiFetch } from "../../config";

export interface ReelsAdminProps {
  reels: Reel[];
  setReels: React.Dispatch<React.SetStateAction<Reel[]>>;
  onReelClick: (reelId: string) => void;
  onStatusMessage?: (msg: { type: "success" | "error" | "info"; text: string } | null) => void;
  onRequestDeleteReel?: (target: { type: "reel"; id: string; name: string }) => void;
}

export default function ReelsAdminView({
  reels,
  setReels,
  onReelClick,
  onStatusMessage,
  onRequestDeleteReel,
}: ReelsAdminProps) {
  const [reelSearch, setReelSearch] = useState("");
  const [localDeletingReel, setLocalDeletingReel] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notify = (msg: { type: "success" | "error" | "info"; text: string }) => {
    if (onStatusMessage) {
      onStatusMessage(msg);
      setTimeout(() => onStatusMessage(null), 4000);
    }
  };

  const filteredReels = useMemo(() => {
    const q = reelSearch.toLowerCase().trim();
    if (!q) return reels;
    return reels.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.creatorName.toLowerCase().includes(q) ||
        (r.creatorUsername && r.creatorUsername.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q)
    );
  }, [reels, reelSearch]);

  const confirmLocalDeleteReel = async () => {
    if (!localDeletingReel) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/reels/${localDeletingReel.id}`, { method: "DELETE" });
      if (res) {
        setReels((prev) => prev.filter((r) => r.id !== localDeletingReel.id));
        notify({
          type: "success",
          text: `Reel "${localDeletingReel.name}" eliminado del sistema.`,
        });
      }
    } catch (err: any) {
      console.error("Error deleting reel in admin:", err);
      notify({
        type: "error",
        text: err.message || "Error al procesar la eliminación",
      });
    } finally {
      setIsDeleting(false);
      setLocalDeletingReel(null);
    }
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
      id="admin-tab-content-reels"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Moderación de Reels y Publicaciones
          </h2>
          <p className="text-xs text-slate-500">
            Supervisa vídeos activos, métricas de engagement y elimina contenido infractor.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={reelSearch}
            onChange={(e) => setReelSearch(e.target.value)}
            placeholder="Buscar por título, creador o ID..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReels.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No hay reels que coincidan con la búsqueda.
          </div>
        ) : (
          filteredReels.map((reel, rIdx) => (
            <div
              key={`${reel.id}-${rIdx}`}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={
                      reel.creatorAvatar ||
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                    }
                    alt={reel.creatorName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {reel.creatorName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      @{reel.creatorUsername || "creator"}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                    {reel.type || "video"}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {reel.title || "Sin título"}
                  </h4>
                  {reel.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {reel.description}
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-200/60">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{reel.views || 0}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span>{reel.likes || 0}</span>
                  </span>
                  <span className="text-slate-400 text-[10px] truncate">
                    ID: {reel.id}
                  </span>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="bg-white px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => onReelClick(reel.id)}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver Reel</span>
                </button>
                <button
                  onClick={() => {
                    if (onRequestDeleteReel) {
                      onRequestDeleteReel({
                        type: "reel",
                        id: reel.id,
                        name: reel.title || reel.id,
                      });
                    } else {
                      setLocalDeletingReel({
                        id: reel.id,
                        name: reel.title || reel.id,
                      });
                    }
                  }}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                  title="Eliminar publicación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fallback Confirmation Modal when used standalone */}
      <AnimatePresence>
        {localDeletingReel && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">¿Confirmar eliminación?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar de forma permanente el reel{" "}
                  <span className="font-bold text-slate-900">"{localDeletingReel.name}"</span>.
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setLocalDeletingReel(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmLocalDeleteReel}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeleting ? "Eliminando..." : "Eliminar Definitivamente"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
