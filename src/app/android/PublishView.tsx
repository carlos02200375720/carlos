import React, { useRef, useState } from "react";
import { User, Product } from "../../types";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  ShoppingBag,
  Upload,
  Video,
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
  const [category, setCategory] = useState("Moda");
  const [productDescription, setProductDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    // 1. Direct GCS Signed URL upload attempt
    try {
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(file.name);
      const folder = isVideo ? "videos" : "publicaciones";
      const mime = file.type || (isVideo ? "video/mp4" : "image/jpeg");
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
            console.log("⚡ [Android Direct GCS] Subido exitoso vía Signed URL:", public_url);
            return { success: true, url: public_url, hlsUrl: isVideo ? public_url : undefined };
          }
        }
      }
    } catch (e) {
      console.warn("⚠️ [Android Direct GCS] Falló subida directa, usando pipeline del servidor:", e);
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
      let imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80";
      if (image) imageUrl = (await upload(image)).url;
      if (!imageUrl) throw new Error("El backend no devolvió la URL de la imagen.");

      const r = await androidApiFetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: parseFloat(price) || 0,
          description: productDescription.trim(),
          category,
          imageUrl,
          sellerId: currentUser.originalId || currentUser.id,
          sellerName: currentUser.name,
          inStock: true,
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

            {/* Product Price */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Precio (USD) <span className="text-amber-500">*</span>
              </label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
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
                <option>Moda</option>
                <option>Calzado</option>
                <option>Accesorios</option>
                <option>Tecnología</option>
                <option>Belleza</option>
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
