import { AttendanceRegularizationStatus, AttendanceStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { startOfDay } from "../../utils/dates.js";
import { canTeamLeadAccessEmployee, getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import {
  buildApprovedLeaveWhereForAttendanceDate,
  calculateWorkedMinutes,
  combineAttendanceDateAndTime,
  finalizeAttendanceForDate,
  getRegularizedAttendanceStatus,
  parseAttendanceDateInput,
} from "./service.js";

const router = Router();

const attendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
});

const attendanceFinalizeSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const attendanceRegularizationCreateSchema = z.object({
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposedCheckInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  proposedCheckOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().min(1),
});

const attendanceRegularizationReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().optional(),
});

router.use(authenticate);

router.post("/check-in", validate(attendanceSchema), async (request, response, next) => {
  try {
    const employeeId = request.body.employeeId ?? request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const isPrivileged = ["ADMIN", "HR"].includes(request.user!.role);

    if (!isPrivileged && request.user?.employeeId !== employeeId) {
      throw new AppError("You are not authorized to mark attendance for this employee", 403);
    }

    const today = startOfDay(new Date());
    const existing = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: today,
        },
      },
    });

    if (existing?.status === AttendanceStatus.LEAVE) {
      throw new AppError("You are already marked on approved leave for today");
    }

    if (existing?.status === AttendanceStatus.ABSENT) {
      throw new AppError("Attendance for today is finalized as absent. Please request a correction.");
    }

    if (existing?.checkInTime) {
      throw new AppError(existing.checkOutTime ? "Attendance already completed for today" : "Attendance already checked in for today");
    }

    const attendance = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkInTime: new Date(),
            status: AttendanceStatus.PRESENT,
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId,
            attendanceDate: today,
            checkInTime: new Date(),
            status: AttendanceStatus.PRESENT,
          },
        });

    return sendSuccess(response, "Attendance checked in successfully", attendance, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/check-out", validate(attendanceSchema), async (request, response, next) => {
  try {
    const employeeId = request.body.employeeId ?? request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const isPrivileged = ["ADMIN", "HR"].includes(request.user!.role);

    if (!isPrivileged && request.user?.employeeId !== employeeId) {
      throw new AppError("You are not authorized to mark attendance for this employee", 403);
    }

    const today = startOfDay(new Date());
    const attendance = await prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate: today,
        },
      },
    });

    if (!attendance?.checkInTime) {
      throw new AppError("Check-in not found for today");
    }

    if (attendance.checkOutTime) {
      throw new AppError("Attendance already checked out for today");
    }

    const checkOutTime = new Date();
    const workedMinutes = Math.floor((checkOutTime.getTime() - attendance.checkInTime.getTime()) / (1000 * 60));

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime,
        workedMinutes,
      },
    });

    return sendSuccess(response, "Attendance checked out successfully", updatedAttendance);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/finalize",
  requireRoles("ADMIN", "HR"),
  validate(attendanceFinalizeSchema),
  async (request, response, next) => {
    try {
      const result = await finalizeAttendanceForDate(
        { date: request.body.date },
        {
          findActiveEmployees: async () =>
            prisma.employee.findMany({
              where: { isActive: true },
              select: {
                id: true,
                joiningDate: true,
              },
            }),
          findEmployeeIdsWithAttendance: async (attendanceDate) => {
            const records = await prisma.attendance.findMany({
              where: { attendanceDate },
              select: { employeeId: true },
            });

            return records.map((record) => record.employeeId);
          },
          findEmployeeIdsWithApprovedLeave: async (attendanceDate) => {
            const records = await prisma.leaveRequest.findMany({
              where: buildApprovedLeaveWhereForAttendanceDate(attendanceDate),
              select: { employeeId: true },
              distinct: ["employeeId"],
            });

            return records.map((record) => record.employeeId);
          },
          createAbsentAttendances: async (entries) => {
            const result = await prisma.attendance.createMany({
              data: entries,
              skipDuplicates: true,
            });

            return result.count;
          },
        },
      );

      return sendSuccess(response, "Attendance finalized successfully", result);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/regularizations",
  requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"),
  validate(attendanceRegularizationCreateSchema),
  async (request, response, next) => {
    try {
      const employeeId = request.user?.employeeId;

      if (!employeeId) {
        throw new AppError("Employee context is required", 400);
      }

      const attendanceDate = parseAttendanceDateInput(request.body.attendanceDate);
      const today = startOfDay(new Date());

      if (attendanceDate > today) {
        throw new AppError("Attendance correction cannot be requested for a future date");
      }

      const proposedCheckInTime = combineAttendanceDateAndTime(attendanceDate, request.body.proposedCheckInTime);
      const proposedCheckOutTime = combineAttendanceDateAndTime(attendanceDate, request.body.proposedCheckOutTime);

      if (!proposedCheckInTime && !proposedCheckOutTime) {
        throw new AppError("Provide at least one proposed check-in or check-out time");
      }

      if (proposedCheckInTime && proposedCheckOutTime && proposedCheckOutTime <= proposedCheckInTime) {
        throw new AppError("Proposed check-out must be after proposed check-in");
      }

      const duplicatePendingRequest = await prisma.attendanceRegularizationRequest.findFirst({
        where: {
          employeeId,
          attendanceDate,
          status: AttendanceRegularizationStatus.PENDING,
        },
      });

      if (duplicatePendingRequest) {
        throw new AppError("A pending attendance correction request already exists for this date");
      }

      const conflictingApprovedLeave = await prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          ...buildApprovedLeaveWhereForAttendanceDate(attendanceDate),
        },
      });

      if (conflictingApprovedLeave) {
        throw new AppError("Attendance correction is not allowed for a date covered by approved leave");
      }

      const regularizationRequest = await prisma.attendanceRegularizationRequest.create({
        data: {
          employeeId,
          attendanceDate,
          proposedCheckInTime,
          proposedCheckOutTime,
          reason: request.body.reason,
        },
        include: {
          employee: true,
          reviewedBy: true,
        },
      });

      return sendSuccess(response, "Attendance correction request submitted successfully", regularizationRequest, 201);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/regularizations", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      const employeeId = request.user.employeeId;

      if (!employeeId) {
        throw new AppError("Employee context is required", 400);
      }

      const isTeamLead = await hasEmployeeCapability(prisma, employeeId, "TEAM_LEAD");

      where = isTeamLead
        ? {
            OR: [{ employeeId }, { employeeId: { in: await getScopedEmployeeIdsForTeamLead(prisma, employeeId) } }],
          }
        : { employeeId };
    } else if (request.user?.role === "MANAGER" && request.user.employeeId) {
      where = {
        OR: [{ employeeId: request.user.employeeId }, { employee: { managerId: request.user.employeeId } }],
      };
    }

    const regularizationRequests = await prisma.attendanceRegularizationRequest.findMany({
      where,
      include: {
        employee: true,
        reviewedBy: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return sendSuccess(response, "Attendance correction requests fetched successfully", regularizationRequests);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/regularizations/:id/review",
  requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"),
  validate(attendanceRegularizationReviewSchema),
  async (request, response, next) => {
    try {
      const requestId = Number(request.params.id);

      if (!Number.isInteger(requestId) || requestId <= 0) {
        throw new AppError("Invalid attendance correction request");
      }

      const regularizationRequest = await prisma.attendanceRegularizationRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: true,
        },
      });

      if (!regularizationRequest) {
        throw new AppError("Attendance correction request not found", 404);
      }

      if (regularizationRequest.status !== AttendanceRegularizationStatus.PENDING) {
        throw new AppError("Only pending attendance correction requests can be reviewed");
      }

      if (
        request.user?.role === "MANAGER" &&
        (!request.user.employeeId ||
          regularizationRequest.employee.managerId !== request.user.employeeId ||
          regularizationRequest.employeeId === request.user.employeeId)
      ) {
        throw new AppError("You are not authorized to review this attendance correction request", 403);
      }

      if (request.user?.role === "EMPLOYEE") {
        if (!request.user.employeeId || regularizationRequest.employeeId === request.user.employeeId) {
          throw new AppError("You are not authorized to review this attendance correction request", 403);
        }

        const canAccess = await canTeamLeadAccessEmployee(prisma, request.user.employeeId, regularizationRequest.employeeId);

        if (!canAccess) {
          throw new AppError("You are not authorized to review this attendance correction request", 403);
        }
      }

      if (request.body.status === "REJECTED" && !request.body.rejectionReason) {
        throw new AppError("Rejection reason is required");
      }

      if (request.body.status === "APPROVED") {
        const conflictingApprovedLeave = await prisma.leaveRequest.findFirst({
          where: {
            employeeId: regularizationRequest.employeeId,
            ...buildApprovedLeaveWhereForAttendanceDate(regularizationRequest.attendanceDate),
          },
        });

        if (conflictingApprovedLeave) {
          throw new AppError("Attendance correction cannot be approved for a date covered by approved leave");
        }

        const existingAttendance = await prisma.attendance.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: regularizationRequest.employeeId,
              attendanceDate: regularizationRequest.attendanceDate,
            },
          },
        });

        if (existingAttendance?.status === AttendanceStatus.LEAVE) {
          throw new AppError("Attendance correction cannot overwrite leave attendance");
        }

        const status = getRegularizedAttendanceStatus(
          regularizationRequest.proposedCheckInTime,
          regularizationRequest.proposedCheckOutTime,
        );
        const workedMinutes = calculateWorkedMinutes(
          regularizationRequest.proposedCheckInTime,
          regularizationRequest.proposedCheckOutTime,
        );

        await prisma.$transaction([
          existingAttendance
            ? prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  checkInTime: regularizationRequest.proposedCheckInTime,
                  checkOutTime: regularizationRequest.proposedCheckOutTime,
                  workedMinutes,
                  status,
                },
              })
            : prisma.attendance.create({
                data: {
                  employeeId: regularizationRequest.employeeId,
                  attendanceDate: regularizationRequest.attendanceDate,
                  checkInTime: regularizationRequest.proposedCheckInTime,
                  checkOutTime: regularizationRequest.proposedCheckOutTime,
                  workedMinutes,
                  status,
                },
              }),
          prisma.attendanceRegularizationRequest.update({
            where: { id: regularizationRequest.id },
            data: {
              status: AttendanceRegularizationStatus.APPROVED,
              reviewedById: request.user?.employeeId,
              reviewedAt: new Date(),
              rejectionReason: null,
            },
          }),
        ]);
      } else {
        await prisma.attendanceRegularizationRequest.update({
          where: { id: regularizationRequest.id },
          data: {
            status: AttendanceRegularizationStatus.REJECTED,
            reviewedById: request.user?.employeeId,
            reviewedAt: new Date(),
            rejectionReason: request.body.rejectionReason,
          },
        });
      }

      const updatedRequest = await prisma.attendanceRegularizationRequest.findUnique({
        where: { id: regularizationRequest.id },
        include: {
          employee: true,
          reviewedBy: true,
        },
      });

      return sendSuccess(response, "Attendance correction request reviewed successfully", updatedRequest);
    } catch (error) {
      next(error);
    }
  },
);

