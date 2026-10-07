import { apiFetch } from "../config";
import { User } from "../types";
import { sessionState } from "./sessionState";

export const GUEST_TOKEN_KEY = "mall_guest_access_token";

/**
 * Retrieves the guest access token saved locally on the user's device.
 */
export function getLocalGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY) || null;
  } catch (err) {
    console.warn("⚠️ No se pudo leer el token de invitado de localStorage:", err);
    return null;
  }
}

/**
 * Stores the unique guest access token locally on the user's device.
 */
export function setLocalGuestToken(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    localStorage.setItem(GUEST_TOKEN_KEY, token.trim());
  } catch (err) {
    console.warn("⚠️ No se pudo guardar el token de invitado en localStorage:", err);
  }
}

/**
 * Retrieves existing guest access token or immediately generates and persists a new one.
 * Ensures the user has a stable unique identifier from their first millisecond in the app.
 */
export function getOrCreateGuestToken(): string {
  const existing = getLocalGuestToken();
  if (existing) return existing;

  if (typeof window === "undefined") {
    return "guest_server_token";
  }

  try {
    const randomHex =
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    const newToken = `guest_tok_${randomHex}_${Date.now().toString(36)}`;
    setLocalGuestToken(newToken);
    return newToken;
  } catch {
    return `guest_tok_${Date.now().toString(36)}`;
  }
}

/**
 * Clears the local guest access token from the device.
 */
export function removeLocalGuestToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {}
}

export interface GuestSessionResult {
  success: boolean;
  isNew: boolean;
  guestToken: string;
  user: User;
}

/**
 * Synchronizes the guest session with MongoDB Atlas:
 * - If this device visits for the first time, generates a unique access token and persists it in MongoDB Atlas & device storage.
 * - If the user is returning, sends their local token to recognize their identity and load their profile history.
 */
export async function syncGuestSession(
  platform: "web" | "android" = "web"
): Promise<GuestSessionResult | null> {
  const existingToken = getLocalGuestToken() || getOrCreateGuestToken();

  try {
    const res = await apiFetch("/api/auth/guest-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(existingToken ? { "x-guest-token": existingToken } : {})
      },
      body: JSON.stringify({
        guestToken: existingToken || undefined,
        platform,
        deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : ""
      })
    });

    if (!res.ok) {
      console.warn("⚠️ Sincronización de sesión de invitado devolvió HTTP", res.status);
      return null;
    }

    const data: GuestSessionResult = await res.json();
    if (data && data.guestToken) {
      setLocalGuestToken(data.guestToken);
      if (data.user) {
        sessionState.setUser(data.user);
      }
      return data;
    }
  } catch (err) {
    console.warn("⚠️ Error en syncGuestSession:", err);
  }

  return null;
}
