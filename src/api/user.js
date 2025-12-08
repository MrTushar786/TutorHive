import { apiRequest } from "./client";

export function updateProfile(userId, profileData, token) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "PATCH",
    data: profileData,
    token,
  });
}

export function getProfile(userId, token) {
  return apiRequest(`/auth/profile/${userId}`, {
    method: "GET",
    token,
  });
}

