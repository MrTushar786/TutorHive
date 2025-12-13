import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { fetchProfile, loginRequest, registerRequest } from "../api/auth";

export const AuthContext = createContext(null);

const STORAGE_KEY = "tutorhive_session";

function persistSession(token) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (e) {
    console.warn("Failed to save session:", e);
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear session:", e);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to load session:", e);
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    let isMounted = true;

    fetchProfile(token)
      .then((response) => {
        if (isMounted) {
          setUser(response.user);
        }
      })
      .catch(() => {
        clearSession();
        setToken(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAuthSuccess = useCallback((payload) => {
    setUser(payload.user);
    setToken(payload.token);
    persistSession(payload.token);
  }, []);

  const login = useCallback(
    async (credentials) => {
      setError(null);
      const payload = await loginRequest(credentials);
      handleAuthSuccess(payload);
      return payload;
    },
    [handleAuthSuccess]
  );

  const register = useCallback(
    async (formData) => {
      setError(null);
      const payload = await registerRequest(formData);
      handleAuthSuccess(payload);
      return payload;
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      setError,
      login,
      register,
      logout,
    }),
    [user, token, loading, error, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

