import { useState, useEffect, useCallback } from "react";
import { Coffee } from "lucide-react";
import { apiRequest } from "../../services/api";
import "./BreakQuickAction.css";

type BreakSession = {
  id: number;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
};

type BreakQuickActionProps = {
  token: string | null;
  isCheckedIn: boolean;
  isCheckedOut: boolean;
};

export default function BreakQuickAction({ token, isCheckedIn, isCheckedOut }: BreakQuickActionProps) {
  const [activeBreak, setActiveBreak] = useState<BreakSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds on break

  const loadTodayBreaks = useCallback(async () => {
    if (!token || !isCheckedIn) return;
    try {
      const res = await apiRequest<{ breakSessions: BreakSession[] }>("/attendance/break/today", { token });
      const sessions: BreakSession[] = res.data?.breakSessions ?? [];
      const open = sessions.find((s) => !s.endTime) ?? null;
      setActiveBreak(open);
    } catch {
      // silently ignore
    }
  }, [token, isCheckedIn]);

  useEffect(() => {
    loadTodayBreaks();
    
    // Listen for updates from other parts of the app (e.g., BreakReminderModal)
    const handleUpdate = () => loadTodayBreaks();
    window.addEventListener("break-updated", handleUpdate);
    return () => window.removeEventListener("break-updated", handleUpdate);
  }, [loadTodayBreaks]);

  // Live elapsed counter when on break
  useEffect(() => {
    if (!activeBreak) { setElapsed(0); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(activeBreak.startTime).getTime()) / 1000);
      setElapsed(Math.max(0, secs));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeBreak]);

  async function handleBreakToggle() {
    if (!token || loading) return;
    setLoading(true);
    try {
      if (activeBreak) {
        await apiRequest("/attendance/break/end", { method: "POST", token });
        setActiveBreak(null);
      } else {
        const res = await apiRequest<BreakSession>("/attendance/break/start", { method: "POST", token });
        setActiveBreak(res.data ?? null);
        // NEW: Clear any pending break reminder snoozes if user manually starts it
        localStorage.removeItem("hrms_break_snooze_until");
      }
      // Notify other components
      window.dispatchEvent(new CustomEvent("break-updated"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Break action failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  // Hide if not checked in or already checked out
  if (!isCheckedIn || isCheckedOut) return null;

  const fmtElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const isOnBreak = Boolean(activeBreak);

  return (
    <button
      className={`break-btn ${isOnBreak ? "break-btn--active" : ""}`}
      onClick={handleBreakToggle}
      disabled={loading}
      title={isOnBreak ? "Click to end break" : "Click to start a break"}
    >
      <Coffee size={15} strokeWidth={2.2} />
      <span className="break-btn__label">
        {loading
          ? "..."
          : isOnBreak
          ? `On Break · ${fmtElapsed(elapsed)}`
          : "Break"}
      </span>
      {isOnBreak && <span className="break-btn__dot" />}
    </button>
  );
}
