import { StatusCodes } from "http-status-codes";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import TutorProfile from "../models/TutorProfile.js";
import Review from "../models/Review.js";

function mapTutorSession(booking) {
  return {
    id: booking._id,
    student: booking.student?.name,
    avatar: booking.student?.avatar,
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

  // Get Profile
  const tutorProfile = await TutorProfile.findOne({ userId: tutorId }) || {};

  const bookings = await Booking.find({ tutor: tutorId })
    .populate("student", "name avatar stats")
    .sort({ startTime: 1 });

  const now = new Date();
  const upcomingSessions = bookings.filter((booking) => booking.startTime >= now).slice(0, 5).map(mapTutorSession);

  const studentsMap = new Map();
  bookings.forEach((booking) => {
    if (booking.student) {
      // SELF-HEARLING: If booking has 0 price but is completed/confirmed, and tutor has a rate, update it.
      // This fixes legacy data or data created before rate was set.
      if ((booking.price === 0 || !booking.price) && (booking.status === 'completed' || booking.status === 'confirmed') && tutorProfile.hourlyRate > 0) {
        const newPrice = Math.round((booking.duration / 60) * tutorProfile.hourlyRate);
        if (newPrice > 0) {
          booking.price = newPrice;
          // We can't await inside forEach easily, but we can fire-and-forget update or do it in bulk before this loop.
          // For display purposes, we update the object instance 'booking'. 
          // Ideally we should also save to DB.
          Booking.updateOne({ _id: booking._id }, { price: newPrice }).exec();
        }
      }

      const current = studentsMap.get(booking.student._id?.toString()) ?? {
        ...booking.student.toJSON(),
        id: booking.student._id,
        sessions: 0,
        totalEarnings: 0,
        totalHours: 0,
        progress: Math.round(Math.random() * 30 + 60),
        lastSession: booking.startTime,
      };

      current.sessions += 1;
      // Update lastSession to the latest one encountered
      if (new Date(booking.startTime) > new Date(current.lastSession)) {
        current.lastSession = booking.startTime;
      }

      if (booking.status === 'completed') {
        current.totalEarnings += (booking.price || 0);
        current.totalHours += (booking.duration || 0) / 60;
      }

      studentsMap.set(booking.student._id.toString(), current);
    }
  });

  // Calculate real-time stats
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const totalStudents = studentsMap.size;
  const completedSessions = completedBookings.length;

  // Get ratings from Reviews specifically (fallback to profile aggregate)
  let averageRating = tutorProfile.rating || 0;
  if (!tutorProfile.rating) {
    // Use reviews directly if aggregate missing
    const bookingsWithFeedback = completedBookings.filter((b) => b.feedback?.rating);
    if (bookingsWithFeedback.length > 0) {
      averageRating = bookingsWithFeedback.reduce((sum, b) => sum + (b.feedback.rating || 0), 0) / bookingsWithFeedback.length;
    }
  }

  // FORCE Update stats object for response
  const realTimeStats = {
    totalStudents,
    completedLessons: completedSessions,
    totalEarnings,
    averageRating: Math.round(averageRating * 10) / 10
  };

  // Check if we need to sync stats back to Profile
  // (We do this to keep Profile denormalized stats fresh)
  if (tutorProfile) {
    if (!tutorProfile.stats) tutorProfile.stats = {};
    tutorProfile.stats.totalStudents = totalStudents;
    tutorProfile.stats.completedLessons = completedSessions;
    tutorProfile.stats.totalEarnings = totalEarnings;
    // Save occasionally or always to keep DB in sync? Let's save to be safe.
    await tutorProfile.save();
  }

  // Detailed Earnings History (Individual Sessions)
  const detailedEarnings = completedBookings.map(booking => ({
    id: booking._id,
    date: booking.startTime,
    student: booking.student?.name || "Student",
    duration: booking.duration,
    amount: booking.price || 0,
    status: "Paid"
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const recentActivity = bookings.slice(-6).reverse().map((booking) => ({
    id: booking._id,
    type: booking.status,
    message: `${booking.status === "completed" ? "Completed" : "Upcoming"} session with ${booking.student?.name}`,
    time: booking.updatedAt,
    icon: booking.status === "completed" ? "✅" : "📅",
  }));

  // Merge Generic User data with Profile data
  const mergedTutor = {
    ...tutor.toJSON(),
    ...tutorProfile.toJSON(),
    stats: realTimeStats, // Override with real-time calcs
    _id: tutor._id // prioritize user ID
  };

  res.json({
    tutor: mergedTutor,
    upcomingSessions,
    myStudents: Array.from(studentsMap.values()),
    earningsHistory: detailedEarnings,
    recentActivity,
  });
}

export async function listTutors(_req, res) {
  // Query TutorProfiles directly for efficient listing
  // Sort by rating desc
  const profiles = await TutorProfile.find().sort({ rating: -1 }).populate("userId", "name avatar");

  const tutors = profiles.map(profile => {
    // If user deleted but profile exists, skip?
    if (!profile.userId) return null;
    const user = profile.userId; // populated
    return {
      id: user._id, // Client expects Tutor ID to be User ID for now
      name: user.name,
      avatar: user.avatar,
      subjects: profile.subjects,
      hourlyRate: profile.hourlyRate,
      rating: profile.rating,
      reviews: profile.totalReviews,
      expertise: profile.expertise,
      headline: profile.headline,
      city: profile.city,
      experience: profile.yearsOfExperience ? `${profile.yearsOfExperience}+ years` : "New",
      availability: profile.availabilityDisplay || "Flexible"
    };
  }).filter(t => t !== null);

  res.json({ tutors });
}

