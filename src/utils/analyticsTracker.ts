import { apiFetch } from "../config";
import { sessionState } from "./sessionState";

export type FunnelStepType =
  | "page_visit"
  | "tienda"
  | "producto_id"
  | "carrito"
  | "verificacion"
  | "gracia";

export interface FunnelPeriodMetrics {
  capa1_tienda: number;
  capa2_producto_id: number;
  capa3_carrito: number;
  capa4_verificacion: number;
  capa5_gracia: number;
  users?: {
    capa1_tienda: number;
    capa2_producto_id: number;
    capa3_carrito: number;
    capa4_verificacion: number;
    capa5_gracia: number;
  };
}

export interface FunnelAnalyticsData {
  pageVisits: {
    day: number;
    week: number;
    month: number;
    year: number;
  };
  pageUsers?: {
    day: number;
    week: number;
    month: number;
    year: number;
  };
  funnelByPeriod: {
    day: FunnelPeriodMetrics;
    week: FunnelPeriodMetrics;
    month: FunnelPeriodMetrics;
    year: FunnelPeriodMetrics;
    all: FunnelPeriodMetrics;
  };
  updatedAt?: string;
}

const LOCAL_STORAGE_KEY = "mall_funnel_analytics_v1";
const VISITOR_ID_KEY = "mall_visitor_uid";
let lastTrackedStepKey = "";
let lastTrackedStepTime = 0;

interface LocalFunnelEvent {
  step: FunnelStepType;
  timestamp: number;
  visitorId: string;
  userId?: string;
  path?: string;
  productId?: string;
}

/**
 * Returns a persistent unique identifier for this browser/user
 */
export function getOrCreateVisitorId(): { visitorId: string; userId?: string } {
  if (typeof window === "undefined") {
    return { visitorId: "server_visitor" };
  }
  const activeUser = typeof sessionState?.getUser === "function" ? sessionState.getUser() : null;
  const activeUserId =
    activeUser?.id ||
    (typeof sessionState?.getUsername === "function" ? sessionState.getUsername() : null) ||
    "";
  const isLoggedUser =
    Boolean(activeUserId) &&
    activeUserId !== "current_user" &&
    activeUserId !== "user_guest" &&
    activeUserId !== "invitado";

  let anonId = "";
  try {
    anonId = window.localStorage.getItem(VISITOR_ID_KEY) || "";
    if (!anonId) {
      anonId = `vis_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      window.localStorage.setItem(VISITOR_ID_KEY, anonId);
    }
  } catch {
    anonId = "vis_session";
  }

  return {
    visitorId: isLoggedUser ? activeUserId : anonId,
    userId: isLoggedUser ? activeUserId : undefined,
  };
}

function getLocalEvents(): LocalFunnelEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendLocalEvent(event: LocalFunnelEvent): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalEvents();
    existing.push(event);
    const trimmed = existing.slice(-1500);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("funnel-analytics-updated"));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Records a funnel step or page visit both locally and on the backend,
 * tracking both total visits and unique user ID.
 */
export function trackFunnelStep(
  step: FunnelStepType,
  options?: { path?: string; productId?: string }
): void {
  if (typeof window === "undefined") return;
  const currentPath = options?.path || window.location.pathname;
  const dedupKey = `${step}:${currentPath}:${options?.productId || ""}`;
  const now = Date.now();

  // Prevent duplicate firing within 1.2s for the exact same step & path
  if (dedupKey === lastTrackedStepKey && now - lastTrackedStepTime < 1200) {
    return;
  }
  lastTrackedStepKey = dedupKey;
  lastTrackedStepTime = now;

  const { visitorId, userId } = getOrCreateVisitorId();

  appendLocalEvent({
    step,
    timestamp: now,
    visitorId,
    userId,
    path: currentPath,
    productId: options?.productId,
  });

  apiFetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step,
      visitorId,
      userId,
      path: currentPath,
      productId: options?.productId,
    }),
  }).catch(() => {});
}

/**
 * Fetches live funnel analytics from the backend API
 */
export async function fetchFunnelAnalytics(): Promise<FunnelAnalyticsData | null> {
  try {
    const res = await apiFetch("/api/analytics/funnel");
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.pageVisits && data.funnelByPeriod) {
      return data as FunnelAnalyticsData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns local session increments (both total visits and unique users)
 */
export function getLocalFunnelCounts(windowMs: number) {
  const now = Date.now();
  const events = getLocalEvents().filter((e) => now - e.timestamp <= windowMs);

  const countStepUsers = (stepFilter: FunnelStepType | "all") => {
    const subset =
      stepFilter === "all" ? events : events.filter((e) => e.step === stepFilter);
    const set = new Set<string>();
    subset.forEach((e) => set.add(e.userId || e.visitorId || "local_user"));
    return set.size;
  };

  return {
    allVisits: events.length,
    allUsers: countStepUsers("all"),
    tienda: events.filter((e) => e.step === "tienda").length,
    producto_id: events.filter((e) => e.step === "producto_id").length,
    carrito: events.filter((e) => e.step === "carrito").length,
    verificacion: events.filter((e) => e.step === "verificacion").length,
    gracia: events.filter((e) => e.step === "gracia").length,
    users: {
      tienda: countStepUsers("tienda"),
      producto_id: countStepUsers("producto_id"),
      carrito: countStepUsers("carrito"),
      verificacion: countStepUsers("verificacion"),
      gracia: countStepUsers("gracia"),
    },
  };
}
