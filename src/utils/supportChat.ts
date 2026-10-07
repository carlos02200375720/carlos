import { User } from "../types";
import { isSuperAdmin } from "../superAdmin";

export const SUPPORT_EMAIL = "cg0220037@gmail.com";
export const SUPPORT_USER_ID = "user_u8d2dsa11";
export const SUPPORT_ALIASES = [SUPPORT_USER_ID, SUPPORT_EMAIL, "support", "soporte", "carlos", "carlosg", "admin"];

export function isSupportAlias(id?: string | null): boolean {
  if (!id) return false;
  const lower = id.trim().toLowerCase();
  return (
    lower === SUPPORT_EMAIL ||
    lower === SUPPORT_USER_ID.toLowerCase() ||
    SUPPORT_ALIASES.some((alias) => alias.toLowerCase() === lower)
  );
}

export const DEFAULT_SUPPORT_USER: User = {
  id: SUPPORT_USER_ID,
  name: "Soporte al Cliente",
  username: "soporte",
  email: SUPPORT_EMAIL,
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
  bio: "Atención y soporte oficial de Mall Social. Escríbenos aquí para cualquier duda.",
  isOnline: true,
  followers: 999,
  following: 1,
};

/**
 * Resolves the official support user from the current users array or falls back to defaults.
 */
export function resolveSupportUser(users: User[] = []): User {
  const found = users.find(
    (u) =>
      (u.email && u.email.toLowerCase() === SUPPORT_EMAIL) ||
      u.id === SUPPORT_USER_ID ||
      (u.username && u.username.toLowerCase() === "carlos") ||
      isSuperAdmin(u)
  );

  if (found) {
    return {
      ...found,
      name: "Soporte al Cliente",
      bio: "Atención y soporte oficial de Mall Social (cg0220037@gmail.com)",
      isOnline: true,
    };
  }

  return DEFAULT_SUPPORT_USER;
}

/**
 * Determines whether a user is the Support Administrator (cg0220037@gmail.com)
 */
export function isSupportAdmin(user?: User | null): boolean {
  if (!user) return false;
  const email = (user.email || "").trim().toLowerCase();
  return email === SUPPORT_EMAIL || isSuperAdmin(user);
}
