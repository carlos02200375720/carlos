import React, { useRef, useState } from "react";
import { User, Product, ProductVariantItem } from "../../types";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { androidApiFetch } from "./api";
import AndroidVideoUploadPreview from "./components/AndroidVideoUploadPreview";

export interface AndroidPublishViewProps {
  currentUser: User;
  onBack: () => void;
  onSuccess: () => void;
  userProducts: Product[];
}

type PublishType = "video" | "product";

export default function AndroidPublishView({
  currentUser,
  onBack,
  onSuccess,
  userProducts,
}: AndroidPublishViewProps) {
  const [type, setType] = useState<PublishType>("video");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Video state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [productId, setProductId] = useState("");
  const [aspect, setAspect] = useState<"vertical" | "horizontal" | "square">("vertical");
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Product state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [shippingCapital, setShippingCapital] = useState("");
  const [shippingProvince, setShippingProvince] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [stock, setStock] = useState("10");
  const [category, setCategory] = useState("Ropa Femenina");
  const [productDescription, setProductDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Product variants & color images state
  const [prodVariants, setProdVariants] = useState<{ name: string; options: string[] }[]>([
    { name: "Talla", options: ["S", "M", "L"] },
    { name: "Color", options: ["Negro", "Blanco"] }
  ]);
  const [prodVariantList, setProdVariantList] = useState<ProductVariantItem[]>([]);
  const [newColorName, setNewColorName] = useState("");
  const [newColorFile, setNewColorFile] = useState<File | null>(null);
  const [colorImageFiles, setColorImageFiles] = useState<Record<string, File>>({});
  const [colorImagePreviews, setColorImagePreviews] = useState<Record<string, string>>({});
  const [editingColorTarget, setEditingColorTarget] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const newColorImageInputRef = useRef<HTMLInputElement>(null);
  const existingColorImageInputRef = useRef<HTMLInputElement>(null);

  const handleAddColorVariant = () => {
    const trimmedColor = newColorName.trim();
    if (!trimmedColor) return;
    const colorKey = trimmedColor.toLowerCase();

    setProdVariants((prev) => {
      const colorIdx = prev.findIndex((v) => v.name.trim().toLowerCase() === "color");
      if (colorIdx >= 0) {
        const existingOpts = prev[colorIdx].options;
        if (existingOpts.some((o) => o.trim().toLowerCase() === colorKey)) return prev;
        const updated = [...prev];
        updated[colorIdx] = { ...updated[colorIdx], options: [...existingOpts, trimmedColor] };
        return updated;
      }
      return [...prev, { name: "Color", options: [trimmedColor] }];
    });

    if (newColorFile) {
      const previewUrl = URL.createObjectURL(newColorFile);
      setColorImageFiles((prev) => ({ ...prev, [colorKey]: newColorFile }));
      setColorImagePreviews((prev) => ({ ...prev, [colorKey]: previewUrl }));
      setProdVariantList((prev) => [
        ...prev.filter((item) => (item.color || item.name || "").trim().toLowerCase() !== colorKey),
        {
          id: `var_color_${Date.now()}`,
          name: trimmedColor,
          color: trimmedColor,
          price: parseFloat(String(price).replace(",", ".")) || 0,
          imageUrl: previewUrl,
        },
      ]);
    }

    setNewColorName("");
    setNewColorFile(null);
    if (newColorImageInputRef.current) newColorImageInputRef.current.value = "";
  };

  const handleAssignColorImage = (colorName: string, file: File) => {
    const colorKey = colorName.trim().toLowerCase();
    const previewUrl = URL.createObjectURL(file);
    setColorImageFiles((prev) => ({ ...prev, [colorKey]: file }));
    setColorImagePreviews((prev) => ({ ...prev, [colorKey]: previewUrl }));
    setProdVariantList((prev) => [
      ...prev.filter((item) => (item.color || item.name || "").trim().toLowerCase() !== colorKey),
      {
        id: `var_color_${Date.now()}`,
        name: colorName.trim(),
        color: colorName.trim(),
        price: parseFloat(String(price).replace(",", ".")) || 0,
        imageUrl: previewUrl,
      },
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    setProdVariants(prodVariants.filter((_, i) => i !== index));
  };

  const handleRemoveVariantOption = (variantIndex: number, optionToRemove: string) => {
    const targetVar = prodVariants[variantIndex];
    if (!targetVar) return;
    if (targetVar.name.trim().toLowerCase().includes("color")) {
      const colorKey = optionToRemove.trim().toLowerCase();
      setColorImageFiles((prev) => {
        const next = { ...prev };
        delete next[colorKey];
        return next;
      });
      setColorImagePreviews((prev) => {
        const next = { ...prev };
        delete next[colorKey];
        return next;
      });
      setProdVariantList((prev) =>
        prev.filter((item) => (item.color || item.name || "").trim().toLowerCase() !== colorKey)
      );
    }
    const nextOptions = targetVar.options.filter((o) => o !== optionToRemove);
    if (nextOptions.length === 0) {
      handleRemoveVariant(variantIndex);
    } else {
      setProdVariants(prodVariants.map((v, idx) => (idx === variantIndex ? { ...v, options: nextOptions } : v)));
    }
  };

  const handleAddVariant = () => {
    if (!newVarName.trim() || !newVarValue.trim()) return;
    const options = newVarValue
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (options.length === 0) return;
    const varNameClean = newVarName.trim();
    const existingIdx = prodVariants.findIndex((v) => v.name.trim().toLowerCase() === varNameClean.toLowerCase());
    if (existingIdx >= 0) {
      const merged = Array.from(new Set([...prodVariants[existingIdx].options, ...options]));
      setProdVariants(prodVariants.map((v, i) => (i === existingIdx ? { ...v, options: merged } : v)));
    } else {
      setProdVariants([...prodVariants, { name: varNameClean, options }]);
    }
    setNewVarName("");
    setNewVarValue("");
  };

  const selectVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVideo(f);
    setError(null);
    const u = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = u;
    v.onloadedmetadata = () => {
      const r = (v.videoWidth || 1) / (v.videoHeight || 1);
      setAspect(r < 0.85 ? "vertical" : r > 1.18 ? "horizontal" : "square");
      URL.revokeObjectURL(u);
    };
  };

  const upload = async (file: File) => {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(file.name);

    // 1. Direct GCS Signed URL upload for images (videos must go through backend FFmpeg HLS/faststart pipeline)
    if (!isVideo) {
      try {
        const folder = "publicaciones";
        const mime = file.type || "image/jpeg";
        const signedRes = await fetch(
          `/api/v1/media/upload-url?folder=${folder}&file_type=${encodeURIComponent(mime)}&file_name=${encodeURIComponent(file.name)}`
        );
        if (signedRes.ok) {
          const { upload_url, public_url } = await signedRes.json();
          if (upload_url && public_url) {
            const putRes = await fetch(upload_url, {
              method: "PUT",
              headers: { "Content-Type": mime },
              body: file,
            });
            if (putRes.ok) {
              console.log("⚡ [Android Direct GCS] Imagen subida vía Signed URL:", public_url);
              return { success: true, url: public_url };
            }
          }
        }
      } catch (e) {
        console.warn("⚠️ [Android Direct GCS] Falló subida directa, usando pipeline del servidor:", e);
      }
    }

    const createFormData = () => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("platform", "android");
      fd.append("creatorId", currentUser.originalId || currentUser.id);
      fd.append("creatorUsername", currentUser.username);
      return fd;
    };

    let r: Response;
    try {
      r = await androidApiFetch("/upload", { method: "POST", body: createFormData() });
    } catch {
      r = await fetch("/api/upload", { method: "POST", body: createFormData() });
    }

    let text = await r.text();
    if (!r.ok || !text.trim().startsWith("{")) {
      try {
        const altR = await fetch("/api/upload", { method: "POST", body: createFormData() });
        if (altR.ok) {
          const altText = await altR.text();
          if (altText.trim().startsWith("{")) {
            r = altR;
            text = altText;
          }
        }
      } catch {}
    }

    if (!r.ok) {
      if (/^<!doctype html/i.test(text)) {
        throw new Error(`El backend rechazó la subida (HTTP ${r.status}). Por favor reintenta.`);
      }
      let msg = text;
      try {
        const parsed = JSON.parse(text);
        msg = parsed?.error || parsed?.message || msg;
      } catch {}
      throw new Error(msg || `Error de subida HTTP ${r.status}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("El backend devolvió JSON inválido al subir el archivo.");
    }
  };

  const publishVideo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!video) return setError("Debes seleccionar un video para tu Reel.");
    if (!title.trim()) return setError("Por favor ingresa un título para el video.");

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const d = await upload(video);
      const url = d.url || d.videoUrl;
      if (!url) throw new Error("El backend no devolvió la URL del video.");

      const r = await androidApiFetch("/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type: "video",
          videoUrl: url,
          hlsUrl: d.hlsUrl,
          thumbnailUrl: d.thumbnailUrl,
          media: [{
            type: "video",
            url: d.hlsUrl || url,
            hlsUrl: d.hlsUrl,
            thumbnailUrl: d.thumbnailUrl || undefined,
          }],
          creatorId: currentUser.originalId || currentUser.id,
          creatorUsername: currentUser.username,
          creatorName: currentUser.name,
          creatorAvatar: currentUser.avatar,
          taggedProductId: productId || undefined,
          aspectRatio: aspect,
        }),
      });

      if (!r.ok) throw new Error(`No se pudo registrar la publicación (HTTP ${r.status}).`);
      setSuccess("¡Video publicado exitosamente!");
      setTimeout(onSuccess, 800);
    } catch (e: any) {
      setError(e?.message || "Error al publicar el video.");
    } finally {
      setLoading(false);
    }
  };

  const publishProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || !price.trim()) return setError("Nombre y precio son obligatorios.");

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const effectiveVariants = [...prodVariants.map((v) => ({ ...v, options: [...v.options] }))];
      const effectiveColorFiles: Record<string, File> = { ...colorImageFiles };
      if (newColorName.trim()) {
        const pendingColor = newColorName.trim();
        const pendingKey = pendingColor.toLowerCase();
        const cIdx = effectiveVariants.findIndex((v) => v.name.trim().toLowerCase() === "color");
        if (cIdx >= 0) {
          if (!effectiveVariants[cIdx].options.some((o) => o.trim().toLowerCase() === pendingKey)) {
            effectiveVariants[cIdx].options.push(pendingColor);
          }
        } else {
          effectiveVariants.push({ name: "Color", options: [pendingColor] });
        }
        if (newColorFile) {
          effectiveColorFiles[pendingKey] = newColorFile;
        }
      }

      const uploadedColorUrlMap: Record<string, string> = {};
      for (const [colorKey, file] of Object.entries(effectiveColorFiles)) {
        const uploadedRes = await upload(file);
        if (uploadedRes?.url) {
          uploadedColorUrlMap[colorKey] = uploadedRes.url;
        }
      }

      let imageUrl = "";
      if (image) {
        imageUrl = (await upload(image)).url;
      } else if (Object.values(uploadedColorUrlMap).length > 0) {
        imageUrl = Object.values(uploadedColorUrlMap)[0];
      } else {
        imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80";
      }
      if (!imageUrl) throw new Error("El backend no devolvió la URL de la imagen.");

      const parsedPrice = parseFloat(String(price).replace(",", ".")) || 0;
      const finalVariantList: ProductVariantItem[] = [];
      const seenVariantKeys = new Set<string>();
      const colorGroup = effectiveVariants.find((v) => v.name.trim().toLowerCase().includes("color"));
      const colorOptions = colorGroup ? colorGroup.options : [];

      colorOptions.forEach((opt, idx) => {
        const key = opt.trim().toLowerCase();
        const uploadedUrl = uploadedColorUrlMap[key];
        const existingItem = prodVariantList.find((item) => (item.color || item.name || "").trim().toLowerCase() === key);
        const resolvedImageUrl =
          uploadedUrl || (existingItem?.imageUrl && !existingItem.imageUrl.startsWith("blob:") ? existingItem.imageUrl : undefined);
        if (resolvedImageUrl) {
          seenVariantKeys.add(key);
          finalVariantList.push({
            id: existingItem?.id || `var_color_${Date.now()}_${idx}`,
            name: opt.trim(),
            color: opt.trim(),
            price: parsedPrice,
            imageUrl: resolvedImageUrl,
          });
        }
      });

      const allImages = Array.from(new Set([imageUrl, ...Object.values(uploadedColorUrlMap)].filter(Boolean)));

      const parsedCapital = Math.max(0, parseFloat(String(shippingCapital).replace(",", ".")) || 0);
      const parsedProvince = Math.max(0, parseFloat(String(shippingProvince).replace(",", ".")) || 0);
      const isFreeShipping = Boolean(freeShipping);
      const parsedStock = parseInt(String(stock), 10);
      const effectiveStock = !Number.isNaN(parsedStock) && parsedStock >= 0 ? parsedStock : 10;

      const r = await androidApiFetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: parsedPrice,
          shippingCost: isFreeShipping && parsedCapital === 0 ? 0 : parsedCapital,
          shippingCapital: parsedCapital,
          shippingProvince: parsedProvince,
          freeShipping: isFreeShipping,
          stock: effectiveStock,
          description: productDescription.trim(),
          category,
          imageUrl,
          images: allImages,
          variants: effectiveVariants,
          variantList: finalVariantList,
          sellerId: currentUser.originalId || currentUser.id,
          sellerName: currentUser.name,
          sellerUsername: currentUser.username,
          inStock: effectiveStock > 0,
        }),
      });

      if (!r.ok) throw new Error(`No se pudo crear el producto (HTTP ${r.status}).`);
      setSuccess("¡Producto publicado exitosamente!");
      setTimeout(onSuccess, 800);
    } catch (e: any) {
      setError(e?.message || "Error al publicar el producto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col h-full w-full overflow-hidden select-none">
      {/* 1. Header (Fixed at top) */}
      <header
        className="flex-shrink-0 bg-slate-950/95 border-b border-slate-850 px-4 py-3 backdrop-blur-md z-10"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Volver</span>
          </button>
          <h1 className="text-base font-bold text-white tracking-wide">Publicar</h1>
          <div className="w-16" /> {/* Spacer to keep title centered */}
        </div>

        {/* Type Switcher Tabs */}
        <div className="flex gap-2 mt-3 p-1 bg-slate-900/90 rounded-xl border border-slate-800/80">
          <button
            type="button"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              type === "video"
                ? "bg-amber-500 text-slate-950 shadow-md scale-[1.01]"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => {
              setType("video");
              setError(null);
            }}
          >
            <Video className="w-4 h-4" />
            <span>Video Reel</span>
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              type === "product"
                ? "bg-amber-500 text-slate-950 shadow-md scale-[1.01]"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => {
              setType("product");
              setError(null);
            }}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Producto</span>
          </button>
        </div>
      </header>

      {/* 2. Scrollable Body Content */}
      <main
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4 touch-pan-y"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingBottom: "10rem", // Generous bottom padding so last fields are completely visible above fixed footer
        }}
      >
        {/* Alerts */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 shadow-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{success}</span>
          </div>
        )}

        {/* Video Form Mode */}
        {type === "video" && (
          <div className="space-y-4">
            {/* Video selector / preview */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Archivo de Video <span className="text-amber-500">*</span>
              </label>
              {video ? (
                <div className="space-y-2">
                  <AndroidVideoUploadPreview
                    file={video}
                    onRemove={() => {
                      setVideo(null);
                      if (videoInputRef.current) videoInputRef.current.value = "";
                    }}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>Aspecto detectado: <b className="text-white capitalize">{aspect}</b></span>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                    >
                      Cambiar video
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-slate-700/90 hover:border-amber-500/80 bg-slate-900/50 hover:bg-slate-900/80 rounded-2xl flex flex-col items-center justify-center p-4 transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-amber-500/20 transition-all">
                    <Video className="w-6 h-6 text-slate-400 group-hover:text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-white mb-1">Toca para seleccionar video</span>
                  <span className="text-[11px] text-slate-400">MP4, WebM o MOV (hasta 100MB)</span>
                </button>
              )}
              <input
                ref={videoInputRef}
                hidden
                type="file"
                accept="video/*"
                onChange={selectVideo}
              />
            </div>

            {/* Video Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Título del Reel <span className="text-amber-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escribe un título llamativo..."
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                maxLength={100}
              />
            </div>

            {/* Video Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descripción y hashtags (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Escribe detalles del video, hashtags (#moda, #tendencia)..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            {/* Tagged Product (if creator has products) */}
            {userProducts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Etiquetar producto en el video (opcional)
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">Sin producto etiquetado</option>
                  {userProducts.map((p, pIdx) => (
                    <option key={`${p.id}-${pIdx}`} value={p.id}>
                      {p.name} (${p.price?.toFixed(2) || "0.00"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Product Form Mode */}
        {type === "product" && (
          <div className="space-y-4">
            {/* Product Image */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Foto del Producto
              </label>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 truncate">
                  <ImageIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="truncate">{image ? image.name : "Seleccionar imagen"}</span>
                </div>
                <span className="text-xs text-amber-400 font-semibold flex-shrink-0 ml-2">Explorar</span>
                <input
                  ref={imageInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                />
              </button>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre del Producto <span className="text-amber-500">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Chaqueta Vintage con Cinturón"
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Product Price & Stock */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Precio ($) <span className="text-amber-500">*</span>
                </label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Stock <span className="text-amber-500">*</span>
                </label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="10"
                  className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* 3 Campos de Configuración de Envío */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">Configuración de Envío (3 campos)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Precio de envío a la capital */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    1. Precio de envío a la capital ($)
                  </label>
                  <input
                    value={shippingCapital}
                    onChange={(e) => setShippingCapital(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-3 rounded-xl border text-sm transition-colors bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* 2. Precio de envío a provincia */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    2. Precio de envío a provincia ($)
                  </label>
                  <input
                    value={shippingProvince}
                    onChange={(e) => setShippingProvince(e.target.value)}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-3 rounded-xl border text-sm transition-colors bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* 3. Envío gratis */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    3. Envío gratis
                  </label>
                  <button
                    type="button"
                    onClick={() => setFreeShipping(!freeShipping)}
                    className={`w-full p-3 rounded-xl border text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                      freeShipping
                        ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{freeShipping ? "Envío Gratis Activo" : "Activar Envío Gratis"}</span>
                    </span>
                    <span className="font-mono text-[10px]">
                      {freeShipping ? "SÍ ($0)" : "NO"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 font-semibold">Botones de envío:</span>
                {(() => {
                  const cap = Math.max(0, parseFloat(String(shippingCapital).replace(",", ".")) || 0);
                  const prov = Math.max(0, parseFloat(String(shippingProvince).replace(",", ".")) || 0);
                  const showFree = freeShipping;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                      {cap > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 font-extrabold border border-amber-500/40">
                          Capital: ${cap.toFixed(2)}
                        </span>
                      )}
                      {prov > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-extrabold border border-indigo-500/40">
                          Provincia: ${prov.toFixed(2)}
                        </span>
                      )}
                      {showFree && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/40">
                          Envío Gratis ($0.00)
                        </span>
                      )}
                      {cap <= 0 && prov <= 0 && !showFree && (
                        <span className="text-slate-500">Sin opciones seleccionadas</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Product Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="Ropa Femenina">Ropa Femenina</option>
                <option value="Ropa Masculina">Ropa Masculina</option>
                <option value="Mascotas">Mascotas</option>
                <option value="Hogar">Hogar</option>
                <option value="Salud">Salud</option>
                <option value="Joyas">Joyas</option>
                <option value="Bolsos">Bolsos</option>
                <option value="Zapatos">Zapatos</option>
                <option value="Juguetes">Juguetes</option>
                <option value="Deportes">Deportes</option>
                <option value="Electrónica">Electrónica</option>
                <option value="Automotriz">Automotriz</option>
                <option value="Teléfonos">Teléfonos</option>
                <option value="Informática">Informática</option>
                <option value="Moda">Moda</option>
                <option value="Calzado">Calzado</option>
                <option value="Accesorios">Accesorios</option>
                <option value="Tecnología">Tecnología</option>
                <option value="Belleza">Belleza</option>
              </select>
            </div>

            {/* Product Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Descripción del Producto
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Detalla materiales, tallas, cuidados..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
            </div>

            {/* Product Variants (Colores con Imagen y Tallas) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Tag className="w-4 h-4" />
                  <span>Variantes del Producto (Colores con Imagen, Tallas)</span>
                </span>
              </div>

              <input
                type="file"
                ref={existingColorImageInputRef}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && editingColorTarget) {
                    handleAssignColorImage(editingColorTarget, file);
                  }
                  setEditingColorTarget(null);
                  e.target.value = "";
                }}
              />

              {/* Dedicated Color Variant Creator with Image */}
              <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2.5">
                <span className="text-[11px] font-extrabold text-white block">
                  Crear Variante de Color (Nombre + Imagen del Color)
                </span>
                <p className="text-[10px] text-slate-400">
                  Ej: Escribe "Azul" y carga una imagen que represente ese color para el detalle del producto.
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nombre del color (Ej. Azul, Rojo, Negro...)"
                    value={newColorName}
                    onChange={(e) => setNewColorName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                  />

                  <input
                    type="file"
                    ref={newColorImageInputRef}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setNewColorFile(file);
                    }}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    {newColorFile ? (
                      <div className="flex-1 flex items-center gap-2 p-1.5 bg-slate-900 border border-amber-500/40 rounded-xl">
                        <img
                          src={URL.createObjectURL(newColorFile)}
                          alt="Color preview"
                          className="w-8 h-8 rounded-lg object-cover shrink-0"
                        />
                        <span className="text-[10px] text-slate-200 font-bold truncate flex-1">{newColorFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewColorFile(null);
                            if (newColorImageInputRef.current) newColorImageInputRef.current.value = "";
                          }}
                          className="p-1 text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => newColorImageInputRef.current?.click()}
                        className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-amber-500 rounded-xl text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>Cargar imagen del color</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleAddColorVariant}
                      disabled={!newColorName.trim()}
                      className="py-2.5 px-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Color</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active variants list */}
              {prodVariants.length > 0 && (
                <div className="space-y-2">
                  {prodVariants.map((variant, index) => {
                    const isColorGroup = variant.name.trim().toLowerCase().includes("color");
                    return (
                      <div key={index} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{variant.name}:</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(index)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isColorGroup ? (
                          <div className="grid grid-cols-2 gap-2">
                            {variant.options.map((opt, idx) => {
                              const colorKey = opt.trim().toLowerCase();
                              const previewImg =
                                colorImagePreviews[colorKey] ||
                                prodVariantList.find((item) => (item.color || item.name || "").trim().toLowerCase() === colorKey)?.imageUrl;
                              return (
                                <div key={idx} className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {previewImg ? (
                                      <img src={previewImg} alt={opt} className="w-9 h-9 rounded-md object-cover border border-amber-500/40 shrink-0" />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingColorTarget(opt);
                                          existingColorImageInputRef.current?.click();
                                        }}
                                        className="w-9 h-9 rounded-md border border-dashed border-slate-700 bg-slate-950 flex items-center justify-center text-slate-400 shrink-0"
                                      >
                                        <ImageIcon className="w-4 h-4" />
                                      </button>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-bold text-white truncate">{opt}</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingColorTarget(opt);
                                          existingColorImageInputRef.current?.click();
                                        }}
                                        className="text-[9px] font-bold text-amber-400 underline"
                                      >
                                        {previewImg ? "Cambiar foto" : "Cargar foto"}
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariantOption(index, opt)}
                                    className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {variant.options.map((opt, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-900 text-slate-300 px-2 py-1 rounded border border-slate-800">
                                <span>{opt}</span>
                                <button type="button" onClick={() => handleRemoveVariantOption(index, opt)} className="text-slate-500 hover:text-rose-400">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add another variant (e.g. Talla) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Otra variante (ej: Talla)"
                  value={newVarName}
                  onChange={(e) => setNewVarName(e.target.value)}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Opciones (ej: S, M, L)"
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer (Fixed at the bottom of the page) */}
      <footer
        className="flex-shrink-0 bg-slate-950/95 border-t border-slate-800/80 px-4 pt-3 pb-4 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.4)] z-20"
        style={{
          paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
        }}
      >
        <button
          type="button"
          onClick={type === "video" ? () => publishVideo() : () => publishProduct()}
          disabled={loading}
          id="android-publish-submit-button"
          className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Publicando...</span>
            </>
          ) : type === "video" ? (
            <>
              <Upload className="w-5 h-5 stroke-[2.5]" />
              <span>Publicar video</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
              <span>Publicar producto</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
