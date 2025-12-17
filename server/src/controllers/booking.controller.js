

import { StatusCodes } from "http-status-codes";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import TutorProfile from "../models/TutorProfile.js";
import AvailabilitySlot from "../models/AvailabilitySlot.js";
import Review from "../models/Review.js";
import { createBookingSchema } from "../validation/booking.schema.js";

export async function createBooking(req, res) {
  const payload = createBookingSchema.parse(req.body);

  // Determine roles
  let studentId, tutorId, status;

  if (req.user.role === "student") {
    studentId = req.user.id;
    tutorId = payload.tutorId;
    status = "pending";
  } else if (req.user.role === "tutor") {
    // Tutor creating an instant session
    studentId = req.body.studentId;
    if (!studentId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Student ID is required for tutor-initiated bookings" });
    }
    tutorId = req.user.id;
    status = "confirmed"; // Instant confirmation
  } else {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Only students or tutors can book sessions" });
  }

  const tutor = await User.findById(tutorId);
  if (!tutor || tutor.role !== "tutor") {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Tutor not found" });
  }

  const student = await User.findById(studentId);
  if (!student) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Student not found" });
  }

  // Calculate End Time
  const startTime = new Date(payload.startTime);
  const endTime = new Date(startTime.getTime() + payload.duration * 60000);

  // 1. Check for existing slot
  let slot = await AvailabilitySlot.findOne({
    tutorId: payload.tutorId,
    startUTC: startTime,
    durationMin: payload.duration
  });

  let slotId = null;

  if (slot) {
    // 2. ATOMIC RESERVATION
    const reservedSlot = await AvailabilitySlot.findOneAndUpdate(
      { _id: slot._id, isBooked: false },
      {
        isBooked: true,
        // bookingId will be set after booking creation (circular dependency handling or use 2-phase if needed)
        // ideally we generate bookingId first or use transaction. 
        // For simplicity without transactions: we mark it booked first.
      },
      { new: true }
    );

    if (!reservedSlot) {
      return res.status(StatusCodes.CONFLICT).json({ message: "This slot has already been booked." });
    }
    slotId = reservedSlot._id;
  } else {
    // 3. Ad-hoc Booking: Create a new booked slot
    // Check if any overlapping slot exists to be safe
    const clash = await AvailabilitySlot.findOne({
      tutorId: tutorId,
      $or: [
        { startUTC: { $lt: endTime }, endUTC: { $gt: startTime } }
      ],
      isBooked: true
    });

    if (clash) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Time overlap with another booking" });
    }

    const newSlot = await AvailabilitySlot.create({
      tutorId: tutorId,
      startUTC: startTime,
      endUTC: endTime,
      durationMin: payload.duration,
      isBooked: true,
      source: "adhoc"
    });
    slotId = newSlot._id;
  }

  try {
    const booking = await Booking.create({
      student: studentId,
      tutor: tutorId,
      subject: payload.subject,
      startTime: startTime,
      endTime: endTime,
      duration: payload.duration,
      price: Math.round((payload.duration / 60) * (tutor.hourlyRate || 0)),
      notes: payload.notes,
      status: status,
      slotId: slotId,
      meetingRoomId: status === "confirmed" ? `room-${Date.now()}` : undefined
    });

    // Update slot with booking ID
    await AvailabilitySlot.findByIdAndUpdate(slotId, { bookingId: booking._id });

    res.status(StatusCodes.CREATED).json({ booking });
  } catch (error) {
    // Rollback slot if booking failed
    if (slotId) {
      if (slot) { // if it was an existing slot, release it
        await AvailabilitySlot.findByIdAndUpdate(slotId, { isBooked: false });
      } else { // if ad-hoc, delete it
        await AvailabilitySlot.findByIdAndDelete(slotId);
      }
    }
    throw error;
  }
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
    // Explicitly include pending and confirmed.
    // We want to show ANY session that is not cancelled/completed/no-show, 
    // effectively showing all active workflows.
    query.status = { $in: ["pending", "confirmed"] };
  } else if (status === "completed") {
    query.status = "completed";
  } else if (status === "cancelled") {
    query.status = { $in: ["cancelled", "no-show"] }; // Include no-show in cancelled view for clarity
  } else if (status && status !== "all") {
    query.status = status;
  }

  try {
    const bookings = await Booking.find(query)
      .populate(role === "student" ? "tutor" : "student", "name email avatar")
      .sort({ startTime: status === "upcoming" ? 1 : -1 });

    console.log(`Found ${bookings.length} bookings for ${role} ${userId} with status ${status || "upcoming"}`);

    const sessions = bookings.map((booking) => ({
      id: booking._id.toString(),
      tutor: role === "student" ? booking.tutor?.name : undefined,
      tutorId: role === "student" ? booking.tutor?._id : undefined,
      student: role === "tutor" ? booking.student?.name : undefined,
      studentId: role === "tutor" ? booking.student?._id : undefined,
      subject: booking.subject,
      startTime: booking.startTime,
      duration: booking.duration,
      status: booking.status,
      price: booking.price,
      notes: booking.notes,
      feedback: booking.feedback,
      meetingRoomId: booking.meetingRoomId,
      avatar: role === "student" ? booking.tutor?.avatar : booking.student?.avatar,
    }));

    res.json({ sessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Failed to fetch sessions",
      error: error.message
    });
  }
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
    // Release slot if cancelled
    if (status === "cancelled" && booking.slotId) {
      await AvailabilitySlot.findByIdAndUpdate(booking.slotId, { isBooked: false, bookingId: null });
    }
  }
  if (startTime) {
    // Rescheduling is complex, for now we keep simple update but warn about slot sync
    // Ideally we should move slots
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

  // Update booking with feedback (Legacy field)
  booking.feedback = { rating, comment, submittedAt: new Date() };
  await booking.save();

  // Create Review (New Architecture)
  try {
    // Find or create Review
    // Need TutorProfile
    let tutorProfile = await TutorProfile.findOne({ userId: booking.tutor });
    if (!tutorProfile) {
      // If no profile, we can't create a review linked to it. 
      // (This happens if migration wasn't run). 
      // We can fallback to just updating User for now.
    } else {
      await Review.create({
        bookingId: booking._id,
        studentId: booking.student,
        tutorProfileId: tutorProfile._id,
        rating,
        text: comment
      });

      // Recalculate Rating for TutorProfile
      const stats = await Review.aggregate([
        { $match: { tutorProfileId: tutorProfile._id } },
        { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } }
      ]);

      if (stats.length > 0) {
        tutorProfile.rating = Math.round(stats[0].avgRating * 10) / 10;
        tutorProfile.totalReviews = stats[0].count;
        await tutorProfile.save();
      }
    }
  } catch (err) {
    console.error("Failed to create review record:", err);
  }

  // Update tutor's average rating (Legacy User Model)
  const tutor = await User.findById(booking.tutor);
  if (tutor) {
    const tutorBookings = await Booking.find({
      tutor: booking.tutor,
      "feedback.rating": { $exists: true }
    });
    const totalRating = tutorBookings.reduce((sum, b) => sum + (b.feedback?.rating || 0), 0);
    const avgRating = totalRating / tutorBookings.length; // careful div by zero if length 0
    tutor.rating = tutorBookings.length > 0 ? avgRating : 0;
    tutor.reviews = tutorBookings.length;
    if (tutor.stats) {
      tutor.stats.averageRating = tutor.rating;
    }
    await tutor.save();
  }

  res.json({ message: "Feedback submitted successfully", booking });
}

