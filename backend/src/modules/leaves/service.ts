import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { calculateLeaveDays, endOfDay, startOfDay } from "../../utils/dates.js";
import { getFinancialQuarterForDate, getFinancialYearForDate } from "../../utils/financial-year.js";

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
    medicalProofRequired: boolean;
    medicalProofDueAt: Date | null;
    medicalProofSubmittedAt: Date | null;
    medicalProofStatus: MedicalProofStatus;
    medicalProofReviewedAt: Date | null;
    medicalProofReviewedById: number | null;
    medicalProofRejectionReason: string | null;
    reason: string;
  }) => Promise<unknown>;
};

export const SICK_LEAVE_CODE = "SL";
export const MEDICAL_PROOF_THRESHOLD_DAYS = 2;
export const MEDICAL_PROOF_WINDOW_DAYS = 2;
export const MEDICAL_PROOF_STATUS = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING_UPLOAD: "PENDING_UPLOAD",
  PENDING_HR_REVIEW: "PENDING_HR_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const;
export type MedicalProofStatus = (typeof MEDICAL_PROOF_STATUS)[keyof typeof MEDICAL_PROOF_STATUS];

function isPolicyActiveForYear(leaveType: LeaveTypePolicy, year: number) {
  return leaveType.policyEffectiveFromYear !== null && year >= leaveType.policyEffectiveFromYear;
}

function isQuarterlyLeaveType(leaveType: LeaveTypePolicy, year: number) {
  return isPolicyActiveForYear(leaveType, year) && leaveType.allocationMode === "QUARTERLY";
}

function getConsecutiveRequestedDays(startDate: Date, endDate: Date) {
  return Math.floor((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / 86400000) + 1;
}

export function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function requiresMedicalProof(leaveTypeCode: string, totalDays: number) {
  return leaveTypeCode.trim().toUpperCase() === SICK_LEAVE_CODE && totalDays > MEDICAL_PROOF_THRESHOLD_DAYS;
}

export function getMedicalProofDueAt(createdAt: Date) {
  return addDays(createdAt, MEDICAL_PROOF_WINDOW_DAYS);
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
    throw new AppError("Please choose an end date that is the same as or after the start date.");
  }

  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  if (sameDay && input.startDayDuration !== input.endDayDuration) {
    throw new AppError("For a single-day leave request, please choose the same duration for both start and end.");
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
  const year = getFinancialYearForDate(startDate);
  const leaveType = await deps.findLeaveType({ leaveTypeId: input.leaveTypeId });

  if (!leaveType) {
    throw new AppError("Leave type not found", 404);
  }

  const currentDate = new Date();
  const currentYear = getFinancialYearForDate(currentDate);

  const overlap = await deps.findOverlap({
    employeeId: input.actor.employeeId,
    startDate,
    endDate,
  });

  if (overlap) {
    throw new AppError("You already have a leave request for one or more of these dates.");
  }

  const leaveBalance = await deps.findLeaveBalance({
    employeeId: input.actor.employeeId,
    leaveTypeId: input.leaveTypeId,
    year,
  });

  if (isQuarterlyLeaveType(leaveType, year)) {
    const currentQuarter = getFinancialQuarterForDate(currentDate);
    const startQuarter = getFinancialQuarterForDate(startDate);
    const endQuarter = getFinancialQuarterForDate(endDate);
    const endYear = getFinancialYearForDate(endDate);

    if (year !== endYear) {
      throw new AppError("This leave type must stay within the current quarter, so the selected dates cannot cross into another year.");
    }

    if (startQuarter !== endQuarter) {
      throw new AppError("This leave type must stay within a single quarter. Please submit separate requests for different quarters.");
    }

    if (year !== currentYear || startQuarter !== currentQuarter) {
      throw new AppError("This leave type can only be applied within the current quarter.");
    }
  }

  if (
    isPolicyActiveForYear(leaveType, year) &&
    leaveType.requiresAttachmentAfterDays !== null &&
    leaveType.code.trim().toUpperCase() !== SICK_LEAVE_CODE &&
    getConsecutiveRequestedDays(startDate, endDate) >= leaveType.requiresAttachmentAfterDays &&
    !input.attachmentPath
  ) {
    throw new AppError(`Please upload the required document for ${leaveType.name.toLowerCase()} of 2 or more consecutive days.`);
  }

  const medicalProofRequired = requiresMedicalProof(leaveType.code, totalDays);
  const medicalProofDueAt = medicalProofRequired ? getMedicalProofDueAt(new Date()) : null;
  const medicalProofStatus = medicalProofRequired ? MEDICAL_PROOF_STATUS.PENDING_UPLOAD : MEDICAL_PROOF_STATUS.NOT_REQUIRED;

  if (isPolicyActiveForYear(leaveType, year) && leaveType.maxUsagesPerYear !== null) {
    const existingYearRequests = await deps.countExistingYearRequests({
      employeeId: input.actor.employeeId,
      leaveTypeId: input.leaveTypeId,
      year,
    });

    if (existingYearRequests >= leaveType.maxUsagesPerYear) {
      throw new AppError(`${leaveType.name} can only be used once in a year.`);
    }
  }

  const availablePaidDays = isQuarterlyLeaveType(leaveType, year)
    ? leaveBalance?.visibleDays ?? 0
    : leaveBalance?.remainingDays ?? 0;

  if (isPolicyActiveForYear(leaveType, year) && leaveType.deductFullQuotaOnApproval) {
    if ((leaveBalance?.remainingDays ?? 0) < leaveType.defaultDaysPerYear) {
      throw new AppError(`No balance is available for ${leaveType.name.toLowerCase()} right now.`);
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
      medicalProofRequired,
      medicalProofDueAt,
      medicalProofSubmittedAt: null,
      medicalProofStatus,
      medicalProofReviewedAt: null,
      medicalProofReviewedById: null,
      medicalProofRejectionReason: null,
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
    medicalProofRequired,
    medicalProofDueAt,
    medicalProofSubmittedAt: null,
    medicalProofStatus,
    medicalProofReviewedAt: null,
    medicalProofReviewedById: null,
    medicalProofRejectionReason: null,
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
