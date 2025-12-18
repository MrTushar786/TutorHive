import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Search,
  Calendar,
  TrendingUp,
  MessageSquare,
  Settings,
  UserPen,
  LogOut,
  User,
  BookOpen,
  X,
  Video,
  Clock,
  Hourglass,
  DollarSign,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  ArrowLeft,
  GraduationCap,
  Target,
  CheckCircle,
  XCircle,
  Trophy,
  Flame
} from "lucide-react";
import "./StudentDashboard.css";
import useAuth from "../hooks/useAuth";
import { fetchStudentDashboard } from "../api/student";
import { createBooking, getMySessions, updateBookingStatus, generateMeetingRoom, submitFeedback } from "../api/booking";
import RescheduleDialog from "../components/RescheduleDialog";
import ProfileEdit from "../components/ProfileEdit";
import Messaging from "../components/Messaging";
import { getConversationId } from "../hooks/useConversationId";
import { getConversations, initiateChat } from "../api/messages";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const setActiveTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    if (tab !== "messages") newParams.delete("chatId");
    setSearchParams(newParams);
  };
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
  const [paymentStep, setPaymentStep] = useState(1); // 1: Form, 2: Gateway, 3: Processing, 4: Success
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
  const [targetConversation, setTargetConversation] = useState(null);

  // Sync URL chatId to targetConversation
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    if (activeTab === "messages" && chatId && realConversations.length > 0) {
      if (targetConversation?.id !== chatId) {
        const conv = realConversations.find(c => c.id === chatId);
        if (conv) setTargetConversation(conv);
      }
    } else if (activeTab === "messages" && !chatId && targetConversation) {
      setTargetConversation(null);
    }
  }, [searchParams, activeTab, realConversations]);

  const dashboardLoadedRef = React.useRef(false);

  const loadDashboard = useCallback(async (isBackground = false) => {
    if (!user?._id) return;
    if (!isBackground && !dashboardLoadedRef.current) setLoading(true);
    setError("");
    try {
      const response = await fetchStudentDashboard(user._id, token);
      setDashboardData(response);
      dashboardLoadedRef.current = true;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, user?._id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (activeTab === "dashboard") {
        loadDashboard(true);
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

  const handleMessageTutor = async (tutor) => {
    console.log("handleMessageTutor called with:", tutor);
    try {
      if (!user?._id || !token) {
        console.error("Missing user or token");
        return;
      }
      const targetId = tutor.id || tutor._id || tutor.tutorId;

      if (!targetId) {
        console.error("No target ID found", tutor);
        return;
      }

      const conversation = await initiateChat(targetId, token);

      setRealConversations(prev => {
        const exists = prev.find(c => c.id === conversation.id);
        if (exists) return prev;
        return [conversation, ...prev];
      });

      setDeletedConvIds(prev => prev.filter(id => id !== conversation.id));

      // Trigger URL update to open chat
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", "messages");
      newParams.set("chatId", conversation.id);
      setSearchParams(newParams);
    } catch (err) {
      console.error("Failed to start chat", err);
    }
  };

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
    setPaymentStep(1);
  };

  const handleBookingChange = (e) => {
    setBookingForm({
      ...bookingForm,
      [e.target.name]: e.target.value,
    });
  };

  /* Payment & Booking Flow */
  const initiatePayment = () => {
    if (!selectedTutor) return;
    if (!bookingForm.date || !bookingForm.time) {
      setBookingError("Please select a date and time");
      return;
    }
    // Proceed to Payment Gateway
    setPaymentStep(2);
  };

  const processPayment = async () => {
    setPaymentStep(3); // Processing
    setBookingStatus("loading");
    setBookingError("");

    try {
      // Simulate Payment Gateway Delay
      await new Promise(resolve => setTimeout(resolve, 2000));

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

      setPaymentStep(4); // Success!
      await loadDashboard();

      // Auto close after success? Or let user close manually.
      // setTimeout(closeBookingModal, 2000); 
    } catch (err) {
      setBookingError(err.message);
      setPaymentStep(2); // Go back to gateway on error
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
                {tab === "dashboard" && <LayoutDashboard size={20} strokeWidth={1.5} />}
                {tab === "find-tutors" && <Search size={20} strokeWidth={1.5} />}
                {tab === "sessions" && <Calendar size={20} strokeWidth={1.5} />}
                {tab === "progress" && <TrendingUp size={20} strokeWidth={1.5} />}
                {tab === "messages" && <MessageSquare size={20} strokeWidth={1.5} />}
                {tab === "settings" && <Settings size={20} strokeWidth={1.5} />}
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
                studentProfile?.avatar || <User size={24} color="#666" strokeWidth={1.5} />
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
            <UserPen size={18} strokeWidth={1.5} />
            <span>Edit Profile</span>
          </button>
          <button className="logout-btn" onClick={logout} type="button">
            <LogOut size={18} strokeWidth={1.5} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className={`main-content ${activeTab === "messages" ? "no-padding" : ""}`}>
        {activeTab === "dashboard" && (
          <div className="dashboard-content">
            <div className="page-header">
              <h1>Welcome back, {studentProfile?.name?.split(" ")[0]}! 👋</h1>
              <p>Here's what's happening with your learning journey today</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card orange">
                <div className="stat-icon">
                  <BookOpen size={28} color="white" strokeWidth={1.5} />
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedLessons}</div>
                  <div className="stat-label">Completed Lessons</div>
                </div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon">
                  <Calendar size={28} color="white" strokeWidth={1.5} />
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.upcomingLessons}</div>
                  <div className="stat-label">Upcoming Sessions</div>
                </div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon">
                  <Clock size={28} color="white" strokeWidth={1.5} />
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalHours}</div>
                  <div className="stat-label">Total Hours</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon">
                  <Target size={28} color="white" strokeWidth={1.5} />
                </div>
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
                          session.avatar || <User size={24} strokeWidth={1.5} />
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
                      <div className={`activity-icon ${activity.type || 'default'}`}>
                        {activity.type === "completed" && <CheckCircle size={20} color="white" strokeWidth={1.5} />}
                        {(activity.type === "confirmed" || activity.type === "upcoming") && <Calendar size={20} color="white" strokeWidth={1.5} />}
                        {activity.type === "pending" && <Hourglass size={20} color="white" strokeWidth={1.5} />}
                        {activity.type === "cancelled" && <XCircle size={20} color="white" strokeWidth={1.5} />}
                        {!["completed", "confirmed", "upcoming", "pending", "cancelled"].includes(activity.type) && <Calendar size={20} color="white" strokeWidth={1.5} />}
                      </div>
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
        )
        }

        {
          activeTab === "find-tutors" && (
            <div className="find-tutors-content">
              <div className="page-header">
                <h1>Find Your Perfect Tutor</h1>
                <p>Browse through our expert tutors and book your next session</p>
              </div>

              <div className="search-filter-bar">
                <div className="search-box">
                  <span className="search-icon"><Search size={18} strokeWidth={1.5} /></span>
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
                  <div key={tutor.id} className="tutor-card-compact">
                    <div className="tutor-header-compact">
                      <div className="tutor-avatar-compact">
                        {tutor.avatar?.startsWith("data:") || tutor.avatar?.startsWith("http") ? (
                          <img src={tutor.avatar} alt={tutor.name} />
                        ) : (
                          <div className="avatar-placeholder"><User size={24} strokeWidth={1.5} /></div>
                        )}
                      </div>
                      <div className="tutor-info-compact">
                        <div className="tutor-name-row">
                          <h3>{tutor.name}</h3>
                          <div className="tutor-rating-pill">
                            <Star size={12} fill="#FFB800" stroke="none" />
                            <span>{tutor.rating}</span>
                          </div>
                        </div>
                        <div className="tutor-subject-text">{tutor.subject}</div>
                      </div>
                    </div>

                    <div className="tutor-stats-compact">
                      <div className="stat-item">
                        <GraduationCap size={14} className="tutor-stat-icon" strokeWidth={1.5} />
                        <span>{tutor.experience}</span>
                      </div>
                      <div className="stat-item">
                        <Calendar size={14} className="tutor-stat-icon" strokeWidth={1.5} />
                        <span>{tutor.availability}</span>
                      </div>
                    </div>

                    <div className="tutor-tags-compact">
                      {(tutor.expertise || []).slice(0, 3).map(skill => (
                        <span key={skill} className="compact-tag">{skill}</span>
                      ))}
                      {(tutor.expertise || []).length > 3 && (
                        <span className="compact-tag more">+{tutor.expertise.length - 3}</span>
                      )}
                    </div>

                    <div className="tutor-footer-compact">
                      <div className="price-compact">
                        <span className="amount">${tutor.hourlyRate}</span>
                        <span className="unit">/hr</span>
                      </div>
                      <button className="book-btn-compact" onClick={() => openBookingModal(tutor)}>
                        Book
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        {
          activeTab === "sessions" && (
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
                    <div key={session.id} className="session-card-simple">
                      <div className="simple-card-left">
                        <div className="simple-date-box">
                          <span className="day">{formatShortDay(session.startTime)}</span>
                          <span className="month">{formatShortMonth(session.startTime)}</span>
                        </div>
                      </div>

                      <div className="simple-card-middle">
                        <div className="simple-header">
                          <h3 className="simple-subject">{session.subject}</h3>
                          <span className={`simple-status ${session.status}`}>{session.status}</span>
                        </div>

                        <div className="simple-meta-row">
                          <span className="simple-meta">
                            <span className="tutor-avatar-micro">
                              {session.avatar?.startsWith("data:") || session.avatar?.startsWith("http") ? (
                                <img src={session.avatar} alt="" />
                              ) : (
                                <User size={14} strokeWidth={1.5} />
                              )}
                            </span>
                            {session.tutor}
                          </span>
                          <span className="simple-dot">•</span>
                          <span className="simple-meta"><Clock size={14} style={{ marginRight: 4 }} strokeWidth={1.5} /> {formatTime(session.startTime)}</span>
                          <span className="simple-dot">•</span>
                          <span className="simple-meta"><Hourglass size={14} style={{ marginRight: 4 }} strokeWidth={1.5} /> {session.duration} min</span>
                          <span className="simple-dot">•</span>
                          <span className="simple-meta"><DollarSign size={14} style={{ marginRight: 1 }} strokeWidth={1.5} /> {session.price || session.hourlyRate || 0}</span>
                        </div>

                        {session.feedback && (
                          <div className="simple-feedback-row">
                            <span className="simple-stars" title={`Rating: ${session.feedback.rating}`}>
                              {Array.from({ length: session.feedback.rating }).map((_, i) => (
                                <Star key={i} size={12} fill="#FFD700" color="#FFD700" style={{ display: 'inline-block', marginRight: 1 }} />
                              ))}
                            </span>
                            {session.feedback.comment && (
                              <span className="simple-comment">
                                "{session.feedback.comment.length > 30 ? session.feedback.comment.substring(0, 30) + '...' : session.feedback.comment}"
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="simple-actions">
                        <button
                          className="btn-simple secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("Message clicked for", session.tutor);
                            handleMessageTutor({ id: session.tutorId, name: session.tutor, avatar: session.avatar });
                          }}
                          type="button"
                          title="Message"
                        >
                          <MessageSquare size={20} strokeWidth={1.5} />
                        </button>

                        {sessionsFilter === "upcoming" && (session.status === "confirmed" || session.status === "pending") && (
                          <button
                            className="btn-simple primary"
                            onClick={(e) => { e.stopPropagation(); handleJoinSession(session); }}
                            disabled={session.status === "pending"}
                            type="button"
                            title={session.status === "pending" ? "Waiting for confirmation" : "Join Video Session"}
                          >
                            <Video size={16} style={{ marginRight: 6 }} strokeWidth={1.5} /> Join
                          </button>
                        )}

                        {sessionsFilter === "upcoming" && session.status !== "cancelled" && (
                          <>
                            <button
                              className="btn-simple secondary"
                              onClick={(e) => { e.stopPropagation(); handleReschedule(session); }}
                              type="button"
                              title="Reschedule"
                            >
                              <Calendar size={20} strokeWidth={1.5} />
                            </button>
                            <button
                              className="btn-simple danger"
                              onClick={(e) => { e.stopPropagation(); handleCancelSession(session); }}
                              type="button"
                              title="Cancel"
                            >
                              <X size={20} strokeWidth={1.5} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        {
          activeTab === "progress" && (
            <div className="progress-content">
              <div className="page-header">
                <h1>Learning Progress</h1>
                <p>Track your improvement across different subjects</p>
              </div>

              <div className="progress-overview">
                <div className="overall-progress-card">
                  <h3>Overall Progress</h3>
                  <div className="circular-progress">
                    <svg viewBox="0 0 200 200" width="100%" height="100%">
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
                      <div className="mini-stat-icon"><BookOpen size={20} color="#FF6B35" strokeWidth={1.5} /></div>
                      <div className="mini-stat-info">
                        <div className="mini-stat-value">{stats.completedLessons}</div>
                        <div className="mini-stat-label">Lessons</div>
                      </div>
                    </div>
                    <div className="mini-stat">
                      <div className="mini-stat-icon"><Clock size={20} color="#9C27B0" strokeWidth={1.5} /></div>
                      <div className="mini-stat-info">
                        <div className="mini-stat-value">{stats.totalHours}h</div>
                        <div className="mini-stat-label">Hours</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="achievements-card">
                  <h3>Recent Achievements</h3>
                  <div className="achievements-grid">
                    <div className={`achievement-badge ${stats.completedLessons >= 1 ? '' : 'locked'}`}>
                      <div className="badge-icon">
                        <Trophy size={32} color="#D4AF37" fill="#FFD700" strokeWidth={1.5} />
                      </div>
                      <div className="badge-name">First Lesson</div>
                    </div>
                    <div className={`achievement-badge ${stats.progressPercentage >= 10 ? '' : 'locked'}`}>
                      <div className="badge-icon">
                        <Star size={32} color="#FFA000" fill="#FFC107" strokeWidth={1.5} />
                      </div>
                      <div className="badge-name">Rising Star</div>
                    </div>
                    <div className={`achievement-badge ${stats.completedLessons >= 2 ? '' : 'locked'}`}>
                      <div className="badge-icon">
                        <Flame size={32} color="#E64A19" fill="#FF5722" strokeWidth={1.5} />
                      </div>
                      <div className="badge-name">3 Lesson Streak</div>
                    </div>
                    <div className={`achievement-badge ${stats.completedLessons >= 3 ? '' : 'locked'}`}>
                      <div className="badge-icon">
                        <Target size={32} color="#C2185B" strokeWidth={1.5} />
                      </div>
                      <div className="badge-name">Scholar</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="subject-progress-list">
                <h3>Progress by Subject</h3>
                {progressData.map((item, index) => {
                  const colors = [
                    "linear-gradient(90deg, #9C27B0, #E040FB)", // Purple
                    "linear-gradient(90deg, #FF4081, #C2185B)", // Pink
                    "linear-gradient(90deg, #FF6B35, #F44336)"  // Orange
                  ];
                  return (
                    <div key={item.subject} className="subject-progress-item">
                      <div className="subject-progress-header">
                        <div className="subject-name">{item.subject}</div>
                        <div className="subject-stats">
                          <span>{item.lessons} lessons</span>
                          <span className="progress-percent" style={{ color: index === 0 ? '#9C27B0' : index === 1 ? '#C2185B' : '#FF6B35' }}>{item.progress}%</span>
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${item.progress}%`,
                            background: colors[index % colors.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        }

        {
          activeTab === "messages" && (
            <div className="messages-content">
              <ErrorBoundary>
                <Messaging
                  currentUser={user}
                  token={token}
                  targetConversation={targetConversation}
                  conversations={(() => {
                    const uniqueMap = new Map();

                    // Filter deleted
                    const visible = realConversations.filter(c => !deletedConvIds.includes(c.id));
                    visible.forEach(c => {
                      if (c && c.id) uniqueMap.set(String(c.id), c);
                    });

                    if (targetConversation && targetConversation.id) {
                      const targetId = String(targetConversation.id);
                      if (!uniqueMap.has(targetId)) {
                        return [targetConversation, ...Array.from(uniqueMap.values())];
                      }
                    }
                    return Array.from(uniqueMap.values());
                  })()}
                  onSendMessage={(conversationId, message) => {
                    loadConversations();
                  }}
                  onDeleteConversation={async (convId) => {
                    console.log("Deleting conversation:", convId);

                    // Clear targetConversation if it's the one being deleted
                    if (targetConversation && targetConversation.id === convId) {
                      setTargetConversation(null);
                    }

                    setDeletedConvIds((prev) => (prev.includes(convId) ? prev : [...prev, convId]));
                    const apiUrl = import.meta.env.VITE_API_URL || "";
                    try {
                      await fetch(`${apiUrl}/api/messages/conversations/${convId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      // Wait a bit for backend to process before reloading
                      setTimeout(loadConversations, 100);
                    } catch (e) {
                      console.error("Failed to delete", e);
                    }
                  }}
                  onMarkAsRead={async (convId) => {
                    // Optimistically update local state
                    setRealConversations(prev => prev.map(c =>
                      c.id === convId ? { ...c, unreadCount: 0 } : c
                    ));

                    const apiUrl = import.meta.env.VITE_API_URL || "";
                    try {
                      await fetch(`${apiUrl}/api/messages/mark-read`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ conversationId: convId })
                      });
                      loadConversations();
                    } catch (e) { console.error("Failed to mark read", e); }
                  }}
                  onMessageReceived={loadConversations}
                  onSelectConversation={(conv) => {
                    const newParams = new URLSearchParams(searchParams);
                    if (conv) {
                      newParams.set("chatId", conv.id);
                    } else {
                      newParams.delete("chatId");
                    }
                    setSearchParams(newParams);
                  }}
                />
              </ErrorBoundary>
            </div>
          )
        }

        {
          activeTab === "settings" && (
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
          )
        }
      </main >

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
                  selectedTutor.avatar || <User size={32} strokeWidth={1.5} />
                )}
              </div>
              <div>
                <h2>Book Session with {selectedTutor.name}</h2>
                <p className="modal-subject">{selectedTutor.subject}</p>
              </div>
            </div>
            <div className="modal-body">
              {/* Step 1: Booking Form */}
              {paymentStep === 1 && (
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
              )}

              {/* Step 2: Payment Gateway */}
              {paymentStep === 2 && (
                <div className="payment-gateway">
                  <div className="payment-summary">
                    <div className="summary-row">
                      <span>Tutor Rate</span>
                      <span>${selectedTutor.hourlyRate}/hr</span>
                    </div>
                    <div className="summary-row">
                      <span>Duration</span>
                      <span>{bookingForm.duration} mins</span>
                    </div>
                    <div className="summary-total">
                      <span>Total to Pay</span>
                      <span>${Math.round(((selectedTutor.hourlyRate || 0) / 60) * bookingForm.duration)}</span>
                    </div>
                  </div>

                  <div className="card-input-mock">
                    <label>Credit Card Number</label>
                    <div className="card-field">
                      <span className="card-icon">💳</span>
                      <input type="text" placeholder="**** **** **** 4242" defaultValue="4242 4242 4242 4242" readOnly />
                      <span className="card-brand">VISA</span>
                    </div>
                    <div className="card-row">
                      <div className="card-col">
                        <label>Expiry</label>
                        <input type="text" defaultValue="12/28" readOnly />
                      </div>
                      <div className="card-col">
                        <label>CVC</label>
                        <input type="text" defaultValue="123" readOnly />
                      </div>
                    </div>
                  </div>
                  <div className="secure-badge">🔒 256-bit SSL Secure Payment</div>
                  {bookingError && <p className="form-error">{bookingError}</p>}
                </div>
              )}

              {/* Step 3: Processing */}
              {paymentStep === 3 && (
                <div className="payment-processing">
                  <div className="spinner large"></div>
                  <p>Processing Payment...</p>
                  <span className="sub-text">Please do not close this window</span>
                </div>
              )}

              {/* Step 4: Success */}
              {paymentStep === 4 && (
                <div className="payment-success">
                  <div className="success-icon">🎉</div>
                  <h3>Booking Confirmed!</h3>
                  <p>Your session has been successfully booked and paid for.</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {paymentStep === 1 && (
                <>
                  <button className="modal-btn secondary" onClick={closeBookingModal} type="button">
                    Cancel
                  </button>
                  <button
                    className="modal-btn primary"
                    onClick={initiatePayment}
                    type="button"
                  >
                    Proceed to Pay ${Math.round(((selectedTutor.hourlyRate || 0) / 60) * bookingForm.duration)}
                  </button>
                </>
              )}

              {paymentStep === 2 && (
                <>
                  <button className="modal-btn secondary" onClick={() => setPaymentStep(1)} type="button">
                    Back
                  </button>
                  <button
                    className="modal-btn primary pay-btn"
                    onClick={processPayment}
                    type="button"
                  >
                    Pay Now
                  </button>
                </>
              )}

              {paymentStep === 4 && (
                <button
                  className="modal-btn primary full-width"
                  onClick={() => {
                    closeBookingModal();
                    setActiveTab("sessions"); // This updates local state
                    // Also update URL to ensure persistence
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set("tab", "sessions");
                    newParams.delete("chatId"); // Clear any chat query
                    setSearchParams(newParams);
                  }}
                  type="button"
                >
                  View My Sessions
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {
        rescheduleDialog && (
          <RescheduleDialog
            session={rescheduleDialog}
            onConfirm={handleRescheduleConfirm}
            onCancel={handleRescheduleCancel}
          />
        )
      }

      {/* Mobile Navigation */}
      <nav className="student-mobile-nav">
        {["dashboard", "find-tutors", "sessions", "messages", "settings"].map((tab) => (
          <button
            key={tab}
            className={`mobile-nav-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="mobile-nav-icon">
              {tab === "dashboard" && <LayoutDashboard size={20} />}
              {tab === "find-tutors" && <Search size={20} />}
              {tab === "sessions" && <Calendar size={20} />}
              {tab === "messages" && <MessageSquare size={20} />}
              {tab === "settings" && <Settings size={20} />}
            </span>
            <span className="mobile-nav-label">
              {tab === "find-tutors" ? "Tutors" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
          </button>
        ))}
      </nav>
    </div >
  );
}