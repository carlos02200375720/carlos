import { Reel, ReelMedia } from "../../types";

/**
 * Builds a deterministic, ordered sequence of media (videos and/or images) for a Reel.
 * If reel.media already exists and is non-empty, it normalizes and returns it.
 * Otherwise, it extracts from videoUrl and images/thumbnailUrl in consistent order.
 */
export function buildReelMedia(reel: any): ReelMedia[] {
  const rawMedia = Array.isArray(reel.media) ? reel.media : [];
  const isVideoUrl = (u: string) =>
    /\.(m3u8|mp4|mov|m4v|webm|avi|mkv|3gp|flv|ts)($|\?)/i.test(u) ||
    u.includes("/videos/") ||
    u.includes("/hls/");

  const result: ReelMedia[] = [];
  const seenUrls = new Set<string>();

  const addMediaItem = (item: ReelMedia, aliases: string[] = []) => {
    const cleanUrl = (item.url || "").trim();
    if (!cleanUrl || cleanUrl.includes("1618005182384")) return;
    if (seenUrls.has(cleanUrl)) return;
    seenUrls.add(cleanUrl);
    for (const alias of aliases) {
      if (alias && alias.trim()) seenUrls.add(alias.trim());
    }
    result.push({ ...item, url: cleanUrl });
  };

  // 1. Process existing media[] entries while preserving each video's own URL
  if (rawMedia.length > 0) {
    for (const m of rawMedia) {
      const rawUrl = typeof m?.url === "string" ? m.url.trim() : "";
      const type: "video" | "image" =
        m?.type === "video" || isVideoUrl(rawUrl) ? "video" : "image";
      const fallbackUrl =
        type === "video"
          ? reel.hlsUrl || reel.videoUrl || rawUrl || ""
          : rawUrl;
      const url = typeof fallbackUrl === "string" ? fallbackUrl.trim() : "";
      if (!url) continue;

      const isPrimaryVideo =
        type === "video" &&
        (!rawUrl || rawUrl === reel.videoUrl || rawUrl === reel.hlsUrl || rawMedia.filter((x: any) => x?.type === "video").length === 1);
      const resolvedUrl = isPrimaryVideo ? (reel.hlsUrl || reel.videoUrl || rawUrl) : (rawUrl || url);
      const candidateHls =
        m?.hlsUrl || (isPrimaryVideo ? reel.hlsUrl : undefined) || (resolvedUrl.includes(".m3u8") ? resolvedUrl : undefined);
      const candidateThumb = m?.thumbnailUrl || (isPrimaryVideo ? reel.thumbnailUrl : undefined);

      addMediaItem(
        {
          type,
          url: resolvedUrl,
          hlsUrl:
            type === "video" && typeof candidateHls === "string" && candidateHls.includes(".m3u8")
              ? candidateHls.trim()
              : undefined,
          thumbnailUrl:
            typeof candidateThumb === "string" && candidateThumb.trim()
              ? candidateThumb.trim()
              : undefined,
        },
        isPrimaryVideo ? [reel.videoUrl || "", reel.hlsUrl || "", rawUrl] : [rawUrl]
      );
    }
  }

  // 2. Ensure top-level videoUrl/hlsUrl is included if not already present
  if ((reel.videoUrl && typeof reel.videoUrl === "string" && reel.videoUrl.trim() !== "") || (reel.hlsUrl && typeof reel.hlsUrl === "string" && reel.hlsUrl.trim() !== "")) {
    const vUrl = typeof reel.videoUrl === "string" ? reel.videoUrl.trim() : "";
    const hlsUrl =
      typeof reel.hlsUrl === "string" && reel.hlsUrl.includes(".m3u8")
        ? reel.hlsUrl.trim()
        : undefined;
    const primaryUrl = hlsUrl || vUrl;
    if (primaryUrl && !seenUrls.has(primaryUrl) && (!vUrl || !seenUrls.has(vUrl))) {
      addMediaItem(
        {
          type: "video",
          url: primaryUrl,
          hlsUrl,
          thumbnailUrl: reel.thumbnailUrl || undefined,
        },
        [vUrl, hlsUrl || ""]
      );
    }
  }

  // 3. Ensure all entries in reel.images[] are included when the reel is a carousel/product or has no video
  const shouldIncludeImages =
    result.length === 0 ||
    reel.type === "carousel" ||
    reel.type === "product" ||
    String(reel.id || "").startsWith("reel_prod_") ||
    (Array.isArray(reel.images) && reel.images.length > 1);

  if (shouldIncludeImages && Array.isArray(reel.images) && reel.images.length > 0) {
    for (const img of reel.images) {
      if (img && typeof img === "string" && img.trim() !== "") {
        const clean = img.trim();
        // Do not add the video's auto-generated poster/thumbnail as a separate carousel image slide on single-video reels
        if (result.length > 0 && reel.type === "video" && clean === reel.thumbnailUrl) continue;
        const itemType: "video" | "image" = isVideoUrl(clean) ? "video" : "image";
        addMediaItem({
          type: itemType,
          url: clean,
          hlsUrl: itemType === "video" && clean.includes(".m3u8") ? clean : undefined,
        });
      }
    }
  } else if (
    result.length === 0 &&
    reel.thumbnailUrl &&
    typeof reel.thumbnailUrl === "string" &&
    reel.thumbnailUrl.trim() !== ""
  ) {
    addMediaItem({ type: "image", url: reel.thumbnailUrl.trim() });
  }

  return result;
}

/**
 * Formats any Reel object into the unified, complete contract consumed identically by Web and Android clients.
 */
