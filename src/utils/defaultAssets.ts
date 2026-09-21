
import { apiFetch } from "../config";

export const FALLBACK_DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80";

export const FALLBACK_DEFAULT_COVER =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80";

export const AVATAR_PRESETS = [
  {
    id: "preset_1",
    label: "Modern Portrait",
    url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: "preset_2",
    label: "Creative Creator",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: "preset_3",
    label: "3D Avatar Smile",
    url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: "preset_4",
    label: "Digital Nomad",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
  },
  {
    id: "preset_5",
    label: "Minimalist Gradient",
    url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80"
  }
];

let runtimeAvatar: string | null = null;
let runtimeCover: string | null = null;

export const COVER_PRESETS = [
  {
    id: "cover_1",
    label: "Dark Wave Geometric",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "cover_2",
    label: "Cyber Neon Glow",
    url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "cover_3",
    label: "Minimal Studio Dusk",
    url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "cover_4",
    label: "Warm Architectural",
    url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
  },
  {
    id: "cover_5",
    label: "Abstract Aurora",
    url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80"
  }
];

export function getDefaultAvatar(): string {
  try {
    if (runtimeAvatar && runtimeAvatar.trim().length > 0) return runtimeAvatar;
  } catch {}
  return FALLBACK_DEFAULT_AVATAR;
}

export function getDefaultCoverPhoto(): string {
  try {
    if (runtimeCover && runtimeCover.trim().length > 0) return runtimeCover;
  } catch {}
  return FALLBACK_DEFAULT_COVER;
}

export function setDefaultAssetsCache(avatar?: string, cover?: string): void {
  try {
    if (avatar && avatar.trim().length > 0) runtimeAvatar = avatar.trim();
    if (cover && cover.trim().length > 0) runtimeCover = cover.trim();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("default-assets-changed", {
          detail: {
            avatar: avatar || getDefaultAvatar(),
            cover: cover || getDefaultCoverPhoto()
          }
        })
      );
    }
  } catch {}
}

export async function fetchAndSyncDefaultAssets(): Promise<{ avatar: string; cover: string }> {
  try {
    const res = await apiFetch("/api/admin/default-assets");
    if (res.ok) {
      const data = await res.json();
      const avatar = data.defaultAvatar || FALLBACK_DEFAULT_AVATAR;
      const cover = data.defaultCoverPhoto || FALLBACK_DEFAULT_COVER;
      setDefaultAssetsCache(avatar, cover);
      return { avatar, cover };
    }
  } catch (err) {
    console.warn("Could not sync default assets from backend:", err);
  }
  return {
    avatar: getDefaultAvatar(),
    cover: getDefaultCoverPhoto()
  };
}
