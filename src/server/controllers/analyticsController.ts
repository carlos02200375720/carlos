import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoAppSettings } from "../models";
import { orders, broadcastToAll } from "../services/state";

export type FunnelStepType =
  | "page_visit"
  | "tienda"
  | "producto_id"
  | "carrito"
  | "verificacion"
  | "gracia";

export interface FunnelEventRecord {
  step: FunnelStepType;
  timestamp: number;
  visitorId: string;
  userId?: string;
  path?: string;
  productId?: string;
}

export interface StepDualCount {
  visits: number;
  users: number;
}

export interface FunnelPeriodMetrics {
  capa1_tienda: number;
  capa2_producto_id: number;
  capa3_carrito: number;
  capa4_verificacion: number;
  capa5_gracia: number;
  users: {
    capa1_tienda: number;
    capa2_producto_id: number;
    capa3_carrito: number;
    capa4_verificacion: number;
    capa5_gracia: number;
  };
}

interface AnalyticsMemoryState {
  events: FunnelEventRecord[];
  loadedFromDb: boolean;
}

const analyticsState: AnalyticsMemoryState = {
  events: [],
  loadedFromDb: false,
};

const MAX_STORED_EVENTS = 10000;

/**
 * Load persisted funnel events from MongoDB AppSettings document (key: "analytics_funnel")
 */
