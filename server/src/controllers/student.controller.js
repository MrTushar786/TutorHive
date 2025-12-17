import { StatusCodes } from "http-status-codes";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

const MAX_RECENT_ACTIVITY = 6;

function mapSession(booking) {
  return {
    id: booking._id,
    tutor: booking.tutor?.name,
    avatar: booking.tutor?.avatar,
    tutorId: booking.tutor?._id,
    subject: booking.subject,
    startTime: booking.startTime,
    duration: booking.duration,
    status: booking.status,
    hourlyRate: booking.tutor?.hourlyRate,
  };
}

export async function getDashboard(req, res) {
  const { studentId } = req.params;

  if (req.user.role !== "admin" && req.user.id !== studentId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const student = await User.findById(studentId);
  if (!student || student.role !== "student") {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Student not found" });
  }

  const bookings = await Booking.find({ student: studentId })
    .populate("tutor", "name subjects avatar hourlyRate expertise availability stats rating reviews")
    .sort({ startTime: 1 });

  const now = new Date();
  const upcomingSessions = bookings.filter((booking) => booking.startTime >= now).slice(0, 5).map(mapSession);

  const recentActivity = bookings
    .slice(-MAX_RECENT_ACTIVITY)
    .reverse()
    .map((booking) => ({
      id: booking._id,
      type: booking.status,
      message: `Session with ${booking.tutor?.name} for ${booking.subject}`,
      time: booking.updatedAt,
      icon: booking.status === "confirmed" ? "📅" : booking.status === "completed" ? "✅" : "⏳",
    }));

  const progressBySubject = bookings.reduce((acc, booking) => {
    // Normalize subject
    const subject = booking.subject || "General";
    acc[subject] = acc[subject] || { lessons: 0, completed: 0 };
    acc[subject].lessons += 1;
    if (booking.status === "completed") {
      acc[subject].completed += 1;
    }
    return acc;
  }, {});

  const progressData = Object.entries(progressBySubject)
    .map(([subject, data]) => ({
      subject,
      progress: Math.round((data.completed / data.lessons) * 100) || 0,
      lessons: data.lessons,
    }))
    .sort((a, b) => b.lessons - a.lessons); // Sort by most active subjects

  // Fetch tutors logic updated to use TutorProfile
  const tutorProfiles = await import("../models/TutorProfile.js").then(m => m.default.find().limit(12).sort({ rating: -1 }).populate("userId"));

  const tutorsResponse = tutorProfiles.map((tp) => {
    if (!tp.userId) return null;
    const u = tp.userId;
    return {
      id: u._id,
      name: u.name,
      subject: tp.subjects?.[0] ?? "General",
      rating: tp.rating,
      reviews: tp.totalReviews,
      hourlyRate: tp.hourlyRate,
      experience: tp.yearsOfExperience ? `${tp.yearsOfExperience}+ years` : "New",
      avatar: u.avatar ?? "👨‍🏫",
      expertise: tp.expertise,
      availability: tp.availabilityDisplay || "Flexible",
    };
  }).filter(t => t !== null);

  // Compute overall stats from bookings for dynamic progress
  const totalLessons = bookings.length;
  const completedLessons = bookings.filter((b) => b.status === "completed").length;
  const upcomingLessons = bookings.filter((b) => b.startTime >= now).length;
  const totalMinutes = bookings.reduce((sum, b) => sum + (b.duration || 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const studentResponse = {
    ...student.toObject(),
    stats: {
      completedLessons,
      upcomingLessons,
      totalHours,
      progressPercentage,
    },
  };

  res.json({
    student: studentResponse,
    upcomingSessions,
    recentActivity,
    progressData,
    availableTutors: tutorsResponse,
  });
}