router.post("/regularizations/:id/cancel", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const requestId = Number(request.params.id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      throw new AppError("Invalid attendance correction request");
    }

    const regularizationRequest = await prisma.attendanceRegularizationRequest.findUnique({
      where: { id: requestId },
      include: {
        employee: true,
      },
    });

    if (!regularizationRequest) {
      throw new AppError("Attendance correction request not found", 404);
    }

    if (regularizationRequest.employeeId !== request.user?.employeeId) {
      throw new AppError("You are not authorized to cancel this attendance correction request", 403);
    }

    if (regularizationRequest.status !== AttendanceRegularizationStatus.PENDING) {
      throw new AppError("Only pending attendance correction requests can be cancelled");
    }

    const updatedRequest = await prisma.attendanceRegularizationRequest.update({
      where: { id: regularizationRequest.id },
      data: {
        status: AttendanceRegularizationStatus.CANCELLED,
      },
      include: {
        employee: true,
        reviewedBy: true,
      },
    });

    return sendSuccess(response, "Attendance correction request cancelled successfully", updatedRequest);
  } catch (error) {
    next(error);
  }
});

router.get("/", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      if (!request.user.employeeId) {
        throw new AppError("Employee context is required", 400);
      }

      if (requestedEmployeeId && requestedEmployeeId !== request.user.employeeId) {
        const canAccess = await canTeamLeadAccessEmployee(prisma, request.user.employeeId, requestedEmployeeId);

        if (!canAccess) {
          throw new AppError("You are not authorized to view this attendance", 403);
        }

        where = { employeeId: requestedEmployeeId };
      } else {
        where = { employeeId: request.user.employeeId };
      }
    } else if (request.user?.role === "MANAGER" && request.user.employeeId) {
      where = requestedEmployeeId
        ? requestedEmployeeId === request.user.employeeId
          ? { employeeId: requestedEmployeeId }
          : { employeeId: requestedEmployeeId, employee: { managerId: request.user.employeeId } }
        : { employee: { managerId: request.user.employeeId } };
    } else if (requestedEmployeeId) {
      where = { employeeId: requestedEmployeeId };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
    });

    return sendSuccess(response, "Attendance records fetched successfully", attendance);
  } catch (error) {
    next(error);
  }
});

export default router;
