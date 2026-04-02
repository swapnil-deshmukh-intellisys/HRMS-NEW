import "./AttendanceQuickAction.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { apiRequest } from "../../services/api";
import type { Attendance } from "../../types";
import { ATTENDANCE_EVENT, dispatchAttendanceUpdated, getAttendanceUpdatedDetail, getSelfAttendanceActionState } from "./attendanceQuickActionUtils";
import { formatAttendanceTime } from "../../utils/format";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadAttendance = useCallback(async () => {
    if (!currentEmployeeId) {
      setAttendanceToday(null);
      onStateChange?.(null);
      return;
    }

    try {
      const response = await apiRequest<SelfDashboardData>("/attendance/today", { token });
      const nextAttendance = response.data.attendanceToday ?? null;
      setAttendanceToday(nextAttendance);
      onStateChange?.(nextAttendance);
    } catch {
      setAttendanceToday(null);
      onStateChange?.(null);
    }
  }, [currentEmployeeId, onStateChange, token]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    const handleAttendanceUpdated = (event: Event) => {
      const detail = getAttendanceUpdatedDetail(event);

      if (detail) {
        setAttendanceToday(detail.attendanceToday);
        onStateChange?.(detail.attendanceToday);
        return;
      }

      void loadAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [loadAttendance, onStateChange]);

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

    if (actionState.requiresConfirmation) {
      setConfirmOpen(true);
      return;
    }

    await submitAction();
  }

  async function submitAction() {
    if (!actionState.actionPath || actionState.disabled || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiRequest<Attendance>(actionState.actionPath, {
        method: "POST",
        token,
        body: {},
      });
      const nextAttendance = response.data;
      setAttendanceToday(nextAttendance);
      onStateChange?.(nextAttendance);
      dispatchAttendanceUpdated(nextAttendance);
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
      </div>
      <Modal open={confirmOpen} title="Confirm check out" onClose={() => setConfirmOpen(false)}>
        <div className="stack attendance-quick-action-confirm">
          <p className="muted">Are you sure you want to check out for today? This will complete today&apos;s attendance entry.</p>
          <div className="button-row">
            <button
              type="button"
              className="attendance-quick-action-confirm-button"
              onClick={() => {
                setConfirmOpen(false);
                void submitAction();
              }}
            >
              Confirm check out
            </button>
            <button type="button" className="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
