import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./StudentDashboard.css";
import useAuth from "../hooks/useAuth";
import { fetchStudentDashboard } from "../api/student";
import { createBooking, getMySessions, updateBookingStatus, generateMeetingRoom, submitFeedback } from "../api/booking";
import RescheduleDialog from "../components/RescheduleDialog";
import ProfileEdit from "../components/ProfileEdit";
import Messaging from "../components/Messaging";
import { getConversationId } from "../hooks/useConversationId";
import { getConversations } from "../api/messages";
import ErrorBoundary from "../utils/ErrorBoundary";

const DURATION_OPTIONS = [
  { label: "1 Hour", value: 60 },
  { label: "1.5 Hours", value: 90 },
  { label: "2 Hours", value: 120 },
];

const defaultStats = {
  completedLessons: 0,
  upcomingLessons: 0,
  totalHours: 0,
  progressPercentage: 0,
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const formatShortDay = (value) => new Date(value).toLocaleDateString("en-US", { day: "2-digit" });
const formatShortMonth = (value) => new Date(value).toLocaleDateString("en-US", { month: "short" });

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingForm, setBookingForm] = useState({
    date: "",
    time: "",
    duration: 60,
    notes: "",
  });
  const [bookingStatus, setBookingStatus] = useState("idle");
  const [bookingError, setBookingError] = useState("");
  const [sessionsFilter, setSessionsFilter] = useState("upcoming");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [rescheduleDialog, setRescheduleDialog] = useState(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const { user, token, logout } = useAuth();
  const [deletedConvIds, setDeletedConvIds] = useState(() => {
    try {
      const stored = localStorage.getItem("deletedConvIds");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("deletedConvIds", JSON.stringify(deletedConvIds));
  }, [deletedConvIds]);
  const [realConversations, setRealConversations] = useState([]);

  // Restore conversation if it reappears from backend (e.g. new message received)
  useEffect(() => {
    if (realConversations.length > 0 && deletedConvIds.length > 0) {
      const activeRealIds = new Set(realConversations.map(c => c.id));
      const newDeletedIds = deletedConvIds.filter(id => !activeRealIds.has(id));

      if (newDeletedIds.length !== deletedConvIds.length) {
        setDeletedConvIds(newDeletedIds);
      }
    }
  }, [realConversations, deletedConvIds]);

  const loadDashboard = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchStudentDashboard(user._id, token);
      setDashboardData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, user?._id]);

  useEffect(() => {
    loadDashboard();
    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (activeTab === "dashboard") {
        loadDashboard();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [loadDashboard, activeTab]);

  const loadSessions = useCallback(async () => {
    if (!user?._id || !token) return;
    setSessionsLoading(true);
    try {
      const response = await getMySessions(sessionsFilter, token);
      console.log("Sessions response:", response);
      // Backend returns { sessions: [...] } or just array?
      // Based on controller, it returns { sessions: [...] }
      const sessionsData = response?.sessions || response || [];
      console.log("Setting sessions state to:", sessionsData);
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (err) {
      console.error("Error loading sessions:", err);
      setError(err.message || "Failed to load sessions");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [user?._id, token, sessionsFilter]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (activeTab === "sessions") {
      loadSessions();
    }
  }, [activeTab, loadSessions]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getConversations(token);
      setRealConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "messages") {
      loadConversations();
      const interval = setInterval(loadConversations, 5000); // Poll every 5s for new chats
      return () => clearInterval(interval);
    }
  }, [activeTab, loadConversations]);

  const studentProfile = dashboardData?.student;
  // Build dynamic progress data and robust overall progress for the circular bar
  const progressData = useMemo(() => dashboardData?.progressData || [], [dashboardData]);

  const overallProgressFromSubjects = useMemo(() => {
    const totals = progressData.reduce(
      (acc, item) => {
        const lessons = Number(item.lessons) || 0;
        const progress = Number(item.progress) || 0;
        acc.lessons += lessons;
        acc.weighted += lessons * progress;
        return acc;
      },
      { lessons: 0, weighted: 0 }
    );
    return totals.lessons > 0 ? Math.round(totals.weighted / totals.lessons) : 0;
  }, [progressData]);

  const stats = useMemo(() => {
    const base = studentProfile?.stats || defaultStats;
    const progressPercentage =
      base.progressPercentage !== undefined && base.progressPercentage !== null
        ? base.progressPercentage
        : overallProgressFromSubjects;
    return { ...base, progressPercentage };
  }, [studentProfile, overallProgressFromSubjects]);

  const upcomingSessions = useMemo(() => dashboardData?.upcomingSessions || [], [dashboardData]);
  const availableTutors = useMemo(() => dashboardData?.availableTutors || [], [dashboardData]);
  const recentActivity = useMemo(() => dashboardData?.recentActivity || [], [dashboardData]);

  const subjects = useMemo(() => {
    const unique = new Set(availableTutors.map((tutor) => (tutor.subject || "general").toLowerCase()));
    return ["all", ...unique];
  }, [availableTutors]);

  const filteredTutors = useMemo(() => {
    return availableTutors.filter((tutor) => {
      const matchesSearch =
        tutor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tutor.subject || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject =
        selectedSubject === "all" || (tutor.subject || "").toLowerCase() === selectedSubject;
      return matchesSearch && matchesSubject;
    });
  }, [availableTutors, searchQuery, selectedSubject]);

  const openBookingModal = (tutor) => {
    setSelectedTutor(tutor);
    setBookingModal(true);
    setBookingError("");
  };

  const closeBookingModal = () => {
    setBookingModal(false);
    setSelectedTutor(null);
    setBookingForm({
      date: "",
      time: "",
      duration: 60,
      notes: "",
    });
    setBookingError("");
  };

  const handleBookingChange = (e) => {
    setBookingForm({
      ...bookingForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleBooking = async () => {
    if (!selectedTutor) return;
    if (!bookingForm.date || !bookingForm.time) {
      setBookingError("Please select a date and time");
      return;
    }
    setBookingStatus("loading");
    setBookingError("");
    try {
      const startTime = new Date(`${bookingForm.date}T${bookingForm.time}`);
      await createBooking(
        {
          tutorId: selectedTutor.id,
          subject: selectedTutor.subject,
          startTime: startTime.toISOString(),
          duration: Number(bookingForm.duration),
          notes: bookingForm.notes,
        },
        token
      );
      await loadDashboard();
      closeBookingModal();
    } catch (err) {
      setBookingError(err.message);
    } finally {
      setBookingStatus("idle");
    }
  };

  const handleJoinSession = async (session) => {
    try {
      // Navigate to video call page with booking ID
      window.location.href = `/video-call/${session.id}`;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReschedule = (session) => {
    setRescheduleDialog(session);
  };

  const handleRescheduleConfirm = async (newStartTime) => {
    if (!rescheduleDialog) return;

    try {
      await updateBookingStatus(rescheduleDialog.id, "pending", token, { startTime: newStartTime });
      await loadSessions();
      await loadDashboard();
      setRescheduleDialog(null);
    } catch (err) {
      setError(err.message);
      setRescheduleDialog(null);
    }
  };

  const handleRescheduleCancel = () => {
    setRescheduleDialog(null);
  };

  const handleCancelSession = async (session) => {
    if (!window.confirm("Are you sure you want to cancel this session?")) {
      return;
    }
    try {
      await updateBookingStatus(session.id, "cancelled", token);
      await loadSessions();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };


  const handleFeedbackSubmit = async (feedback) => {
    try {
      await submitFeedback(feedback.sessionId, feedback, token);
      await loadSessions();
      await loadDashboard();
    } catch (err) {
      console.error("Error submitting feedback:", err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="state-message">
        <div className="spinner" />
        <p>Loading your personalized TutorHive data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-message error">
        <p>{error}</p>
        <button className="btn-primary" onClick={loadDashboard} type="button">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <span className="logo-icon">🐝</span>
            <span className="logo-text">TutorHive</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {["dashboard", "find-tutors", "sessions", "progress", "messages", "settings"].map((tab) => (
            <button
              key={tab}
              className={`nav-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav-icon">
                {tab === "dashboard" && "📊"}
                {tab === "find-tutors" && "🔍"}
                {tab === "sessions" && "📅"}
                {tab === "progress" && "📈"}
                {tab === "messages" && "💬"}
                {tab === "settings" && "⚙️"}
              </span>
              <span>{tab.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {studentProfile?.avatar?.startsWith("data:") || studentProfile?.avatar?.startsWith("http") ? (
                <img src={studentProfile.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                studentProfile?.avatar || "👨‍🎓"
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{studentProfile?.name}</div>
              <div className="user-email">{studentProfile?.email}</div>
            </div>
          </div>
          <button
            className="profile-btn"
            onClick={() => {
              setActiveTab("settings");
              setShowProfileEdit(true);
            }}
            type="button"
            title="Edit Profile"
          >
            <span>✏️</span>
            <span>Edit Profile</span>
          </button>
          <button className="logout-btn" onClick={logout} type="button">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === "dashboard" && (
          <div className="dashboard-content">
            <div className="page-header">
              <h1>Welcome back, {studentProfile?.name?.split(" ")[0]}! 👋</h1>
              <p>Here's what's happening with your learning journey today</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card orange">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedLessons}</div>
                  <div className="stat-label">Completed Lessons</div>
                </div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon">📅</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.upcomingLessons}</div>
                  <div className="stat-label">Upcoming Sessions</div>
                </div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon">⏱️</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalHours}</div>
                  <div className="stat-label">Total Hours</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon">🎯</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.progressPercentage}%</div>
                  <div className="stat-label">Overall Progress</div>
                </div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Upcoming Sessions</h3>
                  <button
                    className="view-all-btn"
                    type="button"
                    onClick={() => setActiveTab("sessions")}
                  >
                    View All →
                  </button>
                </div>
                <div className="sessions-list">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-avatar">
                        {session.avatar?.startsWith("data:") || session.avatar?.startsWith("http") ? (
                          <img src={session.avatar} alt="Tutor" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          session.avatar || "👩‍🏫"
                        )}
                      </div>
                      <div className="session-details">
                        <div className="session-tutor">{session.tutor}</div>
                        <div className="session-subject">{session.subject}</div>
                      </div>
                      <div className="session-time">
                        <div className="session-date">{formatDate(session.startTime)}</div>
                        <div className="session-hour">{formatTime(session.startTime)}</div>
                      </div>
                      <span className={`session-status ${session.status}`}>{session.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Recent Activity</h3>
                </div>
                <div className="activity-list">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-icon">{activity.icon}</div>
                      <div className="activity-details">
                        <div className="activity-message">{activity.message}</div>
                        <div className="activity-time">{formatDate(activity.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "find-tutors" && (
          <div className="find-tutors-content">
            <div className="page-header">
              <h1>Find Your Perfect Tutor</h1>
              <p>Browse through our expert tutors and book your next session</p>
            </div>

            <div className="search-filter-bar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by tutor name or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-chips">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    className={`filter-chip ${selectedSubject === subject ? "active" : ""}`}
                    onClick={() => setSelectedSubject(subject)}
                  >
                    {subject === "all" ? "All" : subject.replace(/\b\w/g, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div className="tutors-grid">
              {filteredTutors.map((tutor) => (
                <div key={tutor.id} className="tutor-card">
                  <div className="tutor-card-header">
                    <div className="tutor-avatar-large">
                      {tutor.avatar?.startsWith("data:") || tutor.avatar?.startsWith("http") ? (
                        <img src={tutor.avatar} alt={tutor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        tutor.avatar || "👩‍🏫"
                      )}
                    </div>
                    <div className="tutor-rating">
                      <span className="star">⭐</span>
                      <span className="rating-value">{tutor.rating}</span>
                      <span className="rating-count">({tutor.reviews})</span>
                    </div>
                  </div>
                  <div className="tutor-card-body">
                    <h3 className="tutor-name">{tutor.name}</h3>
                    <div className="tutor-subject">{tutor.subject}</div>
                    <div className="tutor-experience">
                      <span className="icon">🎓</span>
                      <span>{tutor.experience}</span>
                    </div>
                    <div className="tutor-expertise">
                      {(tutor.expertise || []).map((skill) => (
                        <span key={skill} className="expertise-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="tutor-availability">
                      <span className="icon">📅</span>
                      <span>{tutor.availability}</span>
                    </div>
                  </div>
                  <div className="tutor-card-footer">
                    <div className="tutor-price">
                      <span className="price-amount">${tutor.hourlyRate || 0}</span>
                      <span className="price-unit">/hour</span>
                    </div>
                    <button className="book-btn" onClick={() => openBookingModal(tutor)}>
                      Book Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="sessions-content">
            <div className="page-header">
              <h1>My Sessions</h1>
              <p>Manage your upcoming and past tutoring sessions</p>
            </div>

            <div className="sessions-tabs">
              <button
                className={`sessions-tab-btn ${sessionsFilter === "upcoming" ? "active" : ""}`}
                onClick={() => setSessionsFilter("upcoming")}
                type="button"
              >
                Upcoming
              </button>
              <button
                className={`sessions-tab-btn ${sessionsFilter === "completed" ? "active" : ""}`}
                onClick={() => setSessionsFilter("completed")}
                type="button"
              >
                Completed
              </button>
              <button
                className={`sessions-tab-btn ${sessionsFilter === "cancelled" ? "active" : ""}`}
                onClick={() => setSessionsFilter("cancelled")}
                type="button"
              >
                Cancelled
              </button>
            </div>

            {sessionsLoading ? (
              <div className="state-message">
                <div className="spinner" />
                <p>Loading sessions...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="state-message">
                <p>No {sessionsFilter} sessions found.</p>
              </div>
            ) : (
              <div className="sessions-list-detailed">
                {sessions.map((session) => (
                  <div key={session.id} className="session-card-detailed">
                    <div className="session-card-left">
                      <div className="session-date-box">
                        <div className="date-day">{formatShortDay(session.startTime)}</div>
                        <div className="date-month">{formatShortMonth(session.startTime)}</div>
                      </div>
                    </div>
                    <div className="session-card-middle">
                      <div className="session-main-info">
                        <h3>{session.subject}</h3>
                        <div className="session-tutor-info">
                          <span className="tutor-avatar-small">
                            {session.avatar?.startsWith("data:") || session.avatar?.startsWith("http") ? (
                              <img src={session.avatar} alt="Tutor" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                              session.avatar || "👩‍🏫"
                            )}
                          </span>
                          <span>{session.tutor}</span>
                        </div>
                      </div>
                      <div className="session-meta">
                        <div className="meta-item">
                          <span className="meta-icon">⏰</span>
                          <span>{formatTime(session.startTime)}</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-icon">⏱️</span>
                          <span>{session.duration} minutes</span>
                        </div>
                        <div className="meta-item">
                          <span className="meta-icon">💰</span>
                          <span>${session.price}</span>
                        </div>
                      </div>
                      {session.feedback && (
                        <div className="session-feedback" style={{ marginTop: '1rem', padding: '0.5rem', background: '#f5f5f5', borderRadius: '8px' }}>
                          <div className="feedback-rating" style={{ color: '#FFD700' }}>{"⭐".repeat(session.feedback.rating)}</div>
                          {session.feedback.comment && (
                            <div className="feedback-comment" style={{ fontStyle: 'italic', fontSize: '0.9rem', color: '#666' }}>
                              "{session.feedback.comment}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="session-card-right">
                      <span className={`status-badge ${session.status}`}>{session.status}</span>
                      <div className="session-actions">
                        {sessionsFilter === "upcoming" && (session.status === "confirmed" || session.status === "pending") && (
                          <button
                            className="action-btn primary"
                            onClick={() => handleJoinSession(session)}
                            type="button"
                            disabled={session.status === "pending"}
                            title={session.status === "pending" ? "Waiting for tutor confirmation" : "Join Session"}
                          >
                            {session.status === "pending" ? "Pending Confirmation" : "Join Session"}
                          </button>
                        )}
                        {sessionsFilter === "upcoming" && session.status !== "cancelled" && (
                          <>
                            <button
                              className="action-btn secondary"
                              onClick={() => handleReschedule(session)}
                              type="button"
                            >
                              Reschedule
                            </button>
                            <button
                              className="action-btn danger"
                              onClick={() => handleCancelSession(session)}
                              type="button"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "progress" && (
          <div className="progress-content">
            <div className="page-header">
              <h1>Learning Progress</h1>
              <p>Track your improvement across different subjects</p>
            </div>

            <div className="progress-overview">
              <div className="overall-progress-card">
                <h3>Overall Progress</h3>
                <div className="circular-progress">
                  <svg width="200" height="200">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="#f0f0f0" strokeWidth="20" />
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="20"
                      strokeDasharray={`${stats.progressPercentage * 5.024} 502.4`}
                      strokeLinecap="round"
                      transform="rotate(-90 100 100)"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#FF6B35" />
                        <stop offset="100%" stopColor="#9C27B0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="progress-percentage">{stats.progressPercentage}%</div>
                </div>
                <div className="progress-stats-mini">
                  <div className="mini-stat">
                    <div className="mini-stat-value">{stats.completedLessons}</div>
                    <div className="mini-stat-label">Lessons</div>
                  </div>
                  <div className="mini-stat">
                    <div className="mini-stat-value">{stats.totalHours}h</div>
                    <div className="mini-stat-label">Hours</div>
                  </div>
                </div>
              </div>

              <div className="achievements-card">
                <h3>Recent Achievements</h3>
                <div className="achievements-grid">
                  <div className="achievement-badge">
                    <div className="badge-icon">🏆</div>
                    <div className="badge-name">25 Lessons</div>
                  </div>
                  <div className="achievement-badge">
                    <div className="badge-icon">⭐</div>
                    <div className="badge-name">Top Student</div>
                  </div>
                  <div className="achievement-badge">
                    <div className="badge-icon">🔥</div>
                    <div className="badge-name">7 Day Streak</div>
                  </div>
                  <div className="achievement-badge locked">
                    <div className="badge-icon">🎯</div>
                    <div className="badge-name">50 Lessons</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="subject-progress-list">
              <h3>Progress by Subject</h3>
              {progressData.map((item) => (
                <div key={item.subject} className="subject-progress-item">
                  <div className="subject-progress-header">
                    <div className="subject-name">{item.subject}</div>
                    <div className="subject-stats">
                      <span>{item.lessons} lessons</span>
                      <span className="progress-percent">{item.progress}%</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="messages-content">
            <div className="page-header">
              <h1>Messages</h1>
              <p>Chat with your tutors</p>
            </div>
            <ErrorBoundary>
              <Messaging
                currentUser={user}
                token={token}
                conversations={(() => {
                  const activeIds = new Set(realConversations.map((c) => c.id));
                  const potentialConversations = availableTutors
                    .map((tutor) => {
                      const otherId = tutor.id || tutor._id;
                      const convId = getConversationId(user?._id, otherId);
                      if (!convId) return null;
                      if (activeIds.has(convId)) return null;
                      if (deletedConvIds.includes(convId)) return null;
                      return {
                        id: convId,
                        name: tutor.name,
                        avatar: tutor.avatar,
                        lastMessage: "Click to start conversation",
                        messages: [],
                        unreadCount: 0,
                        isPotential: true,
                      };
                    })
                    .filter(Boolean);

                  return [...realConversations, ...potentialConversations].filter(c => !deletedConvIds.includes(c.id));
                })()}
                onSendMessage={(conversationId, message) => {
                  console.log("Sending message:", conversationId, message);
                }}
                onDeleteConversation={async (convId) => {
                  // Always hide locally first (persistent)
                  setDeletedConvIds((prev) => (prev.includes(convId) ? prev : [...prev, convId]));
                  // If it's a real conversation, tell backend
                  try {
                    await import("../api/messages").then(m => m.deleteChat(convId, token));
                    setRealConversations(prev => prev.filter(c => c.id !== convId));
                  } catch (e) {
                    // Ignore 404s or errors for potential convs
                  }
                }}
                onMarkAsRead={async (convId) => {
                  // Optimistically update local state
                  setRealConversations(prev => prev.map(c =>
                    c.id === convId ? { ...c, unreadCount: 0 } : c
                  ));
                  // Call backend
                  try {
                    await import("../api/messages").then(m => m.markAsRead(convId, token));
                  } catch (e) {
                    console.error("Failed to mark as read", e);
                  }
                }}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="settings-content">
            <div className="page-header">
              <h1>Settings</h1>
              <p>Manage your account preferences</p>
            </div>
            {showProfileEdit ? (
              <ProfileEdit
                user={studentProfile || user}
                token={token}
                onSave={() => {
                  setShowProfileEdit(false);
                  loadDashboard();
                }}
                onCancel={() => setShowProfileEdit(false)}
              />
            ) : (
              <div className="settings-sections">
                <div className="settings-section">
                  <h3>Profile Settings</h3>
                  <p>Update your profile information and preferences.</p>
                  <button className="btn-primary" onClick={() => setShowProfileEdit(true)}>
                    Edit Profile
                  </button>
                </div>
                <div className="settings-section">
                  <h3>Account Settings</h3>
                  <p>Manage your account preferences and security.</p>
                  <button className="btn-secondary" disabled>
                    Coming Soon
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {bookingModal && selectedTutor && (
        <div className="modal-overlay" onClick={closeBookingModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeBookingModal} type="button">
              ×
            </button>
            <div className="modal-header">
              <div className="modal-tutor-avatar">
                {selectedTutor.avatar?.startsWith("data:") || selectedTutor.avatar?.startsWith("http") ? (
                  <img src={selectedTutor.avatar} alt={selectedTutor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  selectedTutor.avatar || "👩‍🏫"
                )}
              </div>
              <div>
                <h2>Book Session with {selectedTutor.name}</h2>
                <p className="modal-subject">{selectedTutor.subject}</p>
              </div>
            </div>
            <div className="modal-body">
              <div className="booking-form">
                <div className="form-group">
                  <label htmlFor="booking-date">Select Date</label>
                  <input
                    id="booking-date"
                    type="date"
                    name="date"
                    className="form-input"
                    value={bookingForm.date}
                    onChange={handleBookingChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="booking-time">Select Time</label>
                  <input
                    id="booking-time"
                    type="time"
                    name="time"
                    className="form-input"
                    value={bookingForm.time}
                    onChange={handleBookingChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="booking-duration">Session Duration</label>
                  <select
                    id="booking-duration"
                    name="duration"
                    className="form-input"
                    value={bookingForm.duration}
                    onChange={handleBookingChange}
                  >
                    {DURATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - ${Math.round(((selectedTutor.hourlyRate || 0) / 60) * option.value)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="booking-notes">Additional Notes (Optional)</label>
                  <textarea
                    id="booking-notes"
                    name="notes"
                    className="form-input"
                    rows="3"
                    placeholder="Any specific topics you'd like to cover?"
                    value={bookingForm.notes}
                    onChange={handleBookingChange}
                  />
                </div>
                {bookingError && <p className="form-error">{bookingError}</p>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={closeBookingModal} type="button">
                Cancel
              </button>
              <button
                className="modal-btn primary"
                onClick={handleBooking}
                disabled={bookingStatus === "loading"}
                type="button"
              >
                {bookingStatus === "loading" ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        </div>
      )}


      {rescheduleDialog && (
        <RescheduleDialog
          session={rescheduleDialog}
          onConfirm={handleRescheduleConfirm}
          onCancel={handleRescheduleCancel}
        />
      )}
    </div>
  );
}