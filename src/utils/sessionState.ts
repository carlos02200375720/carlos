// Runtime session only. No localStorage, sessionStorage, IndexedDB, or browser persistence.
// Persistent application data remains in the backend (MongoDB / Google Cloud Storage).
import type { User } from "../types";

let sessionUser: User | null = null;
let sessionUsername: string | null = null;
let authenticated = false;
let platformTarget: "android" | "web" | null = null;

export const sessionState = {
  getUser: (): User | null => sessionUser,
  getUserId: (): string | null => sessionUser?.id ?? sessionUsername ?? null,
  setUser: (user: User | null): void => {
    sessionUser = user;
    const isGuest = !!user && (user.isGuest === true || user.username === "invitado" || user.username?.startsWith("invitado_") || user.id === "guest");
    sessionUsername = (user && !isGuest) ? user.username : null;
    authenticated = !!user && !isGuest;
  },
  getUsername: (): string | null => {
    if (sessionUser && (sessionUser.isGuest === true || sessionUser.username === "invitado" || sessionUser.username?.startsWith("invitado_"))) {
      return null;
    }
    return sessionUsername;
  },
  setUsername: (username: string | null): void => {
    if (username && (username === "invitado" || username === "guest" || username.startsWith("invitado_"))) {
      sessionUsername = null;
    } else {
      sessionUsername = username;
    }
  },
  isAuthenticated: (): boolean => authenticated,
  setAuthenticated: (value: boolean): void => {
    authenticated = value;
  },
  getPlatform: (): "android" | "web" | null => platformTarget,
  setPlatform: (value: "android" | "web" | null): void => {
    platformTarget = value;
  },
  clear: (): void => {
    sessionUser = null;
    sessionUsername = null;
    authenticated = false;
    platformTarget = null;
  },
};
