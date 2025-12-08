import { StatusCodes } from "http-status-codes";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

function mapTutorSession(booking) {
  return {
    id: booking._id,
    student: booking.student?.name,
    studentId: booking.student?._id,
    subject: booking.subject,
    startTime: booking.startTime,
    duration: booking.duration,
    status: booking.status,
  };
}

export async function getDashboard(req, res) {
  const { tutorId } = req.params;

  if (req.user.role !== "admin" && req.user.id !== tutorId) {
    return res.status(StatusCodes.FORBIDDEN).json({ message: "Not authorized" });
  }

  const tutor = await User.findById(tutorId);
  if (!tutor || tutor.role !== "tutor") {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Tutor not found" });
  }

  const bookings = await Booking.find({ tutor: tutorId })
    .populate("student", "name avatar stats")
    .sort({ startTime: 1 });

  const now = new Date();
  const upcomingSessions = bookings.filter((booking) => booking.startTime >= now).slice(0, 5).map(mapTutorSession);

  const studentsMap = new Map();
  bookings.forEach((booking) => {
    if (booking.student) {
      const current = studentsMap.get(booking.student._id?.toString()) ?? {
        ...booking.student.toJSON(),
        sessions: 0,
        progress: Math.round(Math.random() * 30 + 60),
        lastSession: booking.startTime,
      };
      current.sessions += 1;
      current.lastSession = booking.startTime;
      studentsMap.set(booking.student._id.toString(), current);
    }
  });

  // Calculate real-time stats
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const totalStudents = studentsMap.size;
  const completedSessions = completedBookings.length;
  
  // Calculate average rating from feedback
  const bookingsWithFeedback = completedBookings.filter((b) => b.feedback?.rating);
  const averageRating = bookingsWithFeedback.length > 0
    ? bookingsWithFeedback.reduce((sum, b) => sum + (b.feedback.rating || 0), 0) / bookingsWithFeedback.length
    : tutor.rating || 0;

  // Update tutor stats
  if (!tutor.stats) {
    tutor.stats = {};
  }
  tutor.stats.totalStudents = totalStudents;
  tutor.stats.completedSessions = completedSessions;
  tutor.stats.totalEarnings = totalEarnings;
  tutor.stats.averageRating = averageRating;
  await tutor.save();

  const earningsByMonth = completedBookings.reduce((acc, booking) => {
    const monthKey = booking.startTime.toLocaleString("default", { month: "short", year: "numeric" });
    acc[monthKey] = acc[monthKey] || { sessions: 0, earnings: 0 };
    acc[monthKey].sessions += 1;
    acc[monthKey].earnings += booking.price || 0;
    return acc;
  }, {});

  const recentActivity = bookings.slice(-6).reverse().map((booking) => ({
    id: booking._id,
    type: booking.status,
    message: `${booking.status === "completed" ? "Completed" : "Upcoming"} session with ${booking.student?.name}`,
    time: booking.updatedAt,
    icon: booking.status === "completed" ? "✅" : "📅",
  }));

  res.json({
    tutor,
    upcomingSessions,
    myStudents: Array.from(studentsMap.values()),
    earningsHistory: Object.entries(earningsByMonth)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 12)
      .map(([month, data]) => ({
        month,
        ...data,
      })),
    recentActivity,
  });
}

export async function listTutors(_req, res) {
  const tutors = await User.find({ role: "tutor" }).sort({ "stats.averageRating": -1 });
  res.json({
    tutors: tutors.map((tutor) => ({
      id: tutor._id,
      name: tutor.name,
      subjects: tutor.subjects,
      hourlyRate: tutor.hourlyRate,
      rating: tutor.rating,
      reviews: tutor.reviews,
      expertise: tutor.expertise,
      availability: tutor.availability,
    })),
  });
}

