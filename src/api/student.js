import { apiRequest } from "./client";

export function fetchStudentDashboard(studentId, token) {
  return apiRequest(`/students/${studentId}/dashboard`, {
    token,
  });
}

