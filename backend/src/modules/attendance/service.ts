import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "../../utils/dates.js";

type ActiveEmployee = {
  id: number;
  joiningDate: Date;
};

type AttendanceFinalizationDeps = {
  findActiveEmployees: () => Promise<ActiveEmployee[]>;
  findEmployeeIdsWithAttendance: (attendanceDate: Date) => Promise<number[]>;
  findEmployeeIdsWithApprovedLeave: (attendanceDate: Date) => Promise<number[]>;
  createAbsentAttendances: (entries: Array<{ employeeId: number; attendanceDate: Date; status: AttendanceStatus }>) => Promise<number>;
};

export function parseAttendanceDateInput(date?: string) {
  if (!date) {
    return startOfDay(new Date());
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error("Invalid date format");
  }

  const [, year, month, day] = match;
  return startOfDay(new Date(Number(year), Number(month) - 1, Number(day)));
}

export function combineAttendanceDateAndTime(attendanceDate: Date, time?: string | null) {
  if (!time) {
    return null;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) {
    throw new Error("Invalid time format");
  }

  const [, hours, minutes] = match;
  const combined = startOfDay(attendanceDate);
  combined.setHours(Number(hours), Number(minutes), 0, 0);
  return combined;
}

export function calculateWorkedMinutes(checkInTime?: Date | null, checkOutTime?: Date | null) {
  if (!checkInTime || !checkOutTime) {
    return 0;
  }

  return Math.max(0, Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60)));
}

export function getRegularizedAttendanceStatus(checkInTime?: Date | null, checkOutTime?: Date | null) {
  if (checkInTime && checkOutTime) {
    return AttendanceStatus.PRESENT;
  }

  return AttendanceStatus.HALF_DAY;
}

export async function finalizeAttendanceForDate(
  input: { date?: string },
  deps: AttendanceFinalizationDeps,
) {
  const attendanceDate = parseAttendanceDateInput(input.date);
  const [employees, employeeIdsWithAttendance, employeeIdsWithApprovedLeave] = await Promise.all([
    deps.findActiveEmployees(),
    deps.findEmployeeIdsWithAttendance(attendanceDate),
    deps.findEmployeeIdsWithApprovedLeave(attendanceDate),
  ]);

  const attendanceSet = new Set(employeeIdsWithAttendance);
  const approvedLeaveSet = new Set(employeeIdsWithApprovedLeave);
  const eligibleEmployeeIds = employees
    .filter((employee) => startOfDay(employee.joiningDate) <= attendanceDate)
    .filter((employee) => !attendanceSet.has(employee.id))
    .filter((employee) => !approvedLeaveSet.has(employee.id))
    .map((employee) => employee.id);

  if (eligibleEmployeeIds.length === 0) {
    return {
      attendanceDate,
      createdCount: 0,
    };
  }

  const createdCount = await deps.createAbsentAttendances(
    eligibleEmployeeIds.map((employeeId) => ({
      employeeId,
      attendanceDate,
      status: AttendanceStatus.ABSENT,
    })),
  );

  return {
    attendanceDate,
    createdCount,
  };
}

export function buildApprovedLeaveWhereForAttendanceDate(attendanceDate: Date) {
  return {
    status: LeaveStatus.APPROVED,
    startDate: { lte: endOfDay(attendanceDate) },
    endDate: { gte: startOfDay(attendanceDate) },
  };
}

export function hasApprovedLeaveOverlapForAttendanceDate(leaveRequests: Array<{ status: LeaveStatus }>) {
  return leaveRequests.some((leaveRequest) => leaveRequest.status === LeaveStatus.APPROVED);
}
