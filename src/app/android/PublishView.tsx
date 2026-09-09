import React, { useState, useRef } from "react";
import { User, Product } from "../../types";
import { ArrowLeft, Video, Image as ImageIcon, ShoppingBag, Upload, Trash2, Loader2, Sparkles, AlertCircle, CheckCircle2, Tag } from "lucide-react";
import { androidApiFetch } from "./api";
import AndroidVideoUploadPreview from "./components/AndroidVideoUploadPreview";

export interface AndroidPublishViewProps {
  currentUser: User;
  onBack: () => void;
  onSuccess: () => void;
  userProducts: Product[];
}

type AndroidPublishType = "video" | "product";

export default function AndroidPublishView({
  currentUser,
  onBack,
  onSuccess,
  userProducts,
}: AndroidPublishViewProps) {
  const [publishType, setPublishType] = useState<AndroidPublishType>("video");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Video publishing state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Product publishing state
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCategory, setProdCategory] = useState("Moda");
  const [prodDescription, setProdDescription] = useState("");
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prodImgInputRef = useRef<HTMLInputElement>(null);
  const [detectedAspect, setDetectedAspect] = useState<'vertical' | 'horizontal' | 'square'>('vertical');

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);

      // Detect aspect ratio of the selected video file
      try {
        const tempVideo = document.createElement("video");
        tempVideo.preload = "metadata";
        tempVideo.src = URL.createObjectURL(file);
        tempVideo.onloadedmetadata = () => {
          const w = tempVideo.videoWidth || 0;
          const h = tempVideo.videoHeight || 0;
          if (w > 0 && h > 0) {
            const ratio = w / h;
            if (ratio < 0.85) setDetectedAspect('vertical');
            else if (ratio > 1.18) setDetectedAspect('horizontal');
            else setDetectedAspect('square');
          }
          URL.revokeObjectURL(tempVideo.src);
        };
      } catch {
        setDetectedAspect('vertical');
      }
    }
  };

  const handleProdImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProdImageFile(file);
      setProdImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePublishReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setErrorMessage("Debes seleccionar un video para tu Reel.");
      return;
    }
    if (!title.trim()) {
      setErrorMessage("Por favor ingresa un título.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Step 1: Upload media via Android endpoint
      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append("platform", "android");

      const uploadRes = await androidApiFetch("/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) {
        throw new Error(uploadData.error || "Fallo en la subida del video");
      }

      const videoUrl = uploadData.url || uploadData.videoUrl;

      // Step 2: Create Reel
      const reelRes = await androidApiFetch("/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          videoUrl,
          hlsUrl: uploadData.hlsUrl,
          thumbnailUrl: uploadData.thumbnailUrl,
          creatorId: currentUser.originalId || currentUser.id,
          creatorUsername: currentUser.username,
          creatorName: currentUser.name,
          creatorAvatar: currentUser.avatar,
          taggedProductId: selectedProductId || undefined,
          aspectRatio: detectedAspect,
        }),
      });

      if (!reelRes.ok) {
        throw new Error("No se pudo registrar la publicación en Android.");
      }

      setSuccessMessage("¡Publicación subida exitosamente a Android!");
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al publicar.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || !prodPrice.trim()) {
      setErrorMessage("Nombre y precio del producto son obligatorios.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      let imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80";

      if (prodImageFile) {
        const formData = new FormData();
        formData.append("file", prodImageFile);
        formData.append("platform", "android");

        const uploadRes = await androidApiFetch("/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          imageUrl = uploadData.url;
        }
      }

      const prodRes = await androidApiFetch("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prodName.trim(),
          price: parseFloat(prodPrice) || 0,
          description: prodDescription.trim(),
          category: prodCategory,
          imageUrl,
          sellerId: currentUser.originalId || currentUser.id,
          sellerName: currentUser.name,
          inStock: true,
        }),
      });

      if (!prodRes.ok) {
        throw new Error("No se pudo crear el producto.");
      }

      setSuccessMessage("¡Producto publicado en el catálogo de Android!");
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al publicar producto.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none pb-24" id="android-publish-view">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-white/10 active:scale-95 text-slate-300">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-bold">Publicar en Android</span>
        <div className="w-8" />
      </div>

      <div className="max-w-md mx-auto w-full p-4 space-y-5">
        {/* Format Selector */}
        <div className="flex p-1 bg-slate-900 rounded-2xl border border-slate-800">
          <button
            onClick={() => { setPublishType("video"); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              publishType === "video" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Reel Video</span>
          </button>
          <button
            onClick={() => { setPublishType("product"); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              publishType === "product" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Producto</span>
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-rose-500/20 text-rose-300 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center space-x-2 p-3 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {publishType === "video" ? (
          <form onSubmit={handlePublishReel} className="space-y-4">
            {/* Video Picker */}
            {videoFile ? (
              <AndroidVideoUploadPreview
                file={videoFile}
                onRemove={() => setVideoFile(null)}
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 p-4 transition-colors"
              >
                <Video className="w-10 h-10 text-amber-500 mb-2" />
                <span className="text-xs font-bold text-white">Seleccionar Video</span>
                <span className="text-[11px] text-slate-400 mt-1">MP4, WebM o MOV desde tu dispositivo Android</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del Reel..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Escribe una descripción o hashtags #moda #mall..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {userProducts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Etiquetar Producto de tu Tienda</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">Sin producto etiquetado</option>
                  {userProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ${p.price}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Publicar Video en Android</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePublishProduct} className="space-y-4">
            {/* Product Image Picker */}
            {prodImagePreview ? (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
                <img src={prodImagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setProdImageFile(null); setProdImagePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => prodImgInputRef.current?.click()}
                className="w-full h-36 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 p-4 transition-colors"
              >
                <ImageIcon className="w-8 h-8 text-amber-500 mb-1" />
                <span className="text-xs font-bold text-white">Foto del Producto</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPG o PNG</span>
                <input
                  ref={prodImgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProdImageSelect}
                  className="hidden"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nombre del Producto</label>
              <input
                type="text"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Ej. Chaqueta Urbana"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Precio ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="29.99"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Categoría</label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Moda">Moda</option>
                  <option value="Calzado">Calzado</option>
                  <option value="Accesorios">Accesorios</option>
                  <option value="Tecnología">Tecnología</option>
                  <option value="Belleza">Belleza</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Descripción</label>
              <textarea
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
                placeholder="Detalles del producto, materiales, envíos..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Publicar en Tienda de Android</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
