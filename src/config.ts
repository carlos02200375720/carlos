/// <reference types="vite/client" />

// Centralized Backend & API Configuration
export const CLOUD_RUN_BACKEND_URL = "https://carlos02200375720mall-113642516090.europe-west1.run.app";

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;

/**
 * Helper to determine if we are running on an external static frontend host (Vercel, Netlify, GitHub Pages, etc.)
 */
export const isExternalStaticHost = (): boolean => {
  if (typeof window === "undefined" || !window.location) return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.includes("vercel.app") ||
    host.includes("netlify.app") ||
    host.includes("pages.dev") ||
    host.includes("github.io") ||
    host.includes("surge.sh") ||
    host.includes("render.com")
  );
};

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
 * In native wrappers (Capacitor / Cordova on Android & iOS) or static hosting (Vercel), it prefixes with the remote Cloud Run backend URL.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // In native Android/iOS wrappers or static hosts like Vercel, connect to the Cloud Run backend
  if (isNativeMobileWrapper() || isExternalStaticHost()) {
    const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
    return `${trimmedBackend}${cleanPath}`;
  }

  // In standard container dev/preview/production servers, use relative URLs
  return cleanPath;
};

/**
 * Helper to get the correct WebSocket server URL.
 */
export const getWebSocketUrl = (): string => {
  if (typeof window !== "undefined") {
    // If not native mobile and not external static host (i.e. running on local dev or Cloud Run directly)
    if (!isNativeMobileWrapper() && !isExternalStaticHost()) {
      const isLocalOrContainer =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.includes("run.app");

      if (isLocalOrContainer && window.location.protocol.startsWith("http")) {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        return `${wsProtocol}//${host}`;
      }
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
  customTimeoutMs?: number
): Promise<Response> => {
  const cleanPath = input.startsWith("/") ? input : `/${input}`;
  const targetUrl = getApiUrl(input);
  const headers = new Headers(init?.headers);

  // Set generous timeout: 5 minutes (300,000ms) for upload endpoints or FormData bodies, 60s for general API calls
  const isUpload = cleanPath.includes("upload") || (init?.body instanceof FormData);
  const effectiveTimeout = customTimeoutMs !== undefined 
    ? customTimeoutMs 
    : (isUpload ? 300000 : 60000);

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
  let isTimedOut = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    try {
      controller.abort(new Error(`Timeout: La solicitud tardó más de ${Math.round(effectiveTimeout / 1000)}s`));
    } catch {
      controller.abort();
    }
  }, effectiveTimeout);

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
  } catch (primaryErr: any) {
    clearTimeout(timeoutId);

    // If request was explicitly aborted due to timeout, throw friendly error
    if (isTimedOut) {
      throw new Error(`La carga o conexión ha tardado más de ${Math.round(effectiveTimeout / 1000)} segundos. Por favor, verifica tu conexión a internet e inténtalo de nuevo.`);
    }

    // Fallback: only if running in external static host or native mobile wrapper
    if (!signal.aborted && (isNativeMobileWrapper() || isExternalStaticHost())) {
      const alternateUrl = targetUrl === cleanPath 
        ? `${CLOUD_RUN_BACKEND_URL.replace(/\/$/, "")}${cleanPath}`
        : cleanPath;

      try {
        return await fetch(alternateUrl, fetchOptions);
      } catch (fallbackErr) {
        throw primaryErr;
      }
    }

    throw primaryErr;
  }
};


