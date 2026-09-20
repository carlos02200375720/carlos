import { WebSocket } from "ws";
import mongoose from "mongoose";
import { Product, Reel, Order, ChatMessage, LiveSession, User } from "../../types";
import { MongoUser } from "../models";

// Shared memory stores
export let products: Product[] = [];
export let reels: Reel[] = [];
export let orders: Order[] = [];
export let chatMessages: ChatMessage[] = [];
export let liveSessions: LiveSession[] = [];

// Getters and setters for collections
export const getProducts = (): Product[] => products;
export const setProducts = (newProducts: Product[]): void => {
  products = newProducts;
};

export const getReels = (): Reel[] => reels;
export const setReels = (newReels: Reel[]): void => {
  reels = newReels;
};

export const getOrders = (): Order[] => orders;
export const setOrders = (newOrders: Order[]): void => {
  orders = newOrders;
};

export const getChatMessages = (): ChatMessage[] => chatMessages;

export const getLiveSessions = (): LiveSession[] => liveSessions;
export const setLiveSessions = (sessions: LiveSession[]): void => {
  liveSessions = sessions;
};

// Cart in-memory store (key: userId)
export const cartMemoryStore = new Map<string, any[]>();

// Store active viewer sockets per streamId
export const streamViewersMap = new Map<string, Set<WebSocket>>();

// Active WebSocket client map (key: userId)
export const activeClients = new Map<string, WebSocket>();

// Store the original ID of the active current_user (defaults to guest user's ID)
export let activeOriginalUserId = "user_guest";
export const getActiveOriginalUserId = (): string => activeOriginalUserId;
export const setActiveOriginalUserId = (id: string): void => {
  activeOriginalUserId = id;
};

// Concurrency mutex lock to strictly prevent duplicate simultaneous user registrations
export const pendingRegistrations = new Set<string>();

// Helper: Broadcast message to all connected clients
export function broadcastToAll(message: any): void {
  const serialized = JSON.stringify(message);
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  });
}

// Helper: Send message to all users viewing a specific stream
export function broadcastToStream(streamId: string, message: any): void {
  const serialized = JSON.stringify(message);
  activeClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  });
}

// Helper: Broadcast presence list
export async function broadcastPresence(getUsersFn?: () => Promise<User[]>): Promise<void> {
  try {
    let dbUsers: User[] = [];
    if (getUsersFn) {
      dbUsers = await getUsersFn();
    } else if (mongoose.connection.readyState === 1) {
      const docs = await MongoUser.find({
        id: { $nin: ["current_user", "user_guest", "creator", "creador"] },
        username: { $nin: ["invitado", "creador", "creator"] },
      });
      dbUsers = docs.map((u: any) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        bio: u.bio || "Creador en la plataforma",
        isOnline: u.isOnline !== undefined ? u.isOnline : false,
        followers: u.followers || 0,
        following: u.following || 0,
        followingUserIds: u.followingUserIds || [],
        savedReelIds: u.savedReelIds || [],
        coverPhoto: u.coverPhoto || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isGuest: u.isGuest || false,
        password: u.password || "",
        email: u.email || "",
        privacyPolicy: u.privacyPolicy || "",
      }));
    }

    const presenceData = dbUsers.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatar: u.avatar,
      isOnline: u.isOnline,
    }));

    broadcastToAll({
      type: "presence_list",
      users: presenceData,
    });
  } catch (err) {
    console.error("Error in broadcastPresence:", err);
  }
}

// Helper: Update & broadcast real viewer count
export function updateAndBroadcastViewers(streamId: string): void {
  const session = liveSessions.find((s) => s.id === streamId);
  const viewerSet = streamViewersMap.get(streamId);

  if (!session) return;

  if (!viewerSet) {
    session.viewersCount = 0;
    broadcastToStream(streamId, {
      type: "live_viewers",
      streamId,
      count: 0,
    });
    return;
  }

  // Filter out closed sockets and count audience sockets (non-hosts)
  let audienceCount = 0;
  viewerSet.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      if ((socket as any).isHostStream !== streamId) {
        audienceCount++;
      }
    } else {
      viewerSet.delete(socket);
    }
  });

  session.viewersCount = audienceCount;
  broadcastToStream(streamId, {
    type: "live_viewers",
    streamId,
    count: session.viewersCount,
  });
}

// Helper: Handle client leaving live stream
export function handleStreamLeave(socket: WebSocket, streamId: string): void {
  const viewerSet = streamViewersMap.get(streamId);
  if (viewerSet) {
    viewerSet.delete(socket);
    updateAndBroadcastViewers(streamId);
  }
}
