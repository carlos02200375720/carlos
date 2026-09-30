import React, { useState, useEffect } from "react";
import { Bookmark, ShoppingBag, Eye, Heart, Play } from "lucide-react";
import { motion } from "motion/react";
import { Product, Reel } from "../../../types";
import { getMediaUrl } from "../../../config";

export function PublicationCover({ reel }: { reel: Reel }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => {
    if (
      reel.thumbnailUrl &&
      !reel.thumbnailUrl.toLowerCase().endsWith(".m3u8") &&
      !reel.thumbnailUrl.includes("photo-1618005182384")
    ) {
      return getMediaUrl(reel.thumbnailUrl);
    }
    if (
      reel.images &&
      reel.images.length > 0 &&
      !reel.images[0].toLowerCase().endsWith(".m3u8")
    ) {
      return getMediaUrl(reel.images[0]);
    }
    const targetUrl =
      reel.hlsUrl ||
      reel.videoUrl ||
      (reel.media && (reel.media[0] as any)?.hlsUrl) ||
      (reel.media && reel.media[0]?.url) ||
      "";
    const hlsMatch = targetUrl.match(
      /(?:\/uploads\/hls\/|\/api\/hls\/|\/hls\/)([a-zA-Z0-9_-]+)\//
    );
    if (hlsMatch) {
      return `/api/hls/${hlsMatch[1]}/poster.jpg`;
    }
    return null;
  });

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (thumbUrl && !hasError) return;

    const rawUrl =
      reel.videoUrl ||
      reel.hlsUrl ||
      (reel.media && reel.media[0]?.url) ||
      (reel.media && (reel.media[0] as any)?.hlsUrl);
    if (!rawUrl) return;

    const hlsMatch = rawUrl.match(
      /(?:\/uploads\/hls\/|\/api\/hls\/|\/hls\/)([a-zA-Z0-9_-]+)\//
    );
    if (hlsMatch && !thumbUrl) {
      setThumbUrl(`/api/hls/${hlsMatch[1]}/poster.jpg`);
      setHasError(false);
      return;
    }

    if (reel.videoUrl && typeof document !== "undefined") {
      let isCancelled = false;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.volume = 0;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = getMediaUrl(reel.videoUrl);

      const captureFrame = () => {
        if (isCancelled) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(video.videoWidth || 480, 480);
          canvas.height = Math.min(video.videoHeight || 640, 640);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            if (dataUrl && dataUrl.length > 100) {
              setThumbUrl(dataUrl);
              setHasError(false);
            }
          }
        } catch (e) {
          // Fallback gracefully on CORS
        }
      };

      const handleLoadedData = () => {
        video.currentTime = 0.1;
      };

      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("seeked", captureFrame);
      video.load();

      return () => {
        isCancelled = true;
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.removeEventListener("loadeddata", handleLoadedData);
          video.removeEventListener("seeked", captureFrame);
          video.removeAttribute("src");
          video.load();
        } catch {
          // ignore
        }
      };
    }
  }, [reel.videoUrl, reel.hlsUrl, thumbUrl, hasError]);

  if (thumbUrl && !hasError) {
    return (
      <img
        src={getMediaUrl(thumbUrl)}
        alt={reel.description || "Publicación"}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none bg-slate-900"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/40 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden group-hover:scale-105 transition-transform duration-300 select-none">
      <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 shadow-md">
        <Play className="w-4 h-4 fill-amber-400 translate-x-0.5" />
      </div>
      <p className="text-[11px] text-white/90 font-bold line-clamp-2 leading-tight">
        {reel.title ||
          reel.description ||
          (reel.type === "video" ? "Video" : "Publicación")}
      </p>
    </div>
  );
}

export interface GuardadoPerfilProps {
  savedProducts: Product[];
  savedReels: Reel[];
  onSelectProduct: (product: Product) => void;
  onToggleSave?: (id: string) => void;
  onRemoveSavedProductFromLocal?: (productId: string) => void;
  onSelectReel: (reelId: string) => void;
}

export function GuardadoPerfilView({
  savedProducts,
  savedReels,
  onSelectProduct,
  onToggleSave,
  onRemoveSavedProductFromLocal,
  onSelectReel,
}: GuardadoPerfilProps) {
  return (
    <motion.div
      key="admin-saved"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
      id="profile-guardado-view"
    >
      {/* Saved Products Section */}
      <div>
        <h3 className="font-display font-extrabold text-sm text-slate-900 mb-3 flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500/10" />
          <span>Productos Guardados ({savedProducts.length})</span>
        </h3>

        {savedProducts.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 stroke-1 text-slate-300 mb-1.5" />
            <p className="text-xs font-semibold text-slate-500">
              No tienes productos guardados
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Guarda tus productos favoritos desde la Tienda para encontrarlos aquí fácilmente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {savedProducts.map((product, index) => (
              <div
                key={`${product.id}-${index}`}
                onClick={() => onSelectProduct(product)}
                className="border border-slate-100 hover:border-amber-500/30 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between"
                id={`saved-product-${product.id}`}
              >
                <div className="relative aspect-square w-full bg-white overflow-hidden flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                  <h4 className="font-display font-bold text-xs text-slate-900 group-hover:text-amber-500 transition-colors line-clamp-2 leading-tight">
                    {product.name}
                  </h4>
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col items-start gap-0.5">
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-900">
                        ${Number(product.price || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleSave) {
                            onToggleSave(product.id);
                          }
                          if (onRemoveSavedProductFromLocal) {
                            onRemoveSavedProductFromLocal(product.id);
                          }
                        }}
                        className="bg-transparent border-0 p-0 shadow-none outline-none flex items-center justify-center cursor-pointer"
                        title="Quitar de guardados"
                      >
                        <Bookmark className="w-4 h-4 fill-amber-500 text-amber-500 hover:text-amber-600 transition-colors" />
                      </button>
                    </div>
                    {Boolean(product.freeShipping) && (
                      <span className="text-[9px] font-bold bg-transparent text-emerald-700 leading-tight">
                        Envío Gratis
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved Publications Section */}
      <div>
        <h3 className="font-display font-extrabold text-sm text-slate-900 mb-3 flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500/10" />
          <span>Publicaciones Guardadas ({savedReels.length})</span>
        </h3>

        {savedReels.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center text-slate-400">
            <Bookmark className="w-8 h-8 stroke-1 text-slate-300 mb-1.5" />
            <p className="text-xs font-semibold text-slate-500">
              No tienes publicaciones guardadas
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Guarda publicaciones desde la sección de Inicio para verlas aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {savedReels.map((reel, index) => (
              <div
                key={`${reel.id}-${index}`}
                onClick={() => onSelectReel(reel.id)}
                className="aspect-[3/4] rounded-xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-sm"
                id={`saved-reel-${reel.id}`}
              >
                <PublicationCover reel={reel} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60" />

                <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>@{reel.creatorUsername || reel.creatorName}</span>
                </div>

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
      </div>
    </motion.div>
  );
}

export { GuardadoPerfilView as Guardado };
export default GuardadoPerfilView;
