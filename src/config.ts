/// <reference types="vite/client" />

// Centralized Backend & API Configuration
export const CLOUD_RUN_BACKEND_URL = "https://carlos02200375720mall-113642516090.europe-west1.run.app";

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;

/**
 * Helper to determine if we are running in a native mobile wrapper (Capacitor / Cordova / Ionic file:)
 */
export const isNativeMobileWrapper = (): boolean => {
  if (typeof window === "undefined" || !window.location) return false;
  const proto = window.location.protocol;
  return proto === "capacitor:" || proto === "file:" || proto === "ionic:" || proto === "app:";
};

/**
 * Helper to get the correct API endpoint URL.
 * In web browsers (Dev, Preview, Production), relative paths (`/api/...`) connect directly
 * to the container's active server without CORS or cross-origin issues.
 * In native wrappers (Capacitor/Cordova), it prefixes with the remote backend URL.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (typeof window !== "undefined") {
    // If in standard web browser (http / https), use same-origin relative URLs
    if (!isNativeMobileWrapper() && window.location.protocol.startsWith("http")) {
      return cleanPath;
    }
  }

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
  if (typeof window !== "undefined") {
    if (!isNativeMobileWrapper() && window.location.protocol.startsWith("http")) {
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
  init?: RequestInit
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

  const fetchOptions: RequestInit = {
    ...init,
    headers,
  };

  try {
    return await fetch(targetUrl, fetchOptions);
  } catch (primaryErr) {
    // If targetUrl was an absolute URL that failed (e.g. CORS or network error),
    // and relative same-origin fetch is viable, attempt fallback
    if (targetUrl !== cleanPath && typeof window !== "undefined" && window.location?.origin) {
      try {
        return await fetch(cleanPath, fetchOptions);
      } catch (fallbackErr) {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
};


