import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { calculateLeaveDays, endOfDay, startOfDay } from "../../utils/dates.js";

type RequestUser = NonNullable<Express.Request["user"]>;
type LeaveTypePolicy = {
  id: number;
  code: string;
  name: string;
  defaultDaysPerYear: number;
  allocationMode: "YEARLY" | "QUARTERLY";
  quarterlyAllocationDays: number | null;
  carryForwardAllowed: boolean;
  carryForwardCap: number | null;
  requiresAttachmentAfterDays: number | null;
  deductFullQuotaOnApproval: boolean;
  maxUsagesPerYear: number | null;
  policyEffectiveFromYear: number | null;
};

type LeaveBalancePolicy = {
  remainingDays: number;
  visibleDays: number;
  carryForwardDays: number;
  leaveType?: LeaveTypePolicy;
};

type LeaveCreationDeps = {
  findOverlap: (params: { employeeId: number; startDate: Date; endDate: Date }) => Promise<unknown>;
  findLeaveType: (params: { leaveTypeId: number }) => Promise<LeaveTypePolicy | null>;
  findLeaveBalance: (params: { employeeId: number; leaveTypeId: number; year: number }) => Promise<LeaveBalancePolicy | null>;
  countExistingYearRequests: (params: {
    employeeId: number;
    leaveTypeId: number;
    year: number;
  }) => Promise<number>;
  isWorkingDay?: (date: Date) => Promise<boolean>;
  createLeaveRequest: (data: {
    employeeId: number;
    leaveTypeId: number;
    startDate: Date;
    endDate: Date;
    startDayDuration: "FULL_DAY" | "HALF_DAY";
    endDayDuration: "FULL_DAY" | "HALF_DAY";
    totalDays: number;
    paidDays: number;
    unpaidDays: number;
    isUnpaid: boolean;
    attachmentName?: string;
    attachmentPath?: string;
    attachmentMime?: string;
    reason: string;
  }) => Promise<unknown>;
};

