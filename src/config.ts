import { sessionState } from "./utils/sessionState";

/// <reference types="vite/client" />

// Centralized Backend & API Configuration
export const CLOUD_RUN_BACKEND_URL = "https://elegan-backend-587849039182.us-east1.run.app";

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;


/**
 * Helper to determine if we are running on an external static frontend host without backend (GitHub Pages, Vercel, Netlify, etc.)
 */
export const isExternalStaticHost = (): boolean => {
  if (typeof window === "undefined" || !window.location) return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.includes("pages.dev") ||
    host.includes("github.io") ||
    host.includes("surge.sh") ||
    host.includes("vercel.app") ||
    host.includes("netlify.app")
  );
};

/**
 * Helper to resolve media URLs (videos, HLS streams, thumbnails, posters).
 * Ensures relative `/uploads/...` paths are directed to the active backend when running
 * on external static hosts (Vercel, Netlify, GitHub Pages) or native mobile wrappers.
 */
export const getMediaUrl = (path: string | undefined | null): string => {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";

  // If this is a Google Cloud Storage URL (HLS playlist, video segment, MP4, image, avatar, or publication),
  // route it through our backend streaming proxy (/api/hls/... or /uploads/...) so the browser's Hls.js / MSE
  // and <video> tags receive full CORS headers (Access-Control-Allow-Origin: *) and avoid cross-origin blocking.
  const gcsMatch = trimmed.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
  if (gcsMatch) {
    const rawSubpath = gcsMatch[1];
    const isHls = rawSubpath.startsWith("hls/") || rawSubpath.includes(".m3u8");
    const relativeProxy = isHls
      ? `/api/hls/${rawSubpath.replace(/^hls\//, "")}`
      : `/uploads/${rawSubpath}`;

    if (isNativeMobileWrapper() || isExternalStaticHost()) {
      const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
      return `${trimmedBackend}${relativeProxy}`;
    }
    return relativeProxy;
  }

  // Handle /uploads/hls/... legacy paths
  const uploadsHlsMatch = trimmed.match(/^(?:https?:\/\/[^/]+)?\/uploads\/hls\/(.+)$/);
  if (uploadsHlsMatch) {
    const relativeHls = `/api/hls/${uploadsHlsMatch[1]}`;
    if (isNativeMobileWrapper() || isExternalStaticHost()) {
      const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
      return `${trimmedBackend}${relativeHls}`;
    }
    return relativeHls;
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }

  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (isNativeMobileWrapper() || isExternalStaticHost()) {
    const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
    return `${trimmedBackend}${cleanPath}`;
  }
  return cleanPath;
};

/**
 * Helper to determine if we are running in a native mobile wrapper (Capacitor / Cordova / Ionic on Android/iOS)
 */
export const isNativeMobileWrapper = (): boolean => {
  if (typeof window === "undefined" || !window.location) return false;

  const win = window as any;
  // 1. Explicit Capacitor native platform (isNativePlatform returns true ONLY when in native app, false in web)
  if (typeof win.Capacitor?.isNativePlatform === "function" && win.Capacitor.isNativePlatform()) {
    return true;
  }
  if (win.Capacitor?.getPlatform && (win.Capacitor.getPlatform() === "android" || win.Capacitor.getPlatform() === "ios")) {
    return true;
  }

  // 2. Protocols used exclusively by native mobile wrappers (never used by regular web browsers)
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
 * In any web browser (Dev, Preview, Cloud Run, Render, localhost), relative paths (`/api/...`) connect directly
 * to the container's active full-stack server without CORS or cross-origin latency issues.
 * In native wrappers (Capacitor / Cordova on Android & iOS) or purely static hosts, it prefixes with the remote backend URL.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // In a standard web browser running on the full-stack server (Dev, Preview, localhost, or deployed container),
  // keep ALL API requests relative so they hit the active Express backend directly without CORS or dead proxy issues.
  if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http") && !isNativeMobileWrapper() && !isExternalStaticHost()) {
    return cleanPath;
  }

  // Large media uploads only need to bypass Vercel when running on an external static frontend host without backend
  const isLargeMediaUpload = cleanPath === "/api/upload" || cleanPath === "/api/android/upload" || cleanPath === "/upload";
  if (isLargeMediaUpload && isExternalStaticHost()) {
    const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
    return `${trimmedBackend}${cleanPath}`;
  }

  // In native Android/iOS wrappers or purely static external hosts, connect to the Cloud Run backend
  if (isNativeMobileWrapper() || isExternalStaticHost()) {
    const trimmedBackend = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
    return `${trimmedBackend}${cleanPath}`;
  }

  // Fallback to relative URL
  return cleanPath;
};

/**
 * Helper to get the correct WebSocket server URL.
 */
