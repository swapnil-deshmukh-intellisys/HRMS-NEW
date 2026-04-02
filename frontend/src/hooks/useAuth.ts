import { useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";

const TOKEN_KEY = "hrms_token";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [skipSessionFetch, setSkipSessionFetch] = useState(false);

  useEffect(() => {
    if (!token) {
      setSessionUser(null);
      setLoadingSession(false);
      setSkipSessionFetch(false);
      localStorage.removeItem(TOKEN_KEY);
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);

    if (skipSessionFetch) {
      setSkipSessionFetch(false);
      setLoadingSession(false);
      return;
    }

    setLoadingSession(true);

    apiRequest<SessionUser>("/auth/me", { token })
      .then((response) => setSessionUser(response.data))
      .catch(() => {
        setToken(null);
        setSessionUser(null);
      })
      .finally(() => setLoadingSession(false));
  }, [skipSessionFetch, token]);

  function login(nextToken: string, nextUser?: SessionUser | null) {
    if (nextUser !== undefined) {
      setSkipSessionFetch(true);
    }
    setToken(nextToken);
    if (nextUser !== undefined) {
      setSessionUser(nextUser);
      setLoadingSession(false);
    }
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
