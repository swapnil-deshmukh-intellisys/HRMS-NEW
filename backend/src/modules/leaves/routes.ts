import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApprovalStepStatus, LeaveDurationType, LeaveStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import multer, { type FileFilterCallback, type StorageEngine } from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { startOfDay } from "../../utils/dates.js";
import { getFinancialQuarterForDate, getFinancialYearBounds, getFinancialYearForDate } from "../../utils/financial-year.js";
import { getEmployeeLeaveBalanceByType, getEmployeeLeaveBalances, isPolicyActiveForYear } from "../../utils/leave-balance.js";
import { canTeamLeadAccessEmployee, getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import {
  buildApprovedLeaveAttendanceEntries,
  buildLeaveOverlapWhere,
  createLeaveRequestForEmployee,
  MEDICAL_PROOF_STATUS,
  type MedicalProofStatus,
  hasAttendanceConflict,
  MEDICAL_PROOF_WINDOW_DAYS,
  SICK_LEAVE_CODE,
} from "./service.js";
import { getCalendarDayStatus } from "../calendar/service.js";
import { syncLeaveToGoogleCalendar, sendTeamNotification } from "../google/service.js";

const router = Router();
const LEAVE_REASON_MIN_WORDS = 25;
const LEAVE_REASON_MAX_WORDS = 300;

function countWords(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads/leaves");
fs.mkdirSync(uploadsDir, { recursive: true });

function buildFilename(file: Express.Multer.File) {
  const extension = path.extname(file.originalname);
  const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${Date.now()}-${baseName}${extension}`;
}

const uploadStorage = multer.diskStorage({
  destination: (
    _request: Express.Request,
    _file: Express.Multer.File,
    callback: (error: Error | null, destination: string) => void,
  ) => callback(null, uploadsDir),
  filename: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => callback(null, buildFilename(file)),
}) satisfies StorageEngine;

const upload = multer({
  storage: multer.diskStorage({
    destination: (
      _request: Express.Request,
      _file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void,
    ) => callback(null, uploadsDir),
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => callback(null, buildFilename(file)),
  }) satisfies StorageEngine,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request: Express.Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.mimetype)) {
      callback(new AppError("Only PDF, JPG, JPEG, and PNG attachments are allowed", 400));
      return;
    }

    callback(null, true);
  },
});

const medicalProofUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request: Express.Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new AppError("Only PDF medical proof is allowed", 400));
      return;
    }

    callback(null, true);
  },
});

const applyLeaveSchema = z.object({
  leaveTypeId: z.coerce.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  startDayDuration: z.nativeEnum(LeaveDurationType).default(LeaveDurationType.FULL_DAY),
  endDayDuration: z.nativeEnum(LeaveDurationType).default(LeaveDurationType.FULL_DAY),
  reason: z
    .string()
    .trim()
    .refine(
      (value) => {
        const wordCount = countWords(value);
        return wordCount >= LEAVE_REASON_MIN_WORDS && wordCount <= LEAVE_REASON_MAX_WORDS;
      },
      {
        message: `Reason must be between ${LEAVE_REASON_MIN_WORDS} and ${LEAVE_REASON_MAX_WORDS} words`,
      },
    ),
});

const reviewLeaveSchema = z.object({
  rejectionReason: z.string().min(3),
});

router.use(authenticate);

async function getCalendarExceptionsForRange(startDate: Date, endDate: Date) {
  return prisma.calendarException.findMany({
    where: {
      date: {
        gte: startOfDay(startDate),
        lte: startOfDay(endDate),
      },
    },
    orderBy: { date: "asc" },
  });
}

router.get("/leave-types", async (_request, response, next) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return sendSuccess(response, "Leave types fetched successfully", leaveTypes);
  } catch (error) {
    next(error);
  }
});

router.get("/leave-balances/me", async (request, response, next) => {
  try {
    await processOverdueMedicalProofs();

    if (!request.user?.employeeId) {
      throw new AppError("Employee profile not found", 400);
    }

    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    let employeeId = request.user.employeeId;

    if (requestedEmployeeId) {
      if (request.user.role === "EMPLOYEE" && requestedEmployeeId !== request.user.employeeId) {
        const canAccess =
          request.user.employeeId && (await canTeamLeadAccessEmployee(prisma, request.user.employeeId, requestedEmployeeId));

        if (!canAccess) {
          throw new AppError("You are not authorized to view this employee leave balance", 403);
        }
      }

      if (request.user.role === "MANAGER") {
        const managedEmployee = await prisma.employee.findUnique({
          where: { id: requestedEmployeeId },
          select: { id: true, managerId: true },
        });

        if (!managedEmployee || (managedEmployee.managerId !== request.user.employeeId && managedEmployee.id !== request.user.employeeId)) {
          throw new AppError("You are not authorized to view this employee leave balance", 403);
        }
      }

      employeeId = requestedEmployeeId;
    }

    const year = request.query.year ? Number(request.query.year) : getFinancialYearForDate(new Date());
    const balances = await getEmployeeLeaveBalances(prisma, employeeId, year, new Date());

    return sendSuccess(response, "Leave balances fetched successfully", balances);
  } catch (error) {
    next(error);
  }
});

router.get("/leaves", async (request, response, next) => {
  try {
    await processOverdueMedicalProofs();

    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    let where = {};

    if (request.user?.role === "EMPLOYEE") {
      if (requestedEmployeeId && requestedEmployeeId !== request.user.employeeId) {
        const canAccess =
          request.user.employeeId && (await canTeamLeadAccessEmployee(prisma, request.user.employeeId, requestedEmployeeId));

        if (!canAccess) {
          throw new AppError("You are not authorized to view this employee leave requests", 403);
        }

        where = { employeeId: requestedEmployeeId };
      } else if (request.user.employeeId) {
        const isTeamLead = await hasEmployeeCapability(prisma, request.user.employeeId, "TEAM_LEAD");

        where = isTeamLead
          ? {
              OR: [{ employeeId: request.user.employeeId }, { employeeId: { in: await getScopedEmployeeIdsForTeamLead(prisma, request.user.employeeId) } }],
            }
          : { employeeId: request.user.employeeId };
      } else {
        where = { employeeId: request.user.employeeId };
      }
    } else if (request.user?.role === "MANAGER" && request.user.employeeId) {
      if (requestedEmployeeId) {
        const managedEmployee = await prisma.employee.findUnique({
          where: { id: requestedEmployeeId },
          select: { id: true, managerId: true },
        });

        if (!managedEmployee || (managedEmployee.managerId !== request.user.employeeId && managedEmployee.id !== request.user.employeeId)) {
          throw new AppError("You are not authorized to view this employee leave requests", 403);
        }

        where = { employeeId: requestedEmployeeId };
      } else {
        where = {
          OR: [{ employeeId: request.user.employeeId }, { employee: { managerId: request.user.employeeId } }],
        };
      }
    } else if (requestedEmployeeId) {
      where = { employeeId: requestedEmployeeId };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        employee: true,
        leaveType: true,
        managerApprovedBy: true,
        hrApprovedBy: true,
        medicalProofReviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(response, "Leave requests fetched successfully", leaves);
  } catch (error) {
    next(error);
  }
});

router.post("/leaves", upload.single("attachment"), validate(applyLeaveSchema), async (request, response, next) => {
  try {
    const requestStartDate = new Date(request.body.startDate);
    const requestEndDate = new Date(request.body.endDate);
    const calendarExceptions = await getCalendarExceptionsForRange(requestStartDate, requestEndDate);

    const leaveRequest = await createLeaveRequestForEmployee(
      {
        actor: request.user!,
        leaveTypeId: request.body.leaveTypeId,
        startDate: request.body.startDate,
        endDate: request.body.endDate,
        startDayDuration: request.body.startDayDuration,
        endDayDuration: request.body.endDayDuration,
        reason: request.body.reason,
        attachmentName: request.file?.originalname,
        attachmentPath: request.file ? `/uploads/leaves/${request.file.filename}` : undefined,
        attachmentMime: request.file?.mimetype,
      },
      {
        findOverlap: ({ employeeId, startDate, endDate }) =>
          prisma.leaveRequest.findFirst({
            where: buildLeaveOverlapWhere(employeeId, startDate, endDate),
          }),
        findLeaveType: async ({ leaveTypeId }) =>
          (await prisma.leaveType.findUnique({
            where: { id: leaveTypeId },
          })) as {
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
          } | null,
        findLeaveBalance: async ({ employeeId, leaveTypeId, year }) =>
          (await getEmployeeLeaveBalanceByType(prisma, employeeId, leaveTypeId, year, new Date())) as {
            remainingDays: number;
            visibleDays: number;
            carryForwardDays: number;
          } | null,
        countExistingYearRequests: ({ employeeId, leaveTypeId, year }) => {
          const { start, endExclusive } = getFinancialYearBounds(year);

          return prisma.leaveRequest.count({
            where: {
              employeeId,
              leaveTypeId,
              status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
              startDate: {
                gte: start,
                lt: endExclusive,
              },
            },
          });
        },
        isWorkingDay: async (date) => getCalendarDayStatus(date, calendarExceptions).isWorkingDay,
        createLeaveRequest: ({
          employeeId,
          leaveTypeId,
          startDate,
          endDate,
          startDayDuration,
          endDayDuration,
          totalDays,
          paidDays,
          unpaidDays,
          isUnpaid,
          attachmentName,
          attachmentPath,
          attachmentMime,
          medicalProofRequired,
          medicalProofDueAt,
          medicalProofSubmittedAt,
          medicalProofStatus,
          medicalProofReviewedAt,
          medicalProofReviewedById,
          medicalProofRejectionReason,
          reason,
        }) =>
          prisma.leaveRequest.create({
            data: {
              employeeId,
              leaveTypeId,
              startDate,
              endDate,
              startDayDuration,
              endDayDuration,
              totalDays,
              paidDays,
              unpaidDays,
              isUnpaid,
              attachmentName,
              attachmentPath,
              attachmentMime,
              medicalProofRequired,
              medicalProofDueAt,
              medicalProofSubmittedAt,
              medicalProofStatus,
              medicalProofReviewedAt,
              medicalProofReviewedById,
              medicalProofRejectionReason,
              reason,
            },
            include: {
              employee: true,
              leaveType: true,
              managerApprovedBy: true,
              hrApprovedBy: true,
              medicalProofReviewedBy: true,
            },
          }),
      },
    );

    return sendSuccess(response, "Leave request submitted successfully", leaveRequest, 201);
  } catch (error) {
    next(error);
  }
});

async function getLeaveReviewContext(leaveId: number) {
  const leaveRequest = (await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  })) as (Awaited<ReturnType<typeof prisma.leaveRequest.findUnique>> & {
    medicalProofRequired: boolean;
    medicalProofDueAt: Date | null;
    medicalProofSubmittedAt: Date | null;
    medicalProofStatus: MedicalProofStatus;
    medicalProofReviewedAt: Date | null;
    medicalProofReviewedById: number | null;
    medicalProofRejectionReason: string | null;
    employee: {
      managerId: number | null;
    };
    leaveType: {
      id: number;
      code: string;
      defaultDaysPerYear: number;
      quarterlyAllocationDays: number | null;
      carryForwardAllowed: boolean;
      carryForwardCap: number | null;
      deductFullQuotaOnApproval: boolean;
      allocationMode: "YEARLY" | "QUARTERLY";
      policyEffectiveFromYear: number | null;
    };
  }) | null;

  if (!leaveRequest) {
    throw new AppError("Leave request not found", 404);
  }

  return leaveRequest;
}

function ensurePendingLeave(leaveRequest: Awaited<ReturnType<typeof getLeaveReviewContext>>) {
  if (leaveRequest.status !== LeaveStatus.PENDING) {
    throw new AppError("Only pending leave requests can be reviewed");
  }
}

function ensureNotSelfReview(
  leaveRequest: Awaited<ReturnType<typeof getLeaveReviewContext>>,
  actor: NonNullable<Express.Request["user"]>,
) {
  if (leaveRequest.employeeId === actor.employeeId) {
    throw new AppError("You cannot review your own leave request", 403);
  }
}

function ensureManagerApprovalAccess(
  leaveRequest: Awaited<ReturnType<typeof getLeaveReviewContext>>,
  actor: NonNullable<Express.Request["user"]>,
) {
  if (actor.role === "ADMIN") {
    return;
  }

  if (actor.role !== "MANAGER") {
    throw new AppError("Only managers can perform the first approval step", 403);
  }

  if (leaveRequest.employee.managerId !== actor.employeeId) {
    throw new AppError("Managers can only review leave for their direct reports", 403);
  }
}

function ensureHrApprovalAccess(
  actor: NonNullable<Express.Request["user"]>,
) {
  if (actor.role !== "HR" && actor.role !== "ADMIN") {
    throw new AppError("Only HR can perform the final approval step", 403);
  }
}

function ensureMedicalProofEligible(leaveRequest: LeaveReviewContext) {
  if (!leaveRequest.medicalProofRequired || !isSickLeave(leaveRequest.leaveType.code)) {
    throw new AppError("Medical proof is not required for this leave request", 400);
  }

  if (leaveRequest.status !== LeaveStatus.APPROVED) {
    throw new AppError("Medical proof can only be managed after leave approval", 400);
  }
}

function ensureMedicalProofWindowOpen(leaveRequest: LeaveReviewContext, now = new Date()) {
  if (!leaveRequest.medicalProofDueAt || leaveRequest.medicalProofDueAt < now) {
    throw new AppError(`Medical proof must be uploaded within ${MEDICAL_PROOF_WINDOW_DAYS} days`, 400);
  }
}

async function finalizeApprovedLeave(
  transaction: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  leaveRequest: Awaited<ReturnType<typeof getLeaveReviewContext>>,
  actor: NonNullable<Express.Request["user"]>,
) {
  const calendarExceptions = await transaction.calendarException.findMany({
    where: {
      date: {
        gte: startOfDay(leaveRequest.startDate),
        lte: startOfDay(leaveRequest.endDate),
      },
    },
    orderBy: { date: "asc" },
  });

  const attendanceEntries = buildApprovedLeaveAttendanceEntries({
    startDate: leaveRequest.startDate,
    endDate: leaveRequest.endDate,
    startDayDuration: leaveRequest.startDayDuration,
    endDayDuration: leaveRequest.endDayDuration,
    isWorkingDay: (date) => getCalendarDayStatus(date, calendarExceptions).isWorkingDay,
  });

  const existingAttendances = await transaction.attendance.findMany({
    where: {
      employeeId: leaveRequest.employeeId,
      attendanceDate: {
        in: attendanceEntries.map((entry) => entry.attendanceDate),
      },
    },
  });

  for (const entry of attendanceEntries) {
    const existingAttendance = existingAttendances.find(
      (attendance) => attendance.attendanceDate.getTime() === entry.attendanceDate.getTime(),
    );

    if (hasAttendanceConflict(existingAttendance)) {
      throw new AppError("Attendance already exists with worked time for one or more leave dates");
    }
  }

  const currentDate = new Date();
  const refreshedBalance = await getEmployeeLeaveBalanceByType(
    transaction,
    leaveRequest.employeeId,
    leaveRequest.leaveTypeId,
    getFinancialYearForDate(leaveRequest.startDate),
    currentDate,
  );
  const policyActive = isPolicyActiveForYear(leaveRequest.leaveType, getFinancialYearForDate(leaveRequest.startDate));
  const deductedDays = policyActive && leaveRequest.leaveType.deductFullQuotaOnApproval
    ? leaveRequest.leaveType.defaultDaysPerYear
    : leaveRequest.paidDays;
  const approvalQuarter = getFinancialQuarterForDate(leaveRequest.startDate);
  const currentQuarter = getFinancialQuarterForDate(currentDate);
  const shouldAdjustVisibleDays =
    policyActive &&
    leaveRequest.leaveType.allocationMode === "QUARTERLY" &&
    getFinancialYearForDate(leaveRequest.startDate) === getFinancialYearForDate(currentDate) &&
    approvalQuarter === currentQuarter;

  if (deductedDays > 0) {
    if (!refreshedBalance || refreshedBalance.remainingDays < deductedDays) {
      throw new AppError("Insufficient leave balance");
    }

    await transaction.leaveBalance.update({
      where: { id: refreshedBalance.id },
      data: {
        usedDays: refreshedBalance.usedDays + deductedDays,
        remainingDays: refreshedBalance.remainingDays - deductedDays,
        visibleDays: shouldAdjustVisibleDays
          ? Math.max(refreshedBalance.visibleDays - deductedDays, 0)
          : refreshedBalance.visibleDays,
      } as never,
    });
  }

  for (const entry of attendanceEntries) {
    const existingAttendance = existingAttendances.find(
      (attendance) => attendance.attendanceDate.getTime() === entry.attendanceDate.getTime(),
    );

    if (existingAttendance) {
      await transaction.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: entry.status,
          checkInTime: null,
          checkOutTime: null,
          workedMinutes: 0,
        },
      });
    } else {
      await transaction.attendance.create({
        data: {
          employeeId: leaveRequest.employeeId,
          attendanceDate: entry.attendanceDate,
          status: entry.status,
          workedMinutes: 0,
        },
      });
    }
  }

  return transaction.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: LeaveStatus.APPROVED,
      managerApprovalStatus: ApprovalStepStatus.APPROVED,
      hrApprovalStatus: ApprovalStepStatus.APPROVED,
      deductedDays,
      fullQuotaDeducted: policyActive && leaveRequest.leaveType.deductFullQuotaOnApproval,
      medicalProofStatus: leaveRequest.medicalProofRequired ? leaveRequest.medicalProofStatus : MEDICAL_PROOF_STATUS.NOT_REQUIRED,
      ...(actor.role === "HR"
        ? {
            hrApprovedById: actor.employeeId,
            hrApprovedAt: new Date(),
            hrRejectionReason: null,
          }
        : {
            managerApprovedById: actor.employeeId,
            managerApprovedAt: new Date(),
            managerRejectionReason: null,
          }),
    } as never,
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

type PrismaTransaction = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type LeaveReviewContext = Awaited<ReturnType<typeof getLeaveReviewContext>>;

function isSickLeave(leaveCode: string) {
  return leaveCode.trim().toUpperCase() === SICK_LEAVE_CODE;
}

async function restoreLeaveBalanceForUnpaidConversion(
  transaction: PrismaTransaction,
  leaveRequest: LeaveReviewContext,
) {
  const deductedDays = leaveRequest.deductedDays ?? 0;

  if (deductedDays <= 0) {
    return;
  }

  const currentDate = new Date();
  const balance = await getEmployeeLeaveBalanceByType(
    transaction,
    leaveRequest.employeeId,
    leaveRequest.leaveTypeId,
    getFinancialYearForDate(leaveRequest.startDate),
    currentDate,
  );

  if (!balance) {
    return;
  }

  const approvalQuarter = getFinancialQuarterForDate(leaveRequest.startDate);
  const currentQuarter = getFinancialQuarterForDate(currentDate);
  const shouldAdjustVisibleDays =
    isPolicyActiveForYear(leaveRequest.leaveType, getFinancialYearForDate(leaveRequest.startDate)) &&
    leaveRequest.leaveType.allocationMode === "QUARTERLY" &&
    getFinancialYearForDate(leaveRequest.startDate) === getFinancialYearForDate(currentDate) &&
    approvalQuarter === currentQuarter;

  await transaction.leaveBalance.update({
    where: { id: balance.id },
    data: {
      usedDays: Math.max(balance.usedDays - deductedDays, 0),
      remainingDays: balance.remainingDays + deductedDays,
      visibleDays: shouldAdjustVisibleDays ? balance.visibleDays + deductedDays : balance.visibleDays,
    } as never,
  });
}

async function convertLeaveToUnpaid(
  transaction: PrismaTransaction,
  leaveRequest: LeaveReviewContext,
  proofStatus: typeof MEDICAL_PROOF_STATUS.REJECTED | typeof MEDICAL_PROOF_STATUS.EXPIRED,
  proofReview: { reviewedById?: number | null; rejectionReason?: string | null } = {},
) {
  await restoreLeaveBalanceForUnpaidConversion(transaction, leaveRequest);

  return transaction.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      paidDays: 0,
      unpaidDays: leaveRequest.totalDays,
      isUnpaid: true,
      deductedDays: 0,
      fullQuotaDeducted: false,
      medicalProofStatus: proofStatus,
      medicalProofReviewedAt: proofStatus === MEDICAL_PROOF_STATUS.EXPIRED ? null : new Date(),
      medicalProofReviewedById:
        proofStatus === MEDICAL_PROOF_STATUS.EXPIRED ? null : (proofReview.reviewedById ?? null),
      medicalProofRejectionReason:
        proofStatus === MEDICAL_PROOF_STATUS.REJECTED ? (proofReview.rejectionReason ?? "Medical proof rejected by HR") : null,
    } as never,
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function processOverdueMedicalProofs(referenceTime = new Date()) {
  const overdueRequests = await prisma.leaveRequest.findMany({
    where: {
      status: LeaveStatus.APPROVED,
      medicalProofRequired: true,
      medicalProofStatus: MEDICAL_PROOF_STATUS.PENDING_UPLOAD,
      medicalProofDueAt: { lt: referenceTime },
      leaveType: { code: SICK_LEAVE_CODE },
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });

  for (const leaveRequest of overdueRequests) {
    await prisma.$transaction((transaction) =>
      convertLeaveToUnpaid(transaction, leaveRequest, MEDICAL_PROOF_STATUS.EXPIRED),
    );
  }

  return overdueRequests.length;
}

async function managerApproveLeave(leaveId: number, actor: NonNullable<Express.Request["user"]>) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensurePendingLeave(leaveRequest);
  ensureNotSelfReview(leaveRequest, actor);
  ensureManagerApprovalAccess(leaveRequest, actor);

  if (leaveRequest.managerApprovalStatus !== ApprovalStepStatus.PENDING) {
    throw new AppError("Manager review is already completed");
  }

  if (leaveRequest.hrApprovalStatus === ApprovalStepStatus.APPROVED) {
    const finalLeave = await prisma.$transaction((transaction) => finalizeApprovedLeave(transaction, leaveRequest, actor));
    
    // Background sync to Google Calendar
    void syncLeaveToGoogleCalendar({
      employeeId: finalLeave.employeeId,
      startDate: finalLeave.startDate,
      endDate: finalLeave.endDate,
      leaveTypeName: finalLeave.leaveType.name,
      reason: finalLeave.reason,
    });

    // Notify on Google Chat
    void sendTeamNotification(
      `✅ *Leave Approved*\n*Employee:* ${finalLeave.employee.firstName} ${finalLeave.employee.lastName}\n*Type:* ${finalLeave.leaveType.name}\n*Dates:* ${finalLeave.startDate.toLocaleDateString()} to ${finalLeave.endDate.toLocaleDateString()}\n*Reason:* ${finalLeave.reason}`
    );

    return finalLeave;
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      managerApprovalStatus: ApprovalStepStatus.APPROVED,
      managerApprovedById: actor.employeeId,
      managerApprovedAt: new Date(),
      managerRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function managerRejectLeave(
  leaveId: number,
  actor: NonNullable<Express.Request["user"]>,
  rejectionReason: string,
) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensurePendingLeave(leaveRequest);
  ensureNotSelfReview(leaveRequest, actor);
  ensureManagerApprovalAccess(leaveRequest, actor);

  if (leaveRequest.managerApprovalStatus !== ApprovalStepStatus.PENDING) {
    throw new AppError("Manager review is already completed");
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: LeaveStatus.REJECTED,
      managerApprovalStatus: ApprovalStepStatus.REJECTED,
      managerApprovedById: actor.employeeId,
      managerApprovedAt: new Date(),
      managerRejectionReason: rejectionReason,
      hrApprovalStatus: ApprovalStepStatus.PENDING,
      hrApprovedById: null,
      hrApprovedAt: null,
      hrRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
    },
  });
}

async function hrApproveLeave(leaveId: number, actor: NonNullable<Express.Request["user"]>) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensurePendingLeave(leaveRequest);
  ensureNotSelfReview(leaveRequest, actor);
  ensureHrApprovalAccess(actor);

  if (leaveRequest.hrApprovalStatus !== ApprovalStepStatus.PENDING) {
    throw new AppError("HR review is already completed");
  }

  if (leaveRequest.managerApprovalStatus === ApprovalStepStatus.APPROVED) {
    const finalLeave = await prisma.$transaction((transaction) => finalizeApprovedLeave(transaction, leaveRequest, actor));
    
    // Background sync to Google Calendar
    void syncLeaveToGoogleCalendar({
      employeeId: finalLeave.employeeId,
      startDate: finalLeave.startDate,
      endDate: finalLeave.endDate,
      leaveTypeName: finalLeave.leaveType.name,
      reason: finalLeave.reason,
    });

    // Notify on Google Chat
    void sendTeamNotification(
      `✅ *Leave Approved*\n*Employee:* ${finalLeave.employee.firstName} ${finalLeave.employee.lastName}\n*Type:* ${finalLeave.leaveType.name}\n*Dates:* ${finalLeave.startDate.toLocaleDateString()} to ${finalLeave.endDate.toLocaleDateString()}\n*Reason:* ${finalLeave.reason}`
    );

    return finalLeave;
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      hrApprovalStatus: ApprovalStepStatus.APPROVED,
      hrApprovedById: actor.employeeId,
      hrApprovedAt: new Date(),
      hrRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function hrRejectLeave(
  leaveId: number,
  actor: NonNullable<Express.Request["user"]>,
  rejectionReason: string,
) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensurePendingLeave(leaveRequest);
  ensureNotSelfReview(leaveRequest, actor);
  ensureHrApprovalAccess(actor);

  if (leaveRequest.hrApprovalStatus !== ApprovalStepStatus.PENDING) {
    throw new AppError("HR review is already completed");
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: LeaveStatus.REJECTED,
      hrApprovalStatus: ApprovalStepStatus.REJECTED,
      hrApprovedById: actor.employeeId,
      hrApprovedAt: new Date(),
      hrRejectionReason: rejectionReason,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function cancelLeave(leaveId: number, actor: NonNullable<Express.Request["user"]>) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
  });

  if (!leaveRequest) {
    throw new AppError("Leave request not found", 404);
  }

  if (leaveRequest.status !== LeaveStatus.PENDING) {
    throw new AppError("Only pending leave requests can be cancelled");
  }

  if (
    leaveRequest.managerApprovalStatus !== ApprovalStepStatus.PENDING ||
    leaveRequest.hrApprovalStatus !== ApprovalStepStatus.PENDING
  ) {
    throw new AppError("Only leave requests with no completed reviews can be cancelled");
  }

  if (leaveRequest.employeeId !== actor.employeeId && actor.role !== "HR" && actor.role !== "ADMIN") {
    throw new AppError("You can only cancel your own leave request", 403);
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: LeaveStatus.CANCELLED,
      managerApprovedById: null,
      managerApprovedAt: null,
      managerRejectionReason: null,
      hrApprovedById: null,
      hrApprovedAt: null,
      hrRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function uploadMedicalProof(
  leaveId: number,
  actor: NonNullable<Express.Request["user"]>,
  file?: Express.Multer.File,
) {
  const leaveRequest = await getLeaveReviewContext(leaveId);

  if (leaveRequest.employeeId !== actor.employeeId) {
    throw new AppError("You can only upload medical proof for your own leave request", 403);
  }

  ensureMedicalProofEligible(leaveRequest);
  ensureMedicalProofWindowOpen(leaveRequest);

  if (!file) {
    throw new AppError("Medical proof PDF is required", 400);
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      attachmentName: file.originalname,
      attachmentPath: `/uploads/leaves/${file.filename}`,
      attachmentMime: file.mimetype,
      medicalProofSubmittedAt: new Date(),
      medicalProofStatus: MEDICAL_PROOF_STATUS.PENDING_HR_REVIEW,
      medicalProofReviewedAt: null,
      medicalProofReviewedById: null,
      medicalProofRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function approveMedicalProof(leaveId: number, actor: NonNullable<Express.Request["user"]>) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensureHrApprovalAccess(actor);
  ensureMedicalProofEligible(leaveRequest);

  if (leaveRequest.medicalProofStatus !== MEDICAL_PROOF_STATUS.PENDING_HR_REVIEW) {
    throw new AppError("Medical proof is not waiting for HR review", 400);
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      medicalProofStatus: MEDICAL_PROOF_STATUS.APPROVED,
      medicalProofReviewedAt: new Date(),
      medicalProofReviewedById: actor.employeeId,
      medicalProofRejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      managerApprovedBy: true,
      hrApprovedBy: true,
      medicalProofReviewedBy: true,
    },
  });
}

async function rejectMedicalProof(leaveId: number, actor: NonNullable<Express.Request["user"]>) {
  const leaveRequest = await getLeaveReviewContext(leaveId);
  ensureHrApprovalAccess(actor);
  ensureMedicalProofEligible(leaveRequest);

  if (leaveRequest.medicalProofStatus !== MEDICAL_PROOF_STATUS.PENDING_HR_REVIEW) {
    throw new AppError("Medical proof is not waiting for HR review", 400);
  }

  return prisma.$transaction((transaction) =>
    convertLeaveToUnpaid(transaction, leaveRequest, MEDICAL_PROOF_STATUS.REJECTED, {
      reviewedById: actor.employeeId,
    }),
  );
}

router.put("/leaves/:id/manager-approve", requireRoles("ADMIN", "MANAGER"), async (request, response, next) => {
  try {
    const leaveId = Number(request.params.id);
    const reviewedLeave = await managerApproveLeave(leaveId, request.user!);
    return sendSuccess(
      response,
      reviewedLeave.status === LeaveStatus.APPROVED ? "Leave approved successfully" : "Manager approval recorded successfully",
      reviewedLeave,
    );
  } catch (error) {
    next(error);
  }
});

router.put(
  "/leaves/:id/manager-reject",
  requireRoles("ADMIN", "MANAGER"),
  validate(reviewLeaveSchema),
  async (request, response, next) => {
    try {
      const leaveId = Number(request.params.id);
      const reviewedLeave = await managerRejectLeave(leaveId, request.user!, request.body.rejectionReason);
      return sendSuccess(response, "Leave rejected at manager review", reviewedLeave);
    } catch (error) {
      next(error);
    }
  },
);

router.put("/leaves/:id/hr-approve", requireRoles("ADMIN", "HR"), async (request, response, next) => {
  try {
    const leaveId = Number(request.params.id);
    const reviewedLeave = await hrApproveLeave(leaveId, request.user!);
    return sendSuccess(response, "Leave approved successfully", reviewedLeave);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/leaves/:id/hr-reject",
  requireRoles("ADMIN", "HR"),
  validate(reviewLeaveSchema),
  async (request, response, next) => {
    try {
      const leaveId = Number(request.params.id);
      const reviewedLeave = await hrRejectLeave(leaveId, request.user!, request.body.rejectionReason);
      return sendSuccess(response, "Leave rejected at HR review", reviewedLeave);
    } catch (error) {
      next(error);
    }
  },
);

router.put("/leaves/:id/cancel", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const leaveId = Number(request.params.id);
    const cancelledLeave = await cancelLeave(leaveId, request.user!);
    return sendSuccess(response, "Leave cancelled successfully", cancelledLeave);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/leaves/:id/medical-proof",
  requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"),
  medicalProofUpload.single("medicalProof"),
  async (request, response, next) => {
    try {
      await processOverdueMedicalProofs();
      const leaveId = Number(request.params.id);
      const updatedLeave = await uploadMedicalProof(leaveId, request.user!, request.file ?? undefined);
      return sendSuccess(response, "Medical proof uploaded successfully", updatedLeave);
    } catch (error) {
      next(error);
    }
  },
);

router.put("/leaves/:id/medical-proof/approve", requireRoles("HR", "ADMIN"), async (request, response, next) => {
  try {
    await processOverdueMedicalProofs();
    const leaveId = Number(request.params.id);
    const updatedLeave = await approveMedicalProof(leaveId, request.user!);
    return sendSuccess(response, "Medical proof approved successfully", updatedLeave);
  } catch (error) {
    next(error);
  }
});

router.put("/leaves/:id/medical-proof/reject", requireRoles("HR", "ADMIN"), async (request, response, next) => {
  try {
    await processOverdueMedicalProofs();
    const leaveId = Number(request.params.id);
    const updatedLeave = await rejectMedicalProof(leaveId, request.user!);
    return sendSuccess(response, "Medical proof rejected successfully", updatedLeave);
  } catch (error) {
    next(error);
  }
});

router.post("/leaves/process-overdue-medical-proof", requireRoles("HR", "ADMIN"), async (_request, response, next) => {
  try {
    const updatedCount = await processOverdueMedicalProofs();
    return sendSuccess(response, "Overdue medical proof processed successfully", { updatedCount });
  } catch (error) {
    next(error);
  }
});

export default router;
