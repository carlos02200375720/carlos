import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Star,
  ArrowLeft,
  ShieldCheck,
  Truck,
  Loader2,
  AlertCircle,
  Play,
  Volume2,
  VolumeX,
  FileText,
} from "lucide-react";
import { motion } from "motion/react";
import { Product, User } from "../../../types";
import { apiFetch } from "../../../config";
import { NativeVideoPlayer } from "../components/VideoPlayer";

export interface ShippingOptionItem {
  carrier: string;
  aging: string;
  shippingCost: number;
}

export function getManualShippingOptions(prod: Product | null): ShippingOptionItem[] {
  if (!prod) {
    return [{ carrier: "Envío Gratis", aging: "1-5 días hábiles", shippingCost: 0 }];
  }

  const opts: ShippingOptionItem[] = [];
  const seenLabels = new Set<string>();

  if (Array.isArray(prod.shippingOptions) && prod.shippingOptions.length > 0) {
    prod.shippingOptions.forEach((opt) => {
      if (!opt || !opt.label || !String(opt.label).trim()) return;
      const cleanLabel = String(opt.label).trim();
      const key = cleanLabel.toLowerCase();
      seenLabels.add(key);
      opts.push({
        carrier: cleanLabel,
        aging: String(opt.deliveryTime || "3-7 días hábiles").trim(),
        shippingCost: Math.max(0, Number(opt.price ?? 0) || 0),
      });
    });
  }

  const capCost = Math.max(0, Number(prod.shippingCapital ?? 0) || 0);
  const provCost = Math.max(0, Number(prod.shippingProvince ?? 0) || 0);
  const baseCost = Math.max(0, Number(prod.shippingCost ?? 0) || 0);

  if (capCost > 0 && !seenLabels.has("envío a la capital")) {
    opts.push({
      carrier: "Envío a la Capital",
      aging: "1-3 días hábiles",
      shippingCost: capCost,
    });
  }
  if (provCost > 0 && !seenLabels.has("envío a provincia")) {
    opts.push({
      carrier: "Envío a Provincia",
      aging: "3-5 días hábiles",
      shippingCost: provCost,
    });
  }
  if (prod.freeShipping && !opts.some((o) => o.shippingCost === 0)) {
    opts.push({
      carrier: "Envío Gratis",
      aging: "1-5 días hábiles",
      shippingCost: 0,
    });
  }

  if (opts.length === 0) {
    if (baseCost > 0) {
      opts.push({
        carrier: "Envío a la Capital",
        aging: "1-3 días hábiles",
        shippingCost: baseCost,
      });
    } else {
      opts.push({
        carrier: "Envío Gratis",
        aging: "1-5 días hábiles",
        shippingCost: 0,
      });
    }
  }

  return opts;
}

export interface ProductoIdTiendaViewProps {
  selectedProduct: Product | null;
  users: User[];
  handleBackToCatalog: () => void;
  onCreatorClick: (creatorId: string) => void;
  onAddToCart: (product: Product) => void;
  openCartDrawer: () => void;
  onProductViewsUpdated?: (productId: string, views: number) => void;
}

