import { OvertimeStatus } from "@prisma/client";
import { startOfDay } from "../../utils/dates.js";

export function calculateOvertimeDuration(startTime: Date, endTime: Date): number {
  return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60)));
}

export function getOvertimeSessionTodayForEmployee(employeeId: number) {
  const today = startOfDay(new Date());
  return {
    employeeId,
    date: today,
  };
}

export function isOvertimeEligible(checkOutTime?: Date | null): boolean {
  // Employee must have completed regular checkout to start overtime
  return !!checkOutTime;
}

export function getOvertimeStatusForDisplay(status: OvertimeStatus) {
  switch (status) {
    case OvertimeStatus.ACTIVE:
      return "In Progress";
    case OvertimeStatus.COMPLETED:
      return "Completed";
    case OvertimeStatus.PENDING_VERIFICATION:
      return "Pending Verification";
    case OvertimeStatus.VERIFIED:
      return "Verified";
    case OvertimeStatus.REJECTED:
      return "Rejected";
    default:
      return "Unknown";
  }
}

export function formatOvertimeDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours} hr`;
  } else {
    return `${hours} hr ${mins} min`;
  }
}

export function getMonthlyOvertimeHours(overtimeSessions: Array<{ duration?: number | null; status: OvertimeStatus }>): number {
  const verifiedSessions = overtimeSessions.filter(session => 
    session.status === OvertimeStatus.VERIFIED && session.duration
  );
  
  const totalMinutes = verifiedSessions.reduce((sum, session) => sum + (session.duration || 0), 0);
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimal places
}
