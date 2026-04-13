import { AttendanceStatus, LeaveDurationType, LeaveStatus } from "@prisma/client";
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
  updateAttendanceWithMissingCheckout: (attendanceDate: Date, cutoffHour: number) => Promise<number>;
  isWorkingDay?: (attendanceDate: Date) => Promise<boolean>;
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


export function finalizeAttendanceStatus(
  checkInTime?: Date | null, 
  checkOutTime?: Date | null
) {
  if (!checkInTime) return AttendanceStatus.ABSENT;
  
  if (!checkOutTime) {
    // Employee checked in but never checked out - mark as half day
    return AttendanceStatus.HALF_DAY;
  }
  
  return AttendanceStatus.PRESENT;
}

export async function finalizeAttendanceForDate(
  input: { date?: string },
  deps: AttendanceFinalizationDeps,
) {
  const attendanceDate = parseAttendanceDateInput(input.date);
  const isWorkingDay = deps.isWorkingDay ? await deps.isWorkingDay(attendanceDate) : true;

  if (!isWorkingDay) {
    return {
      attendanceDate,
      createdCount: 0,
    };
  }

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

  // Update existing attendance records with missing checkouts
  const updatedCount = await deps.updateAttendanceWithMissingCheckout(attendanceDate, 20);

  return {
    attendanceDate,
    createdCount,
    updatedCount,
  };
}

export function buildApprovedLeaveWhereForAttendanceDate(attendanceDate: Date) {
  return {
    status: LeaveStatus.APPROVED,
    startDate: { lte: endOfDay(attendanceDate) },
    endDate: { gte: startOfDay(attendanceDate) },
  };
}

export function buildAttendanceWhereForDate(attendanceDate: Date) {
  return {
    gte: startOfDay(attendanceDate),
    lte: endOfDay(attendanceDate),
  };
}

export function hasApprovedLeaveOverlapForAttendanceDate(leaveRequests: Array<{ status: LeaveStatus }>) {
  return leaveRequests.some((leaveRequest) => leaveRequest.status === LeaveStatus.APPROVED);
}

export function getApprovedLeaveAttendanceStatusForDate(
  leaveRequest: {
    startDate: Date;
    endDate: Date;
    startDayDuration: LeaveDurationType;
    endDayDuration: LeaveDurationType;
  },
  attendanceDate: Date,
) {
  const targetDate = startOfDay(attendanceDate);
  const startDate = startOfDay(leaveRequest.startDate);
  const endDate = startOfDay(leaveRequest.endDate);
  const isStartDay = targetDate.getTime() === startDate.getTime();
  const isEndDay = targetDate.getTime() === endDate.getTime();
  const isSameDay = isStartDay && isEndDay;

  if (isSameDay) {
    return leaveRequest.startDayDuration === LeaveDurationType.HALF_DAY ? AttendanceStatus.HALF_DAY : AttendanceStatus.LEAVE;
  }

  if ((isStartDay && leaveRequest.startDayDuration === LeaveDurationType.HALF_DAY) || (isEndDay && leaveRequest.endDayDuration === LeaveDurationType.HALF_DAY)) {
    return AttendanceStatus.HALF_DAY;
  }

  return AttendanceStatus.LEAVE;
}
