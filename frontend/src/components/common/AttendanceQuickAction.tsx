import "./AttendanceQuickAction.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../../services/api";
import type { Attendance } from "../../types";
import { ATTENDANCE_EVENT, dispatchAttendanceUpdated, getAttendanceUpdatedDetail, getSelfAttendanceActionState } from "./attendanceQuickActionUtils";
import { formatAttendanceTime } from "../../utils/format";
import { useAuth } from "../../hooks/useAuth";
import Modal from "./Modal";

type AttendanceQuickActionProps = {
  token: string | null;
  currentEmployeeId: number | null;
  className?: string;
  size?: "compact" | "default";
  onStateChange?: (attendance: Attendance | null) => void;
};

type SelfDashboardData = {
  attendanceToday?: Attendance | null;
};

export default function AttendanceQuickAction({
  token,
  currentEmployeeId,
  className = "",
  size = "default",
  onStateChange,
}: AttendanceQuickActionProps) {
  const [attendanceToday, setAttendanceToday] = useState<Attendance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [todaysUpdateInput, setTodaysUpdateInput] = useState("");
  const latestLoadRequestRef = useRef(0);
  const attendanceVersionRef = useRef(0);
  const { refreshSession, updateLastActivity } = useAuth();

  const syncAttendanceState = useCallback(
    (nextAttendance: Attendance | null) => {
      setAttendanceToday(nextAttendance);
      onStateChange?.(nextAttendance);
    },
    [onStateChange],
  );

  const loadAttendance = useCallback(async () => {
    if (!currentEmployeeId) {
      syncAttendanceState(null);
      return;
    }

    const requestId = ++latestLoadRequestRef.current;
    const versionAtStart = attendanceVersionRef.current;

    try {
      const response = await apiRequest<SelfDashboardData>("/attendance/today", { token });
      if (requestId !== latestLoadRequestRef.current || versionAtStart !== attendanceVersionRef.current) {
        return;
      }

      const nextAttendance = response.data.attendanceToday ?? null;
      syncAttendanceState(nextAttendance);
    } catch {
      if (requestId !== latestLoadRequestRef.current || versionAtStart !== attendanceVersionRef.current) {
        return;
      }
    }
  }, [currentEmployeeId, syncAttendanceState, token]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);

      if (detail) {
        attendanceVersionRef.current += 1;
        syncAttendanceState(detail.attendanceToday);
        return;
      }

      void loadAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [loadAttendance, syncAttendanceState]);

  useEffect(() => {
    if (!attendanceToday?.checkInTime || attendanceToday.checkOutTime) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, [attendanceToday?.checkInTime, attendanceToday?.checkOutTime]);

  const actionState = useMemo(() => getSelfAttendanceActionState(attendanceToday), [attendanceToday]);

  const liveWorkedDuration = useMemo(() => {
    if (!attendanceToday?.checkInTime || attendanceToday.checkOutTime) {
      return null;
    }

    const checkInTime = new Date(attendanceToday.checkInTime).getTime();
    const workedMinutes = Math.max(0, Math.floor((now - checkInTime) / 60000));
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h`;
    }

    return `${minutes}m`;
  }, [attendanceToday?.checkInTime, attendanceToday?.checkOutTime, now]);
  async function handleClick() {
    if (!actionState.actionPath || actionState.disabled || submitting) {
      return;
    }

    if (actionState.label === "Check out") {
      setShowCheckoutModal(true);
      return;
    }

    if (actionState.requiresConfirmation) {
      const confirmMessage = `Are you sure you want to ${actionState.label.toLowerCase()} for today? This will start your attendance timer for the day.`;

      if (window.confirm(confirmMessage)) {
        await submitAction();
      }
      return;
    }

    await submitAction();
  }

  async function handleCheckoutSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!todaysUpdateInput.trim()) {
      setActionError("Please provide an update on what you worked on today.");
      return;
    }
    await submitAction({ todaysUpdate: todaysUpdateInput });
    setShowCheckoutModal(false);
    setTodaysUpdateInput("");
  }

  async function submitAction(body: Record<string, any> = {}) {
    if (!actionState.actionPath || actionState.disabled || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setActionError("");
      attendanceVersionRef.current += 1;
      
      // Update last activity before making the request
      updateLastActivity();
      
      const response = await apiRequest<Attendance>(actionState.actionPath, {
        method: "POST",
        token,
        body,
      });
      const nextAttendance = response.data;
      syncAttendanceState(nextAttendance);
      dispatchAttendanceUpdated(nextAttendance);
      void loadAttendance();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update attendance.";
      
      // Check if it's a session-related error
      if (errorMessage.includes('500') || errorMessage.includes('Internal server error') || 
          errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setActionError("Session expired or server error. Please refresh the page and try again.");
        // Try to refresh session
        try {
          await refreshSession();
        } catch (sessionError) {
          console.error('Session refresh failed:', sessionError);
        }
      } else {
        setActionError(errorMessage);
      }
      
      await loadAttendance();
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentEmployeeId) {
    return null;
  }

  return (
    <>
      <div className={`attendance-quick-action-wrap attendance-quick-action-wrap--${size}`.trim()}>
        {attendanceToday?.checkInTime && !attendanceToday.checkOutTime ? (
          <div className="attendance-quick-action-meta" aria-live="polite">
            <span className="attendance-quick-action-meta__time">In {formatAttendanceTime(attendanceToday.checkInTime)}</span>
            <strong className="attendance-quick-action-meta__worked">{liveWorkedDuration}</strong>
          </div>
        ) : null}
        <button
          type="button"
          className={`attendance-quick-action attendance-quick-action--${size} ${actionState.toneClass} ${className}`.trim()}
          onClick={handleClick}
          disabled={actionState.disabled || submitting}
          aria-label={actionState.hint}
          title={actionState.hint}
        >
          {submitting ? "Updating..." : actionState.label}
        </button>
        {actionError ? (
          <p className="attendance-quick-action-error" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      <Modal
        open={showCheckoutModal}
        onClose={() => {
          setShowCheckoutModal(false);
          setTodaysUpdateInput("");
          setActionError("");
        }}
        title="Check out"
        className="checkout-modal"
      >
        <form onSubmit={handleCheckoutSubmit} className="stack">
          <p className="muted" style={{ fontSize: '14px', marginBottom: '8px' }}>
            Great job today! Please briefly mention what you worked on before checking out.
          </p>
          <label>
            Today's Update
            <textarea
              value={todaysUpdateInput}
              onChange={(e) => setTodaysUpdateInput(e.target.value)}
              placeholder="e.g. Worked on the dashboard refactoring and fixed 3 bugs in the attendance module."
              required
              rows={4}
              style={{ 
                resize: 'none',
                padding: '12px',
                borderRadius: '12px',
                border: '1.5px solid var(--color-border-default)',
                fontSize: '14px',
                lineHeight: '1.6',
                background: 'rgba(255, 255, 255, 0.5)'
              }}
              autoFocus
            />
          </label>
          <div className="button-row" style={{ marginTop: '8px', justifyContent: 'flex-end', display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShowCheckoutModal(false);
                setTodaysUpdateInput("");
                setActionError("");
              }}
              disabled={submitting}
              style={{ minWidth: '100px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ minWidth: '120px' }}
            >
              {submitting ? "Checking out..." : "Finalize & Out"}
            </button>
          </div>
          {actionError ? (
            <p className="error-text" style={{ marginTop: '12px' }}>{actionError}</p>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
