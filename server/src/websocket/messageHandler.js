import { WebSocketServer } from "ws";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

const conversations = new Map(); // conversationId -> Set of WebSocket connections

export function createMessageWebSocketServer() {
  const wss = new WebSocketServer({ noServer: true });

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

          // Update Conversation document
          try {
            // Check if conversation exists, if not create it
            // Participants are derived from conversationId "conv-user1-user2"
            const parts = conversationId.split("-");
            const participants = [parts[1], parts[2]];

            // NOTE: Dynamic import to avoid circular dependency issues if any, though standard import is fine usually. 
            // We use standard import in this file usually. Let's assume imported at top.
            // Using logic: update or create.

            await Conversation.findOneAndUpdate(
              { conversationId },
              {
                $set: {
                  lastMessage: {
                    text: data.text,
                    sender: userId,
                    createdAt: new Date(),
                  },
                  participants: participants
                },
                $inc: {
                  [`unreadCounts.${participants.find(p => p !== userId)}`]: 1
                },
                $pull: { hiddenFor: { $in: participants } } // Un-hide for everyone involved
              },
              { upsert: true, new: true }
            );
          } catch (err) {
            console.error("Error updating conversation model:", err);
          }

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

