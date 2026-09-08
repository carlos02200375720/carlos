/**
 * Dedicated Web API Layer
 * Ensures the Web frontend communicates cleanly with backend services
 */
import { apiFetch, getApiUrl } from "../../config";

export async function webApiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Platform", "web");
  headers.set("X-Client-Type", "web-browser-app");

  return apiFetch(endpoint, {
    ...options,
    headers,
  });
}

export { getApiUrl };
