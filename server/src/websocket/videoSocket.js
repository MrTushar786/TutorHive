import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";

/**
 * Enterprise-grade Socket.IO signaling server for video calls
 * Handles booking-based room authorization and WebRTC signaling
 */

// Store active rooms: roomId -> Set of socket IDs
const activeRooms = new Map();

// Store socket metadata: socketId -> { userId, bookingId, roomId, role }
const socketMetadata = new Map();

/**
 * Verify JWT token from socket handshake
 */
function verifyToken(socket) {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    console.log("No token provided in socket handshake");
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Extract user ID from subject (sub) field, same as auth middleware
    const userId = decoded.sub || decoded.id || decoded._id;
    const role = decoded.role;

    if (!userId) {
      console.log("Token decoded but no user ID found");
      return null;
    }

    console.log(`Token verified: userId=${userId}, role=${role}`);
    return { id: userId.toString(), role };
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return null;
  }
}

/**
 * Verify user has access to booking
 */
async function verifyBookingAccess(userId, bookingId, role) {
  try {
    console.log(`Verifying booking access: userId=${userId}, bookingId=${bookingId}, role=${role}`);

    const booking = await Booking.findById(bookingId).populate("student tutor");

    if (!booking) {
      console.log(`Booking ${bookingId} not found`);
      return { authorized: false, reason: "Booking not found" };
    }

    // Get IDs as strings for comparison
    const studentId = booking.student?._id?.toString() || booking.student?.toString();
    const tutorId = booking.tutor?._id?.toString() || booking.tutor?.toString();
    const userIdStr = userId.toString();

    console.log(`Booking details: studentId=${studentId}, tutorId=${tutorId}, status=${booking.status}`);

    // Check if user is the student or tutor of this booking
    const isStudent = studentId === userIdStr;
    const isTutor = tutorId === userIdStr;

    console.log(`User check: isStudent=${isStudent}, isTutor=${isTutor}`);

    if (!isStudent && !isTutor) {
      console.log(`User ${userIdStr} is not the student (${studentId}) or tutor (${tutorId}) of booking ${bookingId}`);
      return { authorized: false, reason: "Not authorized for this booking" };
    }

    // Verify role matches
    if ((role === "student" && !isStudent) || (role === "tutor" && !isTutor)) {
      console.log(`Role mismatch: user claims to be ${role} but isStudent=${isStudent}, isTutor=${isTutor}`);
      return { authorized: false, reason: "Role mismatch" };
    }

    // Only allow calls for confirmed or pending bookings
    if (!["pending", "confirmed"].includes(booking.status)) {
      console.log(`Booking status ${booking.status} is not allowed for calls`);
      return { authorized: false, reason: "Booking not available for calls" };
    }

    console.log(`Authorization successful for user ${userIdStr} as ${role}`);
    return { authorized: true, booking };
  } catch (error) {
    console.error("Error verifying booking access:", error);
    return { authorized: false, reason: "Server error" };
  }
}

/**
 * Initialize Socket.IO server with booking-based authorization
 */
