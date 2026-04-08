import type { Attendance } from "../../types";

export function getAttendanceWidgetTitle(attendance: Attendance | null) {
  if (!attendance) {
    return "Not marked";
  }

  if (attendance.status === "LEAVE") {
    return "On leave";
  }

  if (attendance.checkOutTime) {
    return "Completed";
  }

  if (attendance.checkInTime) {
    return "Checked in";
  }

  if (attendance.status === "HALF_DAY") {
    return "Half day";
  }

  if (attendance.status === "ABSENT") {
    return "Absent";
  }

  return attendance.status;
}

export function formatWorkedDuration(workedMinutes?: number) {
  if (!workedMinutes || workedMinutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}
