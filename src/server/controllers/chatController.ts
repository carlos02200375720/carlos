import { Request, Response } from "express";
import mongoose from "mongoose";
import { chatMessages, activeOriginalUserId, activeClients } from "../services/state";
import { MongoChatMessage, MongoUser } from "../models";
import { ChatMessage } from "../../types";
import { generateId } from "../utils/helpers";
import { WebSocket } from "ws";

const SUPPORT_USER_ID = "user_u8d2dsa11";
const SUPPORT_EMAIL = "cg0220037@gmail.com";

/**
 * GET /api/chats/:partnerId
 * Get historical chats with a partner or with support
 */
export async function getChatMessages(req: Request, res: Response): Promise<void> {
  const partnerId = String(req.params.partnerId || "").trim();
  const headerUserId = (req.headers["x-user-id"] as string)?.trim();
  const queryUserId = (req.query.userId as string)?.trim();
  const callerId = headerUserId || queryUserId || activeOriginalUserId || "current_user";

  try {
    let messages: ChatMessage[] = [];

    if (mongoose.connection.readyState === 1) {
      const dbDocs = await MongoChatMessage.find({
        $or: [
          { senderId: callerId, receiverId: partnerId },
          { senderId: partnerId, receiverId: callerId },
          // Also check support aliases if partnerId is support
          ...(partnerId === SUPPORT_USER_ID || partnerId === SUPPORT_EMAIL || partnerId === "support"
            ? [
                { senderId: callerId, receiverId: { $in: [SUPPORT_USER_ID, SUPPORT_EMAIL, "support"] } },
                { senderId: { $in: [SUPPORT_USER_ID, SUPPORT_EMAIL, "support"] }, receiverId: callerId },
              ]
            : []),
        ],
      })
        .sort({ createdAt: 1 })
        .lean();

      if (dbDocs && dbDocs.length > 0) {
        messages = dbDocs.map((d: any) => ({
          id: d.id,
          senderId: d.senderId,
          receiverId: d.receiverId,
          text: d.text,
          timestamp: d.timestamp || d.createdAt?.toISOString() || new Date().toISOString(),
        }));
      }
    }

    // Merge with in-memory messages if not found in db
    if (messages.length === 0) {
      messages = chatMessages.filter((m) => {
        const isFromMe = m.senderId === callerId || (callerId === "current_user" && m.senderId === activeOriginalUserId);
        const isToMe = m.receiverId === callerId || (callerId === "current_user" && m.receiverId === activeOriginalUserId);

        const isFromPartner =
          m.senderId === partnerId ||
          ((partnerId === SUPPORT_USER_ID || partnerId === SUPPORT_EMAIL) &&
            (m.senderId === SUPPORT_USER_ID || m.senderId === SUPPORT_EMAIL || m.senderId === "support"));

        const isToPartner =
          m.receiverId === partnerId ||
          ((partnerId === SUPPORT_USER_ID || partnerId === SUPPORT_EMAIL) &&
            (m.receiverId === SUPPORT_USER_ID || m.receiverId === SUPPORT_EMAIL || m.receiverId === "support"));

        return (isFromMe && isToPartner) || (isFromPartner && isToMe);
      });
    }

    res.json(messages);
  } catch (err: any) {
    console.error("Error fetching chat messages:", err);
    res.status(500).json({ error: "Error al recuperar los mensajes de chat." });
  }
}

/**
 * GET /api/chats/support/conversations
 * For Admin (cg0220037@gmail.com): returns all clients who have messaged support
 */
export async function getSupportConversations(req: Request, res: Response): Promise<void> {
  try {
    const supportAliases = [SUPPORT_USER_ID, SUPPORT_EMAIL, "support", "carlos"];

    let allSupportMessages: any[] = [];
    if (mongoose.connection.readyState === 1) {
      allSupportMessages = await MongoChatMessage.find({
        $or: [
          { senderId: { $in: supportAliases } },
          { receiverId: { $in: supportAliases } },
        ],
      })
        .sort({ createdAt: 1 })
        .lean();
    } else {
      allSupportMessages = chatMessages.filter(
        (m) => supportAliases.includes(m.senderId) || supportAliases.includes(m.receiverId)
      );
    }

    // Group messages by the client (the other party in the conversation)
    const clientMap = new Map<string, { lastMessage: any; messageCount: number }>();
    allSupportMessages.forEach((msg) => {
      const clientId = supportAliases.includes(msg.senderId) ? msg.receiverId : msg.senderId;
      if (!clientId || supportAliases.includes(clientId)) return;

      const existing = clientMap.get(clientId);
      if (!existing) {
        clientMap.set(clientId, { lastMessage: msg, messageCount: 1 });
      } else {
        existing.lastMessage = msg;
        existing.messageCount += 1;
      }
    });

    const clientIds = Array.from(clientMap.keys());
    let clientUsers: any[] = [];
    if (mongoose.connection.readyState === 1 && clientIds.length > 0) {
      clientUsers = await MongoUser.find({ id: { $in: clientIds } }, "id username name avatar email isOnline").lean();
    }

    const conversations = clientIds.map((clientId) => {
      const info = clientMap.get(clientId)!;
      const matchedUser = clientUsers.find((u) => u.id === clientId);
      return {
        clientId,
        user: matchedUser || {
          id: clientId,
          name: clientId.startsWith("guest_") ? "Cliente Invitado" : "Cliente",
          username: clientId,
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        },
        lastMessage: info.lastMessage,
        messageCount: info.messageCount,
      };
    });

    res.json({ conversations });
  } catch (err: any) {
    console.error("Error retrieving support conversations:", err);
    res.status(500).json({ error: "Error al recuperar conversaciones de soporte." });
  }
}

/**
 * POST /api/chats
 * Send a chat message (REST fallback for WebSocket)
 */
export async function sendChatMessage(req: Request, res: Response): Promise<void> {
  const { senderId, receiverId, text } = req.body;
  if (!senderId || !receiverId || !text || !String(text).trim()) {
    res.status(400).json({ error: "senderId, receiverId y text son obligatorios." });
    return;
  }

  const cleanText = String(text).trim();
  const newMsg: ChatMessage = {
    id: "m_" + generateId(),
    senderId: String(senderId).trim(),
    receiverId: String(receiverId).trim(),
    text: cleanText,
    timestamp: new Date().toISOString(),
  };

  try {
    chatMessages.push(newMsg);

    if (mongoose.connection.readyState === 1) {
      await MongoChatMessage.create(newMsg);
    }

    // Forward to recipient via WebSocket if active
    const recSocket = activeClients.get(newMsg.receiverId);
    if (recSocket && recSocket.readyState === WebSocket.OPEN) {
      recSocket.send(
        JSON.stringify({
          type: "private_msg",
          message: newMsg,
        })
      );
    }

    res.json({ success: true, message: newMsg });
  } catch (err: any) {
    console.error("Error sending chat message:", err);
    res.status(500).json({ error: "Error al enviar mensaje." });
  }
}

