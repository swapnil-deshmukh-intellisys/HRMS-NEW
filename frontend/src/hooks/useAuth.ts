import { useEffect, useState, useCallback, useRef } from "react";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";
import { TIMEZONE } from "../utils/format";

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
  const [connectionError, setConnectionError] = useState(false);
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
    const now = new Date();
    const nowInIst = toZonedTime(now, TIMEZONE);
    const targetInIst = new Date(nowInIst);
    targetInIst.setHours(8, 0, 0, 0);

    // If it is already past 8:00 AM IST today, set target to tomorrow at 8:00 AM IST
    if (nowInIst.getTime() >= targetInIst.getTime()) {
      targetInIst.setDate(targetInIst.getDate() + 1);
    }

    // Early morning buffer: if within 2 hours of 8:00 AM IST, push to tomorrow's 8:00 AM IST
    if (targetInIst.getTime() - nowInIst.getTime() < 2 * 60 * 60 * 1000) {
      targetInIst.setDate(targetInIst.getDate() + 1);
    }

    // Convert target back to standard UTC timestamp
    const targetUtc = fromZonedTime(targetInIst, TIMEZONE);
    localStorage.setItem(SESSION_TIMEOUT_KEY, targetUtc.getTime().toString());
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
    const tokenBeingVerified = token;

    // Use global request cache to prevent redundant calls from multiple components
    if (activeSessionRequests.has(token) && !isRetry) {
      try {
        const response = await activeSessionRequests.get(token);
        if (localStorage.getItem(TOKEN_KEY) !== tokenBeingVerified) return;
        setSessionUser(response.data);
        setLoadingSession(false);
        return;
      } catch (err) {
        // Fall through to actual request if cached promise fails
      }
    }

    try {
      setLoadingSession(true);
      const requestPromise = apiRequest<{
        user: SessionUser;
        summary: any;
        notifications: any[];
      }>("/system/bootstrap", { token });
      
      // Store in global map
      activeSessionRequests.set(token, requestPromise);
      
      const response = await requestPromise;
      
      if (localStorage.getItem(TOKEN_KEY) !== tokenBeingVerified) {
        console.warn("Discarding auth check result: token has changed since request started.");
        return;
      }
      
      // Store the bootstrap data globally so AppProvider can pick it up without re-fetching
      (window as any).__HRMS_BOOTSTRAP_DATA__ = response.data;

      setSessionUser(response.data.user);
      setSessionTimeout();
      retryCount.current = 0;
      if (connectionError) {
        console.log("[AUTH] Connection restored! Dispatching hrms-reconnected event.");
        window.dispatchEvent(new Event("hrms-reconnected"));
      }
      setConnectionError(false);
    } catch (error: any) {
      if (localStorage.getItem(TOKEN_KEY) !== tokenBeingVerified) {
        console.warn("Discarding auth check failure: token has changed since request started.");
        return;
      }

      const isTransientError = 
        !error.status || 
        error.status >= 500 || 
        error.message?.includes('500') || 
        error.message?.includes('Network Error') || 
        error.message?.includes('Failed to fetch');

      if (isTransientError) {
        setConnectionError(true);
        // Exponential backoff capped at 30 seconds
        const delay = Math.min(2000 * Math.pow(2, retryCount.current), 30000);
        retryCount.current++;
        console.warn(`Transient server error during bootstrap, retrying in ${delay}ms (retry #${retryCount.current})...`);
        setTimeout(() => fetchSession(true), delay);
      } else {
        console.error("Session verification failed with non-transient error, logging out:", error.message);
        logout();
      }
    } finally {
      activeSessionRequests.delete(tokenBeingVerified); // Cleanup when done
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
      } else {
        setSessionTimeout();
      }
    }, 15000);
    return () => clearInterval(checkInterval);
  }, [token, lastActivity, logout, setSessionTimeout]);

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
    connectionError,
    login,
    logout,
    refreshSession,
    updateLastActivity,
  };
}