export const getWebSocketUrl = (): string => {
  // In a standard browser running on the full-stack server, connect directly to the current host
  if (typeof window !== "undefined" && window.location && !isNativeMobileWrapper() && !isExternalStaticHost()) {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.host}`;
  }

  // If on static host or native app, connect to the remote backend WebSocket
  if (BACKEND_URL) {
    try {
      const parsed = new URL(BACKEND_URL);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${parsed.host}`;
    } catch (e) {
      console.warn("Could not parse BACKEND_URL as URL, falling back:", e);
    }
  }

  return "wss://elegan-backend-587849039182.us-east1.run.app";
};

export const apiFetch = async (
  input: string,
  init?: RequestInit,
  customTimeoutMs?: number
): Promise<Response> => {
  const cleanPath = input.startsWith("/") ? input : `/${input}`;
  const reqMethod = (init?.method || "GET").toUpperCase();

  // Web and Android must publish through the same canonical persistence routes.
  // The Android gateway already performs transactional writes to MongoReel and
  // creates product companion reels, while the legacy web mutation routes can
  // return success even when their Mongo write fails.
  const canonicalMutationPath =
    reqMethod === "POST" && cleanPath === "/api/reels"
      ? "/api/android/reels"
      : reqMethod === "POST" && cleanPath === "/api/products"
        ? "/api/android/products"
        : cleanPath;

  const targetUrl = getApiUrl(canonicalMutationPath);
  const headers = new Headers(init?.headers);

  // Set generous timeout: 5 minutes (300,000ms) for upload endpoints or FormData bodies, 60s for general API calls
  const isUpload = cleanPath.includes("upload") || (init?.body instanceof FormData);
  const effectiveTimeout = customTimeoutMs !== undefined 
    ? customTimeoutMs 
    : (isUpload ? 300000 : 60000);

  if (typeof window !== "undefined") {
    try {
      const loggedInUsername = sessionState.getUsername();
      const currentUserData = JSON.stringify(sessionState.getUser());
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
      // Ignore runtime session parsing error
    }
  }

  if (isNativeMobileWrapper()) {
    if (!headers.has("X-Platform")) headers.set("X-Platform", "android");
    if (!headers.has("X-Client-Platform")) headers.set("X-Client-Platform", "android");
    if (!headers.has("X-Client-App")) headers.set("X-Client-App", "MallSocial-Android");
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

    // If remote host returned 5xx server error, and we have a local dev/preview host available, try local
    if (!res.ok && res.status >= 500 && targetUrl !== cleanPath) {
      if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
        try {
          const localRes = await fetch(cleanPath, fetchOptions);
          if (localRes.ok) return localRes;
        } catch {}
      }
    }

    return res;
  } catch (primaryErr: any) {
    clearTimeout(timeoutId);

    // If request was explicitly aborted due to timeout, throw friendly error
    if (isTimedOut) {
      throw new Error(`La carga o conexión ha tardado más de ${Math.round(effectiveTimeout / 1000)} segundos. Por favor, verifica tu conexión a internet e inténtalo de nuevo.`);
    }

    // If targetUrl was a remote URL and failed with network/CORS error, attempt the local relative endpoint
    if (targetUrl !== cleanPath && typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
      try {
        console.warn(`⚠️ [apiFetch] Falló conexión a ${targetUrl}. Reintentando con endpoint local ${cleanPath}...`);
        const localRes = await fetch(cleanPath, fetchOptions);
        if (localRes.ok || localRes.status < 500) {
          return localRes;
        }
      } catch (localErr) {
        console.warn(`⚠️ [apiFetch] Endpoint local ${cleanPath} también falló:`, localErr);
      }
    }

    // Fallback: if primary URL failed, attempt alternative backend URL or dedicated Android route
    // ONLY for idempotent, safe methods (GET, HEAD). NEVER retry POST, PUT, DELETE or mutations!
    const isIdempotentSafe = reqMethod === "GET" || reqMethod === "HEAD";

    if (!signal.aborted && isIdempotentSafe) {
      const backendBase = (BACKEND_URL || CLOUD_RUN_BACKEND_URL).replace(/\/$/, "");
      
      // If we are querying reels or products or users, attempt dedicated android endpoint
      if (cleanPath === "/api/reels" || cleanPath === "/api/products" || cleanPath === "/api/users") {
        const androidEndpoint = cleanPath.replace(/^\/api/, "/api/android");
        const androidTarget = isNativeMobileWrapper() || isExternalStaticHost()
          ? `${backendBase}${androidEndpoint}`
          : androidEndpoint;

        try {
          const androidRes = await fetch(androidTarget, fetchOptions);
          if (androidRes.ok) return androidRes;
        } catch {}
      }

      const alternateUrl = targetUrl === cleanPath 
        ? `${backendBase}${cleanPath}`
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
