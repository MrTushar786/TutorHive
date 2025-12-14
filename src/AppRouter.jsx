import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AuthPage from "./auth/AuthPage";
import AuthCallback from "./auth/AuthCallback";
import StudentDashboard from "./student/StudentDashboard";
import TutorDashboard from "./tutor/TutorDashboard";
import VideoCallPage from "./pages/VideoCallPage";
import ProtectedRoute from "./component/ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/studentdashboard"
          element={(
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/tutordashboard"
          element={(
            <ProtectedRoute allowedRoles={["tutor"]}>
              <TutorDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/video-call/:bookingId"
          element={(
            <ProtectedRoute allowedRoles={["student", "tutor"]}>
              <VideoCallPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}