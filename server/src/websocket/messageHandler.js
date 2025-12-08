import { WebSocketServer } from "ws";
import Message from "../models/Message.js";

const conversations = new Map(); // conversationId -> Set of WebSocket connections

export function setupMessageWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: "/ws/messages" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const conversationId = url.searchParams.get("conversationId");
    const userId = url.searchParams.get("userId");

    if (!conversationId || !userId) {
      ws.close(1008, "Missing conversationId or userId");
      return;
    }

    // Add to conversation
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, new Set());
    }
    conversations.get(conversationId).add(ws);

    // Send existing messages
    try {
      const dbMessages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .populate("sender", "name");

      const formattedMessages = dbMessages.map((msg) => ({
        id: msg._id.toString(),
        text: msg.text,
        sender: msg.sender._id.toString(),
        senderName: msg.sender.name,
        timestamp: msg.createdAt.toISOString(),
      }));

      ws.send(JSON.stringify({
        type: "messages",
        messages: formattedMessages,
      }));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "message" && data.text) {
          // Save to DB
          const newMessage = new Message({
            conversationId,
            sender: userId,
            text: data.text,
          });
          await newMessage.save();

          const messageObj = {
            id: newMessage._id.toString(),
            text: newMessage.text,
            sender: userId,
            senderName: data.senderName,
            timestamp: newMessage.createdAt.toISOString(),
          };

          // Broadcast to all clients in the conversation
          broadcastToConversation(conversationId, ws, {
            type: "new-message",
            message: messageObj,
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (conversations.has(conversationId)) {
        conversations.get(conversationId).delete(ws);
        if (conversations.get(conversationId).size === 0) {
          conversations.delete(conversationId);
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return wss;
}

function broadcastToConversation(conversationId, sender, message) {
  if (!conversations.has(conversationId)) return;

  conversations.get(conversationId).forEach((client) => {
    if (client !== sender && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

