import { Request, Response } from "express";
import mongoose from "mongoose";
import { chatMessages, activeOriginalUserId, activeClients } from "../services/state";
import { MongoChatMessage, MongoUser } from "../models";
import { ChatMessage } from "../../types";
import { generateId } from "../utils/helpers";
import { WebSocket } from "ws";

const SUPPORT_USER_ID = "user_u8d2dsa11";
const SUPPORT_EMAIL = "cg0220037@gmail.com";
const SUPPORT_ALIASES = [SUPPORT_USER_ID, SUPPORT_EMAIL, "support", "soporte", "carlos", "carlosg", "admin"];

/**
 * GET /api/chats/:partnerId
 * Get historical chats with a partner or with support
 */
export async function getChatMessages(req: Request, res: Response): Promise<void> {
  const partnerId = String(req.params.partnerId || "").trim();
  const headerUserId = (req.headers["x-user-id"] as string)?.trim();
  const queryUserId = (req.query.userId as string)?.trim();
  const callerId = headerUserId || queryUserId || activeOriginalUserId || "current_user";

  const isPartnerSupport = SUPPORT_ALIASES.includes(partnerId);
  const isCallerSupport = SUPPORT_ALIASES.includes(callerId) || (callerId === "current_user" && activeOriginalUserId === "carlos");

  try {
    let messages: ChatMessage[] = [];

    if (mongoose.connection.readyState === 1) {
      let query: any;

      if (isPartnerSupport) {
        // Client chatting with Support
        query = {
          $or: [
            { senderId: callerId, receiverId: { $in: SUPPORT_ALIASES } },
            { senderId: { $in: SUPPORT_ALIASES }, receiverId: callerId },
            ...(activeOriginalUserId && activeOriginalUserId !== callerId
              ? [
                  { senderId: activeOriginalUserId, receiverId: { $in: SUPPORT_ALIASES } },
                  { senderId: { $in: SUPPORT_ALIASES }, receiverId: activeOriginalUserId },
                ]
              : []),
          ],
        };
      } else if (isCallerSupport) {
        // Admin replying to a Client (partnerId)
        query = {
          $or: [
            { senderId: partnerId, receiverId: { $in: SUPPORT_ALIASES } },
            { senderId: { $in: SUPPORT_ALIASES }, receiverId: partnerId },
          ],
        };
      } else {
        // Direct peer-to-peer fallback
        query = {
          $or: [
            { senderId: callerId, receiverId: partnerId },
            { senderId: partnerId, receiverId: callerId },
          ],
        };
      }

      const dbDocs = await (MongoChatMessage as any).find(query).sort({ createdAt: 1 }).lean();

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

    // Merge with in-memory messages if not found in db or supplement
    if (messages.length === 0) {
      messages = chatMessages.filter((m) => {
        if (isPartnerSupport) {
          const isFromClient = m.senderId === callerId || (callerId === "current_user" && m.senderId === activeOriginalUserId);
          const isToClient = m.receiverId === callerId || (callerId === "current_user" && m.receiverId === activeOriginalUserId);
          const isFromSupport = SUPPORT_ALIASES.includes(m.senderId);
          const isToSupport = SUPPORT_ALIASES.includes(m.receiverId);
          return (isFromClient && isToSupport) || (isFromSupport && isToClient);
        }

        if (isCallerSupport) {
          const isFromClient = m.senderId === partnerId;
          const isToClient = m.receiverId === partnerId;
          const isFromSupport = SUPPORT_ALIASES.includes(m.senderId);
          const isToSupport = SUPPORT_ALIASES.includes(m.receiverId);
          return (isFromClient && isToSupport) || (isFromSupport && isToClient);
        }

        const isFromMe = m.senderId === callerId;
        const isToMe = m.receiverId === callerId;
        const isFromPartner = m.senderId === partnerId;
        const isToPartner = m.receiverId === partnerId;
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
    const supportAliases = SUPPORT_ALIASES;

    let allSupportMessages: any[] = [];
    if (mongoose.connection.readyState === 1) {
      allSupportMessages = await (MongoChatMessage as any).find({
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

