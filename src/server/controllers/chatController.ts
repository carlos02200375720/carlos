import { Request, Response } from "express";
import { chatMessages, activeOriginalUserId } from "../services/state";

/**
 * GET /api/chats/:partnerId
 * Get historical chats with a partner
 */
export function getChatMessages(req: Request, res: Response): void {
  if (activeOriginalUserId === "user_guest") {
    res.status(403).json({ error: "Debes registrarte o iniciar sesión para ver tus chats." });
    return;
  }
  const partnerId = req.params.partnerId;

  const messages = chatMessages.filter((m) => {
    const isFromMe = m.senderId === "current_user" || m.senderId === activeOriginalUserId;
    const isToMe = m.receiverId === "current_user" || m.receiverId === activeOriginalUserId;

    const isFromPartner = m.senderId === partnerId;
    const isToPartner = m.receiverId === partnerId;

    return (isFromMe && isToPartner) || (isFromPartner && isToMe);
  });

  res.json(messages);
}
