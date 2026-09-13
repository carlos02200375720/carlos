import type { Express } from "express";

/**
 * Central route registration point.
 * Keep endpoint definitions in this layer and delegate work to controllers.
 */
export function registerRoutes(_app: Express): void {
  // Existing routes are migrated here incrementally to preserve behavior.
}