export function formatReelDTO(r: any, userMap?: Map<string, any>): Reel {
  const creatorUser = userMap
    ? userMap.get(r.creatorId) || (r.creatorUsername ? userMap.get(r.creatorUsername.toLowerCase()) : null)
    : null;

  const images = Array.isArray(r.images)
    ? r.images.filter((img: any) => img && typeof img === "string" && !img.includes("1618005182384"))
    : [];

  const videoUrl = typeof r.videoUrl === "string" ? r.videoUrl.trim() : "";
  const hlsUrl = r.hlsUrl && typeof r.hlsUrl === "string" && r.hlsUrl.includes(".m3u8") ? r.hlsUrl.trim() : undefined;
  let thumbnailUrl =
    r.thumbnailUrl &&
    typeof r.thumbnailUrl === "string" &&
    !r.thumbnailUrl.includes("1618005182384") &&
    !r.thumbnailUrl.toLowerCase().endsWith(".m3u8")
      ? r.thumbnailUrl.trim()
      : images.length > 0 && typeof images[0] === "string" && !images[0].toLowerCase().endsWith(".m3u8")
      ? images[0]
      : "";

  if (!thumbnailUrl && (videoUrl || hlsUrl)) {
    const targetUrl = hlsUrl || videoUrl;
    if (targetUrl.includes("/hls/")) {
      thumbnailUrl = targetUrl.replace(/\/(?:master|index)\.m3u8.*$/, "/poster.jpg");
    }
  }

  const media = buildReelMedia({ ...r, videoUrl, hlsUrl, thumbnailUrl, images });

  const normalizedMedia: ReelMedia[] = media.map((item, idx) => {
    if (item.type !== "video") return item;
    const isPrimary = idx === 0 && (!item.url || item.url === videoUrl || item.url === hlsUrl);
    return {
      ...item,
      url: item.url || hlsUrl || videoUrl,
      hlsUrl: item.hlsUrl || (isPrimary ? hlsUrl : undefined),
      thumbnailUrl: item.thumbnailUrl || (isPrimary ? thumbnailUrl : undefined) || undefined,
    };
  });

  if ((videoUrl || hlsUrl) && !normalizedMedia.some((item) => item.type === "video")) {
    normalizedMedia.unshift({
      type: "video",
      url: hlsUrl || videoUrl,
      hlsUrl,
      thumbnailUrl: thumbnailUrl || undefined,
    });
  }

  // Infer or respect explicit Reel type
  let type = r.type;
  if (!type) {
    if (r.productId) {
      type = "product";
    } else if (videoUrl) {
      type = "video";
    } else if (images.length > 1) {
      type = "carousel";
    } else {
      type = "image";
    }
  }

  const productId = r.productId || r.taggedProductId || undefined;
  const isProductReel = type === "product" || Boolean(productId) || String(r.id || "").startsWith("reel_prod_");

  return {
    id: r.id,
    type,
    title: r.title || r.name || "",
    description: r.description || "",
    caption: r.caption || r.description || "",
    creatorId: creatorUser ? creatorUser.id : r.creatorId || "user_anon",
    creatorName: creatorUser ? creatorUser.name : r.creatorName || "Usuario",
    creatorUsername: creatorUser ? creatorUser.username : r.creatorUsername || undefined,
    creatorAvatar: creatorUser
      ? creatorUser.avatar
      : r.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    videoUrl,
    hlsUrl,
    thumbnailUrl,
    images,
    media: normalizedMedia,
    likes: typeof r.likes === "number" ? r.likes : 0,
    likedBy: Array.isArray(r.likedBy) ? r.likedBy : [],
    comments: Array.isArray(r.comments) ? r.comments : [],
    shares: typeof r.shares === "number" ? r.shares : 0,
    saves: typeof r.saves === "number" ? r.saves : 0,
    views: typeof r.views === "number" ? r.views : 0,
    productId,
    aspectRatio: isProductReel ? (r.aspectRatio === "horizontal" ? "horizontal" : "square") : (r.aspectRatio || "vertical"),
  };
}

/**
 * Generates the unified companion Reel for a Product so that creating a product
 * automatically manifests as a first-class element in the Reel feed.
 */
export function createCompanionReelForProduct(product: any, sellerUser?: any): Reel {
  const hasVideo = Array.isArray(product.videos) && product.videos.length > 0 && product.videos[0];
  const videoUrl = hasVideo ? String(product.videos[0]).trim() : "";
  const productImages = Array.isArray(product.images) && product.images.length > 0
    ? product.images.filter((img: any) => typeof img === "string" && img.trim() !== "")
    : product.imageUrl
    ? [product.imageUrl]
    : [];
  const thumbnailUrl = product.imageUrl || (productImages.length > 0 ? productImages[0] : "");

  const media: ReelMedia[] = [];
  if (hasVideo) {
    media.push({
      type: "video",
      url: videoUrl,
    });
  }
  for (const img of productImages) {
    media.push({
      type: "image",
      url: img,
    });
  }
  if (media.length === 0 && thumbnailUrl) {
    media.push({
      type: "image",
      url: thumbnailUrl,
    });
  }

  const reelId = `reel_prod_${product.id}`;
  const description = product.description || `${product.name} - $${product.price}`;

  return {
    id: reelId,
    type: "product",
    title: product.name || "",
    description,
    caption: description,
    creatorId: sellerUser?.id || product.sellerId || "seller",
    creatorName: sellerUser?.name || product.sellerName || "Vendedor",
    creatorUsername: sellerUser?.username || product.sellerUsername || undefined,
    creatorAvatar: sellerUser?.avatar || product.sellerAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    videoUrl,
    thumbnailUrl,
    images: productImages,
    media,
    likes: 0,
    likedBy: [],
    comments: [],
    shares: 0,
    saves: 0,
    views: 0,
    productId: product.id,
    aspectRatio: "square",
  };
}
