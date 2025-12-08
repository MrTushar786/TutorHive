import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import studentRoutes from "./routes/student.routes.js";
import tutorRoutes from "./routes/tutor.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import messageRoutes from "./routes/message.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { requestId } from "./middleware/requestId.js";

const app = express();

app.use(requestId);
const allowedOrigins = process.env.CLIENT_URL?.split(",").map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins?.length ? allowedOrigins : "*",
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV ?? "development" });
});

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/tutors", tutorRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/messages", messageRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

