import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProfile, loginRequest, registerRequest } from "../api/auth";
import AuthContext from "./AuthContext";

const STORAGE_KEY = "tutorhive_session";

function persistSession(token) {
  localStorage.setItem(STORAGE_KEY, token);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      if (!token) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetchProfile(token);
        if (isMounted) {
          setUser(response.user);
        }
      } catch {
        clearSession();
        if (isMounted) {
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    hydrate();

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

export default AuthProvider;