function getQuarterForDate(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function isPolicyActiveForYear(leaveType: LeaveTypePolicy, year: number) {
  return leaveType.policyEffectiveFromYear !== null && year >= leaveType.policyEffectiveFromYear;
}

function isQuarterlyLeaveType(leaveType: LeaveTypePolicy, year: number) {
  return isPolicyActiveForYear(leaveType, year) && leaveType.allocationMode === "QUARTERLY";
}

function getConsecutiveRequestedDays(startDate: Date, endDate: Date) {
  return Math.floor((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / 86400000) + 1;
}

async function calculateCalendarAwareLeaveDays(input: {
  startDate: Date;
  endDate: Date;
  startDayDuration: "FULL_DAY" | "HALF_DAY";
  endDayDuration: "FULL_DAY" | "HALF_DAY";
  isWorkingDay: (date: Date) => Promise<boolean>;
}) {
  const sameDay =
    input.startDate.getFullYear() === input.endDate.getFullYear() &&
    input.startDate.getMonth() === input.endDate.getMonth() &&
    input.startDate.getDate() === input.endDate.getDate();

  let totalDays = 0;
  const current = startOfDay(input.startDate);
  const finalDate = startOfDay(input.endDate);

  while (current <= finalDate) {
    const attendanceDate = new Date(current);
    const workingDay = await input.isWorkingDay(attendanceDate);

    if (workingDay) {
      const isStartDay = attendanceDate.getTime() === startOfDay(input.startDate).getTime();
      const isEndDay = attendanceDate.getTime() === finalDate.getTime();

      if (sameDay) {
        totalDays += input.startDayDuration === "HALF_DAY" ? 0.5 : 1;
      } else if ((isStartDay && input.startDayDuration === "HALF_DAY") || (isEndDay && input.endDayDuration === "HALF_DAY")) {
        totalDays += 0.5;
      } else {
        totalDays += 1;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return totalDays;
}

export async function createLeaveRequestForEmployee(
  input: {
    actor: RequestUser;
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    startDayDuration: "FULL_DAY" | "HALF_DAY";
    endDayDuration: "FULL_DAY" | "HALF_DAY";
    reason: string;
    attachmentName?: string;
    attachmentPath?: string;
    attachmentMime?: string;
  },
  deps: LeaveCreationDeps,
) {
  if (!input.actor.employeeId) {
    throw new AppError("Employee profile not found", 400);
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (endDate < startDate) {
    throw new AppError("End date cannot be before start date");
  }

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay && input.startDayDuration !== input.endDayDuration) {
    throw new AppError("For a single-date leave, start and end day duration must match");
  }

  const totalDays = deps.isWorkingDay
    ? await calculateCalendarAwareLeaveDays({
        startDate,
        endDate,
        startDayDuration: input.startDayDuration,
        endDayDuration: input.endDayDuration,
        isWorkingDay: deps.isWorkingDay,
      })
    : sameDay
      ? input.startDayDuration === "HALF_DAY"
        ? 0.5
        : 1
      : calculateLeaveDays(startDate, endDate) - (input.startDayDuration === "HALF_DAY" ? 0.5 : 0) - (input.endDayDuration === "HALF_DAY" ? 0.5 : 0);

  if (totalDays <= 0) {
    throw new AppError("Leave duration must include at least half a working day");
  }
  const year = startDate.getFullYear();
  const leaveType = await deps.findLeaveType({ leaveTypeId: input.leaveTypeId });

  if (!leaveType) {
    throw new AppError("Leave type not found", 404);
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  const overlap = await deps.findOverlap({
    employeeId: input.actor.employeeId,
    startDate,
    endDate,
  });

  if (overlap) {
    throw new AppError("Overlapping leave request already exists");
  }

  const leaveBalance = await deps.findLeaveBalance({
    employeeId: input.actor.employeeId,
    leaveTypeId: input.leaveTypeId,
    year,
  });

  if (isQuarterlyLeaveType(leaveType, year)) {
    const currentQuarter = getQuarterForDate(currentDate);
    const startQuarter = getQuarterForDate(startDate);
    const endQuarter = getQuarterForDate(endDate);

    if (year !== endDate.getFullYear()) {
      throw new AppError("Quarterly leave requests cannot span across years");
    }

    if (startQuarter !== endQuarter) {
      throw new AppError("Quarterly leave requests must stay within a single quarter");
    }

    if (year !== currentYear || startQuarter !== currentQuarter) {
      throw new AppError("Casual and sick leave can only be used within the current quarter");
    }
  }

  if (
    isPolicyActiveForYear(leaveType, year) &&
    leaveType.requiresAttachmentAfterDays !== null &&
    getConsecutiveRequestedDays(startDate, endDate) >= leaveType.requiresAttachmentAfterDays &&
    !input.attachmentPath
  ) {
    throw new AppError(`Attachment is required for ${leaveType.name.toLowerCase()} requests of 2 or more consecutive days`);
  }

  if (isPolicyActiveForYear(leaveType, year) && leaveType.maxUsagesPerYear !== null) {
    const existingYearRequests = await deps.countExistingYearRequests({
      employeeId: input.actor.employeeId,
      leaveTypeId: input.leaveTypeId,
      year,
    });

    if (existingYearRequests >= leaveType.maxUsagesPerYear) {
      throw new AppError(`${leaveType.name} can only be used once per year`);
    }
  }

  const availablePaidDays = isQuarterlyLeaveType(leaveType, year)
    ? leaveBalance?.visibleDays ?? 0
    : leaveBalance?.remainingDays ?? 0;

  if (isPolicyActiveForYear(leaveType, year) && leaveType.deductFullQuotaOnApproval) {
    if ((leaveBalance?.remainingDays ?? 0) < leaveType.defaultDaysPerYear) {
      throw new AppError(`No yearly quota remaining for ${leaveType.name.toLowerCase()}`);
    }

    return deps.createLeaveRequest({
      employeeId: input.actor.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate,
      endDate,
      startDayDuration: input.startDayDuration,
      endDayDuration: input.endDayDuration,
      totalDays,
      paidDays: totalDays,
      unpaidDays: 0,
      isUnpaid: false,
      attachmentName: input.attachmentName,
      attachmentPath: input.attachmentPath,
      attachmentMime: input.attachmentMime,
      reason: input.reason,
    });
  }

  const paidDays = Math.min(availablePaidDays, totalDays);
  const unpaidDays = Math.max(totalDays - paidDays, 0);

  return deps.createLeaveRequest({
    employeeId: input.actor.employeeId,
    leaveTypeId: input.leaveTypeId,
    startDate,
    endDate,
    startDayDuration: input.startDayDuration,
    endDayDuration: input.endDayDuration,
    totalDays,
    paidDays,
    unpaidDays,
    isUnpaid: unpaidDays > 0,
    attachmentName: input.attachmentName,
    attachmentPath: input.attachmentPath,
    attachmentMime: input.attachmentMime,
    reason: input.reason,
  });
}

export function buildLeaveOverlapWhere(employeeId: number, startDate: Date, endDate: Date) {
  return {
    employeeId,
    status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
    startDate: { lte: endOfDay(endDate) },
    endDate: { gte: startOfDay(startDate) },
  };
}

export function buildApprovedLeaveAttendanceEntries(input: {
  startDate: Date;
  endDate: Date;
  startDayDuration: "FULL_DAY" | "HALF_DAY";
  endDayDuration: "FULL_DAY" | "HALF_DAY";
  isWorkingDay?: (date: Date) => boolean;
}) {
  const entries: Array<{ attendanceDate: Date; status: "LEAVE" | "HALF_DAY" }> = [];
  const current = startOfDay(input.startDate);
  const finalDate = startOfDay(input.endDate);

  while (current <= finalDate) {
    const attendanceDate = new Date(current);
    const workingDay = input.isWorkingDay ? input.isWorkingDay(attendanceDate) : true;

    if (!workingDay) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const isStartDay = attendanceDate.getTime() === startOfDay(input.startDate).getTime();
    const isEndDay = attendanceDate.getTime() === finalDate.getTime();
    const isSameDay = isStartDay && isEndDay;

    let status: "LEAVE" | "HALF_DAY" = AttendanceStatus.LEAVE;

    if (isSameDay) {
      status = input.startDayDuration === "HALF_DAY" ? AttendanceStatus.HALF_DAY : AttendanceStatus.LEAVE;
    } else if ((isStartDay && input.startDayDuration === "HALF_DAY") || (isEndDay && input.endDayDuration === "HALF_DAY")) {
      status = AttendanceStatus.HALF_DAY;
    }

    entries.push({ attendanceDate, status });
    current.setDate(current.getDate() + 1);
  }

  return entries;
}

export function hasAttendanceConflict(attendance?: {
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  workedMinutes?: number;
} | null) {
  if (!attendance) {
    return false;
  }

  return Boolean(attendance.checkInTime || attendance.checkOutTime || (attendance.workedMinutes ?? 0) > 0);
}
