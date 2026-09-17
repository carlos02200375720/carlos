import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoUser } from "../models";
import { LiveSession } from "../../types";
import { generateId } from "../utils/helpers";
import {
  liveSessions,
  setLiveSessions,
  activeOriginalUserId,
  broadcastToAll,
} from "../services/state";

/**
 * GET /api/live
 * Get live streams
 */
export function getLiveSessions(req: Request, res: Response): void {
  res.json(liveSessions);
}

/**
 * POST /api/live
 * Create a live stream session (Go Live)
 */
export async function createLiveSession(req: Request, res: Response): Promise<void> {
  const { title, creatorId } = req.body;

  let lookupId = creatorId;
  if (!lookupId || lookupId === "current_user") {
    lookupId = activeOriginalUserId;
  }

  let creator = null;
  if (mongoose.connection.readyState === 1 && lookupId && lookupId !== "user_guest") {
    creator = await MongoUser.findOne({ id: lookupId });
  }

  if (!creator) {
    res.status(403).json({ error: "Un usuario no registrado no puede iniciar transmisiones en vivo." });
    return;
  }

  const existing = liveSessions.find((s) => s.creatorId === creator.id && s.isLive);
  if (existing) {
    res.json(existing);
    return;
  }

  const newSession: LiveSession = {
    id: "live_" + generateId(),
    creatorId: creator.id,
    creatorName: creator.name,
    creatorAvatar: creator.avatar,
    title: title || "My Live Stream! 🔴",
    viewersCount: 0,
    isLive: true,
    chatMessages: [],
  };

  setLiveSessions([...liveSessions, newSession]);

  broadcastToAll({
    type: "live_started",
    session: newSession,
  });

  res.json(newSession);
}

/**
 * POST /api/live/:id/end
 * End a live stream session
 */
export function endLiveSession(req: Request, res: Response): void {
  const session = liveSessions.find((s) => s.id === req.params.id);
  if (!session) {
    res.status(404).json({ error: "Live session not found" });
    return;
  }

  session.isLive = false;
  setLiveSessions(liveSessions.filter((s) => s.id !== session.id));

  broadcastToAll({
    type: "live_ended",
    sessionId: session.id,
  });

  res.json({ success: true });
}
