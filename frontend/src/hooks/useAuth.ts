import { useEffect, useState, useCallback, useRef } from "react";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";

const TOKEN_KEY = "hrms_token";
const SESSION_TIMEOUT_KEY = "hrms_session_timeout";
const LAST_ACTIVITY_KEY = "hrms_last_activity";
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_DURATION = 10 * 60 * 60 * 1000; // 10 hours

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [sessionWarning, setSessionWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(() => {
    const saved = localStorage.getItem(LAST_ACTIVITY_KEY);
    return saved ? parseInt(saved) : Date.now();
  });

  // Reference for retry count to avoid messy nested timeouts
  const retryCount = useRef(0);

  // Track if we have initiated the initial session check
  const hasFetched = useRef(false);

  // Sync token to localStorage and reset fetch state when token is cleared
  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_TIMEOUT_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      hasFetched.current = false; // Reset for next login
    }
  }, [token]);

  // Update last activity with throttling to protect localStorage performance
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    setLastActivity(now);
    // Only write to localStorage at most once every 2 seconds
    const lastSaved = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastSaved || now - parseInt(lastSaved) > 2000) {
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    }
  }, []);

  // Global listeners for user activity
  useEffect(() => {
    if (!token) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => updateLastActivity();
    
    events.forEach(event => window.addEventListener(event, handler));
    return () => events.forEach(event => window.removeEventListener(event, handler));
  }, [token, updateLastActivity]);

  // Set session timeout expiry marker
  const setSessionTimeout = useCallback(() => {
    const expiryTime = Date.now() + SESSION_DURATION;
    localStorage.setItem(SESSION_TIMEOUT_KEY, expiryTime.toString());
  }, []);

  // Logout clears state IMMEDIATELY for responsiveness
  const logout = useCallback(async () => {
    const currentToken = token;
    
    // Clear local state first
    setToken(null);
    setSessionUser(null);
    setSessionWarning(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);

    // Call API in background if we had a token
    if (currentToken) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token: currentToken });
      } catch (err) {
        console.warn("Logout API failed, but local session cleared", err);
      }
    }
  }, [token]);

  // Re-fetch user session data
  const fetchSession = useCallback(async (isRetry = false) => {
    if (!token) return;

    try {
      setLoadingSession(true);
      const response = await apiRequest<SessionUser>("/auth/me", { token });
      setSessionUser(response.data);
      setSessionTimeout();
      retryCount.current = 0; // Reset on success
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
      const willRetry = retryCount.current > 0 && retryCount.current <= 2;
      if (!isRetry && !willRetry) {
        setLoadingSession(false);
      } else if (isRetry) {
        setLoadingSession(false);
      }
    }
  }, [token, logout, setSessionTimeout]);

  // Periodic session checker
  useEffect(() => {
    if (!token) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      
      // 1. Check absolute session timeout
      const sessionTimeout = localStorage.getItem(SESSION_TIMEOUT_KEY);
      if (sessionTimeout) {
        const expiryTime = parseInt(sessionTimeout);
        const timeUntilExpiry = expiryTime - now;

        if (timeUntilExpiry <= 0) {
          console.log("Absolute session duration exceeded");
          logout();
          return;
        }

        // Show warning 5 minutes before
        setSessionWarning(timeUntilExpiry <= WARNING_THRESHOLD);
      }

      // 2. Check inactivity timeout
      if (now - lastActivity >= SESSION_DURATION) {
        console.log("Inactivity timeout exceeded");
        logout();
      }
    }, 15000); // Check every 15 seconds for responsiveness

    return () => clearInterval(checkInterval);
  }, [token, lastActivity, logout]);

  // Initial load
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
