import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../services/api";

const SNOOZE_KEY = "hrms_break_snooze_until";

export function useBreakReminder(token: string | null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);

  // Check for the trigger in URL (from notification click)
  useEffect(() => {
    if (searchParams.get("triggerBreak") === "true") {
      setShowModal(true);
      // Clean up URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("triggerBreak");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Check for Snooze timer
  useEffect(() => {
    const checkSnooze = () => {
      const snoozeUntil = localStorage.getItem(SNOOZE_KEY);
      if (snoozeUntil) {
        const until = parseInt(snoozeUntil, 10);
        if (Date.now() >= until) {
          localStorage.removeItem(SNOOZE_KEY);
          setShowModal(true);
          // Show a fresh browser notification as well for "Re-trigger"
          if (Notification.permission === "granted") {
             new Notification("☕ Break Reminder (Snoozed)", {
               body: "Your 5-minute snooze is over. Time for that break!",
               icon: "/logo192.png"
             });
          }
        }
      }
    };

    const interval = setInterval(checkSnooze, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  const startBreak = useCallback(async () => {
    if (!token) return;
    await apiRequest("/attendance/break/start", { method: "POST", token });
    // Notify app to refresh (Navbar/Attendance list)
    window.dispatchEvent(new CustomEvent("break-updated"));
    setShowModal(false);
  }, [token]);

  const snoozeBreak = useCallback(() => {
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, fiveMinutesFromNow.toString());
    setShowModal(false);
  }, []);

  const dismissBreak = useCallback(() => {
    setShowModal(false);
    localStorage.removeItem(SNOOZE_KEY);
  }, []);

  return {
    showModal,
    startBreak,
    snoozeBreak,
    dismissBreak
  };
}
