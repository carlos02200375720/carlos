/// <reference types="vite/client" />

// Centralized Backend & API Configuration
export const CLOUD_RUN_BACKEND_URL = "https://carlos02200375720mall-113642516090.europe-west1.run.app";

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;

/**
 * Helper to determine if we are running in a native mobile wrapper (Capacitor / Cordova / Ionic on Android/iOS)
 */
export const isNativeMobileWrapper = (): boolean => {
  if (typeof window === "undefined" || !window.location) return false;

  const win = window as any;
  // 1. Explicit Capacitor native platform
  if (typeof win.Capacitor?.isNativePlatform === "function" && win.Capacitor.isNativePlatform()) {
    return true;
  }
  if (win.Capacitor?.getPlatform && (win.Capacitor.getPlatform() === "android" || win.Capacitor.getPlatform() === "ios")) {
    return true;
  }

  // 2. Protocols used exclusively by native mobile wrappers
  const proto = window.location.protocol;
  if (proto === "capacitor:" || proto === "file:" || proto === "ionic:" || proto === "app:") {
    return true;
  }

  // 3. Cordova / PhoneGap
  if (win.cordova && !proto.startsWith("http")) {
    return true;
  }

  return false;
};

/**
 * Helper to get the correct API endpoint URL.
 * In web browsers (Dev, Preview, Production web hosting), relative paths (`/api/...`) connect directly
 * to the container's active server without CORS or cross-origin issues.
 * In native wrappers (Capacitor / Cordova on Android & iOS), it prefixes with the remote backend URL.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // In any standard browser environment (web app, dev, preview, shared build), use relative URLs
  if (typeof window !== "undefined" && !isNativeMobileWrapper()) {
    return cleanPath;
  }

  // In native Android / iOS wrappers, connect to the Cloud Run backend
  if (BACKEND_URL) {
    const trimmedBackend = BACKEND_URL.replace(/\/$/, "");
    return `${trimmedBackend}${cleanPath}`;
  }

  return cleanPath;
};

/**
 * Helper to get the correct WebSocket server URL.
 */
export const getWebSocketUrl = (): string => {
  if (typeof window !== "undefined" && !isNativeMobileWrapper()) {
    if (window.location.protocol.startsWith("http")) {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      return `${wsProtocol}//${host}`;
    }
  }

  if (BACKEND_URL) {
    try {
      const parsed = new URL(BACKEND_URL);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${parsed.host}`;
    } catch (e) {
      console.warn("Could not parse BACKEND_URL as URL, falling back:", e);
    }
  }

  return "wss://carlos02200375720mall-113642516090.europe-west1.run.app";
};

export const apiFetch = async (
  input: string,
  init?: RequestInit,
  customTimeoutMs: number = 25000
): Promise<Response> => {
  const cleanPath = input.startsWith("/") ? input : `/${input}`;
  const targetUrl = getApiUrl(input);
  const headers = new Headers(init?.headers);

  if (typeof window !== "undefined") {
    try {
      const loggedInUsername = localStorage.getItem("loggedInUsername");
      const currentUserData = localStorage.getItem("currentUserData");
      if (loggedInUsername && loggedInUsername !== "invitado" && loggedInUsername !== "guest") {
        if (!headers.has("x-user-username")) {
          headers.set("x-user-username", loggedInUsername);
        }
      }
      if (currentUserData) {
        const parsed = JSON.parse(currentUserData);
        if (parsed && parsed.username && parsed.username !== "invitado") {
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
    } catch (e) {
      // Ignore localStorage parsing error
    }
  }

  // Setup timeout abort controller if signal not already supplied
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, customTimeoutMs);

  const signal = init?.signal || controller.signal;

  const fetchOptions: RequestInit = {
    ...init,
    headers,
    signal,
  };

  try {
    const res = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);
    return res;
  } catch (primaryErr) {
    clearTimeout(timeoutId);

    // Fallback: If primary targetUrl failed, attempt the alternate URL (relative vs remote)
    const alternateUrl = targetUrl === cleanPath 
      ? `${CLOUD_RUN_BACKEND_URL.replace(/\/$/, "")}${cleanPath}`
      : cleanPath;

    try {
      return await fetch(alternateUrl, fetchOptions);
    } catch (fallbackErr) {
      throw primaryErr;
    }
  }
};


