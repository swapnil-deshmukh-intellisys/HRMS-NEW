import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "../services/api";
import type { SessionUser } from "../types";

const TOKEN_KEY = "hrms_token";
const SESSION_TIMEOUT_KEY = "hrms_session_timeout";
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(token));
  const [skipSessionFetch, setSkipSessionFetch] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(() => Date.now());

  // Update last activity on user interaction
  const updateLastActivity = useCallback(() => {
    setLastActivity(Date.now());
    localStorage.setItem('hrms_last_activity', Date.now().toString());
  }, []);

  // Check if session is expired
  const isSessionExpired = useCallback(() => {
    const sessionTimeout = localStorage.getItem(SESSION_TIMEOUT_KEY);
    if (!sessionTimeout) return false;
    
    const expiryTime = parseInt(sessionTimeout);
    return Date.now() >= expiryTime;
  }, []);

  // Set session timeout
  const setSessionTimeout = useCallback(() => {
    const expiryTime = Date.now() + SESSION_DURATION;
    localStorage.setItem(SESSION_TIMEOUT_KEY, expiryTime.toString());
    setLastActivity(Date.now());
  }, []);

  // Manual logout function
  const logout = useCallback(async () => {
    if (token) {
      try {
        await apiRequest("/auth/logout", { method: "POST", token });
      } catch {
        // Keep logout resilient for stateless auth.
      }
    }

    setToken(null);
    setSessionUser(null);
    setSessionWarning(false);
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
    localStorage.removeItem('hrms_last_activity');
  }, [token]);

  // Handle session expiry
  const handleSessionExpiry = useCallback(() => {
    console.log('Session expired, logging out...');
    logout();
    // Clear all session-related data
    localStorage.removeItem(SESSION_TIMEOUT_KEY);
    localStorage.removeItem('hrms_last_activity');
  }, [logout]);

  // Check session status periodically
  useEffect(() => {
    if (!token) return;

    const checkSession = () => {
      if (isSessionExpired()) {
        handleSessionExpiry();
        return;
      }

      // Check for inactivity timeout
      const inactivityDuration = Date.now() - lastActivity;
      if (inactivityDuration >= SESSION_DURATION) {
        handleSessionExpiry();
        return;
      }

      // Show warning 5 minutes before expiry
      const sessionTimeout = localStorage.getItem(SESSION_TIMEOUT_KEY);
      if (sessionTimeout) {
        const expiryTime = parseInt(sessionTimeout);
        const timeUntilExpiry = expiryTime - Date.now();
        
        if (timeUntilExpiry <= WARNING_THRESHOLD && timeUntilExpiry > 0) {
          setSessionWarning(true);
        } else {
          setSessionWarning(false);
        }
      }
    };

    const interval = setInterval(checkSession, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [token, lastActivity, isSessionExpired, handleSessionExpiry]);

  useEffect(() => {
    if (!token) {
      setSessionUser(null);
      setLoadingSession(false);
      setSkipSessionFetch(false);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESSION_TIMEOUT_KEY);
      localStorage.removeItem('hrms_last_activity');
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);

    if (skipSessionFetch) {
      setSkipSessionFetch(false);
      setLoadingSession(false);
      setSessionTimeout();
      return;
    }

    setLoadingSession(true);

    apiRequest<SessionUser>("/auth/me", { token })
      .then((response) => {
        setSessionUser(response.data);
        setSessionTimeout();
      })
      .catch((error) => {
        console.error('Auth check failed:', error);
        // Check if it's a 500 error (server issue) vs auth error
        if (error.message?.includes('500') || error.message?.includes('Internal server error')) {
          // Server error - don't logout immediately, retry after delay
          setTimeout(() => {
            if (token) {
              apiRequest<SessionUser>("/auth/me", { token })
                .then((response) => {
                  setSessionUser(response.data);
                  setSessionTimeout();
                })
                .catch(() => {
                  // Second failure, logout
                  setToken(null);
                  setSessionUser(null);
                  localStorage.removeItem(SESSION_TIMEOUT_KEY);
                  localStorage.removeItem('hrms_last_activity');
                })
                .finally(() => setLoadingSession(false));
            }
          }, 5000); // Retry after 5 seconds
        } else {
          // Auth error - logout immediately
          setToken(null);
          setSessionUser(null);
          localStorage.removeItem(SESSION_TIMEOUT_KEY);
          localStorage.removeItem('hrms_last_activity');
        }
      })
      .finally(() => setLoadingSession(false));
  }, [skipSessionFetch, token, setSessionTimeout]);

  function login(nextToken: string, nextUser?: SessionUser | null) {
    if (nextUser !== undefined) {
      setSkipSessionFetch(true);
    }
    setToken(nextToken);
    if (nextUser !== undefined) {
      setSessionUser(nextUser);
      setLoadingSession(false);
      setSessionTimeout();
    }
  }



  // Manual session refresh
  const refreshSession = useCallback(async () => {
    if (!token) return;

    try {
      const response = await apiRequest<SessionUser>("/auth/me", { token });
      setSessionUser(response.data);
      setSessionTimeout();
      setSessionWarning(false);
    } catch (error) {
      console.error('Session refresh failed:', error);
      handleSessionExpiry();
    }
  }, [token, setSessionTimeout, handleSessionExpiry]);

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
