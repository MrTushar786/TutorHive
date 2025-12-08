import { StatusCodes } from "http-status-codes";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { createBookingSchema } from "../validation/booking.schema.js";

export async function createBooking(req, res) {
  const payload = createBookingSchema.parse(req.body);

  if (req.user.role !== "student") {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Only students can book sessions" });
  }

  const tutor = await User.findById(payload.tutorId);
  if (!tutor || tutor.role !== "tutor") {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Tutor not found" });
  }

  const booking = await Booking.create({
    tutor: payload.tutorId,
    student: req.user.id,
    subject: payload.subject,
    startTime: payload.startTime,
    duration: payload.duration,
    price: Math.round((payload.duration / 60) * tutor.hourlyRate),
    notes: payload.notes,
    status: "pending",
  });

  res.status(StatusCodes.CREATED).json({ booking });
}

export async function getStudentBookings(req, res) {
  const { studentId } = req.params;

  if (req.user.role !== "admin" && req.user.id !== studentId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const bookings = await Booking.find({ student: studentId })
    .populate("tutor", "name subjects hourlyRate")
    .sort({ startTime: -1 });

  res.json({ bookings });
}

export async function getTutorBookings(req, res) {
  const { tutorId } = req.params;

  if (req.user.role !== "admin" && req.user.id !== tutorId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const bookings = await Booking.find({ tutor: tutorId })
    .populate("student", "name email")
    .sort({ startTime: -1 });

  res.json({ bookings });
}

export async function getMySessions(req, res) {
  const { status } = req.query;
  const userId = req.user.id;
  const role = req.user.role;

  let query = {};
  if (role === "student") {
    query.student = userId;
  } else if (role === "tutor") {
    query.tutor = userId;
  } else {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Invalid role" });
  }

  const now = new Date();
  if (status === "upcoming" || !status) {
    // For upcoming, show future sessions that are not cancelled
    query.startTime = { $gte: now };
    query.status = { $ne: "cancelled" };
  } else if (status === "completed") {
    query.status = "completed";
  } else if (status === "cancelled") {
    query.status = "cancelled";
  } else if (status && status !== "all") {
    query.status = status;
  }

  const bookings = await Booking.find(query)
    .populate(role === "student" ? "tutor" : "student", "name email avatar")
    .sort({ startTime: status === "upcoming" ? 1 : -1 });

  const sessions = bookings.map((booking) => ({
    id: booking._id.toString(),
    tutor: role === "student" ? booking.tutor?.name : undefined,
    student: role === "tutor" ? booking.student?.name : undefined,
    subject: booking.subject,
    startTime: booking.startTime,
    duration: booking.duration,
    status: booking.status,
    price: booking.price,
    notes: booking.notes,
    meetingRoomId: booking.meetingRoomId,
    avatar: role === "student" ? booking.tutor?.avatar : booking.student?.avatar,
  }));

  res.json({ sessions });
}

export async function updateBookingStatus(req, res) {
  const { bookingId } = req.params;
  const { status, startTime } = req.body;

  if (status && !["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid status" });
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Booking not found" });
  }

  // Check authorization
  if (req.user.role !== "admin" && booking.student.toString() !== req.user.id && booking.tutor.toString() !== req.user.id) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  if (status) {
    booking.status = status;
  }
  if (startTime) {
    const newStartTime = new Date(startTime);
    if (newStartTime <= new Date()) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Start time must be in the future" });
    }
    booking.startTime = newStartTime;
    // When rescheduling, set status back to pending for tutor approval
    if (status !== "cancelled") {
      booking.status = "pending";
    }
  }
  await booking.save();

  res.json({ booking });
}

export async function generateMeetingRoom(req, res) {
  const { bookingId } = req.params;

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Booking not found" });
  }

  // Check authorization
  if (req.user.role !== "admin" && booking.student.toString() !== req.user.id && booking.tutor.toString() !== req.user.id) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  // Generate a unique room ID if not exists
  if (!booking.meetingRoomId) {
    booking.meetingRoomId = `room-${booking._id.toString()}-${Date.now()}`;
    await booking.save();
  }

  res.json({ meetingRoomId: booking.meetingRoomId, booking });
}

export async function submitFeedback(req, res) {
  const { bookingId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Rating must be between 1 and 5" });
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Booking not found" });
  }

  // Check authorization - only student can submit feedback
  if (req.user.role !== "student" || booking.student.toString() !== req.user.id) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Only students can submit feedback" });
  }

  // Update booking with feedback
  booking.feedback = { rating, comment, submittedAt: new Date() };
  await booking.save();

  // Update tutor's average rating
  const tutor = await User.findById(booking.tutor);
  if (tutor) {
    const tutorBookings = await Booking.find({ 
      tutor: booking.tutor, 
      "feedback.rating": { $exists: true } 
    });
    const totalRating = tutorBookings.reduce((sum, b) => sum + (b.feedback?.rating || 0), 0);
    const avgRating = totalRating / tutorBookings.length;
    tutor.rating = avgRating;
    tutor.reviews = tutorBookings.length;
    if (tutor.stats) {
      tutor.stats.averageRating = avgRating;
    }
    await tutor.save();
  }

  res.json({ message: "Feedback submitted successfully", booking });
}

