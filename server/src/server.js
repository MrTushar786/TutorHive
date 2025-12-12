import dotenv from "dotenv";
import { createServer } from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { createRoomWebSocketServer } from "./websocket/roomHandler.js";
import { createMessageWebSocketServer } from "./websocket/messageHandler.js";
import { setupVideoSocket } from "./websocket/videoSocket.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const server = createServer(app);

    // Create WebSocket servers (unbound)
    const roomWss = createRoomWebSocketServer();
    const messageWss = createMessageWebSocketServer();

    // Setup Socket.IO (binds to server automatically)
    setupVideoSocket(server);

    // Handle upgrade requests manually to route to correct WS server
    server.on("upgrade", (request, socket, head) => {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`);

      if (pathname.startsWith("/ws/messages")) {
        messageWss.handleUpgrade(request, socket, head, (ws) => {
          messageWss.emit("connection", ws, request);
        });
      } else if (pathname.startsWith("/ws")) {
        roomWss.handleUpgrade(request, socket, head, (ws) => {
          roomWss.emit("connection", ws, request);
        });
      }
      // Note: Socket.IO handles its own upgrade requests (e.g., /bridge)
    });

    server.listen(PORT, () => {
      console.log(`✅ API ready on port ${PORT}`);
      console.log(`✅ WebSocket server ready on ws://localhost:${PORT}/ws`);
      console.log(`✅ Message WebSocket server ready on ws://localhost:${PORT}/ws/messages`);
      console.log(`✅ Socket.IO video signaling server ready on /bridge`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();

