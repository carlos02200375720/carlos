import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import mongoose from "mongoose";
import { MongoUser } from "../models";
import { ChatMessage } from "../../types";
import { generateId } from "../utils/helpers";
import {
  activeClients,
  activeOriginalUserId,
  chatMessages,
  liveSessions,
  streamViewersMap,
  broadcastPresence,
  broadcastToStream,
  handleStreamLeave,
  updateAndBroadcastViewers,
} from "./state";

export function setupWebSocket(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle Upgrade from HTTP to WS
  httpServer.on("upgrade", (request, socket, head) => {
    // Avoid upgrading if Vite has its own websocket connection in development
    if (request.url?.startsWith("/@vite") || request.url?.includes("hmr")) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    let clientUserId: string | null = null;
    let currentStreamId: string | null = null;

    ws.on("message", (messageStr: string) => {
      try {
        const payload = JSON.parse(messageStr);

        switch (payload.type) {
          case "auth": {
            clientUserId = payload.userId || "current_user";
            activeClients.set(clientUserId!, ws);

            const userIdToUpdate = clientUserId === "current_user" ? activeOriginalUserId : clientUserId;

            // Update user online status
            if (mongoose.connection.readyState === 1 && userIdToUpdate !== "user_guest") {
              MongoUser.findOneAndUpdate({ id: userIdToUpdate }, { isOnline: true })
                .then(() => broadcastPresence())
                .catch((err: any) => console.error("Error setting user online in WS:", err));
            } else {
              broadcastPresence();
            }
            break;
          }

          case "private_msg": {
            if (activeOriginalUserId === "user_guest") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Un usuario no registrado no puede enviar mensajes."
              }));
              break;
            }
            const { senderId, receiverId, text } = payload;
            if (!senderId || !receiverId || !text) return;

            const actualSenderId = (senderId === "current_user" && activeOriginalUserId !== "user_guest") ? activeOriginalUserId : senderId;

            const newMsg: ChatMessage = {
              id: "m_" + generateId(),
              senderId: actualSenderId,
              receiverId,
              text,
              timestamp: new Date().toISOString()
            };

            chatMessages.push(newMsg);

            // Send to recipient if connected (check receiverId directly or current_user)
            let sentToRec = false;
            const recSocket = activeClients.get(receiverId);
            if (recSocket && recSocket.readyState === WebSocket.OPEN) {
              recSocket.send(JSON.stringify({
                type: "private_msg",
                message: newMsg
              }));
              sentToRec = true;
            }

            if (!sentToRec && receiverId === activeOriginalUserId) {
              const currentClient = activeClients.get("current_user");
              if (currentClient && currentClient.readyState === WebSocket.OPEN) {
                currentClient.send(JSON.stringify({
                  type: "private_msg",
                  message: newMsg
                }));
              }
            }

            // Acknowledge back to sender
            ws.send(JSON.stringify({
              type: "private_msg_sent",
              message: newMsg
            }));
            break;
          }

          case "live_join": {
            const { streamId, username, isHost } = payload;

            if (currentStreamId && currentStreamId !== streamId) {
              handleStreamLeave(ws, currentStreamId);
            }
            currentStreamId = streamId;

            const session = liveSessions.find((s) => s.id === streamId);
            if (session) {
              if (!streamViewersMap.has(streamId)) {
                streamViewersMap.set(streamId, new Set());
              }
              const viewerSet = streamViewersMap.get(streamId)!;
              const isNewViewer = !viewerSet.has(ws);

              if (isHost || clientUserId === session.creatorId) {
                (ws as any).isHostStream = streamId;
              } else {
                (ws as any).isHostStream = false;
              }

              viewerSet.add(ws);
              updateAndBroadcastViewers(streamId);

              // Send system welcome message if new non-host viewer joined
              if (isNewViewer && !(ws as any).isHostStream) {
                const systemMsg = {
                  id: "lc_" + generateId(),
                  username: "System 🤖",
                  avatar: "",
                  text: `👋 ${username || "Un espectador"} se unió a la transmisión.`,
                  createdAt: new Date().toISOString()
                };

                session.chatMessages.push(systemMsg);

                broadcastToStream(streamId, {
                  type: "live_chat_msg",
                  streamId,
                  msg: systemMsg
                });
              }
            }
            break;
          }

          case "live_msg": {
            if (activeOriginalUserId === "user_guest") {
              ws.send(JSON.stringify({
                type: "error",
                message: "Un usuario no registrado no puede enviar mensajes de chat en vivo."
              }));
              break;
            }
            const { streamId, senderName, avatar, text } = payload;
            const session = liveSessions.find((s) => s.id === streamId);
            if (session && text) {
              const liveMsg = {
                id: "lc_" + generateId(),
                username: senderName,
                avatar: avatar,
                text: text,
                createdAt: new Date().toISOString()
              };

              session.chatMessages.push(liveMsg);

              broadcastToStream(streamId, {
                type: "live_chat_msg",
                streamId,
                msg: liveMsg
              });
            }
            break;
          }

          case "live_reaction": {
            const { streamId, reactionType } = payload;
            broadcastToStream(streamId, {
              type: "live_reaction",
              streamId,
              reactionType
            });
            break;
          }

          case "live_leave": {
            const { streamId } = payload;
            handleStreamLeave(ws, streamId);
            currentStreamId = null;
            break;
          }
        }
      } catch (err) {
        console.error("Error handling WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      if (clientUserId) {
        activeClients.delete(clientUserId);
        const userIdToUpdate = clientUserId === "current_user" ? activeOriginalUserId : clientUserId;
        if (mongoose.connection.readyState === 1 && userIdToUpdate !== "user_guest") {
          MongoUser.findOneAndUpdate({ id: userIdToUpdate }, { isOnline: false })
            .then(() => broadcastPresence())
            .catch((err: any) => console.error("Error setting user offline in WS close:", err));
        } else {
          broadcastPresence();
        }
      }

      if (currentStreamId) {
        handleStreamLeave(ws, currentStreamId);
      }
    });
  });

  return wss;
}
