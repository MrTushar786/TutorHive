import dotenv from "dotenv";
import { createServer } from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { setupWebSocketServer } from "./websocket/roomHandler.js";
import { setupMessageWebSocketServer } from "./websocket/messageHandler.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const server = createServer(app);
    setupWebSocketServer(server);
    setupMessageWebSocketServer(server);
    server.listen(PORT, () => {
      console.log(`API ready on port ${PORT}`);
      console.log(`WebSocket server ready on ws://localhost:${PORT}/ws`);
      console.log(`Message WebSocket server ready on ws://localhost:${PORT}/ws/messages`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();

