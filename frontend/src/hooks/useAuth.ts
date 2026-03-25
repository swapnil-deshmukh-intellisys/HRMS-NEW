import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";

const TOKEN_KEY = "hrms_token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setSessionUser(null);
      setLoadingSession(false);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
    setLoadingSession(true);

    apiRequest<SessionUser>("/auth/me", { token })
      .then((response) => setSessionUser(response.data))
      .catch(() => {
        setToken(null);
        setSessionUser(null);
      })
      .finally(() => setLoadingSession(false));
  }, [token]);

  function login(nextToken: string) {
    setToken(nextToken);
  }

  async function logout() {
    if (token) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token });
      } catch {
        // Keep logout resilient for stateless auth.
      }
    }

    setToken(null);
    setSessionUser(null);
  }

  return {
    token,
    sessionUser,
    loadingSession,
    login,
    logout,
  };
}
