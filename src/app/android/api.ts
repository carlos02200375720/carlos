/**
 * Android-Dedicated API & Network Layer
 * 
 * This module isolates all Android frontend network requests.
 * All requests are routed through dedicated Android endpoints (/api/android/*)
 * and tagged with platform headers, allowing the server to process Android
 * requests with independent logic from web or iOS frontends.
 */

import { safeStorage } from "../../utils/safeStorage";
import { User, Reel, Product, CartItem, Order, ChatMessage } from "../../types";

export const CLOUD_RUN_BACKEND_URL = "https://carlos02200375720mall-113642516090.europe-west1.run.app";
export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;

/**
 * Returns true if running inside an Android native container (Capacitor/Cordova)
 */
export const isAndroidNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const win = window as any;
  if (win.Capacitor?.getPlatform && win.Capacitor.getPlatform() === "android") return true;
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "")) return true;
  const proto = window.location?.protocol || "";
  return proto === "capacitor:" || proto === "file:" || proto === "ionic:";
};

/**
 * Android-specific URL resolver. Always directs to /api/android routes.
 */
export const getAndroidApiUrl = (endpoint: string): string => {
  let clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // If already prefixed with /api/android, keep it, otherwise translate /api/* to /api/android/*
  if (clean.startsWith("/api/android/")) {
    // Already targeted for android
  } else if (clean.startsWith("/api/")) {
    clean = clean.replace(/^\/api/, "/api/android");
  } else {
    clean = `/api/android${clean}`;
  }

  if (isAndroidNative() || (typeof window !== "undefined" && window.location.hostname.includes("github.io"))) {
    const base = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
    return `${base}${clean}`;
  }

  return clean;
};

/**
 * Dedicated fetch utility for Android. Injects Android-specific metadata and user credentials.
 */
export const androidApiFetch = async (
  endpoint: string,
  init?: RequestInit,
  timeoutMs: number = 60000
): Promise<Response> => {
  const url = getAndroidApiUrl(endpoint);
  const headers = new Headers(init?.headers);

  // Android platform identification headers
  headers.set("X-Platform", "android");
  headers.set("X-Client-Platform", "android");
  headers.set("X-Client-App", "MallSocial-Android");
  headers.set("X-Client-Version", "1.0.0-android");

  // User credentials
  if (typeof window !== "undefined") {
    try {
      const loggedInUsername = safeStorage.getItem("loggedInUsername");
      const currentUserData = safeStorage.getItem("currentUserData");
      if (loggedInUsername && loggedInUsername !== "invitado" && loggedInUsername !== "guest") {
        if (!headers.has("x-user-username")) {
          headers.set("x-user-username", loggedInUsername);
        }
      }
      if (currentUserData) {
        const parsed = JSON.parse(currentUserData);
        if (parsed?.username && parsed.username !== "invitado") {
          if (!headers.has("x-user-username")) {
            headers.set("x-user-username", parsed.username);
          }
          if (parsed.originalId || parsed.id) {
            if (!headers.has("x-user-id")) {
              headers.set("x-user-id", parsed.originalId || parsed.id);
            }
          }
        }
      }
    } catch {}
  }

  const isUpload = endpoint.includes("upload") || (init?.body instanceof FormData);
  const effectiveTimeout = isUpload ? 300000 : timeoutMs;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
  const signal = init?.signal || controller.signal;

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    // Fallback: If Android endpoint is in transition or network error, attempt direct fallback
    if (!signal.aborted) {
      console.warn("Android API fetch primary attempt failed, retrying:", err?.message);
    }
    throw err;
  }
};

/**
 * Typed Android API Service Methods
 */
export const androidApi = {
  getHealth: async () => {
    const res = await androidApiFetch("/health");
    return res.json();
  },

  getReels: async (): Promise<Reel[]> => {
    const res = await androidApiFetch("/reels");
    return res.json();
  },

  likeReel: async (reelId: string, userId: string, username: string) => {
    const res = await androidApiFetch(`/reels/${reelId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username }),
    });
    return res.json();
  },

  commentReel: async (reelId: string, data: { userId: string; username: string; avatar: string; text: string }) => {
    const res = await androidApiFetch(`/reels/${reelId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getProducts: async (): Promise<Product[]> => {
    const res = await androidApiFetch("/products");
    return res.json();
  },

  getUsers: async (): Promise<User[]> => {
    const res = await androidApiFetch("/users");
    return res.json();
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const res = await androidApiFetch("/users/current_user");
    return res.json();
  },

  switchUser: async (targetUsername: string, password?: string, isSessionRestore?: boolean) => {
    const res = await androidApiFetch("/users/current/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUsername, password, isSessionRestore }),
    });
    return res.json();
  },

  logoutUser: async () => {
    const res = await androidApiFetch("/users/current/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.json();
  },

  toggleSaveReel: async (reelId: string, userId: string, username: string) => {
    const res = await androidApiFetch("/users/current/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId, userId, username }),
    });
    return res.json();
  },

  toggleFollowUser: async (targetUserId: string, currentUserId: string, currentUsername: string) => {
    const res = await androidApiFetch(`/users/${targetUserId}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentUserId, currentUsername }),
    });
    return res.json();
  },

  getCart: async (userId: string): Promise<{ items: CartItem[] }> => {
    const res = await androidApiFetch(`/cart/${encodeURIComponent(userId)}`);
    return res.json();
  },

  saveCart: async (userId: string, items: CartItem[]) => {
    const res = await androidApiFetch(`/cart/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    return res.json();
  },

  createOrder: async (orderData: any): Promise<Order> => {
    const res = await androidApiFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    return res.json();
  },

  getChatMessages: async (partnerId: string): Promise<ChatMessage[]> => {
    const res = await androidApiFetch(`/chats/${partnerId}`);
    return res.json();
  },

  uploadFile: async (formData: FormData): Promise<any> => {
    const res = await androidApiFetch("/upload", {
      method: "POST",
      body: formData,
    });
    return res.json();
  },
};
