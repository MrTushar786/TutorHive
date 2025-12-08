import { apiRequest } from "./client";

export function fetchTutorDashboard(tutorId, token) {
  return apiRequest(`/tutors/${tutorId}/dashboard`, {
    token,
  });
}

export function fetchTutors(token) {
  return apiRequest("/tutors", { token });
}

