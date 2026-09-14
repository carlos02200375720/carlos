import { safeStorage } from "../../utils/safeStorage";
import { User, Reel, Product, CartItem, Order, ChatMessage } from "../../types";
import { BACKEND_URL } from "../../config";

/**
 * Single Android network layer.
 * Native Android always talks to the configured backend and never falls back
 * to a second/unknown origin.
 */
export { BACKEND_URL };

export const isAndroidNative = (): boolean => {
  if (typeof window === "undefined") return false;
  const win = window as any;
  if (typeof win.Capacitor?.isNativePlatform === "function" && win.Capacitor.isNativePlatform()) return true;
  if (win.Capacitor?.getPlatform && (win.Capacitor.getPlatform() === "android" || win.Capacitor.getPlatform() === "ios")) return true;
  const proto = window.location?.protocol || "";
  return proto === "capacitor:" || proto === "file:" || proto === "ionic:" || proto === "app:";
};

export const getAndroidApiUrl = (endpoint: string): string => {
  let clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (clean.startsWith("/api/android/")) {
    // already canonical
  } else if (clean.startsWith("/api/")) {
    clean = clean.replace(/^\/api/, "/api/android");
  } else {
    clean = `/api/android${clean}`;
  }

  // When running in a standard web browser (preview, local dev, or web hosting), use relative URL
  if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http") && !isAndroidNative()) {
    return clean;
  }

  const base = (BACKEND_URL || "").replace(/\/$/, "");
  if (!base) {
    return clean;
  }
  return `${base}${clean}`;
};

const readResponseBody = async (response: Response): Promise<any> => {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`El backend respondió JSON inválido (HTTP ${response.status}).`);
    }
  }

  // Never let JSON.parse turn an HTML/proxy error into "Unexpected token '<'".
  const preview = text.replace(/\s+/g, " ").slice(0, 180);
  if (/^<!doctype html/i.test(text) || /<html[\s>]/i.test(text)) {
    throw new Error(
      `El backend de Android respondió HTML en vez de JSON (HTTP ${response.status}). ` +
      `Revisa que el APK use el backend configurado y que /api/android esté desplegado. ` +
      `Respuesta: ${preview}`
    );
  }

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}: ${preview}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inesperada del backend (HTTP ${response.status}): ${preview}`);
  }
};

export const androidApiFetch = async (
  endpoint: string,
  init?: RequestInit,
  timeoutMs: number = 60000
): Promise<Response> => {
  const url = getAndroidApiUrl(endpoint);
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");
  headers.set("X-Platform", "android");
  headers.set("X-Client-Platform", "android");
  headers.set("X-Client-App", "MallSocial-Android");
  headers.set("X-Client-Version", "1.0.0-android");

  if (typeof window !== "undefined") {
    try {
      const loggedInUsername = safeStorage.getItem("loggedInUsername");
      const currentUserData = safeStorage.getItem("currentUserData");
      if (loggedInUsername && loggedInUsername !== "invitado" && loggedInUsername !== "guest") {
        headers.set("x-user-username", loggedInUsername);
      }
      if (currentUserData) {
        const parsed = JSON.parse(currentUserData);
        if (parsed?.username && parsed.username !== "invitado") {
          if (!headers.has("x-user-username")) headers.set("x-user-username", parsed.username);
          if (parsed.originalId || parsed.id) headers.set("x-user-id", parsed.originalId || parsed.id);
        }
      }
    } catch {
      // Ignore malformed local session data; the server can treat the request as guest.
    }
  }

  const isUpload = endpoint.includes("upload") || (init?.body instanceof FormData);
  const effectiveTimeout = isUpload ? 300000 : timeoutMs;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
  const signal = init?.signal || controller.signal;

  try {
    const res = await fetch(url, { ...init, headers, signal });
    // If the remote server returned a 5xx server error, and we are in a web browser, try local fallback
    if (!res.ok && res.status >= 500 && typeof window !== "undefined" && window.location?.protocol?.startsWith("http")) {
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const localClean = cleanEndpoint.startsWith("/api/android") ? cleanEndpoint : `/api/android${cleanEndpoint}`;
      if (url !== localClean) {
        try {
          const localRes = await fetch(localClean, { ...init, headers, signal });
          if (localRes.ok) return localRes;
        } catch {}
      }
    }
    return res;
  } catch (err: any) {
    if (signal.aborted) {
      if (controller.signal.aborted) {
        throw new Error(`La solicitud tardó más de ${Math.round(effectiveTimeout / 1000)} segundos.`);
      }
      throw err;
    }
    // Fallback to relative URL if remote backend failed to connect and in browser
    if (typeof window !== "undefined" && window.location?.protocol?.startsWith("http")) {
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const localClean = cleanEndpoint.startsWith("/api/android") ? cleanEndpoint : `/api/android${cleanEndpoint}`;
      if (url !== localClean) {
        try {
          return await fetch(localClean, { ...init, headers, signal });
        } catch {}
      }
    }
    throw new Error(`No se pudo conectar con el backend Android: ${err?.message || "error de red"}`);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const androidApi = {
  getHealth: async () => {
    const res = await androidApiFetch("/health");
    return readResponseBody(res);
  },

  getReels: async (): Promise<Reel[]> => {
    const res = await androidApiFetch("/reels");
    return readResponseBody(res);
  },

  likeReel: async (reelId: string, userId: string, username: string) => {
    const res = await androidApiFetch(`/reels/${reelId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username }),
    });
    return readResponseBody(res);
  },

  commentReel: async (reelId: string, data: { userId: string; username: string; avatar: string; text: string }) => {
    const res = await androidApiFetch(`/reels/${reelId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return readResponseBody(res);
  },

  getProducts: async (): Promise<Product[]> => {
    const res = await androidApiFetch("/products");
    return readResponseBody(res);
  },

  getUsers: async (): Promise<User[]> => {
    const res = await androidApiFetch("/users");
    return readResponseBody(res);
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const res = await androidApiFetch("/users/current_user");
    return readResponseBody(res);
  },

  switchUser: async (targetUsername: string, password?: string, isSessionRestore?: boolean) => {
    const res = await androidApiFetch("/users/current/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUsername, password, isSessionRestore }),
    });
    return readResponseBody(res);
  },

  logoutUser: async () => {
    const res = await androidApiFetch("/users/current/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return readResponseBody(res);
  },

  toggleSaveReel: async (reelId: string, userId: string, username: string) => {
    const res = await androidApiFetch("/users/current/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reelId, userId, username }),
    });
    return readResponseBody(res);
  },

  toggleFollowUser: async (targetUserId: string, currentUserId: string, currentUsername: string) => {
    const res = await androidApiFetch(`/users/${targetUserId}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentUserId, currentUsername }),
    });
    return readResponseBody(res);
  },

  getCart: async (userId: string): Promise<{ items: CartItem[] }> => {
    const res = await androidApiFetch(`/cart/${encodeURIComponent(userId)}`);
    return readResponseBody(res);
  },

  saveCart: async (userId: string, items: CartItem[]) => {
    const res = await androidApiFetch(`/cart/${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    return readResponseBody(res);
  },

  createOrder: async (orderData: any): Promise<Order> => {
    const res = await androidApiFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    return readResponseBody(res);
  },

  getChatMessages: async (partnerId: string): Promise<ChatMessage[]> => {
    const res = await androidApiFetch(`/chats/${partnerId}`);
    return readResponseBody(res);
  },

  uploadFile: async (formData: FormData): Promise<any> => {
    const res = await androidApiFetch("/upload", {
      method: "POST",
      body: formData,
    });
    return readResponseBody(res);
  },
};