export function setupVideoSocket(server) {
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim())
    : []; // Default to empty to allow all in dev logic below

  console.log("Video Socket allowed origins:", allowedOrigins.length ? allowedOrigins : "ALL (Dev Mode)");

  const io = new Server(server, {
    path: "/bridge",
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true); // Dev mode

        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith(".vercel.app")) {
          callback(null, true);
        } else {
          console.log("Blocked by CORS:", origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    serveClient: false,
    transports: ["websocket", "polling"],
    allowEIO3: true,
  });

  // Allow connection first, verify auth on join-room
  io.use(async (socket, next) => {
    try {
      // Try to verify token, but don't block connection
      const user = verifyToken(socket);
      if (user) {
        socket.user = user;
      }
      // Allow connection, we'll verify on join-room
      next();
    } catch (error) {
      console.error("Socket middleware error:", error);
      // Still allow connection, verify later
      next();
    }
  });

  io.on("connection", async (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Verify authentication on connection
    const user = verifyToken(socket);
    if (!user) {
      console.log(`Socket ${socket.id} - No valid token, will verify on join-room`);
      socket.user = null;
    } else {
      socket.user = user;
      console.log(`Socket connected: ${socket.id}, User: ${socket.user.id}`);
    }

    // Join booking room
    socket.on("join-room", async (data) => {
      const { bookingId, role } = data;

      if (!bookingId || !role) {
        socket.emit("error", { message: "Missing bookingId or role" });
        return;
      }

      // Verify authentication if not already done
      if (!socket.user) {
        const user = verifyToken(socket);
        if (!user) {
          socket.emit("error", { message: "Authentication required" });
          return;
        }
        socket.user = user;
      }

      // Verify booking access
      const access = await verifyBookingAccess(socket.user.id, bookingId, role);

      if (!access.authorized) {
        socket.emit("error", { message: access.reason });
        return;
      }

      const roomId = `booking:${bookingId}`;

      // Join room
      await socket.join(roomId);

      // Track room membership
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, new Set());
      }
      activeRooms.get(roomId).add(socket.id);

      // Store metadata
      socketMetadata.set(socket.id, {
        userId: socket.user.id,
        bookingId,
        roomId,
        role,
      });

      // Notify others in room
      const roomSize = activeRooms.get(roomId).size;
      socket.to(roomId).emit("user-joined", {
        userId: socket.user.id,
        role,
        roomSize,
      });

      socket.emit("room-joined", {
        roomId,
        bookingId,
        role,
        roomSize,
      });

      console.log(`User ${socket.user.id} joined room ${roomId} as ${role}`);
    });

    // Handle WebRTC offer
    socket.on("call-offer", async (data) => {
      const { offer, bookingId } = data;
      const metadata = socketMetadata.get(socket.id);

      console.log(`Received offer for booking ${bookingId} from ${socket.user.id}`);

      if (!metadata || metadata.bookingId !== bookingId) {
        console.log(`Authorization failed: metadata=${!!metadata}, bookingId match=${metadata?.bookingId === bookingId}`);
        socket.emit("error", { message: "Not authorized" });
        return;
      }

      const roomId = `booking:${bookingId}`;
      console.log(`Broadcasting offer to room ${roomId}`);
      socket.to(roomId).emit("call-offer", {
        offer,
        from: socket.user.id,
        role: metadata.role,
        bookingId,
      });
    });

    // Handle WebRTC answer
    socket.on("call-answer", async (data) => {
      const { answer, bookingId } = data;
      const metadata = socketMetadata.get(socket.id);

      console.log(`Received answer for booking ${bookingId} from ${socket.user.id}`);

      if (!metadata || metadata.bookingId !== bookingId) {
        socket.emit("error", { message: "Not authorized" });
        return;
      }

      const roomId = `booking:${bookingId}`;
      console.log(`Broadcasting answer to room ${roomId}`);
      socket.to(roomId).emit("call-answer", {
        answer,
        from: socket.user.id,
        role: metadata.role,
        bookingId,
      });
    });

    // Handle ICE candidates
    socket.on("ice-candidate", async (data) => {
      const { candidate, bookingId } = data;
      const metadata = socketMetadata.get(socket.id);

      if (!metadata || metadata.bookingId !== bookingId) {
        return;
      }

      const roomId = `booking:${bookingId}`;
      socket.to(roomId).emit("ice-candidate", {
        candidate,
        from: socket.user.id,
        role: metadata.role,
        bookingId,
      });
    });

    // Handle call end
    socket.on("end-call", async (data) => {
      const { bookingId } = data;
      const metadata = socketMetadata.get(socket.id);

      if (metadata) {
        const roomId = `booking:${bookingId}`;
        socket.to(roomId).emit("call-ended", {
          from: socket.user.id,
          role: metadata.role,
        });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      const metadata = socketMetadata.get(socket.id);

      if (metadata) {
        const { roomId } = metadata;

        // Remove from room tracking
        if (activeRooms.has(roomId)) {
          activeRooms.get(roomId).delete(socket.id);

          if (activeRooms.get(roomId).size === 0) {
            activeRooms.delete(roomId);
          } else {
            // Notify others
            socket.to(roomId).emit("user-left", {
              userId: metadata.userId,
              role: metadata.role,
            });
          }
        }

        socketMetadata.delete(socket.id);
        console.log(`User ${metadata.userId} disconnected from room ${roomId}`);
      }
    });
  });

  return io;
}

