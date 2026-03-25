import "./AttendanceQuickAction.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { apiRequest } from "../../services/api";
import type { Attendance } from "../../types";
import { ATTENDANCE_EVENT, dispatchAttendanceUpdated, getSelfAttendanceActionState } from "./attendanceQuickActionUtils";

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

  const loadAttendance = useCallback(async () => {
    if (!currentEmployeeId) {
      setAttendanceToday(null);
      onStateChange?.(null);
      return;
    }

    try {
      const response = await apiRequest<SelfDashboardData>("/dashboard/employee", { token });
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
    const handleAttendanceUpdated = () => {
      void loadAttendance();
    };

    window.addEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
    return () => window.removeEventListener(ATTENDANCE_EVENT, handleAttendanceUpdated);
  }, [loadAttendance]);

  const actionState = useMemo(() => getSelfAttendanceActionState(attendanceToday), [attendanceToday]);

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
      await apiRequest(actionState.actionPath, {
        method: "POST",
        token,
        body: {},
      });
      await loadAttendance();
      dispatchAttendanceUpdated();
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentEmployeeId) {
    return null;
  }

  return (
    <>
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
      <Modal open={confirmOpen} title="Confirm check out" onClose={() => setConfirmOpen(false)}>
        <div className="stack attendance-quick-action-confirm">
          <p className="muted">Are you sure you want to check out for today? This will complete today&apos;s attendance entry.</p>
          <div className="button-row">
            <button
              type="button"
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
