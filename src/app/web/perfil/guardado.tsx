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
  const [filter, setFilter] = useState<"all" | "reels" | "products">("all");
  const totalSaved = savedProducts.length + savedReels.length;

  // Interleave both products and reels so the unified view displays both categories together
  const unifiedItems = React.useMemo(() => {
    type UnifiedItem =
      | { kind: "product"; data: Product; id: string }
      | { kind: "reel"; data: Reel; id: string };

    const pList = [...savedProducts];
    const rList = [...savedReels];
    const items: UnifiedItem[] = [];
    const maxLen = Math.max(pList.length, rList.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < rList.length) {
        items.push({ kind: "reel", data: rList[i], id: rList[i].id });
      }
      if (i < pList.length) {
        items.push({ kind: "product", data: pList[i], id: pList[i].id });
      }
    }
    return items;
  }, [savedProducts, savedReels]);

  return (
    <motion.div
      key="admin-saved"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
      id="profile-guardado-view"
    >
      {/* Horizontal Filter Tabs Bar (nunca uno debajo del otro) */}
      <div className="flex flex-row items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 no-scrollbar whitespace-nowrap">
        <button
          type="button"
          id="saved-filter-tab-all"
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            filter === "all"
              ? "bg-amber-500 text-slate-950 shadow-xs font-black ring-2 ring-amber-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Todos ({totalSaved})</span>
        </button>

        <button
          type="button"
          id="saved-filter-tab-reels"
          onClick={() => setFilter("reels")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            filter === "reels"
              ? "bg-amber-500 text-slate-950 shadow-xs font-black ring-2 ring-amber-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Publicaciones ({savedReels.length})</span>
        </button>

        <button
          type="button"
          id="saved-filter-tab-products"
          onClick={() => setFilter("products")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            filter === "products"
              ? "bg-amber-500 text-slate-950 shadow-xs font-black ring-2 ring-amber-500/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Productos ({savedProducts.length})</span>
        </button>
      </div>

      {/* Empty State */}
      {totalSaved === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-400">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
            <Bookmark className="w-6 h-6 stroke-1" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">No tienes publicaciones ni productos guardados</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Guarda publicaciones desde la sección de Inicio o productos desde la Tienda tocando el botón de guardado.
          </p>
        </div>
      ) : (
        <div>
          {/* 1. Unified "Todos" View: Displays both publications and products together in one organized grid */}
          {filter === "all" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {unifiedItems.map((item, index) => {
                if (item.kind === "product") {
                  const product = item.data;
                  return (
                    <div
                      key={`unified-p-${product.id}-${index}`}
                      onClick={() => onSelectProduct(product)}
                      className="border border-slate-200/90 hover:border-amber-500/40 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between relative"
                      id={`saved-unified-product-${product.id}`}
                    >
                      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-amber-400 flex items-center gap-1 shadow-xs">
                          <ShoppingBag className="w-2.5 h-2.5" />
                          <span>Producto</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleSave) onToggleSave(product.id);
                            if (onRemoveSavedProductFromLocal) onRemoveSavedProductFromLocal(product.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-amber-400 hover:bg-black/80 active:scale-90 transition-transform cursor-pointer"
                          title="Quitar de guardados"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </button>
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
                            {Boolean(product.freeShipping) && (
                              <span className="text-[9px] font-bold text-emerald-700 leading-tight">
                                Envío Gratis
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const reel = item.data;
                return (
                  <div
                    key={`unified-r-${reel.id}-${index}`}
                    onClick={() => onSelectReel(reel.id)}
                    className="aspect-[3/4] rounded-2xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all"
                    id={`saved-unified-reel-${reel.id}`}
                  >
                    <PublicationCover reel={reel} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-70" />

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-bold text-white flex items-center gap-1 shadow-xs">
                      <Play className="w-2.5 h-2.5 fill-current text-amber-400" />
                      <span>@{reel.creatorUsername || reel.creatorName || "creador"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleSave) onToggleSave(reel.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-amber-400 hover:bg-black/80 active:scale-90 transition-transform cursor-pointer"
                      title="Quitar de guardados"
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </button>

                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3 text-slate-200" />
                        <span>{reel.views || 0}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                        <span>{reel.likes || 0}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Publicaciones Filter */}
          {filter === "reels" && (
            <div>
              {savedReels.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <Play className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No tienes publicaciones guardadas</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Guarda publicaciones desde la sección de Inicio para verlas aquí.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {savedReels.map((reel, index) => (
                    <div
                      key={`filtered-r-${reel.id}-${index}`}
                      onClick={() => onSelectReel(reel.id)}
                      className="aspect-[3/4] rounded-2xl overflow-hidden relative border border-slate-200 cursor-pointer group bg-slate-900 shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all"
                      id={`saved-reel-${reel.id}`}
                    >
                      <PublicationCover reel={reel} />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent opacity-70" />

                      <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 rounded-md text-[9px] font-bold text-white flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>@{reel.creatorUsername || reel.creatorName}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleSave) onToggleSave(reel.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-amber-400 hover:bg-black/80 active:scale-90 transition-transform cursor-pointer"
                        title="Quitar de guardados"
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </button>

                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-white text-[10px] font-mono font-bold">
                        <span className="flex items-center space-x-0.5">
                          <Eye className="w-3 h-3 text-slate-200" />
                          <span>{reel.views || 0}</span>
                        </span>
                        <span className="flex items-center space-x-0.5">
                          <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                          <span>{reel.likes || 0}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Productos Filter */}
          {filter === "products" && (
            <div>
              {savedProducts.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No tienes productos guardados</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Guarda tus productos favoritos desde la Tienda para encontrarlos aquí.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {savedProducts.map((product, index) => (
                    <div
                      key={`filtered-p-${product.id}-${index}`}
                      onClick={() => onSelectProduct(product)}
                      className="border border-slate-200/90 hover:border-amber-500/40 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between"
                      id={`saved-product-${product.id}`}
                    >
                      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleSave) onToggleSave(product.id);
                            if (onRemoveSavedProductFromLocal) onRemoveSavedProductFromLocal(product.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-xs text-amber-400 hover:bg-black/80 active:scale-90 transition-transform cursor-pointer"
                          title="Quitar de guardados"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        </button>
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
                            {Boolean(product.freeShipping) && (
                              <span className="text-[9px] font-bold text-emerald-700 leading-tight">
                                Envío Gratis
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export { GuardadoPerfilView as Guardado };
export default GuardadoPerfilView;
