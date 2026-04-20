import type { Attendance } from "../../types";

export const ATTENDANCE_EVENT = "hrms:attendance-updated";

export type AttendanceUpdatedDetail = {
  attendanceToday: Attendance | null;
};

export function dispatchAttendanceUpdated(attendanceToday: Attendance | null = null) {
  window.dispatchEvent(
    new CustomEvent<AttendanceUpdatedDetail>(ATTENDANCE_EVENT, {
      detail: { attendanceToday },
    }),
  );
}

export function getAttendanceUpdatedDetail(event: Event) {
  return (event as CustomEvent<AttendanceUpdatedDetail>).detail ?? null;
}

export function getSelfAttendanceActionState(attendance: Attendance | null) {
  if (!attendance) {
    return {
      label: "Check in",
      actionPath: "/attendance/check-in" as const,
      disabled: false,
      toneClass: "attendance-quick-action--check-in",
      hint: "Mark today's attendance",
      requiresConfirmation: true,
    };
  }

  if (attendance.status === "LEAVE") {
    return {
      label: "On leave",
      actionPath: null,
      disabled: true,
      toneClass: "attendance-quick-action--leave",
      hint: "Approved leave for today",
      requiresConfirmation: false,
    };
  }

  if (attendance.status === "HALF_DAY" && !attendance.checkInTime && !attendance.checkOutTime) {
    return {
      label: "Half day",
      actionPath: null,
      disabled: true,
      toneClass: "attendance-quick-action--leave",
      hint: "Approved half-day leave for today",
      requiresConfirmation: false,
    };
  }

  if (attendance.status === "ABSENT") {
    return {
      label: "Marked absent",
      actionPath: null,
      disabled: true,
      toneClass: "attendance-quick-action--completed",
      hint: "Attendance is finalized as absent for today",
    };
  }

  if (attendance.checkOutTime) {
    return {
      label: "Completed",
      actionPath: null,
      disabled: true,
      toneClass: "attendance-quick-action--completed",
      hint: "Attendance completed for today",
      requiresConfirmation: false,
    };
  }

  if (attendance.checkInTime) {
    return {
      label: "Check out",
      actionPath: "/attendance/check-out" as const,
      disabled: false,
      toneClass: "attendance-quick-action--check-out",
      hint: "Finish today's attendance",
      requiresConfirmation: true,
    };
  }

  return {
    label: "Check in",
    actionPath: "/attendance/check-in" as const,
    disabled: false,
    toneClass: "attendance-quick-action--check-in",
    hint: "Mark today's attendance",
    requiresConfirmation: true,
  };
}
