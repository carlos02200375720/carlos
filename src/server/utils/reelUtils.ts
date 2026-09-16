import { Reel, ReelMedia } from "../../types";

/**
 * Builds a deterministic, ordered sequence of media (videos and/or images) for a Reel.
 * If reel.media already exists and is non-empty, it normalizes and returns it.
 * Otherwise, it extracts from videoUrl and images/thumbnailUrl in consistent order.
 */
export function buildReelMedia(reel: any): ReelMedia[] {
  if (Array.isArray(reel.media) && reel.media.length > 0) {
    return reel.media.map((m: any) => ({
      type: m.type === "video" ? ("video" as const) : ("image" as const),
      url: m.url || "",
      hlsUrl: m.hlsUrl || undefined,
      thumbnailUrl: m.thumbnailUrl || undefined,
    }));
  }

  const mediaList: ReelMedia[] = [];

  // 1. Primary video (if present)
  if (reel.videoUrl && typeof reel.videoUrl === "string" && reel.videoUrl.trim() !== "") {
    mediaList.push({
      type: "video",
      url: reel.videoUrl.trim(),
      hlsUrl: reel.hlsUrl && reel.hlsUrl.includes(".m3u8") ? reel.hlsUrl.trim() : undefined,
      thumbnailUrl: reel.thumbnailUrl || undefined,
    });
  }

  // 2. Additional / companion images
  if (Array.isArray(reel.images) && reel.images.length > 0) {
    for (const img of reel.images) {
      if (img && typeof img === "string" && img.trim() !== "") {
        mediaList.push({
          type: "image",
          url: img.trim(),
        });
      }
    }
  } else if (!reel.videoUrl && reel.thumbnailUrl && typeof reel.thumbnailUrl === "string" && reel.thumbnailUrl.trim() !== "") {
    mediaList.push({
      type: "image",
      url: reel.thumbnailUrl.trim(),
    });
  }

  return mediaList;
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
  const thumbnailUrl =
    r.thumbnailUrl && !r.thumbnailUrl.includes("1618005182384")
      ? r.thumbnailUrl.trim()
      : images.length > 0
      ? images[0]
      : "";

  const media = buildReelMedia({ ...r, videoUrl, hlsUrl, thumbnailUrl, images });

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

  return {
    id: r.id,
    type,
    title: r.title || r.name || "",
    description: r.description || "",
    caption: r.caption || r.description || "",
    creatorId: creatorUser ? creatorUser.id : r.creatorId || "creator",
    creatorName: creatorUser ? creatorUser.name : r.creatorName || "Creador",
    creatorUsername: creatorUser ? creatorUser.username : r.creatorUsername || undefined,
    creatorAvatar: creatorUser
      ? creatorUser.avatar
      : r.creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
    videoUrl,
    hlsUrl,
    thumbnailUrl,
    images,
    media,
    likes: typeof r.likes === "number" ? r.likes : 0,
    likedBy: Array.isArray(r.likedBy) ? r.likedBy : [],
    comments: Array.isArray(r.comments) ? r.comments : [],
    shares: typeof r.shares === "number" ? r.shares : 0,
    saves: typeof r.saves === "number" ? r.saves : 0,
    views: typeof r.views === "number" ? r.views : 0,
    productId,
    aspectRatio: r.aspectRatio || "vertical",
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
      thumbnailUrl,
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
    aspectRatio: "vertical",
  };
}
