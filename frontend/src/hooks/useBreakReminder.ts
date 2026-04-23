import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api";

const SNOOZE_KEY = "hrms_break_snooze_until";

export function useBreakReminder(token: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);

  const clearSnooze = useCallback(() => {
    localStorage.removeItem(SNOOZE_KEY);
  }, []);

  // Check for the trigger in URL (from notification click)
  useEffect(() => {
    const handleTrigger = async () => {
      if (searchParams.get("triggerBreak") === "true") {
        // Only show if not already on break
        try {
          const res = await apiRequest<{ breakSessions: any[] }>("/attendance/break/today", { token });
          const hasActiveBreak = (res.data?.breakSessions ?? []).some(s => !s.endTime);
          
          if (!hasActiveBreak) {
            setShowModal(true);
          } else {
            // Already on break, just clear any old snoozes
            clearSnooze();
          }
        } catch {
          setShowModal(true); // Fallback to show if API fails
        }

        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("triggerBreak");
        setSearchParams(newParams, { replace: true });
      }
    };

    if (token) handleTrigger();
  }, [searchParams, setSearchParams, token, clearSnooze]);

  // Check for Snooze timer
  useEffect(() => {
    const checkSnooze = () => {
      const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
      if (snoozeUntil) {
        const until = parseInt(snoozeUntil, 10);
        if (Date.now() >= until) {
          clearSnooze();
          setShowModal(true);
          // Show a fresh browser notification
          if (Notification.permission === "granted") {
             new Notification("☕ Break Reminder (Snoozed)", {
               body: "Time for that break!",
               icon: "/favicon.svg"
             });
          }
        }
      }
    };

    const interval = setInterval(checkSnooze, 10000); 
    return () => clearInterval(interval);
  }, [clearSnooze]);

  const startBreak = useCallback(async () => {
    if (!token) return;
    await apiRequest("/attendance/break/start", { method: "POST", token });
    clearSnooze();
    // Notify app to refresh (Navbar/Attendance list)
    window.dispatchEvent(new CustomEvent("break-updated"));
    setShowModal(false);
  }, [token, clearSnooze]);

  const snoozeBreak = useCallback((minutes: number = 5) => {
    const snoozeTime = Date.now() + minutes * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, snoozeTime.toString());
    setShowModal(false);
  }, []);

  const dismissBreak = useCallback(() => {
    setShowModal(false);
    clearSnooze();
  }, [clearSnooze]);

  // Listen for global break updates to clear snooze
  useEffect(() => {
    const handleGlobalUpdate = () => clearSnooze();
    window.addEventListener("break-updated", handleGlobalUpdate);
    return () => window.removeEventListener("break-updated", handleGlobalUpdate);
  }, [clearSnooze]);

  return {
    showModal,
    startBreak,
    snoozeBreak,
    dismissBreak
  };
}
