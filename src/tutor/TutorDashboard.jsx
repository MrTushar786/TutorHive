import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./TutorDashboard.css";
import useAuth from "../hooks/useAuth";
import { fetchTutorDashboard } from "../api/tutor";
import { getMySessions, updateBookingStatus, generateMeetingRoom } from "../api/booking";
import ProfileEdit from "../components/ProfileEdit";
import Messaging from "../components/Messaging";
import { getConversationId } from "../hooks/useConversationId";
import { getConversations } from "../api/messages";

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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sessionModal, setSessionModal] = useState(false);
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
  const [deletedConvIds, setDeletedConvIds] = useState([]);
  const [realConversations, setRealConversations] = useState([]);

  const loadDashboard = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetchTutorDashboard(user._id, token);
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
      setRealConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "messages") {
      loadConversations();
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

  const closeSessionModal = () => {
    setSessionModal(false);
    setSelectedStudent(null);
  };

  const handleSessionStart = () => {
    closeSessionModal();
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
                {tab === "dashboard" && "🏠"}
                {tab === "students" && "👨‍🎓"}
                {tab === "schedule" && "📅"}
                {tab === "earnings" && "💰"}
                {tab === "messages" && "💬"}
                {tab === "settings" && "⚙️"}
              </span>
              <span>{tab.replace("-", " ")}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{tutorProfile?.avatar || "👩‍🏫"}</div>
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
              <h1>Welcome back, {tutorProfile?.name?.split(" ")[0]}! 👋</h1>
              <p>Here's an overview of your tutoring activities today</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card orange">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalStudents}</div>
                  <div className="stat-label">Total Students</div>
                </div>
              </div>
              <div className="stat-card blue">
                <div className="stat-icon">📚</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.completedSessions}</div>
                  <div className="stat-label">Completed Sessions</div>
                </div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon">💰</div>
                <div className="stat-info">
                  <div className="stat-value">{formatCurrency(stats.totalEarnings)}</div>
                  <div className="stat-label">Total Earnings</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon">⭐</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.averageRating.toFixed(1)}</div>
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
                      <div className="session-avatar">{session.avatar || "👨‍🎓"}</div>
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

        {activeTab === "students" && (
          <div className="students-content">
            <div className="page-header">
              <h1>My Students</h1>
              <p>Manage your students and track their progress</p>
            </div>

            <div className="search-filter-bar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
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
                <div key={student.id} className="student-card">
                  <div className="student-card-header">
                    <div className="student-avatar-large">{student.avatar || "👩‍🎓"}</div>
                    <div className="student-rating">
                      <span className="star">⭐</span>
                      <span className="rating-value">{student.rating?.toFixed(1) || "5.0"}</span>
                    </div>
                  </div>
                  <div className="student-card-body">
                    <h3 className="student-name">{student.name}</h3>
                    <div className="student-subject">{student.subject}</div>
                    <div className="student-sessions">
                      <span className="icon">📚</span>
                      <span>{student.sessions} sessions</span>
                    </div>
                    <div className="student-progress">
                      <span className="icon">📈</span>
                      <span>{student.progress}% progress</span>
                    </div>
                    <div className="student-last-session">
                      <span className="icon">📅</span>
                      <span>Last session: {formatDate(student.lastSession)}</span>
                    </div>
                  </div>
                  <div className="student-card-footer">
                    <button className="session-btn" onClick={() => openSessionModal(student)} type="button">
                      Start Session
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
                          <span className="tutor-avatar-small">{session.avatar || "👨‍🎓"}</span>
                          <span>{session.student}</span>
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
                    </div>
                    <div className="session-card-right">
                      <span className={`status-badge ${session.status}`}>{session.status}</span>
                      <div className="session-actions">
                        {session.status === "pending" && (
                          <button
                            className="action-btn primary"
                            onClick={() => handleConfirmSession(session)}
                            type="button"
                          >
                            Confirm
                          </button>
                        )}
                        {sessionsFilter === "upcoming" && session.status === "confirmed" && (
                          <button
                            className="action-btn primary"
                            onClick={() => handleJoinSession(session)}
                            type="button"
                          >
                            Start Session
                          </button>
                        )}
                        {sessionsFilter === "upcoming" && session.status !== "cancelled" && (
                          <button
                            className="action-btn danger"
                            onClick={() => handleCancelSession(session)}
                            type="button"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
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
              <p>Track your income and payouts</p>
            </div>

            <div className="earnings-overview">
              <div className="total-earnings-card">
                <h3>Total Earnings</h3>
                <div className="earnings-amount">{formatCurrency(stats.totalEarnings)}</div>
                <div className="earnings-stats">
                  <div className="earnings-stat">
                    <div className="stat-label">Average Rating</div>
                    <div className="stat-value">{stats.averageRating.toFixed(1)}</div>
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
                        <th>Month</th>
                        <th>Sessions</th>
                        <th>Earnings</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earningsHistory.map((item) => (
                        <tr key={item.month}>
                          <td>{item.month}</td>
                          <td>{item.sessions}</td>
                          <td>{formatCurrency(item.earnings)}</td>
                          <td>
                            <span className="status-paid">Paid</span>
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

        {activeTab === "messages" && (
          <div className="messages-content">
            <div className="page-header">
              <h1>Messages</h1>
              <p>Chat with your students</p>
            </div>
            <Messaging
              currentUser={user}
              token={token}
              conversations={(() => {
                const activeIds = new Set(realConversations.map((c) => c.id));
                const potentialConversations = myStudents
                  .map((student) => {
                    const otherId = student.id || student._id;
                    const convId = getConversationId(user?._id, otherId);
                    if (!convId) return null;
                    if (activeIds.has(convId)) return null;
                    if (deletedConvIds.includes(convId)) return null;
                    return {
                      id: convId,
                      name: student.name,
                      avatar: student.avatar,
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
              onDeleteConversation={(convId) => {
                setDeletedConvIds((prev) => (prev.includes(convId) ? prev : [...prev, convId]));
              }}
            />
          </div>
        )}

        {activeTab === "settings" && (
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
        )}
      </main>

      {sessionModal && selectedStudent && (
        <div className="modal-overlay" onClick={closeSessionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeSessionModal} type="button">
              ×
            </button>
            <div className="modal-header">
              <div className="modal-student-avatar">{selectedStudent.avatar || "👨‍🎓"}</div>
              <div>
                <h2>Session with {selectedStudent.name}</h2>
                <p className="modal-subject">{selectedStudent.subject}</p>
              </div>
            </div>
            <div className="modal-body">
              <div className="session-form">
                <div className="form-group">
                  <label>Session Notes</label>
                  <textarea className="form-input" rows="3" placeholder="Any notes for this session?" />
                </div>
                <div className="form-group">
                  <label>Goals for Today</label>
                  <input type="text" className="form-input" placeholder="What will you cover today?" />
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

    </div>
  );
}

