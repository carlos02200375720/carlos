// Runtime session only. No localStorage, sessionStorage, IndexedDB, or browser persistence.
// Persistent application data remains in the backend (MongoDB / Google Cloud Storage).
import type { User } from "../types";

let sessionUser: User | null = null;
let sessionUsername: string | null = null;
let authenticated = false;
let platformTarget: "android" | "web" | null = null;

export const sessionState = {
  getUser: (): User | null => sessionUser,
  setUser: (user: User | null): void => {
    sessionUser = user;
    sessionUsername = user?.username ?? null;
    authenticated = !!user && !user.isGuest;
  },
  getUsername: (): string | null => sessionUsername,
  setUsername: (username: string | null): void => {
    sessionUsername = username;
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
