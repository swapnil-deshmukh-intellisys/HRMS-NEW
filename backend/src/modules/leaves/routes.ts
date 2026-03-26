import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LeaveDurationType, LeaveStatus } from "@prisma/client";
import { Router } from "express";
import multer, { type FileFilterCallback, type StorageEngine } from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { canTeamLeadAccessEmployee, getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import { buildApprovedLeaveAttendanceEntries, buildLeaveOverlapWhere, createLeaveRequestForEmployee, hasAttendanceConflict } from "./service.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../../uploads/leaves");
fs.mkdirSync(uploadsDir, { recursive: true });

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
    ) => {
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9-_]/g, "_");
      callback(null, `${Date.now()}-${baseName}${extension}`);
    },
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

const applyLeaveSchema = z.object({
  leaveTypeId: z.coerce.number().int().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  startDayDuration: z.nativeEnum(LeaveDurationType).default(LeaveDurationType.FULL_DAY),
  endDayDuration: z.nativeEnum(LeaveDurationType).default(LeaveDurationType.FULL_DAY),
  reason: z.string().min(3),
});

const reviewLeaveSchema = z.object({
  rejectionReason: z.string().min(3),
});

router.use(authenticate);

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

    const year = request.query.year ? Number(request.query.year) : new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: {
        employeeId,
        year,
      },
      include: {
        leaveType: true,
      },
    });

    return sendSuccess(response, "Leave balances fetched successfully", balances);
  } catch (error) {
    next(error);
  }
});

router.get("/leaves", async (request, response, next) => {
  try {
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
        approvedBy: true,
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
        findLeaveBalance: ({ employeeId, leaveTypeId, year }) =>
          prisma.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId,
                leaveTypeId,
                year,
              },
            },
          }),
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
              reason,
            },
            include: {
              employee: true,
              leaveType: true,
            },
          }),
      },
    );

    return sendSuccess(response, "Leave request submitted successfully", leaveRequest, 201);
  } catch (error) {
    next(error);
  }
});

async function reviewLeave(
  status: LeaveStatus,
  leaveId: number,
  actor: NonNullable<Express.Request["user"]>,
  rejectionReason?: string,
) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      employee: true,
    },
  });

  if (!leaveRequest) {
    throw new AppError("Leave request not found", 404);
  }

  if (leaveRequest.status !== LeaveStatus.PENDING) {
    throw new AppError("Only pending leave requests can be reviewed");
  }

  if (leaveRequest.employeeId === actor.employeeId) {
    throw new AppError("You cannot review your own leave request", 403);
  }

  if (actor.role === "MANAGER" && leaveRequest.employee.managerId !== actor.employeeId) {
    throw new AppError("Managers can only review leave for their direct reports", 403);
  }

  if (actor.role === "EMPLOYEE") {
    if (!actor.employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const canAccess = await canTeamLeadAccessEmployee(prisma, actor.employeeId, leaveRequest.employeeId);

    if (!canAccess) {
      throw new AppError("You are not authorized to review this leave request", 403);
    }
  }

  return prisma.$transaction(async (transaction) => {
    if (status === LeaveStatus.APPROVED) {
      const attendanceEntries = buildApprovedLeaveAttendanceEntries({
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        startDayDuration: leaveRequest.startDayDuration,
        endDayDuration: leaveRequest.endDayDuration,
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

      const balance = await transaction.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: leaveRequest.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: leaveRequest.startDate.getFullYear(),
          },
        },
      });

        if (leaveRequest.paidDays > 0) {
          if (!balance || balance.remainingDays < leaveRequest.paidDays) {
            throw new AppError("Insufficient leave balance");
          }

          await transaction.leaveBalance.update({
            where: { id: balance.id },
            data: {
              usedDays: balance.usedDays + leaveRequest.paidDays,
              remainingDays: balance.remainingDays - leaveRequest.paidDays,
            },
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
    }

    return transaction.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: {
        status,
        approvedById: actor.employeeId,
        approvedAt: new Date(),
        rejectionReason,
      },
      include: {
        employee: true,
        leaveType: true,
        approvedBy: true,
      },
    });
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

  if (leaveRequest.employeeId !== actor.employeeId && actor.role !== "HR" && actor.role !== "ADMIN") {
    throw new AppError("You can only cancel your own leave request", 403);
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: LeaveStatus.CANCELLED,
      approvedById: null,
      approvedAt: null,
      rejectionReason: null,
    },
    include: {
      employee: true,
      leaveType: true,
      approvedBy: true,
    },
  });
}

router.put("/leaves/:id/approve", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const leaveId = Number(request.params.id);
    const reviewedLeave = await reviewLeave(LeaveStatus.APPROVED, leaveId, request.user!);
    return sendSuccess(response, "Leave approved successfully", reviewedLeave);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/leaves/:id/reject",
  requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"),
  validate(reviewLeaveSchema),
  async (request, response, next) => {
    try {
      const leaveId = Number(request.params.id);
      const reviewedLeave = await reviewLeave(LeaveStatus.REJECTED, leaveId, request.user!, request.body.rejectionReason);
      return sendSuccess(response, "Leave rejected successfully", reviewedLeave);
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

export default router;
