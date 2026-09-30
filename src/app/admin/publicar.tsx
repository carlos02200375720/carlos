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
import { apiFetch, getApiUrl } from "../../config";
import VideoUploadPreview from "../web/components/VideoUploadPreview";

interface PublishViewProps {
  currentUser: User;
  onBack: () => void;
  onSuccess: () => void;
  userProducts: Product[];
  initialTab?: PublishType;
}

type PublishType = "video" | "image" | "carousel" | "product";

export default function PublishView({ currentUser, onBack, onSuccess, userProducts, initialTab = "video" }: PublishViewProps) {
  const [publishType, setPublishType] = useState<PublishType>(initialTab);
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
  const [prodShippingCapital, setProdShippingCapital] = useState("");
  const [prodShippingProvince, setProdShippingProvince] = useState("");
  const [prodFreeShipping, setProdFreeShipping] = useState(false);
  const [prodQuantity, setProdQuantity] = useState("");
  const [prodCategory, setProdCategory] = useState("Ropa Femenina");
  const [prodVariants, setProdVariants] = useState<{ name: string; options: string[] }[]>([
    { name: "Talla", options: ["S", "M", "L"] },
    { name: "Color", options: ["Negro", "Blanco"] }
  ]);
  const [prodVariantList, setProdVariantList] = useState<ProductVariantItem[]>([]);
  const [newVarName, setNewVarName] = useState("");
  const [newVarValue, setNewVarValue] = useState("");

  // Color variant with image states
  const [newColorName, setNewColorName] = useState("");
  const [newColorFile, setNewColorFile] = useState<File | null>(null);
  const [colorImageFiles, setColorImageFiles] = useState<Record<string, File>>({});
  const [colorImagePreviews, setColorImagePreviews] = useState<Record<string, string>>({});
  const [editingColorTarget, setEditingColorTarget] = useState<string | null>(null);

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
  const newColorImageInputRef = useRef<HTMLInputElement>(null);
  const existingColorImageInputRef = useRef<HTMLInputElement>(null);

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

    // 1. PATRÓN DE SUBIDA DIRECTA A GOOGLE CLOUD STORAGE (Signed URLs) PARA IMÁGENES
    // Los videos pasan por el pipeline del backend para segmentación HLS / faststart (moov al inicio)
    if (!isVideo) {
      try {
        const folder = "publicaciones";
        const mime = fileToUpload.type || "image/jpeg";
        const signedUrlRes = await fetch(
          getApiUrl(`/api/v1/media/upload-url?folder=${folder}&file_type=${encodeURIComponent(mime)}&file_name=${encodeURIComponent(fileToUpload.name)}`)
        );

        if (signedUrlRes.ok) {
          const { upload_url, public_url } = await signedUrlRes.json();
          if (upload_url && public_url) {
            console.log(`⚡ [Direct GCS] Subiendo ${fileToUpload.name} directo a Google Cloud Storage...`);
            const putRes = await fetch(upload_url, {
              method: "PUT",
              headers: {
                "Content-Type": mime,
              },
              body: fileToUpload,
            });

            if (putRes.ok) {
              console.log(`✅ [Direct GCS] Subida directa exitosa a GCS: ${public_url}`);
              return { url: public_url };
            } else {
              console.warn(`⚠️ [Direct GCS] PUT directo a GCS retornó HTTP ${putRes.status}. Usando fallback vía servidor.`);
            }
          }
        }
      } catch (directErr) {
        console.warn("⚠️ [Direct GCS] Subida directa no disponible o bloqueada por CORS en navegador. Usando fallback al servidor:", directErr);
      }
    }

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
      console.warn("⚠️ [PublishView] Fallo inicial con apiFetch(/api/upload), intentando fetch relativo directo...", primaryErr);
      // Direct relative fallback if primary fetch failed
      try {
        response = await fetch("/api/upload", {
          method: "POST",
          body: createFormData(),
        });
      } catch (localErr) {
        try {
          response = await fetch("/api/android/upload", {
            method: "POST",
            body: createFormData(),
          });
        } catch {
          throw new Error(`No se pudo conectar con el servidor de subida: ${primaryErr?.message || "error de red"}`);
        }
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

  // Add color variant with optional image
  const handleAddColorVariant = () => {
    const trimmedColor = newColorName.trim();
    if (!trimmedColor) return;
    const colorKey = trimmedColor.toLowerCase();

    // Update or create the "Color" group in prodVariants
    setProdVariants((prev) => {
      const colorIdx = prev.findIndex((v) => v.name.trim().toLowerCase() === "color");
      if (colorIdx >= 0) {
        const existingOpts = prev[colorIdx].options;
        const alreadyExists = existingOpts.some((o) => o.trim().toLowerCase() === colorKey);
        if (alreadyExists) return prev;
        const updated = [...prev];
        updated[colorIdx] = {
          ...updated[colorIdx],
          options: [...existingOpts, trimmedColor],
        };
        return updated;
      } else {
        return [...prev, { name: "Color", options: [trimmedColor] }];
      }
    });

    if (newColorFile) {
      const previewUrl = URL.createObjectURL(newColorFile);
      setColorImageFiles((prev) => ({ ...prev, [colorKey]: newColorFile }));
      setColorImagePreviews((prev) => ({ ...prev, [colorKey]: previewUrl }));
      setProdVariantList((prev) => {
        const filtered = prev.filter((item) => (item.color || item.name || "").trim().toLowerCase() !== colorKey);
        return [
          ...filtered,
          {
            id: `var_color_${Date.now()}`,
            name: trimmedColor,
            color: trimmedColor,
            price: parseFloat(prodPrice) || 0,
            imageUrl: previewUrl,
          },
        ];
      });
    }

    setNewColorName("");
    setNewColorFile(null);
    if (newColorImageInputRef.current) {
      newColorImageInputRef.current.value = "";
    }
  };

  // Attach or update image for an existing color option
  const handleAssignColorImage = (colorName: string, file: File) => {
    const colorKey = colorName.trim().toLowerCase();
    const previewUrl = URL.createObjectURL(file);
    setColorImageFiles((prev) => ({ ...prev, [colorKey]: file }));
    setColorImagePreviews((prev) => ({ ...prev, [colorKey]: previewUrl }));
    setProdVariantList((prev) => {
      const filtered = prev.filter((item) => (item.color || item.name || "").trim().toLowerCase() !== colorKey);
      return [
        ...filtered,
        {
          id: `var_color_${Date.now()}`,
          name: colorName.trim(),
          color: colorName.trim(),
          price: parseFloat(prodPrice) || 0,
          imageUrl: previewUrl,
        },
      ];
    });
  };

  // Remove a single option from a variant group
  const handleRemoveVariantOption = (variantIndex: number, optionToRemove: string) => {
    const targetVar = prodVariants[variantIndex];
    if (!targetVar) return;
    const isColorVar = targetVar.name.trim().toLowerCase().includes("color");
    if (isColorVar) {
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
      setProdVariants(
        prodVariants.map((v, idx) => (idx === variantIndex ? { ...v, options: nextOptions } : v))
      );
    }
  };

  // Add custom variant
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
      const existingOpts = prodVariants[existingIdx].options;
      const merged = Array.from(new Set([...existingOpts, ...options]));
      setProdVariants(prodVariants.map((v, i) => (i === existingIdx ? { ...v, options: merged } : v)));
    } else {
      setProdVariants([...prodVariants, { name: varNameClean, options }]);
    }
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
            type: "video",
            videoUrl,
            hlsUrl,
            thumbnailUrl,
            media: [{
              type: "video",
              url: hlsUrl || videoUrl,
              hlsUrl,
              thumbnailUrl: thumbnailUrl || undefined,
            }],
            description,
            creatorId: currentUser.originalId || currentUser.id,
            creatorOriginalId: currentUser.originalId || "",
            creatorUsername: currentUser.username,
            creatorName: currentUser.name,
            creatorAvatar: currentUser.avatar,
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

        // Include any pending color in the input field if the user didn't click "+ Añadir Color" yet
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

        // Validate product image extensions for uploaded files
        for (const file of productPhotoFiles) {
          if (!validateFileExtension(file, ["png", "jpeg", "jpg", "webp"])) {
            throw new Error(`La foto ${file.name} no tiene una extensión válida (.png, .jpeg, .jpg, .webp)`);
          }
        }

        for (const [colorKey, file] of Object.entries(effectiveColorFiles)) {
          if (!validateFileExtension(file, ["png", "jpeg", "jpg", "webp"])) {
            throw new Error(`La imagen del color "${colorKey}" (${file.name}) no tiene una extensión válida (.png, .jpeg, .jpg, .webp)`);
          }
        }

        // Validate product video extension if exists
        if (productVideoFile && !validateFileExtension(productVideoFile, ["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp", "ts", "m3u8"])) {
          throw new Error("El video del producto debe tener una extensión válida");
        }

        // 1. Upload new product photos
        const uploadedPhotoObjs = await uploadFilesSequentially(productPhotoFiles);
        const photoUrls = uploadedPhotoObjs.map(p => p.url);

        // 1.b Upload color variant images to GCS
        const uploadedColorUrlMap: Record<string, string> = {};
        for (const [colorKey, file] of Object.entries(effectiveColorFiles)) {
          const uploadedColorRes = await uploadFileToGCS(file);
          uploadedColorUrlMap[colorKey] = uploadedColorRes.url;
        }

        // Build final variantList with real uploaded image URLs for colors
        const finalVariantList: ProductVariantItem[] = [];
        const seenVariantKeys = new Set<string>();

        const colorGroup = effectiveVariants.find((v) => v.name.trim().toLowerCase().includes("color"));
        const colorOptions = colorGroup ? colorGroup.options : [];

        colorOptions.forEach((opt, idx) => {
          const key = opt.trim().toLowerCase();
          const uploadedUrl = uploadedColorUrlMap[key];
          const existingItem = prodVariantList.find(
            (item) => (item.color || item.name || "").trim().toLowerCase() === key
          );
          const resolvedImageUrl =
            uploadedUrl ||
            (existingItem?.imageUrl && !existingItem.imageUrl.startsWith("blob:") ? existingItem.imageUrl : undefined);

          if (resolvedImageUrl) {
            seenVariantKeys.add(key);
            finalVariantList.push({
              id: existingItem?.id || `var_color_${Date.now()}_${idx}`,
              name: opt.trim(),
              color: opt.trim(),
              price: parseFloat(prodPrice) || 0,
              imageUrl: resolvedImageUrl,
            });
          }
        });

        // Also keep any other non-blob items from prodVariantList
        prodVariantList.forEach((item, idx) => {
          const key = (item.color || item.name || "").trim().toLowerCase();
          if (!seenVariantKeys.has(key)) {
            const uploadedUrl = uploadedColorUrlMap[key];
            const resolvedImageUrl =
              uploadedUrl || (item.imageUrl && !item.imageUrl.startsWith("blob:") ? item.imageUrl : undefined);
            if (resolvedImageUrl) {
              seenVariantKeys.add(key);
              finalVariantList.push({
                ...item,
                id: item.id || `var_item_${Date.now()}_${idx}`,
                price: item.price || parseFloat(prodPrice) || 0,
                imageUrl: resolvedImageUrl,
              });
            }
          }
        });

        const colorPhotoUrls = Object.values(uploadedColorUrlMap).filter(Boolean);
        const allProductPhotos = Array.from(new Set([...photoUrls, ...colorPhotoUrls]));

        if (allProductPhotos.length === 0) {
          throw new Error("Por favor, selecciona al menos una foto para tu producto.");
        }

        // 2. Upload product video if present
        let videoUrl = "";
        if (productVideoFile) {
          const videoRes = await uploadFileToGCS(productVideoFile);
          videoUrl = videoRes.url;
        }

        // 3. Register Product
        const parsedCapital = Math.max(0, parseFloat(String(prodShippingCapital).replace(",", ".")) || 0);
        const parsedProvince = Math.max(0, parseFloat(String(prodShippingProvince).replace(",", ".")) || 0);
        const isFreeShipping = Boolean(prodFreeShipping);

        const response = await apiFetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            description: prodDescription,
            price: parseFloat(prodPrice),
            imageUrl: allProductPhotos[0],
            stock: parseInt(prodQuantity),
            sellerId: currentUser.originalId || currentUser.id,
            sellerOriginalId: currentUser.originalId || "",
            sellerUsername: currentUser.username,
            sellerName: currentUser.name,
            sellerAvatar: currentUser.avatar,
            shippingCost: isFreeShipping && parsedCapital === 0 ? 0 : parsedCapital,
            shippingCapital: parsedCapital,
            shippingProvince: parsedProvince,
            freeShipping: isFreeShipping,
            images: allProductPhotos,
            videos: videoUrl ? [videoUrl] : [],
            variants: effectiveVariants,
            variantList: finalVariantList,
            category: prodCategory
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad (Stock) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Disponible"
                  value={prodQuantity}
                  onChange={(e) => setProdQuantity(e.target.value)}
                  className="w-full text-xs font-sans p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* 3 Campos de Configuración de Envío */}
            <div className="border border-amber-200/80 rounded-xl p-4 bg-amber-50/40 space-y-3" id="product-shipping-config-panel">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>Configuración de Envío del Producto</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Configura las 3 opciones de envío</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Campo 1: Precio de envío a la capital */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    1. Precio de envío a la capital ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={prodShippingCapital}
                    onChange={(e) => setProdShippingCapital(e.target.value)}
                    id="input-shipping-capital"
                    className="w-full text-xs font-sans p-2.5 rounded-lg border font-medium transition-colors bg-white border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Campo 2: Precio de envío a provincia */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    2. Precio de envío a provincia ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={prodShippingProvince}
                    onChange={(e) => setProdShippingProvince(e.target.value)}
                    id="input-shipping-province"
                    className="w-full text-xs font-sans p-2.5 rounded-lg border font-medium transition-colors bg-white border-slate-200 text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Campo 3: Envío gratis */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    3. Envío gratis
                  </label>
                  <button
                    type="button"
                    id="toggle-free-shipping"
                    onClick={() => setProdFreeShipping(!prodFreeShipping)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-extrabold flex items-center justify-between transition-all cursor-pointer ${
                      prodFreeShipping
                        ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    <span className="flex items-center space-x-1.5">
                      <CheckCircle2 className={`w-4 h-4 ${prodFreeShipping ? "text-white" : "text-slate-400"}`} />
                      <span>{prodFreeShipping ? "Envío Gratis Activo" : "Activar Envío Gratis"}</span>
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      prodFreeShipping ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {prodFreeShipping ? "SÍ ($0)" : "NO"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Configured Shipping Summary Bar */}
              <div className="p-2.5 rounded-lg bg-white border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-700 font-bold">Botones de envío que verá el cliente:</span>
                {(() => {
                  const cap = Math.max(0, parseFloat(String(prodShippingCapital).replace(",", ".")) || 0);
                  const prov = Math.max(0, parseFloat(String(prodShippingProvince).replace(",", ".")) || 0);
                  const showFree = prodFreeShipping;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 font-mono font-extrabold text-[11px]">
                      {cap > 0 && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Capital: ${cap.toFixed(2)}
                        </span>
                      )}
                      {prov > 0 && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                          Provincia: ${prov.toFixed(2)}
                        </span>
                      )}
                      {showFree && (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Envío Gratis ($0.00)
                        </span>
                      )}
                      {cap <= 0 && prov <= 0 && !showFree && (
                        <span className="text-slate-400 font-medium">Sin opciones seleccionadas</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Product Variants (Talla / Color) */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Variantes del Producto (Tallas, Colores con Imagen, etc.)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Define las opciones que desees</span>
              </div>

              {/* Hidden file input for assigning/changing image of an existing color */}
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

              {/* Dedicated Color Variant Creator with Image Upload */}
              <div className="bg-white border border-amber-200/90 rounded-xl p-3.5 shadow-2xs space-y-3" id="color-variant-creator-section">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-extrabold text-slate-900 flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    <span>Crear Variante de Color del Producto (Nombre + Imagen)</span>
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-bold border border-amber-200/60">
                    Se mostrará en el detalle del producto
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Escribe el nombre del color (ej: <b>Azul</b>) y carga una imagen que represente ese color (ej: foto de la camisa azul).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* 1. Color Name Input */}
                  <div className="sm:col-span-5">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      1. Nombre del Color
                    </label>
                    <input
                      type="text"
                      id="input-color-variant-name"
                      placeholder="Ej. Azul, Rojo, Negro, Blanco..."
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddColorVariant();
                        }
                      }}
                      className="w-full text-xs font-sans p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-amber-500 font-medium"
                    />
                  </div>

                  {/* 2. Color Image Upload */}
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      2. Imagen del Color (Opcional)
                    </label>
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
                    {newColorFile ? (
                      <div className="flex items-center space-x-2 p-1.5 bg-amber-50/60 border border-amber-300 rounded-lg">
                        <img
                          src={URL.createObjectURL(newColorFile)}
                          alt="Color preview"
                          className="w-8 h-8 rounded-md object-cover border border-amber-200 shrink-0"
                        />
                        <span className="text-[10px] font-bold text-slate-700 truncate flex-1">
                          {newColorFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewColorFile(null);
                            if (newColorImageInputRef.current) newColorImageInputRef.current.value = "";
                          }}
                          className="p-1 hover:bg-amber-100 rounded text-rose-500 cursor-pointer"
                          title="Quitar imagen"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="btn-upload-color-variant-image"
                        onClick={() => newColorImageInputRef.current?.click()}
                        className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-amber-500 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600" />
                        <span>Cargar imagen del color</span>
                      </button>
                    )}
                  </div>

                  {/* 3. Add Color Button */}
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      id="btn-add-color-variant"
                      onClick={handleAddColorVariant}
                      disabled={!newColorName.trim()}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 rounded-lg flex items-center justify-center space-x-1.5 text-xs font-extrabold transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Color</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active variants list */}
              {prodVariants.length > 0 && (
                <div className="space-y-2.5">
                  {prodVariants.map((variant, index) => {
                    const isColorGroup = variant.name.trim().toLowerCase().includes("color");
                    return (
                      <div key={index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                            <span>{variant.name}:</span>
                            {isColorGroup && (
                              <span className="text-[10px] font-normal text-slate-500">
                                (Haz clic en "Cargar foto" en cualquier color para asignarle su imagen)
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariant(index)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            title="Eliminar grupo de variante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {isColorGroup ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                            {variant.options.map((opt, idx) => {
                              const colorKey = opt.trim().toLowerCase();
                              const previewImg =
                                colorImagePreviews[colorKey] ||
                                prodVariantList.find((item) => (item.color || item.name || "").trim().toLowerCase() === colorKey)?.imageUrl;

                              return (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-amber-400 transition-colors"
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    {previewImg ? (
                                      <img
                                        src={previewImg}
                                        alt={opt}
                                        className="w-11 h-11 rounded-lg object-cover border border-amber-300 shrink-0 bg-white"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingColorTarget(opt);
                                          existingColorImageInputRef.current?.click();
                                        }}
                                        className="w-11 h-11 rounded-lg border border-dashed border-slate-300 hover:border-amber-500 bg-white flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 shrink-0 cursor-pointer transition-colors"
                                        title={`Subir imagen para ${opt}`}
                                      >
                                        <ImageIcon className="w-4 h-4" />
                                        <span className="text-[8px] font-bold mt-0.5">Foto</span>
                                      </button>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-xs font-extrabold text-slate-900 truncate">{opt}</p>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingColorTarget(opt);
                                          existingColorImageInputRef.current?.click();
                                        }}
                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer flex items-center gap-0.5 mt-0.5"
                                      >
                                        <Upload className="w-2.5 h-2.5" />
                                        <span>{previewImg ? "Cambiar foto" : "Cargar foto"}</span>
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariantOption(index, opt)}
                                    className="p-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer shrink-0"
                                    title={`Quitar color ${opt}`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {variant.options.map((opt, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md border border-slate-200/80"
                              >
                                <span>{opt}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariantOption(index, opt)}
                                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                  title={`Quitar ${opt}`}
                                >
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

              {/* New general variant form (e.g. Talla, Material) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Otra Variante (ej: Talla, Material)</label>
                  <input
                    type="text"
                    placeholder="Nombre de la variante (ej. Talla)"
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
                      placeholder="Ej. S, M, L, XL"
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
