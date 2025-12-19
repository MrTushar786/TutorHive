import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  MessageSquare,
  Settings,
  UserPen,
  LogOut,
  User,
  Video,
  Check,
  X,
  CheckCircle,
  Star,
  Search,
  Clock,
  Hourglass
} from "lucide-react";
import "./TutorDashboard.css";
import useAuth from "../hooks/useAuth";
import { fetchTutorDashboard } from "../api/tutor";
import { getMySessions, updateBookingStatus, generateMeetingRoom } from "../api/booking";
import ProfileEdit from "../components/ProfileEdit";
import Messaging from "../components/Messaging";
import { getConversationId } from "../hooks/useConversationId";
import { getConversations, initiateChat } from "../api/messages";
import ErrorBoundary from "../utils/ErrorBoundary";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const formatTime = (value) => new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const formatShortDay = (value) => new Date(value).toLocaleDateString("en-US", { day: "2-digit" });
const formatShortMonth = (value) => new Date(value).toLocaleDateString("en-US", { month: "short" });

const defaultStats = {
  totalStudents: 0,
  completedSessions: 0,
  totalEarnings: 0,
  averageRating: 0,
};

export default function TutorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const setActiveTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    if (tab !== "messages") newParams.delete("chatId");
    setSearchParams(newParams);
  };
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sessionModal, setSessionModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1); // 1: Input, 2: Processing, 3: Success
  const [sessionForm, setSessionForm] = useState({ notes: "", goals: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionsFilter, setSessionsFilter] = useState("upcoming");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const { user, token, logout } = useAuth();
  const [deletedConvIds, setDeletedConvIds] = useState(() => {
    try {
      const stored = localStorage.getItem("tutorDeletedConvIds");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("tutorDeletedConvIds", JSON.stringify(deletedConvIds));
  }, [deletedConvIds]);
  const [realConversations, setRealConversations] = useState([]);
  const [targetConversation, setTargetConversation] = useState(null);

  // Sync URL chatId to targetConversation
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    if (activeTab === "messages" && chatId && realConversations.length > 0) {
      // Only set if we aren't already looking at it (to avoid loops if targetConversation has more data)
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
      const response = await fetchTutorDashboard(user._id, token);
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
      console.log("Tutor sessions response:", response);
      const sessionsData = response?.sessions || response?.data?.sessions || response || [];
      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (err) {
      console.error("Error loading tutor sessions:", err);
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
    if (activeTab === "schedule") {
      loadSessions();
    }
    // Refresh earnings when on earnings tab
    if (activeTab === "earnings") {
      loadDashboard();
      const interval = setInterval(() => {
        loadDashboard();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadSessions, loadDashboard]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getConversations(token);

      // Augment with local student data if needed/possible
      const students = dashboardData?.myStudents || [];
      const augmented = data.map(conv => {
        if (conv.otherUserId) {
          const match = students.find(s => (s.id === conv.otherUserId || s._id === conv.otherUserId));
          if (match) {
            return { ...conv, name: match.name, avatar: match.avatar || conv.avatar };
          }
        }
        return conv;
      });

      setRealConversations(augmented);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, [token, dashboardData]);

  useEffect(() => {
    if (activeTab === "messages") {
      loadConversations();
      const interval = setInterval(loadConversations, 5000); // Poll every 5s for new chats
      return () => clearInterval(interval);
    }
  }, [activeTab, loadConversations]);

  const tutorProfile = dashboardData?.tutor;
  const stats = tutorProfile?.stats || defaultStats;
  const upcomingSessions = useMemo(() => dashboardData?.upcomingSessions || [], [dashboardData]);
  const myStudents = useMemo(() => dashboardData?.myStudents || [], [dashboardData]);
  const earningsHistory = useMemo(() => dashboardData?.earningsHistory || [], [dashboardData]);
  const recentActivity = useMemo(() => dashboardData?.recentActivity || [], [dashboardData]);

  const subjects = useMemo(() => {
    const unique = new Set(myStudents.map((student) => (student.subject || "general").toLowerCase()));
    return ["all", ...unique];
  }, [myStudents]);

  const filteredStudents = useMemo(() => {
    return myStudents.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.subject || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject =
        selectedSubject === "all" || (student.subject || "").toLowerCase() === selectedSubject;
      return matchesSearch && matchesSubject;
    });
  }, [myStudents, searchQuery, selectedSubject]);

  const openSessionModal = (student) => {
    setSelectedStudent(student);
    setSessionModal(true);
  };

  const handleMessageStudent = async (student) => {
    try {
      if (!user?._id || !token) return;
      const targetId = student.id || student._id;

      let conversation = await initiateChat(targetId, token);

      // Manually attach student details to ensure they display correctly immediately
      conversation = {
        ...conversation,
        name: student.name || "Student",
        avatar: student.avatar,
        otherUserId: targetId
      };

      // Update local state to include this conversation immediately
      setRealConversations(prev => {
        const exists = prev.find(c => c.id === conversation.id);
        if (exists) {
          return prev.map(c => c.id === conversation.id ? { ...c, name: student.name, avatar: student.avatar } : c);
        }
        return [conversation, ...prev];
      });

      // Remove from deleted list if it was there
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

  const closeSessionModal = () => {
    setSessionModal(false);
    setSelectedStudent(null);
  };

  const handleSessionStart = async () => {
    if (!selectedStudent || !user || !token) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tutorId: user._id,
          studentId: selectedStudent.id || selectedStudent._id,
          subject: selectedStudent.subject || "General Mentorship",
          startTime: new Date().toISOString(),
          duration: 60,
          notes: `Goals: ${sessionForm.goals}\nNotes: ${sessionForm.notes}`
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to start session");
      }

      const data = await response.json();
      closeSessionModal();

      if (data.booking) {
        window.location.href = `/video-call/${data.booking._id}`;
      }
    } catch (err) {
      console.error(err);
      alert("Error starting session: " + err.message);
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

  const handleConfirmSession = async (session) => {
    try {
      await updateBookingStatus(session.id, "confirmed", token);
      await loadSessions();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMarkComplete = async (session) => {
    if (!window.confirm("Are you sure you want to mark this session as completed?")) {
      return;
    }
    try {
      await updateBookingStatus(session.id, "completed", token);
      // Wait a bit for status to propagate if needed, or just reload
      await loadSessions();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };


  if (loading) {
    return (
      <div className="state-message">
        <div className="spinner" />
        <p>Loading your tutor workspace...</p>
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
    <div className="tutor-dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <span className="logo-icon">🐝</span>
            <span className="logo-text">TutorHive</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {["dashboard", "students", "schedule", "earnings", "messages", "settings"].map((tab) => (
            <button
              key={tab}
              className={`nav-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav-icon">
                {tab === "dashboard" && <LayoutDashboard size={20} strokeWidth={1.5} />}
                {tab === "students" && <Users size={20} strokeWidth={1.5} />}
                {tab === "schedule" && <Calendar size={20} strokeWidth={1.5} />}
                {tab === "earnings" && <DollarSign size={20} strokeWidth={1.5} />}
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
              {tutorProfile?.avatar?.startsWith("data:") || tutorProfile?.avatar?.startsWith("http") ? (
                <img src={tutorProfile.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                tutorProfile?.avatar || <User size={24} color="#666" strokeWidth={1.5} />
              )}
            </div>
            <div className="user-info">
              <div className="user-name">{tutorProfile?.name}</div>
              <div className="user-email">{tutorProfile?.email}</div>
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
              <h1>Welcome back, {tutorProfile?.name?.split(" ")[0]}! 👋</h1>
              <p>Here's an overview of your tutoring activities today</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card orange">
                <div className="stat-icon"><Users size={28} color="white" strokeWidth={1.5} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalStudents}</div>
                  <div className="stat-label">Total Students</div>
                </div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon"><CheckCircle size={28} color="white" strokeWidth={1.5} /></div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedLessons || stats.completedSessions || 0}</div>
                  <div className="stat-label">Completed Sessions</div>
                </div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon"><DollarSign size={28} color="white" strokeWidth={1.5} /></div>
                <div className="stat-info">
                  <div className="stat-value">{formatCurrency(stats.totalEarnings)}</div>
                  <div className="stat-label">Total Earnings</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon"><Star size={28} color="white" strokeWidth={1.5} /></div>
                <div className="stat-info">
                  <div className="stat-value">{(stats.averageRating || 0).toFixed(1)}</div>
                  <div className="stat-label">Average Rating</div>
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
                    onClick={() => setActiveTab("schedule")}
                  >
                    View All →
                  </button>
                </div>
                <div className="sessions-list">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="session-item">
                      <div className="session-avatar">
                        {session.avatar?.startsWith("data:") || session.avatar?.startsWith("http") ? (
                          <img src={session.avatar} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          session.avatar || <User size={24} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="session-details">
                        <div className="session-tutor">{session.student}</div>
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
                        {activity.type === "cancelled" && <X size={20} color="white" strokeWidth={1.5} />}
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
        )}

        {activeTab === "students" && (
          <div className="students-content">
            <div className="page-header">
              <h1>My Students</h1>
              <p>Manage your students and track their progress</p>
            </div>

            <div className="search-filter-bar">
              <div className="search-box">
                <span className="search-icon"><Search size={18} strokeWidth={1.5} /></span>
                <input
                  type="text"
                  placeholder="Search by student name or subject..."
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

            <div className="students-grid">
              {filteredStudents.map((student) => (
                <div key={student.id} className="student-card-compact">
                  <div className="student-header-compact">
                    <div className="student-avatar-compact-wrapper">
                      {student.avatar?.startsWith("data:") || student.avatar?.startsWith("http") ? (
                        <img src={student.avatar} alt={student.name} />
                      ) : (
                        <div className="avatar-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                          {student.avatar || <User size={32} strokeWidth={1.5} color="#666" />}
                        </div>
                      )}
                    </div>
                    <div className="student-info-compact">
                      <div className="student-name-row">
                        <h3>{student.name}</h3>
                        <div className="student-rating-pill">
                          <Star size={12} fill="#FFC107" strokeWidth={0} />
                          <span>4.8</span>
                        </div>
                      </div>
                      <div className="student-subject-text">{student.subject || "General"}</div>

                      <div className="student-stats-row">
                        <span><Calendar size={14} style={{ display: 'inline', marginRight: 4 }} strokeWidth={1.5} /> {formatDate(student.lastSession)}</span>
                        <span><Clock size={14} style={{ display: 'inline', marginRight: 4 }} strokeWidth={1.5} /> {(student.totalHours || 0).toFixed(1)}h</span>
                      </div>
                    </div>
                  </div>

                  <div className="student-tags">
                    <span className="student-tag">{student.subject || "General"}</span>
                    <span className="student-tag">Regular</span>
                  </div>

                  <div className="student-card-footer-compact">
                    <div className="student-earnings">
                      {formatCurrency(student.totalEarnings || 0)} <span>earned</span>
                    </div>
                    <button className="join-btn-pill" onClick={() => openSessionModal(student)}>
                      <span>Start Session</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="schedule-content">
            <div className="page-header">
              <h1>My Schedule</h1>
              <p>View and manage your availability and sessions</p>
            </div>

            <div className="schedule-tabs">
              <button
                className={`schedule-tab-btn ${sessionsFilter === "upcoming" ? "active" : ""}`}
                onClick={() => setSessionsFilter("upcoming")}
                type="button"
              >
                Upcoming
              </button>
              <button
                className={`schedule-tab-btn ${sessionsFilter === "completed" ? "active" : ""}`}
                onClick={() => setSessionsFilter("completed")}
                type="button"
              >
                Completed
              </button>
              <button
                className={`schedule-tab-btn ${sessionsFilter === "cancelled" ? "active" : ""}`}
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
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div key={session.id} className="session-card-simple">
                    <div className="simple-card-left">
                      <div className="simple-date-box">
                        <span className="day">{new Date(session.startTime).getDate()}</span>
                        <span className="month">{new Date(session.startTime).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
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
                          {session.student}
                        </span>
                        <span className="simple-dot">•</span>
                        <span className="simple-meta">
                          <Calendar size={14} style={{ marginRight: 4 }} strokeWidth={1.5} /> {formatTime(session.startTime)}
                        </span>
                        <span className="simple-dot">•</span>
                        <span className="simple-meta">
                          {session.duration} min
                        </span>
                        <span className="simple-dot">•</span>
                        <span className="simple-meta">
                          ${session.price}
                        </span>
                      </div>

                      {session.status === "completed" && session.feedback && (
                        <div className="session-feedback">
                          <div className="feedback-rating">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < session.feedback.rating ? "#FFC107" : "none"}
                                color={i < session.feedback.rating ? "#FFC107" : "#CBD5E0"}
                                strokeWidth={1.5}
                              />
                            ))}
                          </div>
                          {session.feedback.comment && (
                            <div className="feedback-comment">
                              "{session.feedback.comment}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="simple-actions">
                      <button
                        className="btn-simple secondary"
                        onClick={() => handleMessageStudent({ id: session.studentId, name: session.student, avatar: session.avatar })}
                        title="Message"
                      >
                        <MessageSquare size={20} strokeWidth={1.5} />
                      </button>

                      {sessionsFilter === "upcoming" && session.status === "confirmed" && (
                        <button className="btn-simple primary" onClick={() => handleJoinSession(session)}>
                          <Video size={16} style={{ marginRight: 6 }} strokeWidth={1.5} /> Join
                        </button>
                      )}

                      {sessionsFilter === "upcoming" && session.status === "confirmed" && (
                        <button
                          className="btn-simple success"
                          onClick={() => handleMarkComplete(session)}
                          title="Mark as Completed"
                          style={{ background: '#4CAF50', color: 'white' }}
                        >
                          <CheckCircle size={16} strokeWidth={1.5} />
                        </button>
                      )}

                      {session.status === "pending" && (
                        <button className="btn-simple primary" onClick={() => handleConfirmSession(session)} style={{ background: '#4CAF50' }}>
                          <Check size={16} style={{ marginRight: 6 }} strokeWidth={1.5} /> Confirm
                        </button>
                      )}

                      {sessionsFilter === "upcoming" && session.status !== "cancelled" && (
                        <button className="btn-simple danger" onClick={() => handleCancelSession(session)} title="Cancel">
                          <X size={20} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="earnings-content">
            <div className="page-header">
              <h1>Earnings</h1>
              <div className="header-actions">
                <p>Track your income and payouts</p>
                <button
                  className="btn-primary"
                  onClick={() => setWithdrawModal(true)}
                  disabled={stats.totalEarnings === 0}
                >
                  Withdraw Funds
                </button>
              </div>
            </div>

            <div className="earnings-overview">
              <div className="total-earnings-card">
                <h3>Total Earnings</h3>
                <div className="earnings-amount">{formatCurrency(stats.totalEarnings)}</div>
                <div className="earnings-stats">
                  <div className="earnings-stat">
                    <div className="stat-label">Average Rating</div>
                    <div className="stat-value">{(stats.averageRating || 0).toFixed(1)}</div>
                  </div>
                  <div className="earnings-stat">
                    <div className="stat-label">Students</div>
                    <div className="stat-value">{stats.totalStudents}</div>
                  </div>
                </div>
              </div>

              <div className="earnings-history-card">
                <h3>Earnings History</h3>
                <div className="earnings-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Student</th>
                        <th>Duration</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earningsHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.date)}</td>
                          <td>{item.student}</td>
                          <td>{item.duration} min</td>
                          <td>{formatCurrency(item.amount)}</td>
                          <td>
                            <span className="status-badge paid" style={{
                              background: 'rgba(76, 175, 80, 0.1)',
                              color: '#4CAF50',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}>
                              Paid
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

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

                    // Add real conversations first (server truth)
                    const visible = realConversations.filter(c => !deletedConvIds.includes(c.id));
                    visible.forEach(c => {
                      if (c && c.id) uniqueMap.set(String(c.id), c);
                    });

                    // Ensure target conversation is included
                    if (targetConversation && targetConversation.id) {
                      const targetId = String(targetConversation.id);
                      if (!uniqueMap.has(targetId)) {
                        // If not in list, add it (e.g. new chat)
                        // Prepend or append? Map preserves insertion order.
                        // If we want it at top, we should have added it first?
                        // But if we add it first, we might overwrite it with "stale" info?
                        // Actually, realConversations is better data. 
                        // So keep real if exists. If not, add target.
                        // To force it to top visually, we might need array spread.

                        // But Map set appends.
                        // Let's just return [...values] and maybe sort?
                        // Or simple approach:
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
                      setTimeout(loadConversations, 100);
                    } catch (e) {
                      console.error("Failed to delete", e);
                    }
                  }}
                  onMarkAsRead={async (convId) => {
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
                <p>Manage your profile and preferences</p>
              </div>
              {showProfileEdit ? (
                <ProfileEdit
                  user={tutorProfile || user}
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
                    <p>Update your profile information, subjects, and rates.</p>
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

      {sessionModal && selectedStudent && (
        <div className="modal-overlay" onClick={closeSessionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeSessionModal} type="button">
              ×
            </button>
            <div className="modal-header">
              <div className="modal-student-avatar">
                {selectedStudent.avatar?.startsWith("data:") || selectedStudent.avatar?.startsWith("http") ? (
                  <img src={selectedStudent.avatar} alt={selectedStudent.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  selectedStudent.avatar || "👨‍🎓"
                )}
              </div>
              <div>
                <h2>Session with {selectedStudent.name}</h2>
                <p className="modal-subject">{selectedStudent.subject}</p>
              </div>
            </div>
            <div className="modal-body">
              <div className="session-form">
                <div className="form-group">
                  <label>Session Notes</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Any notes for this session?"
                    value={sessionForm.notes}
                    onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Goals for Today</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="What will you cover today?"
                    value={sessionForm.goals}
                    onChange={(e) => setSessionForm({ ...sessionForm, goals: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={closeSessionModal} type="button">
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handleSessionStart} type="button">
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Gateway Demo Modal */}
      {
        withdrawModal && (
          <div className="modal-overlay" onClick={() => { if (withdrawStep !== 2) setWithdrawModal(false); }}>
            <div className="modal-content withdrawal-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>💳 Withdraw Funds</h2>
                <button className="modal-close" onClick={() => setWithdrawModal(false)}>×</button>
              </div>

              <div className="modal-body">
                {withdrawStep === 1 && (
                  <div className="withdrawal-step">
                    <div className="balance-info">
                      <span>Available Balance</span>
                      <span className="amount">{formatCurrency(stats.totalEarnings)}</span>
                    </div>

                    <div className="form-group">
                      <label>Payment Method</label>
                      <select className="form-input">
                        <option>🏦 Bank Transfer (**** 1234)</option>
                        <option>🅿️ PayPal (user@example.com)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Amount to Withdraw</label>
                      <div className="amount-input-wrapper">
                        <span className="currency-prefix">$</span>
                        <input type="number" className="form-input" defaultValue={stats.totalEarnings} max={stats.totalEarnings} />
                      </div>
                    </div>

                    <div className="gateway-note">
                      <p>🔒 Secure Gateway Connected</p>
                    </div>
                  </div>
                )}

                {withdrawStep === 2 && (
                  <div className="withdrawal-processing">
                    <div className="spinner large"></div>
                    <p>Processing with Bank...</p>
                    <span className="sub-text">Verifying credentials & checking liquidity</span>
                  </div>
                )}

                {withdrawStep === 3 && (
                  <div className="withdrawal-success">
                    <div className="success-icon">✅</div>
                    <h3>Withdrawal Initiated!</h3>
                    <p>Your funds are on the way. You should receive them within 1-2 business days.</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {withdrawStep === 1 && (
                  <>
                    <button className="modal-btn secondary" onClick={() => setWithdrawModal(false)}>Cancel</button>
                    <button
                      className="modal-btn primary"
                      onClick={() => {
                        setWithdrawStep(2);
                        setTimeout(() => setWithdrawStep(3), 2000); // Simulate network delay
                      }}
                    >
                      Confirm Withdrawal
                    </button>
                  </>
                )}
                {withdrawStep === 3 && (
                  <button
                    className="modal-btn primary full-width"
                    onClick={() => {
                      setWithdrawModal(false);
                      setWithdrawStep(1);
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Mobile Navigation */}
      <nav className="tutor-mobile-nav">
        {["dashboard", "students", "schedule", "earnings", "messages", "settings"].map((tab) => (
          <button
            key={tab}
            className={`mobile-nav-item ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="mobile-nav-icon">
              {tab === "dashboard" && <LayoutDashboard size={20} />}
              {tab === "students" && <Users size={20} />}
              {tab === "schedule" && <Calendar size={20} />}
              {tab === "earnings" && <DollarSign size={20} />}
              {tab === "messages" && <MessageSquare size={20} />}
              {tab === "settings" && <Settings size={20} />}
            </span>
            <span className="mobile-nav-label">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </span>
          </button>
        ))}
      </nav>
    </div >
  );
}

