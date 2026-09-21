/// <reference types="vite/client" />

export const SUPERADMIN_EMAIL: string =
  String((import.meta as any).env?.VITE_SUPERADMIN_EMAIL || "cg0220037@gmail.com").trim().toLowerCase();

export const isSuperAdmin = (user?: { email?: string; username?: string; id?: string; role?: string; isAdmin?: boolean } | null): boolean => {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  const username = String(user.username || "").trim().toLowerCase();
  const id = String(user.id || "").trim();

  return Boolean(
    (SUPERADMIN_EMAIL && email && email === SUPERADMIN_EMAIL) ||
    email === "cg0220037@gmail.com" ||
    username === "elegan" ||
    id === "user_ih69pd6lu" ||
    user.role === "superadmin"
  );
};

