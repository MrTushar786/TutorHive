import { apiRequest } from "./client";

export function createBooking(payload, token) {
  return apiRequest("/bookings", {
    method: "POST",
    data: payload,
    token,
  });
}

export function getMySessions(status, token) {
  const params = status ? `?status=${status}` : "";
  return apiRequest(`/bookings/my-sessions${params}`, {
    method: "GET",
    token,
  });
}

export function updateBookingStatus(bookingId, status, token, additionalData = {}) {
  return apiRequest(`/bookings/${bookingId}/status`, {
    method: "PATCH",
    data: { status, ...additionalData },
    token,
  });
}

export function generateMeetingRoom(bookingId, token) {
  return apiRequest(`/bookings/${bookingId}/meeting-room`, {
    method: "POST",
    token,
  });
}

export function submitFeedback(bookingId, feedback, token) {
  return apiRequest(`/bookings/${bookingId}/feedback`, {
    method: "POST",
    data: feedback,
    token,
  });
}

