import { useEffect, useState, useCallback, useRef } from "react";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";

const TOKEN_KEY = "hrms_token";
const SESSION_TIMEOUT_KEY = "hrms_session_timeout";
const LAST_ACTIVITY_KEY = "hrms_last_activity";
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

// Global cache to prevent multiple components from firing the same /auth/me request
// This prevents 429 Errors when multiple components on the same page use this hook.
const activeSessionRequests = new Map<string, Promise<any>>();

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [sessionWarning, setSessionWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(() => {
    const saved = localStorage.getItem(LAST_ACTIVITY_KEY);
    return saved ? parseInt(saved) : Date.now();
  });

  const retryCount = useRef(0);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_TIMEOUT_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      hasFetched.current = false;
    }
  }, [token]);

  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    const lastSaved = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastSaved || now - parseInt(lastSaved) > 2000) {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => updateLastActivity();
    events.forEach(event => window.addEventListener(event, handler));
    return () => events.forEach(event => window.removeEventListener(event, handler));
  }, [token, updateLastActivity]);

  const setSessionTimeout = useCallback(() => {
    const midnight = new Date();
    midnight.setHours(23, 59, 59, 999);
    localStorage.setItem(SESSION_TIMEOUT_KEY, midnight.getTime().toString());
  }, []);

  const logout = useCallback(async () => {
    const currentToken = token;
    setToken(null);
    setSessionUser(null);
    setSessionWarning(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);

    if (currentToken) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token: currentToken });
      } catch (err) {
        console.warn("Logout API failed, but local session cleared", err);
      }
    }
  }, [token]);

  const fetchSession = useCallback(async (isRetry = false) => {
    if (!token) return;

    // Use global request cache to prevent redundant calls from multiple components
    if (activeSessionRequests.has(token) && !isRetry) {
      try {
        const response = await activeSessionRequests.get(token);
        setSessionUser(response.data);
        setLoadingSession(false);
        return;
      } catch (err) {
        // Fall through to actual request if cached promise fails
      }
    }

    try {
      setLoadingSession(true);
      const requestPromise = apiRequest<SessionUser>("/auth/me", { token });
      
      // Store in global map
      activeSessionRequests.set(token, requestPromise);
      
      const response = await requestPromise;
      setSessionUser(response.data);
      setSessionTimeout();
      retryCount.current = 0;
    } catch (error: any) {
      const isServerError = error.message?.includes('500') || error.status === 500;
      
      if (isServerError && retryCount.current < 2) {
        retryCount.current++;
        console.warn(`Server error during auth check, retry #${retryCount.current}/2...`);
        setTimeout(() => fetchSession(true), 5000);
      } else {
        console.error("Session verification failed, logging out:", error.message);
        logout();
      }
    } finally {
      activeSessionRequests.delete(token); // Cleanup when done
      setLoadingSession(false);
    }
  }, [token, logout, setSessionTimeout]);

  useEffect(() => {
    if (!token) return;
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const sessionTimeout = localStorage.getItem(SESSION_TIMEOUT_KEY);
      if (sessionTimeout) {
        const expiryTime = parseInt(sessionTimeout);
        if (expiryTime - now <= 0) {
          logout();
          return;
        }
        setSessionWarning(expiryTime - now <= WARNING_THRESHOLD);
      }
      const nowEndOfDay = new Date();
      nowEndOfDay.setHours(23, 59, 59, 999);
      if (now >= nowEndOfDay.getTime()) {
        logout();
      }
    }, 15000);
    return () => clearInterval(checkInterval);
  }, [token, lastActivity, logout]);

  useEffect(() => {
    if (token && !sessionUser && !hasFetched.current) {
      hasFetched.current = true;
      fetchSession();
    }
  }, [token, sessionUser, fetchSession]);

  const login = useCallback((nextToken: string, user?: SessionUser | null) => {
    setToken(nextToken);
    if (user) setSessionUser(user);
    setSessionTimeout();
    updateLastActivity();
  }, [setSessionTimeout, updateLastActivity]);

  const refreshSession = useCallback(() => fetchSession(), [fetchSession]);

  return {
    token,
    sessionUser,
    loadingSession,
    sessionWarning,
    login,
    logout,
    refreshSession,
    updateLastActivity,
  };
}
