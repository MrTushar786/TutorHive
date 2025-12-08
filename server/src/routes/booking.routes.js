import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  createBooking,
  getStudentBookings,
  getTutorBookings,
  getMySessions,
  updateBookingStatus,
  generateMeetingRoom,
  submitFeedback,
} from "../controllers/booking.controller.js";

const router = Router();

router.post("/", authenticate, createBooking);
router.get("/student/:studentId", authenticate, getStudentBookings);
router.get("/tutor/:tutorId", authenticate, getTutorBookings);
router.get("/my-sessions", authenticate, getMySessions);
router.patch("/:bookingId/status", authenticate, updateBookingStatus);
router.post("/:bookingId/meeting-room", authenticate, generateMeetingRoom);
router.post("/:bookingId/feedback", authenticate, submitFeedback);

export default router;

