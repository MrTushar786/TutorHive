import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="state-message">
        <div className="spinner" />
        <p>Loading your TutorHive workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectPath = user.role === "tutor" ? "/tutordashboard" : "/studentdashboard";
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}