export async function loadAnalyticsFromDb(): Promise<void> {
  if (analyticsState.loadedFromDb || mongoose.connection.readyState !== 1) return;
  try {
    const doc = await MongoAppSettings.findOne({ key: "analytics_funnel" }).lean();
    if (doc && Array.isArray((doc as any).funnelEvents)) {
      analyticsState.events = (doc as any).funnelEvents.map((ev: any, idx: number) => ({
        ...ev,
        visitorId: ev.visitorId || ev.userId || `legacy_visitor_${idx}`,
      }));
    }
    analyticsState.loadedFromDb = true;
  } catch (err) {
    console.warn("⚠️ [Analytics] Could not load funnel events from DB:", err);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function scheduleSaveAnalyticsToDb(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const trimmed = analyticsState.events.slice(-MAX_STORED_EVENTS);
      await MongoAppSettings.collection.updateOne(
        { key: "analytics_funnel" },
        {
          $set: {
            key: "analytics_funnel",
            funnelEvents: trimmed,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.warn("⚠️ [Analytics] Error saving funnel events to DB:", err);
    }
  }, 800);
}

/**
 * Compute 100% real aggregated page visits & unique users (day, week, month, year)
 * and 5-layer sales funnel metrics by total visits AND by unique users.
 */
export function computeFunnelSummary() {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const ONE_WEEK = 7 * ONE_DAY;
  const ONE_MONTH = 30 * ONE_DAY;
  const ONE_YEAR = 365 * ONE_DAY;

  const events = analyticsState.events;

  // Real orders in window: both total orders (visits) and distinct buyers (users)
  const getRealOrdersStatsInWindow = (windowMs: number): StepDualCount => {
    const filteredOrders = orders.filter((o) => {
      if (!o.createdAt) return windowMs >= ONE_YEAR;
      const createdMs = new Date(o.createdAt).getTime();
      if (Number.isNaN(createdMs)) return windowMs >= ONE_YEAR;
      return now - createdMs <= windowMs;
    });
    const buyerSet = new Set<string>();
    filteredOrders.forEach((o, i) => {
      const buyerKey =
        (o as any).userId ||
        o.buyerUsername ||
        (o as any).buyerEmail ||
        o.buyerName ||
        o.id ||
        `buyer_${i}`;
      buyerSet.add(String(buyerKey).toLowerCase());
    });
    return {
      visits: filteredOrders.length,
      users: buyerSet.size,
    };
  };

  // Count strictly real tracked events by time window (both total visits and unique users)
  const getStepStats = (
    stepFilter: FunnelStepType | "all_visits",
    windowMs: number
  ): StepDualCount => {
    const matching = events.filter((ev) => {
      if (now - ev.timestamp > windowMs) return false;
      if (stepFilter === "all_visits") return true;
      return ev.step === stepFilter;
    });
    const uniqueVisitors = new Set<string>();
    matching.forEach((ev) => {
      const uid = ev.userId || ev.visitorId || "anon";
      uniqueVisitors.add(uid);
    });
    return {
      visits: matching.length,
      users: uniqueVisitors.size,
    };
  };

  const buildRealPeriodFunnel = (windowMs: number): FunnelPeriodMetrics => {
    const s1 = getStepStats("tienda", windowMs);
    const s2 = getStepStats("producto_id", windowMs);
    const s3 = getStepStats("carrito", windowMs);
    const s4 = getStepStats("verificacion", windowMs);
    const s5 = getStepStats("gracia", windowMs);
    const orderStats = getRealOrdersStatsInWindow(windowMs);

    return {
      capa1_tienda: s1.visits,
      capa2_producto_id: s2.visits,
      capa3_carrito: s3.visits,
      capa4_verificacion: s4.visits,
      capa5_gracia: Math.max(s5.visits, orderStats.visits),
      users: {
        capa1_tienda: s1.users,
        capa2_producto_id: s2.users,
        capa3_carrito: s3.users,
        capa4_verificacion: s4.users,
        capa5_gracia: Math.max(s5.users, orderStats.users),
      },
    };
  };

  const dayStats = getStepStats("all_visits", ONE_DAY);
  const weekStats = getStepStats("all_visits", ONE_WEEK);
  const monthStats = getStepStats("all_visits", ONE_MONTH);
  const yearStats = getStepStats("all_visits", ONE_YEAR);

  return {
    pageVisits: {
      day: dayStats.visits,
      week: weekStats.visits,
      month: monthStats.visits,
      year: yearStats.visits,
    },
    pageUsers: {
      day: dayStats.users,
      week: weekStats.users,
      month: monthStats.users,
      year: yearStats.users,
    },
    funnelByPeriod: {
      day: buildRealPeriodFunnel(ONE_DAY),
      week: buildRealPeriodFunnel(ONE_WEEK),
      month: buildRealPeriodFunnel(ONE_MONTH),
      year: buildRealPeriodFunnel(ONE_YEAR),
      all: buildRealPeriodFunnel(ONE_YEAR * 50),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/analytics/funnel
 */
export async function getFunnelAnalytics(req: Request, res: Response): Promise<void> {
  try {
    await loadAnalyticsFromDb();
    const summary = computeFunnelSummary();
    res.json({
      success: true,
      ...summary,
    });
  } catch (err: any) {
    console.error("❌ Error getting funnel analytics:", err);
    res.status(500).json({ error: "Error obteniendo métricas del embudo", details: err.message });
  }
}

/**
 * POST /api/analytics/track
 */
export async function trackFunnelEvent(req: Request, res: Response): Promise<void> {
  try {
    await loadAnalyticsFromDb();
    const { step, visitorId, userId, path, productId } = req.body || {};
    const validSteps: FunnelStepType[] = [
      "page_visit",
      "tienda",
      "producto_id",
      "carrito",
      "verificacion",
      "gracia",
    ];

    const normalizedStep: FunnelStepType = validSteps.includes(step) ? step : "page_visit";

    const fallbackIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "anon_ip";
    const resolvedVisitorId = String(
      userId || visitorId || req.headers["x-user-id"] || fallbackIp
    );

    const newRecord: FunnelEventRecord = {
      step: normalizedStep,
      timestamp: Date.now(),
      visitorId: resolvedVisitorId,
      userId: userId ? String(userId) : undefined,
      path: path ? String(path) : undefined,
      productId: productId ? String(productId) : undefined,
    };

    analyticsState.events.push(newRecord);
    if (analyticsState.events.length > MAX_STORED_EVENTS) {
      analyticsState.events = analyticsState.events.slice(-MAX_STORED_EVENTS);
    }

    scheduleSaveAnalyticsToDb();

    const summary = computeFunnelSummary();
    broadcastToAll({
      type: "analytics_funnel_updated",
      ...summary,
    });

    res.json({
      success: true,
      ...summary,
    });
  } catch (err: any) {
    console.error("❌ Error tracking funnel event:", err);
    res.status(500).json({ error: "Error registrando evento de analítica", details: err.message });
  }
}
