/// <reference types="vite/client" />

export const SUPERADMIN_EMAIL: string =
  String((import.meta as any).env?.VITE_SUPERADMIN_EMAIL || "").trim().toLowerCase();

export const isSuperAdmin = (user?: { email?: string } | null): boolean => {
  const email = String(user?.email || "").trim().toLowerCase();
  return Boolean(SUPERADMIN_EMAIL && email && email === SUPERADMIN_EMAIL);
};