export function ProductoIdTiendaView({
  selectedProduct,
  users,
  handleBackToCatalog,
  onCreatorClick,
  onAddToCart,
  openCartDrawer,
  onProductViewsUpdated,
}: ProductoIdTiendaViewProps) {
  const [selectedProductMediaUrl, setSelectedProductMediaUrl] = useState<string>(
    () => selectedProduct?.imageUrl || ""
  );
  const [selectedVariants, setSelectedVariants] = useState<{ [key: string]: string }>({});
  const [optionsValidationError, setOptionsValidationError] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOptionItem[]>(() =>
    getManualShippingOptions(selectedProduct)
  );
  const [selectedShippingOption, setSelectedShippingOption] = useState<ShippingOptionItem | null>(
    null
  );

  const gallerySliderRef = useRef<HTMLDivElement>(null);
  const galleryVideoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailItemRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryVideoPlaying, setIsGalleryVideoPlaying] = useState<boolean>(true);
  const [isGalleryVideoMuted, setIsGalleryVideoMuted] = useState<boolean>(true);

  const getSellerInfo = (sellerId: string) => {
    return users.find((u) => u.id === sellerId) || { name: "Vendedor Destacado", avatar: "" };
  };

  // Normalize variants for detail rendering
  const effectiveVariantGroups = React.useMemo(() => {
    if (!selectedProduct) return [];
    if (Array.isArray(selectedProduct.variants) && selectedProduct.variants.length > 0) {
      return selectedProduct.variants;
    }
    const list = Array.isArray(selectedProduct.variantList) ? selectedProduct.variantList : [];
    const groups = new Map<string, Set<string>>();
    for (const item of list) {
      const color = typeof item.color === "string" ? item.color.trim() : "";
      const size = typeof item.size === "string" ? item.size.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (color) {
        if (!groups.has("Color")) groups.set("Color", new Set());
        groups.get("Color")!.add(color);
      }
      if (size) {
        if (!groups.has("Talla")) groups.set("Talla", new Set());
        groups.get("Talla")!.add(size);
      }
      if (!color && !size && name) {
        if (!groups.has("Opción")) groups.set("Opción", new Set());
        groups.get("Opción")!.add(name);
      }
    }
    return Array.from(groups.entries()).map(([name, options]) => ({
      name,
      options: Array.from(options),
    }));
  }, [selectedProduct]);

  const checkIsVideo = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      Boolean(
        selectedProduct?.videos &&
          selectedProduct.videos.some((v) => v === url || lower.includes(v.toLowerCase()))
      ) ||
      lower.includes(".m3u8") ||
      lower.includes("video") ||
      lower.startsWith("data:video") ||
      lower.startsWith("blob:")
    );
  };

  const productGalleryMedia = React.useMemo(() => {
    if (!selectedProduct) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (u?: string) => {
      if (!u || seen.has(u)) return;
      seen.add(u);
      list.push(u);
    };

    push(selectedProduct.imageUrl);
    (selectedProduct.images || []).forEach(push);
    (selectedProduct.videos || []).forEach(push);
    (selectedProduct.variantList || []).forEach((variant) => push(variant.imageUrl));

    return list.length ? list : [selectedProduct.imageUrl].filter(Boolean);
  }, [selectedProduct]);

  // Reset state when switching products
  useEffect(() => {
    if (selectedProduct) {
      setSelectedProductMediaUrl(selectedProduct.imageUrl);
      setSelectedVariants({});
      setOptionsValidationError(null);
      setShippingOptions(getManualShippingOptions(selectedProduct));
      setSelectedShippingOption(null);
      setActiveGalleryIndex(0);
      setIsGalleryVideoPlaying(true);
      setIsGalleryVideoMuted(true);
      if (gallerySliderRef.current) {
        gallerySliderRef.current.scrollLeft = 0;
      }
    }
  }, [selectedProduct?.id]);

  // Track and count views when a product's detail page is visited
  useEffect(() => {
    if (selectedProduct?.id) {
      const prodId = selectedProduct.id;
      apiFetch(`/api/products/${encodeURIComponent(prodId)}/view`, { method: "POST" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.views === "number") {
            onProductViewsUpdated?.(prodId, data.views);
          }
        })
        .catch(() => {});
    }
  }, [selectedProduct?.id]);

  // Cleanup all gallery videos on unmount to prevent ghost background audio
  useEffect(() => {
    return () => {
      Object.keys(galleryVideoRefs.current).forEach((key) => {
        const videoEl = galleryVideoRefs.current[Number(key)];
        if (videoEl) {
          try {
            videoEl.pause();
            videoEl.muted = true;
          } catch {}
        }
      });
    };
  }, []);

  // Sync video playback with active gallery slide
  useEffect(() => {
    productGalleryMedia.forEach((mediaUrl, idx) => {
      const isVideo = checkIsVideo(mediaUrl);
      const videoEl = galleryVideoRefs.current[idx];
      if (isVideo && videoEl) {
        if (idx === activeGalleryIndex) {
          videoEl.muted = isGalleryVideoMuted;
          if (isGalleryVideoPlaying) {
            videoEl.play().catch((err) => {
              console.log("Gallery video playback paused or blocked:", err);
              setIsGalleryVideoPlaying(false);
            });
          } else {
            videoEl.pause();
          }
        } else {
          videoEl.pause();
          videoEl.muted = true;
        }
      }
    });
  }, [activeGalleryIndex, productGalleryMedia, isGalleryVideoPlaying, isGalleryVideoMuted]);

  // Sync thumbnail container scroll with active gallery index
  useEffect(() => {
    const thumbEl = thumbnailItemRefs.current[activeGalleryIndex];
    if (thumbEl && thumbnailTrackRef.current) {
      const container = thumbnailTrackRef.current;
      const thumbLeft = thumbEl.offsetLeft;
      const thumbWidth = thumbEl.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScroll = thumbLeft - containerWidth / 2 + thumbWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [activeGalleryIndex]);

  const handleGalleryScroll = () => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    if (width > 0) {
      const newIdx = Math.round(gallerySliderRef.current.scrollLeft / width);
      if (
        newIdx !== activeGalleryIndex &&
        newIdx >= 0 &&
        newIdx < productGalleryMedia.length
      ) {
        setActiveGalleryIndex(newIdx);
        if (productGalleryMedia[newIdx]) {
          setSelectedProductMediaUrl(productGalleryMedia[newIdx]);
        }
      }
    }
  };

  const scrollToGalleryIndex = (index: number) => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    gallerySliderRef.current.scrollTo({ left: index * width, behavior: "smooth" });
    setActiveGalleryIndex(index);
    if (productGalleryMedia[index]) {
      setSelectedProductMediaUrl(productGalleryMedia[index]);
    }
  };

  const getMissingOptions = (product: Product | null, selected: { [key: string]: string }) => {
    if (!product) return [];
    const missing: string[] = [];

    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((v) => {
        if (!selected[v.name] || !selected[v.name].trim()) {
          missing.push(v.name);
        }
      });
    } else if (product.variantList && product.variantList.length > 0) {
      const hasSwatches = product.variantList.some(
        (item) => item.imageUrl || item.color || item.name
      );
      if (hasSwatches && !selected["Color"] && !selected["Opción"]) {
        missing.push("Color");
      }
    }

    if (!selectedShippingOption) {
      missing.push("Envío");
    }

    return missing;
  };

  if (!selectedProduct) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Cargando detalles del producto...</p>
        <button
          type="button"
          onClick={handleBackToCatalog}
          className="mt-2 px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al catálogo
        </button>
      </div>
    );
  }

  return (
    <>
      <motion.div
        key="detail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-0 md:p-6 pb-4 md:pb-12"
      >
        {/* Image & Showcase */}
        <div className="space-y-4">
          {/* Main Media Viewer - Horizontal Scroll Gallery Slider */}
          <div className="w-full h-[360px] sm:h-[440px] md:h-[500px] rounded-none md:rounded-2xl overflow-hidden border-b md:border border-slate-200/80 bg-white relative group/gallery shadow-xs">
            {/* Horizontal Scroll Track */}
            <div
              ref={gallerySliderRef}
              onScroll={handleGalleryScroll}
              className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x pan-y",
              }}
            >
              {productGalleryMedia.map((mediaUrl, idx) => {
                const isVideo = checkIsVideo(mediaUrl);
                return (
                  <div
                    key={idx}
                    className="w-full h-full flex-shrink-0 snap-center relative flex items-center justify-center bg-black overflow-hidden group/vid"
                  >
                    {isVideo && mediaUrl.includes(".m3u8") ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        <NativeVideoPlayer
                          src=""
                          hlsUrl={mediaUrl}
                          poster={selectedProduct.imageUrl || selectedProduct.images?.[0]}
                          autoPlay={false}
                          loop={true}
                          muted={isGalleryVideoMuted}
                          preload="auto"
                          isCurrent={true}
                          className="w-full h-full object-contain bg-black"
                        />
                      </div>
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={`${selectedProduct.name} - ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover p-0 m-0 bg-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Image Counter Badge in Bottom-Left Corner */}
            {productGalleryMedia.length > 0 && (
              <div
                className="absolute bottom-3 left-3 z-20 px-2 py-0.5 text-white font-mono text-xs font-bold tracking-wider flex items-center space-x-1 pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                id="detail-image-counter"
              >
                <span className="text-amber-400 font-extrabold">{activeGalleryIndex + 1}</span>
                <span className="text-white/80">/</span>
                <span className="text-white">{productGalleryMedia.length}</span>
              </div>
            )}

            {/* Audio Toggle Button in Bottom-Right Corner (for active video) */}
            {checkIsVideo(productGalleryMedia[activeGalleryIndex]) && (
              <button
                type="button"
                id="gallery-video-mute-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGalleryVideoMuted((prev) => {
                    const nextMuted = !prev;
                    const currentVideo = galleryVideoRefs.current[activeGalleryIndex];
                    if (currentVideo) {
                      currentVideo.muted = nextMuted;
                    }
                    return nextMuted;
                  });
                }}
                className="absolute bottom-3 right-3 z-20 p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                title={isGalleryVideoMuted ? "Activar audio" : "Silenciar audio"}
                aria-label={isGalleryVideoMuted ? "Activar audio" : "Silenciar audio"}
              >
                {isGalleryVideoMuted ? (
                  <VolumeX className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : (
                  <Volume2 className="w-5 h-5 text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                )}
              </button>
            )}
          </div>

          {/* Media Thumbnails list (including photos and videos) */}
          {productGalleryMedia.length > 1 && (
            <div className="px-4 md:px-0 space-y-4">
              <div
                ref={thumbnailTrackRef}
                className="flex space-x-2 overflow-x-auto py-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
              >
                {productGalleryMedia.map((url, idx) => {
                  const isVideo = checkIsVideo(url);
                  const isSelected = activeGalleryIndex === idx;
                  return (
                    <button
                      key={`thumb-${idx}`}
                      ref={(el) => {
                        thumbnailItemRefs.current[idx] = el;
                      }}
                      type="button"
                      onClick={() => scrollToGalleryIndex(idx)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 relative cursor-pointer transition-all ${
                        isSelected
                          ? "border-slate-950 scale-105 shadow-xs"
                          : "border-slate-200 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {isVideo ? (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                          <img
                            src={
                              selectedProduct.imageUrl ||
                              selectedProduct.images?.[0] ||
                              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"
                            }
                            className="w-full h-full object-cover opacity-75"
                            referrerPolicy="no-referrer"
                            alt=""
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-xs" />
                          </div>
                          <span className="absolute bottom-0.5 right-0.5 bg-amber-500 text-slate-950 font-black text-[7px] px-1 rounded-xs uppercase tracking-tight">
                            VIDEO
                          </span>
                        </div>
                      ) : (
                        <img
                          src={url}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          alt=""
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Product Specs info */}
        <div className="flex flex-col justify-between px-4 md:px-0">
          <div>
            {/* Seller Header clickable */}
            <div
              onClick={() => onCreatorClick(selectedProduct.sellerId)}
              className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer transition-colors"
            >
              <img
                src={
                  getSellerInfo(selectedProduct.sellerId).avatar ||
                  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                }
                alt="Creator"
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover"
              />
              <span>
                Tienda de @
                {getSellerInfo(selectedProduct.sellerId).name.toLowerCase().replace(/\s+/g, "")}
              </span>
              <span className="text-[10px] text-amber-600 font-medium ml-1">Ver perfil →</span>
            </div>

            <h1 className="font-display font-extrabold text-xs sm:text-[15px] text-slate-900 mt-4 leading-tight">
              {selectedProduct.name}
            </h1>

            {/* Rating Stars & Price Section */}
            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap bg-slate-50/80 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2.5">
                <span
                  className="text-2xl sm:text-3xl font-black font-mono text-slate-950 tracking-tight"
                  id="product-detail-price"
                >
                  ${selectedProduct.price.toFixed(2)}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    selectedProduct.stock > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                      : "bg-rose-50 text-rose-700 border-rose-200/80"
                  }`}
                >
                  {selectedProduct.stock > 0 ? `En Stock` : "Agotado"}
                </span>
              </div>
            </div>

            {/* Product Options & Shipping Selection */}
            {(() => {
              const swatchesMap = new Map<
                string,
                { name: string; color?: string; imageUrl: string }
              >();
              if (selectedProduct.variantList) {
                selectedProduct.variantList.forEach((vItem) => {
                  if (!vItem.imageUrl) return;
                  const key = (vItem.color || vItem.name || vItem.imageUrl).trim().toLowerCase();
                  if (!swatchesMap.has(key)) {
                    swatchesMap.set(key, {
                      name: vItem.color || vItem.name || "Color",
                      color: vItem.color,
                      imageUrl: vItem.imageUrl,
                    });
                  }
                });
              }
              const uniqueSwatches = Array.from(swatchesMap.values());
              const hasOptionGroups = effectiveVariantGroups.length > 0;
              const configuredShippingButtons =
                shippingOptions.length > 0
                  ? shippingOptions
                  : getManualShippingOptions(selectedProduct);

              return (
                <div
                  className="mt-6 space-y-4 border-t border-slate-100 pt-4"
                  id="product-options-section"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>Selecciona tus opciones:</span>
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200/60 lowercase">
                        (requerido)
                      </span>
                    </p>
                  </div>

                  {/* Options Validation Error Notice */}
                  {optionsValidationError && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2.5 animate-bounce shadow-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{optionsValidationError}</span>
                    </div>
                  )}

                  {/* If we have option groups (e.g. Color, Talla) */}
                  {hasOptionGroups ? (
                    effectiveVariantGroups.map((v, idx) => {
                      const groupNameLower = v.name.toLowerCase().trim();
                      const isSizeGroup =
                        groupNameLower.includes("talla") ||
                        groupNameLower.includes("size") ||
                        groupNameLower.includes("medida") ||
                        groupNameLower.includes("dimension");

                      const isColorGroup =
                        !isSizeGroup &&
                        (groupNameLower.includes("color") ||
                          groupNameLower.includes("estilo") ||
                          groupNameLower.includes("style") ||
                          groupNameLower.includes("opción") ||
                          groupNameLower.includes("option") ||
                          groupNameLower.includes("modelo") ||
                          (selectedProduct.variants!.length === 1 && uniqueSwatches.length > 0));

                      if (isColorGroup) {
                        return (
                          <div key={idx} className="space-y-2 text-left">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                              <span className="text-slate-600">{v.name}:</span>
                            </div>

                            {/* Horizontal Carousel of Color Cards */}
                            <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
                              {v.options.map((opt, oIdx) => {
                                const matchingSwatch = uniqueSwatches.find(
                                  (s) =>
                                    s.name.toLowerCase() === opt.toLowerCase() ||
                                    (s.color && s.color.toLowerCase() === opt.toLowerCase()) ||
                                    s.name.toLowerCase().includes(opt.toLowerCase())
                                );
                                const imgUrl = matchingSwatch?.imageUrl;
                                const isSelected = selectedVariants[v.name] === opt;

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    title={opt}
                                    onClick={() => {
                                      const nextVariants = { ...selectedVariants, [v.name]: opt };
                                      setSelectedVariants(nextVariants);
                                      setOptionsValidationError(null);
                                      let resolvedImg = imgUrl;
                                      if (!resolvedImg && selectedProduct.variantList) {
                                        const match = selectedProduct.variantList.find(
                                          (vItem) =>
                                            (vItem.name &&
                                              vItem.name
                                                .toLowerCase()
                                                .includes(opt.toLowerCase())) ||
                                            (vItem.color &&
                                              vItem.color
                                                .toLowerCase()
                                                .includes(opt.toLowerCase()))
                                        );
                                        if (match && match.imageUrl) {
                                          resolvedImg = match.imageUrl;
                                        }
                                      }
                                      if (resolvedImg) {
                                        setSelectedProductMediaUrl(resolvedImg);
                                        const gIdx = productGalleryMedia.indexOf(resolvedImg);
                                        if (gIdx >= 0) {
                                          scrollToGalleryIndex(gIdx);
                                        }
                                      }
                                    }}
                                    className={`group snap-start flex flex-col items-center justify-between p-1 overflow-hidden rounded-xl border transition-all cursor-pointer shrink-0 relative ${
                                      imgUrl ? "w-18" : "px-3.5 py-2"
                                    } ${
                                      isSelected
                                        ? "bg-slate-950 text-white border-slate-950 shadow-md scale-[1.03]"
                                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs"
                                    }`}
                                  >
                                    {imgUrl ? (
                                      <>
                                        <div className="w-16 h-14 rounded-lg overflow-hidden relative bg-slate-100">
                                          <img
                                            src={imgUrl}
                                            alt={opt}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            referrerPolicy="no-referrer"
                                          />
                                        </div>
                                        <span
                                          className={`text-[10px] font-extrabold truncate max-w-full mt-1 px-0.5 leading-tight ${
                                            isSelected ? "text-white" : "text-slate-700"
                                          }`}
                                        >
                                          {opt}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs font-extrabold whitespace-nowrap">
                                        {opt}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      // Standard non-color option buttons (e.g. Talla)
                      return (
                        <div key={idx} className="space-y-1.5 text-left">
                          <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                            <span className="text-slate-600">{v.name}:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {v.options.map((opt, oIdx) => {
                              const isSelected = selectedVariants[v.name] === opt;
                              return (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedVariants({ ...selectedVariants, [v.name]: opt });
                                    setOptionsValidationError(null);
                                  }}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-slate-950 text-white border-slate-950 shadow-sm"
                                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : uniqueSwatches.length > 0 ? (
                    <div className="space-y-2 text-left">
                      <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                        <span className="text-slate-600">Color:</span>
                      </div>
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
                        {uniqueSwatches.map((swatch, sIdx) => {
                          const isSelected =
                            selectedVariants["Color"] === swatch.name ||
                            selectedProductMediaUrl === swatch.imageUrl;
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              title={swatch.name}
                              onClick={() => {
                                setSelectedProductMediaUrl(swatch.imageUrl);
                                setSelectedVariants((prev) => ({ ...prev, Color: swatch.name }));
                                setOptionsValidationError(null);
                                const gIdx = productGalleryMedia.indexOf(swatch.imageUrl);
                                if (gIdx >= 0) {
                                  scrollToGalleryIndex(gIdx);
                                }
                              }}
                              className={`group snap-start flex flex-col items-center justify-between p-1 overflow-hidden rounded-xl border transition-all cursor-pointer w-18 shrink-0 relative ${
                                isSelected
                                  ? "bg-slate-950 text-white border-slate-950 shadow-md scale-[1.03]"
                                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-2xs"
                              }`}
                            >
                              <div className="w-16 h-14 rounded-lg overflow-hidden bg-slate-100">
                                <img
                                  src={swatch.imageUrl}
                                  alt={swatch.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span
                                className={`text-[10px] font-extrabold truncate max-w-full mt-1 px-0.5 leading-tight ${
                                  isSelected ? "text-white" : "text-slate-700"
                                }`}
                              >
                                {swatch.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Shipping Options as Buttons (like Size/Color) */}
                  <div className="space-y-1.5 text-left" id="product-shipping-options-group">
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="text-slate-600">Envío:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {configuredShippingButtons.map((option, sIdx) => {
                        const isSelected =
                          selectedShippingOption?.carrier === option.carrier &&
                          selectedShippingOption?.shippingCost === option.shippingCost;
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => {
                              setSelectedShippingOption(option);
                              setOptionsValidationError(null);
                              if (selectedProduct) {
                                selectedProduct.shippingCost = option.shippingCost;
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex flex-wrap items-center gap-1.5 ${
                              isSelected
                                ? "bg-slate-950 text-white border-slate-950 shadow-sm"
                                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            <span>{option.carrier}:</span>
                            <span
                              className={`font-mono ${
                                isSelected ? "text-amber-400" : "text-emerald-700"
                              }`}
                            >
                              {option.shippingCost === 0
                                ? "GRATIS ($0.00)"
                                : `$${option.shippingCost.toFixed(2)}`}
                            </span>
                            {option.aging && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  isSelected
                                    ? "bg-slate-800 text-slate-200"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                ⏱ {option.aging}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Add to Cart button integrated directly in product detail page */}
            <div
              className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pt-1.5 pb-[1px] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] mt-0 md:static md:z-auto md:bg-transparent md:backdrop-blur-none md:shadow-none md:px-0 md:pt-4 md:pb-0 md:mt-6 md:border-t md:border-slate-100"
              id="shipping-calculation-section"
            >
              <div className="w-full m-0 p-0">
                {(() => {
                  const missingOpts = getMissingOptions(selectedProduct, selectedVariants);
                  const hasMissingOpts = missingOpts.length > 0;

                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedProduct.stock > 0) {
                          const currentMissing = getMissingOptions(
                            selectedProduct,
                            selectedVariants
                          );
                          if (currentMissing.length > 0 || !selectedShippingOption) {
                            setOptionsValidationError(
                              `Por favor selecciona tu ${currentMissing.join(
                                " y "
                              )} antes de añadir al carrito.`
                            );
                            document
                              .getElementById("product-options-section")
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            return;
                          }

                          const variantStr = Object.entries(selectedVariants)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ");

                          const activeImageUrl =
                            selectedProductMediaUrl || selectedProduct.imageUrl;

                          const customizedProduct: Product = {
                            ...selectedProduct,
                            imageUrl: activeImageUrl,
                            name: variantStr
                              ? `${selectedProduct.name} (${variantStr})`
                              : selectedProduct.name,
                            shippingCost: selectedShippingOption.shippingCost,
                            selectedCarrier: selectedShippingOption.aging
                              ? `${selectedShippingOption.carrier} (${selectedShippingOption.aging})`
                              : selectedShippingOption.carrier,
                            selectedDeliveryTime: selectedShippingOption.aging,
                          };

                          onAddToCart(customizedProduct);
                          openCartDrawer();
                        }
                      }}
                      disabled={selectedProduct.stock <= 0}
                      className={`w-full py-3 sm:py-3.5 px-6 rounded-xl font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-md active:scale-98 text-center ${
                        selectedProduct.stock <= 0
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : hasMissingOpts
                          ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-500/20"
                          : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25"
                      }`}
                      id="add-to-cart-detail-btn"
                    >
                      {selectedProduct.stock <= 0 ? (
                        <span>Agotado</span>
                      ) : hasMissingOpts ? (
                        <>
                          <AlertCircle className="w-5 h-5 shrink-0 text-slate-950" />
                          <span className="whitespace-nowrap">
                            {missingOpts.length === 1
                              ? `Elegir ${missingOpts[0]}`
                              : "Elegir opciones"}
                          </span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5 shrink-0 text-slate-950" />
                          <span className="whitespace-nowrap">Añadir al Carrito</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Product Description Section */}
      {selectedProduct.description && (
        <div
          className="mt-6 md:mt-8 bg-white rounded-2xl border-0 p-5 sm:p-7 mx-0 md:mx-6"
          id="product-detail-description-container"
        >
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
            <FileText className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Descripción del Producto
            </h2>
          </div>
          <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
            {selectedProduct.description}
          </div>
        </div>
      )}

      {/* Security badges */}
      <div className="px-4 md:px-6 mt-4 pb-20 md:pb-10">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500 font-semibold">
          <div className="flex flex-col items-center">
            <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1" />
            <span>Pago Seguro</span>
          </div>
          <div className="flex flex-col items-center border-x border-slate-200/60">
            <Truck className="w-5 h-5 text-amber-500 mb-1" />
            <span>Envío Rápido</span>
          </div>
          <div className="flex flex-col items-center">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400/20 mb-1" />
            <span>Garantía Oficial</span>
          </div>
        </div>
      </div>
    </>
  );
}

export const ProductoId = ProductoIdTiendaView;
export default ProductoIdTiendaView;
