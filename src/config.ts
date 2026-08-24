/// <reference types="vite/client" />

// Centralized Backend & API Configuration
export const CLOUD_RUN_BACKEND_URL = "https://carlos02200375720mall-113642516090.europe-west1.run.app";

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || CLOUD_RUN_BACKEND_URL;

/**
 * Helper to get the correct API endpoint URL.
 * Prefers the configured Cloud Run backend URL when connecting across domains.
 */
export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (BACKEND_URL) {
    const trimmedBackend = BACKEND_URL.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location.origin === trimmedBackend) {
      return cleanPath;
    }
    return `${trimmedBackend}${cleanPath}`;
  }
  return cleanPath;
};

/**
 * Helper to get the correct WebSocket server URL.
 */
export const getWebSocketUrl = (): string => {
  if (BACKEND_URL) {
    try {
      const parsed = new URL(BACKEND_URL);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProtocol}//${parsed.host}`;
    } catch (e) {
      console.warn("Could not parse BACKEND_URL as URL, falling back to window.location:", e);
    }
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" && window.location.host ? window.location.host : "carlos02200375720mall-113642516090.europe-west1.run.app";
  return `${protocol}//${host}`;
};

export const apiFetch = async (
  input: string,
  init?: RequestInit
): Promise<Response> => {
  const targetUrl = getApiUrl(input);
  return fetch(targetUrl, init);
};

