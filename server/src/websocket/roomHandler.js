import { WebSocketServer } from "ws";

const rooms = new Map(); // roomId -> Set of WebSocket connections

export function createRoomWebSocketServer() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split("/").filter(p => p);
    // Support both /ws/room/room-xxx and /ws/room-xxx
    let roomId = pathParts[pathParts.length - 1];
    
    // If roomId doesn't start with "room-", try to find it in the path
    if (!roomId || (!roomId.startsWith("room-") && pathParts.length > 1)) {
      roomId = pathParts.find(p => p.startsWith("room-"));
    }

    // Fallback: allow roomId via query string, e.g., /ws?roomId=room-xxxx
    if (!roomId) {
      roomId = url.searchParams.get("roomId");
    }

    if (!roomId || !(roomId.startsWith("room-") || roomId.startsWith("conv-"))) {
      ws.close(1008, "Invalid room ID");
      return;
    }

    // Add to room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);

    // Notify others in room
    broadcastToRoom(roomId, ws, {
      type: "user-joined",
      roomId,
    });

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type && data.roomId) {
          // Broadcast to all other clients in the room
          broadcastToRoom(data.roomId, ws, data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(ws);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        } else {
          // Notify others that user left
          broadcastToRoom(roomId, ws, {
            type: "user-left",
            roomId,
          });
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return wss;
}

function broadcastToRoom(roomId, sender, message) {
  if (!rooms.has(roomId)) return;

  rooms.get(roomId).forEach((client) => {
    if (client !== sender && client.readyState === 1) {
      // readyState 1 = OPEN
      client.send(JSON.stringify(message));
    }
  });
}

