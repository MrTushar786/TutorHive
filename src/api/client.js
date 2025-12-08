const rawBase = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
const API_BASE_URL = rawBase.endsWith("/api") ? rawBase : `${rawBase}/api`;

async function parseResponse(response) {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return response.json();
  }
  return null;
}

export async function apiRequest(path, { method = "GET", data, token, signal } = {}) {
  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  };

  if (token) {
    fetchOptions.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = payload?.message || "Something went wrong";
    const error = new Error(message);
    error.details = payload?.errors;
    throw error;
  }

  return payload;
}

