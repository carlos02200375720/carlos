import React, { useState, useRef } from "react";
import { User, Product, Reel } from "../types";
import { 
  ArrowLeft, 
  Video, 
  Image as ImageIcon, 
  Layers, 
  ShoppingBag, 
  Upload, 
  Trash2, 
  Plus, 
  X, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  Tag
} from "lucide-react";

interface PublishViewProps {
  currentUser: User;
  onBack: () => void;
  onSuccess: () => void;
  userProducts: Product[];
}

type PublishType = "video" | "image" | "carousel" | "product";

export default function PublishView({ currentUser, onBack, onSuccess, userProducts }: PublishViewProps) {
  const [publishType, setPublishType] = useState<PublishType>("video");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // General publication states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taggedProductId, setTaggedProductId] = useState("");

  // Product specific states
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodShipping, setProdShipping] = useState("");
  const [prodQuantity, setProdQuantity] = useState("");
  const [prodCategory, setProdCategory] = useState("Ropa Femenina");
  const [prodVariants, setProdVariants] = useState<{ name: string; options: string[] }[]>([
    { name: "Talla", options: ["S", "M", "L"] },
    { name: "Color", options: ["Negro", "Blanco"] }
  ]);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");

  // Media files states
  const [singleVideoFile, setSingleVideoFile] = useState<File | null>(null);
  const [videoCoverFile, setVideoCoverFile] = useState<File | null>(null);
  const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
  const [carouselImageFiles, setCarouselImageFiles] = useState<File[]>([]);
  const [productPhotoFiles, setProductPhotoFiles] = useState<File[]>([]);
  const [productVideoFile, setProductVideoFile] = useState<File | null>(null);

  // Drag and drop feedback
  const [isDragging, setIsDragging] = useState(false);

  // File input refs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoCoverInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const prodPhotosRef = useRef<HTMLInputElement>(null);
  const prodVideoRef = useRef<HTMLInputElement>(null);

  // File extensions checker helper
  const validateFileExtension = (file: File, allowedExtensions: string[]): boolean => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext ? allowedExtensions.includes(ext) : false;
  };

  // Upload file helper
  const generateVideoThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1.0, (video.duration || 1) / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(video.src);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("No se pudo extraer la portada del video"));
              }
            }, "image/jpeg", 0.85);
          } else {
            URL.revokeObjectURL(video.src);
            reject(new Error("No se pudo crear contexto del canvas"));
          }
        } catch (err) {
          URL.revokeObjectURL(video.src);
          reject(err);
        }
      };

      video.onerror = (err) => {
        URL.revokeObjectURL(video.src);
        reject(err);
      };
    });
  };

  const uploadFileToGCS = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("description", "Uploaded via publishing portal");
    formData.append("creatorId", currentUser.id);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error subiendo archivo: ${file.name}`);
    }

    const data = await response.json();
    if (!data.success || !data.url) {
      throw new Error(data.error || "No se recibió URL del archivo subido");
    }

    return data.url;
  };

  // Add custom variant
  const handleAddVariant = () => {
    if (!newVarName.trim() || !newVarValue.trim()) return;
    const options = newVarValue
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    
    if (options.length === 0) return;

    setProdVariants([...prodVariants, { name: newVarName.trim(), options }]);
    setNewVarName("");
    setNewVarValue("");
  };

  // Remove variant
  const handleRemoveVariant = (index: number) => {
    setProdVariants(prodVariants.filter((_, i) => i !== index));
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (publishType === "video") {
        if (!singleVideoFile) {
          throw new Error("Por favor, selecciona un video para tu publicación.");
        }
        if (!validateFileExtension(singleVideoFile, ["mp4"])) {
          throw new Error("El video debe tener una extensión válida (.mp4)");
        }

        // 1. Upload video
        const videoUrl = await uploadFileToGCS(singleVideoFile);

        // Determine real cover thumbnail: custom image or auto-extracted video frame
        let thumbnailUrl = "";
        if (videoCoverFile) {
          try {
            thumbnailUrl = await uploadFileToGCS(videoCoverFile);
          } catch (coverErr) {
            console.error("Error subiendo portada personalizada:", coverErr);
          }
        }

        if (!thumbnailUrl) {
          try {
            const frameBlob = await generateVideoThumbnail(singleVideoFile);
            const frameFile = new File([frameBlob], `thumb_${Date.now()}.jpg`, { type: "image/jpeg" });
            thumbnailUrl = await uploadFileToGCS(frameFile);
          } catch (frameErr) {
            console.warn("No se pudo extraer miniatura del video:", frameErr);
            thumbnailUrl = videoUrl;
          }
        }

        // 2. Register Reel
        const response = await fetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl,
            thumbnailUrl,
            description,
            creatorId: currentUser.id,
            type: "video",
            productId: taggedProductId || undefined
          }),
        });

        if (!response.ok) {
          throw new Error("Error al guardar la publicación en el servidor");
        }

        setSuccessMessage("¡Tu video se ha publicado con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);

      } else if (publishType === "image") {
        if (!singleImageFile) {
          throw new Error("Por favor, selecciona una imagen para tu publicación.");
        }
        if (!validateFileExtension(singleImageFile, ["png", "jpeg", "jpg", "webp"])) {
          throw new Error("La imagen debe tener una extensión válida (.png, .jpeg, .jpg, .webp)");
        }

        // 1. Upload image
        const imageUrl = await uploadFileToGCS(singleImageFile);

        // 2. Register Reel/Publication of type 'image'
        const response = await fetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: "",
            thumbnailUrl: imageUrl,
            description,
            creatorId: currentUser.id,
            type: "image",
            images: [imageUrl],
            productId: taggedProductId || undefined
          }),
        });

        if (!response.ok) {
          throw new Error("Error al guardar la publicación en el servidor");
        }

        setSuccessMessage("¡Tu imagen se ha publicado con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);

      } else if (publishType === "carousel") {
        if (carouselImageFiles.length === 0) {
          throw new Error("Por favor, selecciona al menos una imagen para tu carrusel.");
        }
        
        // Validate extensions
        for (const file of carouselImageFiles) {
          if (!validateFileExtension(file, ["png", "jpeg", "jpg", "webp"])) {
            throw new Error(`El archivo ${file.name} no tiene una extensión válida (.png, .jpeg, .jpg, .webp)`);
          }
        }

        // 1. Upload all carousel images in parallel
        const imageUrls = await Promise.all(carouselImageFiles.map(file => uploadFileToGCS(file)));

        // 2. Register publication of type 'carousel'
        const response = await fetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: "",
            thumbnailUrl: imageUrls[0],
            description,
            creatorId: currentUser.id,
            type: "carousel",
            images: imageUrls,
            productId: taggedProductId || undefined
          }),
        });

        if (!response.ok) {
          throw new Error("Error al guardar la publicación en el servidor");
        }

        setSuccessMessage("¡Tu carrusel se ha publicado con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);

      } else if (publishType === "product") {
        if (!prodName.trim() || !prodDescription.trim() || !prodPrice.trim() || !prodQuantity.trim()) {
          throw new Error("Por favor, completa los campos requeridos del producto.");
        }
        if (productPhotoFiles.length === 0) {
          throw new Error("Por favor, selecciona al menos una foto para tu producto.");
        }

        // Validate product image extensions
        for (const file of productPhotoFiles) {
          if (!validateFileExtension(file, ["png", "jpeg", "jpg", "webp"])) {
            throw new Error(`La foto ${file.name} no tiene una extensión válida (.png, .jpeg, .jpg, .webp)`);
          }
        }

        // Validate product video extension if exists
        if (productVideoFile && !validateFileExtension(productVideoFile, ["mp4"])) {
          throw new Error("El video del producto debe tener una extensión válida (.mp4)");
        }

        // 1. Upload product photos
        const photoUrls = await Promise.all(productPhotoFiles.map(file => uploadFileToGCS(file)));

        // 2. Upload product video if present
        let videoUrl = "";
        if (productVideoFile) {
          videoUrl = await uploadFileToGCS(productVideoFile);
        }

        // 3. Register Product
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            description: prodDescription,
            price: parseFloat(prodPrice),
            imageUrl: photoUrls[0],
            stock: parseInt(prodQuantity),
            sellerId: currentUser.id,
            shippingCost: parseFloat(prodShipping) || 0,
            images: photoUrls,
            videos: videoUrl ? [videoUrl] : [],
            variants: prodVariants,
            category: prodCategory
          }),
        });

        if (!response.ok) {
          throw new Error("Error al guardar el producto en el servidor");
        }

        setSuccessMessage("¡Tu producto se ha registrado para la venta con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error publishing:", err);
      setErrorMessage(err.message || "Error al realizar la publicación");
    } finally {
      setIsLoading(false);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;

    if (publishType === "video") {
      const file = files.find((f) => f.type.startsWith("video/"));
      if (file) setSingleVideoFile(file);
    } else if (publishType === "image") {
      const file = files.find((f) => f.type.startsWith("image/"));
      if (file) setSingleImageFile(file);
    } else if (publishType === "carousel") {
      const imgFiles = files.filter((f) => f.type.startsWith("image/"));
      setCarouselImageFiles([...carouselImageFiles, ...imgFiles]);
    } else if (publishType === "product") {
      const imgFiles = files.filter((f) => f.type.startsWith("image/"));
      setProductPhotoFiles([...productPhotoFiles, ...imgFiles]);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 transition-colors cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display font-extrabold text-sm text-slate-900">Crear Nueva Publicación</h2>
            <p className="text-[10px] text-slate-500 font-medium">Comparte contenido interactivo o vende productos</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1"></span>
          <span className="text-[10px] text-slate-600 font-mono font-bold mr-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">GCS & MongoDB</span>
        </div>
      </div>

      {/* Tabs / Content types selector */}
      <div className="grid grid-cols-4 border-b border-slate-100 p-2 gap-1 bg-slate-50/20">
        <button
          type="button"
          onClick={() => { setPublishType("video"); setErrorMessage(null); }}
          className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold font-sans transition-all cursor-pointer ${
            publishType === "video" 
              ? "bg-slate-950 text-white shadow-sm" 
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Video Reel</span>
        </button>

        <button
          type="button"
          onClick={() => { setPublishType("image"); setErrorMessage(null); }}
          className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold font-sans transition-all cursor-pointer ${
            publishType === "image" 
              ? "bg-slate-950 text-white shadow-sm" 
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Imagen</span>
        </button>

        <button
          type="button"
          onClick={() => { setPublishType("carousel"); setErrorMessage(null); }}
          className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold font-sans transition-all cursor-pointer ${
            publishType === "carousel" 
              ? "bg-slate-950 text-white shadow-sm" 
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Carrusel</span>
        </button>

        <button
          type="button"
          onClick={() => { setPublishType("product"); setErrorMessage(null); }}
          className={`flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-1.5 py-2.5 px-2 rounded-xl text-[11px] font-bold font-sans transition-all cursor-pointer ${
            publishType === "product" 
              ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/10" 
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Vender</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Alerts */}
        {errorMessage && (
          <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="font-sans font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="font-sans font-medium">{successMessage}</div>
          </div>
        )}

        {/* Media Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all ${
            isDragging 
              ? "border-amber-500 bg-amber-50/20" 
              : "border-slate-200 hover:border-slate-300 bg-slate-50/30"
          }`}
        >
          {publishType === "video" && (
            <>
              <input
                type="file"
                ref={videoInputRef}
                accept="video/mp4"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSingleVideoFile(file);
                }}
                className="hidden"
              />
              {singleVideoFile ? (
                <div className="space-y-3 w-full max-w-sm">
                  <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between text-left">
                    <div className="flex items-center space-x-2 overflow-hidden">
                      <Video className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-mono font-semibold text-slate-700 truncate">{singleVideoFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSingleVideoFile(null)}
                      className="p-1 hover:bg-slate-200 text-slate-500 rounded-md cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">El archivo cumple con el estándar requerido (.mp4)</p>
                  
                  {/* Custom video cover selector */}
                  <div className="mt-3 pt-3 border-t border-slate-200 w-full text-left">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span>Portada / Imagen de Miniatura</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                    </label>
                    <input
                      type="file"
                      ref={videoCoverInputRef}
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setVideoCoverFile(file);
                      }}
                      className="hidden"
                    />
                    {videoCoverFile ? (
                      <div className="flex items-center space-x-2.5 p-2 bg-slate-100 rounded-lg">
                        <img
                          src={URL.createObjectURL(videoCoverFile)}
                          alt="Portada"
                          className="w-10 h-10 object-cover rounded border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-xs font-semibold text-slate-800 truncate">{videoCoverFile.name}</p>
                          <p className="text-[10px] text-emerald-600 font-medium">Portada personalizada</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVideoCoverFile(null)}
                          className="p-1 hover:bg-slate-200 text-slate-500 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => videoCoverInputRef.current?.click()}
                        className="w-full py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Subir portada propia (Imagen)</span>
                      </button>
                    )}
                    {!videoCoverFile && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        * Si no subes una imagen, la app generará automáticamente la portada desde tu video.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="cursor-pointer space-y-2" onClick={() => videoInputRef.current?.click()}>
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Arrastra o haz clic para subir tu Video Reel</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Soporta formato .mp4</p>
                  </div>
                </div>
              )}
            </>
          )}

          {publishType === "image" && (
            <>
              <input
                type="file"
                ref={imageInputRef}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSingleImageFile(file);
                }}
                className="hidden"
              />
              {singleImageFile ? (
                <div className="space-y-3">
                  <div className="w-24 h-24 mx-auto rounded-lg overflow-hidden border border-slate-200 relative bg-slate-100">
                    <img 
                      src={URL.createObjectURL(singleImageFile)} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => setSingleImageFile(null)}
                      className="absolute top-1 right-1 p-1 bg-white/95 hover:bg-white text-slate-700 rounded-md shadow-sm cursor-pointer"
                    >
                      <X className="w-3 h-3 text-rose-500" />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 block">{singleImageFile.name}</span>
                </div>
              ) : (
                <div className="cursor-pointer space-y-2" onClick={() => imageInputRef.current?.click()}>
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Arrastra o haz clic para subir tu Imagen</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Formatos: .png, .jpeg, .webp</p>
                  </div>
                </div>
              )}
            </>
          )}

          {publishType === "carousel" && (
            <>
              <input
                type="file"
                ref={carouselInputRef}
                multiple
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setCarouselImageFiles([...carouselImageFiles, ...files]);
                }}
                className="hidden"
              />
              <div className="w-full space-y-4">
                {carouselImageFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 justify-center">
                    {carouselImageFiles.map((file, idx) => (
                      <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 relative bg-slate-100 shrink-0">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Carousel thumb" 
                          className="w-full h-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => setCarouselImageFiles(carouselImageFiles.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-white/90 rounded text-slate-600 shadow-sm cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5 text-rose-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="cursor-pointer space-y-1" onClick={() => carouselInputRef.current?.click()}>
                  <div className="mx-auto w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Agregar imágenes al carrusel</p>
                    <p className="text-[10px] text-slate-400 font-medium">Puedes subir múltiples imágenes (.png, .jpeg, .webp)</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {publishType === "product" && (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Product Photos */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white/50">
                <p className="text-xs font-bold text-slate-700 mb-2">Fotos del Producto *</p>
                <input
                  type="file"
                  ref={prodPhotosRef}
                  multiple
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setProductPhotoFiles([...productPhotoFiles, ...files]);
                  }}
                  className="hidden"
                />
                
                <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] justify-center items-center">
                  {productPhotoFiles.map((file, idx) => (
                    <div key={idx} className="w-12 h-12 rounded overflow-hidden border border-slate-150 relative">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setProductPhotoFiles(productPhotoFiles.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 p-0.5 bg-white/90 rounded text-slate-600 cursor-pointer"
                      >
                        <X className="w-2 h-2 text-rose-500" />
                      </button>
                    </div>
                  ))}
                  {productPhotoFiles.length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">No hay fotos seleccionadas</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => prodPhotosRef.current?.click()}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir Fotos</span>
                </button>
              </div>

              {/* Product Video */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white/50">
                <p className="text-xs font-bold text-slate-700 mb-2">Video del Producto (Opcional)</p>
                <input
                  type="file"
                  ref={prodVideoRef}
                  accept="video/mp4"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setProductVideoFile(file);
                  }}
                  className="hidden"
                />

                {productVideoFile ? (
                  <div className="p-2 bg-slate-50 border border-slate-150 rounded flex items-center justify-between mb-3 text-left">
                    <span className="text-[10px] font-mono font-medium text-slate-600 truncate max-w-[120px]">{productVideoFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setProductVideoFile(null)}
                      className="p-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-3 h-3 text-rose-500" />
                    </button>
                  </div>
                ) : (
                  <div className="h-[48px] flex items-center justify-center text-center text-slate-400 text-[10px] italic border border-dashed border-slate-200 rounded mb-3">
                    Sin video seleccionado (.mp4)
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => prodVideoRef.current?.click()}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir Video</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form Inputs based on Publish Type */}
        {publishType !== "product" ? (
          /* REGULAR PUBLICATIONS (Video/Image/Carousel) */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Título de la publicación</label>
              <input
                type="text"
                placeholder="Dale un título atractivo..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción / Caption</label>
              <textarea
                placeholder="Escribe algo sobre tu publicación... #Moda #Tech #Estilo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                <Tag className="w-3 h-3 text-slate-500" />
                <span>Etiquetar un Producto de mi Tienda (Opcional)</span>
              </label>
              <select
                value={taggedProductId}
                onChange={(e) => setTaggedProductId(e.target.value)}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
              >
                <option value="">-- No etiquetar producto --</option>
                {userProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ${p.price}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* PRODUCT SALE MODE */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  placeholder="Ej. Sudadera Oversized Neon"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
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
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Descripción Detallada *</label>
              <textarea
                placeholder="Escribe detalles sobre la calidad del material, confección, etc..."
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
                rows={3}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Precio ($) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Envío ($)</label>
                <input
                  type="number"
                  placeholder="Gratis (0.00)"
                  step="0.01"
                  value={prodShipping}
                  onChange={(e) => setProdShipping(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad (Stock) *</label>
                <input
                  type="number"
                  placeholder="Disponible"
                  value={prodQuantity}
                  onChange={(e) => setProdQuantity(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* Product Variants (Talla / Color) */}
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Variantes del Producto (Tallas, Colores, etc.)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Define las opciones que desees</span>
              </div>

              {/* Active variants list */}
              {prodVariants.length > 0 && (
                <div className="space-y-2">
                  {prodVariants.map((variant, index) => (
                    <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-150 shadow-sm">
                      <div className="flex flex-col text-left">
                        <span className="text-[11px] font-bold text-slate-900">{variant.name}:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {variant.options.map((opt, idx) => (
                            <span key={idx} className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60">
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(index)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Eliminar variante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New variant form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nombre (ej: Talla, Color, Material)</label>
                  <input
                    type="text"
                    placeholder="Nombre de la variante"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full text-xs font-sans p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Opciones (separadas por comas)</label>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      placeholder="Ej. S, M, L, XL  o  Negro, Rojo"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      className="flex-1 text-xs font-sans p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              publishType === "product"
                ? "bg-amber-500 hover:bg-amber-400"
                : "bg-amber-500 hover:bg-amber-400"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>Publicando en GCS...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Publicar Ahora</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
