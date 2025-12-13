import { io } from "socket.io-client";

/**
 * Video Socket Client - Manages Socket.IO connection for video calls
 * Handles authentication and room joining
 */

let socketInstance = null;

/**
 * Initialize socket connection
 * @param {String} token - JWT authentication token
 * @returns {Socket} Socket.IO instance
 */
export function initVideoSocket(token) {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  // If socket exists but not connected, try to reconnect
  if (socketInstance && !socketInstance.connected) {
    socketInstance.connect();
    return socketInstance;
  }

  let apiUrl = import.meta.env.VITE_API_URL;
  // If no API URL set (dev mode), derive from current location but target port 5000
  if (!apiUrl && typeof window !== "undefined") {
    apiUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  const url = (apiUrl || "").replace(/\/$/, "");

  console.log("Initializing video socket to:", url, "path: /bridge");

  socketInstance = io(url, {
    path: "/bridge",
    auth: {
      token,
    },
    transports: ["polling", "websocket"], // Allow both now that we connect directly to backend
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout: 20000,
    forceNew: false,
    autoConnect: true,
  });

  socketInstance.on("connect", () => {
    console.log("Video socket connected:", socketInstance.id);
  });

  socketInstance.on("connect_error", (error) => {
    console.error("Video socket connection error:", error);
  });

  socketInstance.on("disconnect", (reason) => {
    console.log("Video socket disconnected:", reason);
  });

  socketInstance.on("error", (error) => {
    console.error("Video socket error:", error);
  });

  return socketInstance;
}

/**
 * Get socket instance
 */
export function getVideoSocket() {
  return socketInstance;
}

/**
 * Wait for socket to connect
 * @param {Number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise that resolves when connected
 */
function waitForConnection(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!socketInstance) {
      reject(new Error("Socket not initialized"));
      return;
    }

    if (socketInstance.connected) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error("Connection timeout"));
    }, timeout);

    socketInstance.once("connect", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    socketInstance.once("connect_error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * Join booking room
 * @param {String} bookingId - Booking ID
 * @param {String} role - User role (student/tutor)
 * @param {Function} onJoined - Callback when joined
 * @param {Function} onError - Error callback
 */
export async function joinBookingRoom(bookingId, role, onJoined, onError) {
  try {
    // Wait for connection if not already connected
    if (!socketInstance?.connected) {
      await waitForConnection(10000);
    }

    if (!socketInstance || !socketInstance.connected) {
      onError(new Error("Socket not connected after waiting"));
      return;
    }

    socketInstance.emit("join-room", { bookingId, role }, (response) => {
      if (response?.error) {
        onError(new Error(response.error));
      } else {
        onJoined(response);
      }
    });

    socketInstance.on("room-joined", (data) => {
      if (data.bookingId === bookingId) {
        onJoined(data);
      }
    });

    socketInstance.on("error", (error) => {
      if (error.message) {
        onError(error);
      }
    });
  } catch (error) {
    console.error("Error joining room:", error);
    onError(error);
  }
}

/**
 * Disconnect socket
 */
export function disconnectVideoSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default socketInstance;

