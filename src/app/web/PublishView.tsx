import React, { useState, useRef } from "react";
import { User, Product, Reel, ProductVariantItem } from "../../types";
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
  Tag,
  Download,
  Truck,
  Globe,
  PackageCheck,
  RefreshCw
} from "lucide-react";
import { apiFetch } from "../../config";
import VideoUploadPreview from "./components/VideoUploadPreview";

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
  const [prodVariantList, setProdVariantList] = useState<ProductVariantItem[]>([]);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");

  // CJ Dropshipping Import states
  const [cjInputId, setCjInputId] = useState("");
  const [isImportingCj, setIsImportingCj] = useState(false);
  const [importedPhotoUrls, setImportedPhotoUrls] = useState<string[]>([]);
  const [importedCjVid, setImportedCjVid] = useState<string | undefined>(undefined);
  const [importedCjPid, setImportedCjPid] = useState<string | undefined>(undefined);
  const [cjLogistics, setCjLogistics] = useState<{
    variantId?: string;
    shippingOptions: {
      carrier: string;
      aging: string;
      shippingCost: number;
    }[];
  } | null>(null);

  const CJ_DEST_COUNTRIES = [
    { code: "US", name: "Estados Unidos 🇺🇸" },
    { code: "ES", name: "España 🇪🇸" },
    { code: "MX", name: "México 🇲🇽" },
    { code: "CO", name: "Colombia 🇨🇴" },
    { code: "CL", name: "Chile 🇨🇱" },
    { code: "AR", name: "Argentina 🇦🇷" },
    { code: "FR", name: "Francia 🇫🇷" },
    { code: "DE", name: "Alemania 🇩🇪" },
    { code: "GB", name: "Reino Unido 🇬🇧" },
    { code: "CA", name: "Canadá 🇨🇦" },
    { code: "BR", name: "Brasil 🇧🇷" },
    { code: "PE", name: "Perú 🇵🇪" },
    { code: "EC", name: "Ecuador 🇪🇨" },
    { code: "DO", name: "República Dominicana 🇩🇴" },
    { code: "IT", name: "Italia 🇮🇹" },
    { code: "PT", name: "Portugal 🇵🇹" },
    { code: "AU", name: "Australia 🇦🇺" },
  ];

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
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      // @ts-ignore
      video.webkitPlaysInline = true;
      const objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;

      let handled = false;
      const cleanup = () => {
        if (handled) return;
        handled = true;
        clearTimeout(timer);
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {}
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      };

      const timer = setTimeout(() => {
        if (!handled) {
          cleanup();
          // Generate a fallback dark canvas thumbnail if video decoding times out
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 360;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#0f172a";
              ctx.fillRect(0, 0, 640, 360);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Timeout al generar portada del video"));
              }, "image/jpeg", 0.85);
              return;
            }
          } catch (e) {}
          reject(new Error("Timeout al generar portada del video"));
        }
      }, 5000);

      const captureFrame = () => {
        if (handled) return;
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              cleanup();
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("No se pudo extraer la portada del video"));
              }
            }, "image/jpeg", 0.85);
          } else {
            cleanup();
            reject(new Error("No se pudo crear contexto del canvas"));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };

      video.onseeked = captureFrame;

      video.onerror = (err) => {
        cleanup();
        reject(err);
      };

      video.load();
    });
  };

  const uploadFileToGCS = async (file: File): Promise<{ url: string; hlsUrl?: string }> => {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts|m3u8)$/i.test(file.name);
    const fileToUpload = file;

    const createFormData = () => {
      const fd = new FormData();
      fd.append("file", fileToUpload, fileToUpload.name);
      fd.append("title", fileToUpload.name);
      fd.append("description", "Uploaded via publishing portal");
      fd.append("creatorId", currentUser.originalId || currentUser.id);
      fd.append("creatorOriginalId", currentUser.originalId || "");
      fd.append("creatorUsername", currentUser.username);
      return fd;
    };

    // Provide 5 minutes (300,000ms) for videos and 2 minutes for photos
    const timeoutMs = isVideo ? 300000 : 120000;
    let response: Response;
    try {
      response = await apiFetch("/api/upload", {
        method: "POST",
        body: createFormData(),
      }, timeoutMs);
    } catch (primaryErr: any) {
      // Direct relative fallback if primary fetch failed
      try {
        response = await fetch("/api/upload", {
          method: "POST",
          body: createFormData(),
        });
      } catch {
        throw new Error(`No se pudo conectar con el servidor de subida: ${primaryErr?.message || "error de red"}`);
      }
    }

    let rawText = await response.text();

    // If the server returned 5xx or HTML, attempt direct local fallback
    if (!response.ok || !rawText.trim().startsWith("{")) {
      try {
        const directRes = await fetch("/api/upload", {
          method: "POST",
          body: createFormData(),
        });
        const directText = await directRes.text();
        if (directRes.ok && directText.trim().startsWith("{")) {
          response = directRes;
          rawText = directText;
        }
      } catch {}
    }

    // Second fallback to android upload endpoint if standard failed
    if (!response.ok || !rawText.trim().startsWith("{")) {
      try {
        const androidRes = await fetch("/api/android/upload", {
          method: "POST",
          body: createFormData(),
        });
        const androidText = await androidRes.text();
        if (androidRes.ok && androidText.trim().startsWith("{")) {
          response = androidRes;
          rawText = androidText;
        }
      } catch {}
    }

    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      if (/^<!doctype html/i.test(rawText.trim()) || rawText.includes("<html")) {
        throw new Error(`El servidor devolvió una página HTML en lugar de JSON (HTTP ${response.status}) al procesar ${fileToUpload.name}.`);
      }
      if (!response.ok) {
        throw new Error(`Error en el servidor (${response.status}) al subir ${fileToUpload.name}.`);
      }
      throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}) al subir ${fileToUpload.name}`);
    }

    if (!response.ok || !data?.success || !data?.url) {
      throw new Error(data?.error || data?.message || data?.details || `Error subiendo archivo: ${fileToUpload.name}`);
    }

    return { url: data.url, hlsUrl: data.hlsUrl };
  };

  const uploadFilesSequentially = async (files: File[]) => {
    const uploaded: { url: string; hlsUrl?: string }[] = [];
    for (const file of files) {
      uploaded.push(await uploadFileToGCS(file));
    }
    return uploaded;
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

  // Import CJ Product handler
  const handleImportCjProduct = async () => {
    if (!cjInputId.trim()) {
      setErrorMessage("Por favor ingresa un ID o SKU del producto de CJ Dropshipping.");
      return;
    }

    setIsImportingCj(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch(`/api/cj/import-product?pid=${encodeURIComponent(cjInputId.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.product) {
        throw new Error(data.error || "No se pudo importar el producto desde CJ Dropshipping");
      }

      const p = data.product;

      // Populate form fields for this session (NOT publishing automatically)
      setProdName(p.name || "");
      setProdDescription((p.description || "").slice(0, 35));
      setProdPrice(p.price ? String(p.price) : "");
      setProdQuantity(p.stock ? String(p.stock) : "50");
      setProdCategory(p.category || "Electrónica");

      setImportedCjVid(p.cjVariantId || p.logistics?.variantId || cjInputId.trim());
      setImportedCjPid(p.cjProductId || cjInputId.trim());

      if (p.images && p.images.length > 0) {
        setImportedPhotoUrls(p.images);
      }

      if (p.variants && p.variants.length > 0) {
        setProdVariants(p.variants);
      }

      if (p.variantList && p.variantList.length > 0) {
        setProdVariantList(p.variantList);
      }

      setSuccessMessage("¡Producto importado de CJ con éxito para esta sesión! Los datos se han cargado. Los clientes podrán seleccionar cualquier país de envío al comprar.");

    } catch (err: any) {
      console.error("Error importando de CJ:", err);
      setErrorMessage(err.message || "Error al conectar con la API de CJ Dropshipping");
    } finally {
      setIsImportingCj(false);
    }
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate authenticated user
    if (currentUser.isGuest || !currentUser.username || currentUser.username === "invitado" || currentUser.username === "guest") {
      setErrorMessage("Debes iniciar sesión con una cuenta para poder publicar contenido o registrar productos.");
      return;
    }

    // Validate 35 character max limit
    if (publishType !== "product" && description.length > 35) {
      setErrorMessage("La descripción excede el límite permitido de máximo 35 caracteres.");
      return;
    }
    if (publishType === "product" && prodDescription.length > 35) {
      setErrorMessage("La descripción del producto excede el límite permitido de máximo 35 caracteres.");
      return;
    }

    setIsLoading(true);

    try {
      if (publishType === "video") {
        if (!singleVideoFile) {
          throw new Error("Por favor, selecciona un video para tu publicación.");
        }
        if (!validateFileExtension(singleVideoFile, ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "ts", "m3u8"])) {
          throw new Error("El archivo de video debe tener un formato válido (.mp4, .mov, .m4v, .webm, etc.)");
        }

        // 1. Upload video
        const { url: videoUrl, hlsUrl } = await uploadFileToGCS(singleVideoFile);

        // Determine real cover thumbnail: custom image or auto-extracted video frame
        let thumbnailUrl = "";
        if (videoCoverFile) {
          try {
            const coverRes = await uploadFileToGCS(videoCoverFile);
            thumbnailUrl = coverRes.url;
          } catch (coverErr) {
            console.error("Error subiendo portada personalizada:", coverErr);
          }
        }

        if (!thumbnailUrl) {
          try {
            const frameBlob = await generateVideoThumbnail(singleVideoFile);
            const frameFile = new File([frameBlob], `thumb_${Date.now()}.jpg`, { type: "image/jpeg" });
            const frameRes = await uploadFileToGCS(frameFile);
            thumbnailUrl = frameRes.url;
          } catch (frameErr) {
            console.warn("No se pudo extraer miniatura del video:", frameErr);
            thumbnailUrl = videoUrl;
          }
        }

        // 2. Register Reel
        const response = await apiFetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl,
            hlsUrl,
            thumbnailUrl,
            description,
            creatorId: currentUser.originalId || currentUser.id,
            creatorOriginalId: currentUser.originalId || "",
            creatorUsername: currentUser.username,
            creatorName: currentUser.name,
            creatorAvatar: currentUser.avatar,
            type: "video",
            productId: taggedProductId || undefined
          }),
        });

        let resData: any = null;
        const resText = await response.text();
        try {
          resData = JSON.parse(resText);
        } catch {}

        if (!response.ok || (resData && resData.success === false)) {
          throw new Error(resData?.error || resData?.message || "Error al guardar la publicación en el servidor");
        }

        setSuccessMessage("¡Tu video se ha procesado a stream HLS (.m3u8) y publicado con éxito!");
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
        const { url: imageUrl } = await uploadFileToGCS(singleImageFile);

        // 2. Register Reel/Publication of type 'image'
        const response = await apiFetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: "",
            thumbnailUrl: imageUrl,
            description,
            creatorId: currentUser.originalId || currentUser.id,
            creatorOriginalId: currentUser.originalId || "",
            creatorUsername: currentUser.username,
            creatorName: currentUser.name,
            creatorAvatar: currentUser.avatar,
            type: "image",
            images: [imageUrl],
            productId: taggedProductId || undefined
          }),
        });

        let resData: any = null;
        const resText = await response.text();
        try {
          resData = JSON.parse(resText);
        } catch {}

        if (!response.ok || (resData && resData.success === false)) {
          throw new Error(resData?.error || resData?.message || "Error al guardar la publicación en el servidor");
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

        // 1. Upload one file at a time to avoid saturating the device and connection
        const uploadedImages = await uploadFilesSequentially(carouselImageFiles);
        const imageUrls = uploadedImages.map(img => img.url);

        // 2. Register publication of type 'carousel'
        const response = await apiFetch("/api/reels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoUrl: "",
            thumbnailUrl: imageUrls[0],
            description,
            creatorId: currentUser.originalId || currentUser.id,
            creatorOriginalId: currentUser.originalId || "",
            creatorUsername: currentUser.username,
            creatorName: currentUser.name,
            creatorAvatar: currentUser.avatar,
            type: "carousel",
            images: imageUrls,
            productId: taggedProductId || undefined
          }),
        });

        let resData: any = null;
        const resText = await response.text();
        try {
          resData = JSON.parse(resText);
        } catch {}

        if (!response.ok || (resData && resData.success === false)) {
          throw new Error(resData?.error || resData?.message || "Error al guardar la publicación en el servidor");
        }

        setSuccessMessage("¡Tu carrusel se ha publicado con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);

      } else if (publishType === "product") {
        if (!prodName.trim() || !prodDescription.trim() || !prodPrice.trim() || !prodQuantity.trim()) {
          throw new Error("Por favor, completa los campos requeridos del producto.");
        }

        // Validate product image extensions for uploaded files
        for (const file of productPhotoFiles) {
          if (!validateFileExtension(file, ["png", "jpeg", "jpg", "webp"])) {
            throw new Error(`La foto ${file.name} no tiene una extensión válida (.png, .jpeg, .jpg, .webp)`);
          }
        }

        // Validate product video extension if exists
        if (productVideoFile && !validateFileExtension(productVideoFile, ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "ts", "m3u8"])) {
          throw new Error("El video del producto debe tener una extensión válida");
        }

        // 1. Upload new product photos and combine with imported CJ photos
        const uploadedPhotoObjs = await uploadFilesSequentially(productPhotoFiles);
        const uploadedPhotoUrls = uploadedPhotoObjs.map(p => p.url);
        const photoUrls = [...importedPhotoUrls, ...uploadedPhotoUrls];

        if (photoUrls.length === 0) {
          throw new Error("Por favor, selecciona o importa al menos una foto para tu producto.");
        }

        // 2. Upload product video if present
        let videoUrl = "";
        if (productVideoFile) {
          const videoRes = await uploadFileToGCS(productVideoFile);
          videoUrl = videoRes.url;
        }

        // 3. Register Product
        const response = await apiFetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            description: prodDescription,
            price: parseFloat(prodPrice),
            imageUrl: photoUrls[0],
            stock: parseInt(prodQuantity),
            sellerId: currentUser.originalId || currentUser.id,
            sellerOriginalId: currentUser.originalId || "",
            sellerUsername: currentUser.username,
            sellerName: currentUser.name,
            sellerAvatar: currentUser.avatar,
            shippingCost: parseFloat(prodShipping) || 0,
            images: photoUrls,
            videos: videoUrl ? [videoUrl] : [],
            variants: prodVariants,
            variantList: prodVariantList,
            category: prodCategory,
            cjVid: importedCjVid,
            cjPid: importedCjPid
          }),
        });

        let resData: any = null;
        const resText = await response.text();
        try {
          resData = JSON.parse(resText);
        } catch {}

        if (!response.ok || (resData && resData.success === false)) {
          throw new Error(resData?.error || resData?.message || "Error al guardar el producto en el servidor");
        }

        setSuccessMessage("¡Tu producto se ha registrado para la venta con éxito!");
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error publishing:", err);
      let msg = err.message || "Error al realizar la publicación";
      if (typeof msg === "string" && (msg.includes("signal is aborted") || msg.includes("aborted"))) {
        msg = "La subida tardó más tiempo del esperado por tu velocidad de conexión. Por favor, inténtalo nuevamente.";
      }
      setErrorMessage(msg);
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
                accept="video/mp4, video/quicktime, video/webm, video/x-m4v, video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSingleVideoFile(file);
                }}
                className="hidden"
              />
              {singleVideoFile ? (
                <div className="space-y-4 w-full max-w-xl">
                  {/* Interactive Video Preview Player and Metadata Summary */}
                  <VideoUploadPreview
                    file={singleVideoFile}
                    coverFile={videoCoverFile}
                    onRemove={() => setSingleVideoFile(null)}
                    onChangeFile={() => videoInputRef.current?.click()}
                  />
                  
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
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Soporta cualquier formato de video (transcodificación exclusiva a HLS .m3u8)</p>
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
                  {/* Imported CJ Photos */}
                  {importedPhotoUrls.map((url, idx) => (
                    <div key={`imp-${idx}`} className="w-12 h-12 rounded overflow-hidden border-2 border-amber-500/60 relative group shadow-sm">
                      <img src={url} alt={`Imported ${idx}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 bg-amber-500 text-[8px] font-bold text-slate-950 text-center leading-tight">CJ</span>
                      <button
                        type="button"
                        onClick={() => setImportedPhotoUrls(importedPhotoUrls.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 p-0.5 bg-slate-900/90 text-white rounded cursor-pointer opacity-80 group-hover:opacity-100"
                        title="Eliminar foto importada"
                      >
                        <X className="w-2.5 h-2.5 text-rose-400" />
                      </button>
                    </div>
                  ))}

                  {/* Uploaded Local Files */}
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
                  {importedPhotoUrls.length === 0 && productPhotoFiles.length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">No hay fotos seleccionadas o importadas</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => prodPhotosRef.current?.click()}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-700 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir Fotos Locales</span>
                </button>
              </div>

              {/* Product Video */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white/50">
                <p className="text-xs font-bold text-slate-700 mb-2">Video del Producto (Opcional)</p>
                <input
                  type="file"
                  ref={prodVideoRef}
                  accept="video/mp4, video/quicktime, video/webm, video/x-m4v, video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setProductVideoFile(file);
                  }}
                  className="hidden"
                />

                {productVideoFile ? (
                  <div className="mb-3">
                    <VideoUploadPreview
                      file={productVideoFile}
                      compact={true}
                      onRemove={() => setProductVideoFile(null)}
                      onChangeFile={() => prodVideoRef.current?.click()}
                    />
                  </div>
                ) : (
                  <div className="h-[48px] flex items-center justify-center text-center text-slate-400 text-[10px] italic border border-dashed border-slate-200 rounded mb-3">
                    Sin video seleccionado (se procesará a stream HLS)
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
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Descripción / Caption</label>
                <span className={`text-[10px] font-mono font-bold ${description.length >= 35 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {description.length} / 35 caracteres
                </span>
              </div>
              <textarea
                placeholder="Escribe una breve descripción (máximo 35 caracteres)..."
                value={description}
                maxLength={35}
                onChange={(e) => setDescription(e.target.value.slice(0, 35))}
                rows={2}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 font-medium"
              />
              <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Atención: Este campo tiene un límite estricto de máximo 35 caracteres.</span>
              </p>
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
                {userProducts.map((p, index) => (
                  <option key={`${p.id}-${index}`} value={p.id}>
                    {p.name} - ${p.price}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* PRODUCT SALE MODE */
          <div className="space-y-4">
            {/* CJ Dropshipping Importer Card */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 rounded-2xl border border-amber-500/40 text-white shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center space-x-2">
                      <span>Importar Producto de CJ Dropshipping</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/30">API Directa CJ</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">Ingresa el ID o SKU de CJ para extraer la información. Los clientes seleccionarán su país en el checkout y verán todos los transportistas de CJ en tiempo real.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Ingresa ID o SKU de CJ (ej: CJ3709637 o 2512100754141607700)..."
                    value={cjInputId}
                    onChange={(e) => setCjInputId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleImportCjProduct();
                      }
                    }}
                    className="w-full text-xs font-mono p-2.5 pr-8 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {cjInputId && (
                    <button
                      type="button"
                      onClick={() => setCjInputId("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleImportCjProduct}
                  disabled={isImportingCj}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 shrink-0 shadow-sm disabled:opacity-50"
                >
                  {isImportingCj ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Importando de CJ...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-slate-950" />
                      <span>Importar a esta sesión</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CJ Global Dynamic Shipping Status Banner */}
            {importedCjVid && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-amber-200">
                <Globe className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-white flex items-center space-x-2">
                    <span>Logística Global Dinámica Activa</span>
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded border border-amber-500/30">ID CJ: {importedCjPid}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    No necesitas seleccionar un país fijo. Cuando un cliente compre este producto, ingresará su dirección en cualquier país del mundo (EE.UU., España, México, Colombia, Chile, etc.) y la plataforma consultará la API de CJ en tiempo real para mostrarle todas las opciones de envío disponibles para que elija la que prefiera.
                  </p>
                </div>
              </div>
            )}



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
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">Descripción Detallada *</label>
                <span className={`text-[10px] font-mono font-bold ${prodDescription.length >= 35 ? 'text-rose-600' : 'text-amber-600'}`}>
                  {prodDescription.length} / 35 caracteres
                </span>
              </div>
              <textarea
                placeholder="Detalles del producto (máximo 35 caracteres)..."
                value={prodDescription}
                maxLength={35}
                onChange={(e) => setProdDescription(e.target.value.slice(0, 35))}
                rows={2}
                className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-amber-500 font-medium"
                required
              />
              <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Atención: La descripción del producto sólo admite máximo 35 caracteres.</span>
              </p>
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

              {/* Extracted Variant Images Preview (Grouped by unique color/image) */}
              {prodVariantList.length > 0 && (() => {
                const uniquePreviewMap = new Map<string, ProductVariantItem>();
                prodVariantList.forEach((item) => {
                  const key = (item.color || item.name || item.imageUrl || "").trim().toLowerCase();
                  if (key && !uniquePreviewMap.has(key)) {
                    uniquePreviewMap.set(key, item);
                  }
                });
                const uniquePreviewList = Array.from(uniquePreviewMap.values());

                return (
                  <div className="pt-3 border-t border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Imágenes de Colores y Variantes Extraídas ({uniquePreviewList.length})</span>
                      </span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-700 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30">CJ API</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-white/70 rounded-xl border border-slate-200/80 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {uniquePreviewList.map((vItem, idx) => (
                        <div key={idx} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs hover:border-amber-400 transition-colors">
                          {vItem.imageUrl ? (
                            <img
                              src={vItem.imageUrl}
                              alt={vItem.name}
                              className="w-10 h-10 rounded-md object-cover border border-slate-100 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-[8px] text-slate-400 font-mono">
                              Sin Foto
                            </div>
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-[10px] font-extrabold text-slate-900 truncate leading-tight" title={vItem.name}>{vItem.color || vItem.name}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[9px] text-slate-500 font-mono font-bold">${vItem.price?.toFixed(2)}</span>
                              {vItem.color && <span className="text-[8px] bg-amber-50 text-amber-700 font-semibold px-1 py-0.2 rounded border border-amber-200">{vItem.color}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                <span>
                  {publishType === "video" || (publishType === "product" && productVideoFile)
                    ? "Transcodificando a stream HLS (.m3u8)..."
                    : "Publicando en GCS..."}
                </span>
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
