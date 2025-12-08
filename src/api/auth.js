import { apiRequest } from "./client";

export function loginRequest(credentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    data: credentials,
  });
}

export function registerRequest(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    data: payload,
  });
}

export function fetchProfile(token) {
  return apiRequest("/auth/me", {
    token,
  });
}

