import { AttendanceRegularizationStatus, AttendanceStatus, LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { endOfDay, startOfDay } from "../../utils/dates.js";
import { canTeamLeadAccessEmployee, getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import { getCalendarDayStatus } from "../calendar/service.js";
import {
  buildAttendanceWhereForDate,
  buildApprovedLeaveWhereForAttendanceDate,
  calculateWorkedMinutes,
  combineAttendanceDateAndTime,
  finalizeAttendanceForDate,
  getApprovedLeaveAttendanceStatusForDate,
  getRegularizedAttendanceStatus,
  parseAttendanceDateInput,
  finalizeAttendanceStatus,
} from "./service.js";
import {
  calculateOvertimeDuration,
  isOvertimeEligible,
  getMonthlyOvertimeHours,
} from "./overtime-service.js";

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

async function enrichAttendanceWithLeaveContext(
  records: Array<{
    id: number;
    employeeId: number;
    attendanceDate: Date;
    status: AttendanceStatus;
  }>,
) {
  if (!records.length) {
    return records;
  }

  const employeeIds = [...new Set(records.map((record) => record.employeeId))];
  const attendanceDates = records.map((record) => record.attendanceDate.getTime());
  const rangeStart = new Date(Math.min(...attendanceDates));
  const rangeEnd = new Date(Math.max(...attendanceDates));

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: LeaveStatus.APPROVED,
      startDate: { lte: endOfDay(rangeEnd) },
      endDate: { gte: startOfDay(rangeStart) },
    },
    include: {
      leaveType: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  });

  return records.map((record) => {
    if (record.status !== AttendanceStatus.LEAVE && record.status !== AttendanceStatus.HALF_DAY) {
      return record;
    }

    const matchingLeave = leaveRequests.find((leaveRequest) => {
      if (leaveRequest.employeeId !== record.employeeId) {
        return false;
      }

      const derivedStatus = getApprovedLeaveAttendanceStatusForDate(leaveRequest, record.attendanceDate);
      return (
        derivedStatus === record.status &&
        startOfDay(record.attendanceDate) >= startOfDay(leaveRequest.startDate) &&
        startOfDay(record.attendanceDate) <= startOfDay(leaveRequest.endDate)
      );
    });

    return {
      ...record,
      leaveTypeCode: matchingLeave?.leaveType.code ?? null,
      leaveTypeName: matchingLeave?.leaveType.name ?? null,
    };
  });
}

async function getAttendanceTodayForEmployee(employeeId: number) {
  const today = startOfDay(new Date());
  const [attendanceTodayRecord, approvedLeaveToday] = await Promise.all([
    prisma.attendance.findFirst({
      where: {
        employeeId,
        attendanceDate: buildAttendanceWhereForDate(today),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        ...buildApprovedLeaveWhereForAttendanceDate(today),
      },
      include: {
        leaveType: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    attendanceTodayRecord ??
    (approvedLeaveToday
      ? {
          id: 0,
          employeeId,
          attendanceDate: today,
          checkInTime: null,
          checkOutTime: null,
          workedMinutes: 0,
          status:
            getApprovedLeaveAttendanceStatusForDate(approvedLeaveToday, today) === AttendanceStatus.HALF_DAY
              ? AttendanceStatus.HALF_DAY
              : AttendanceStatus.LEAVE,
          leaveTypeCode: approvedLeaveToday.leaveType.code,
          leaveTypeName: approvedLeaveToday.leaveType.name,
        }
      : null)
  );
}

router.use(authenticate);

router.get("/today", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const [attendanceToday, overtimeSession] = await Promise.all([
      getAttendanceTodayForEmployee(employeeId),
      prisma.overtimeSession.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: startOfDay(new Date()),
          },
        },
      }),
    ]);

    const isOvertimeEligible = attendanceToday?.checkOutTime ? true : false;

    return sendSuccess(response, "Today's attendance fetched successfully", { 
      attendanceToday, 
      overtimeSession,
      isOvertimeEligible 
    });
  } catch (error) {
    next(error);
  }
});

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
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,
        attendanceDate: buildAttendanceWhereForDate(today),
      },
      orderBy: { createdAt: "desc" },
    });

    const approvedLeaveToday = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        ...buildApprovedLeaveWhereForAttendanceDate(today),
      },
      select: {
        startDate: true,
        endDate: true,
        startDayDuration: true,
        endDayDuration: true,
      },
    });

    if (approvedLeaveToday) {
      const leaveStatus = getApprovedLeaveAttendanceStatusForDate(approvedLeaveToday, today);
      throw new AppError(
        leaveStatus === AttendanceStatus.HALF_DAY
          ? "Check-in is not available on approved half-day leave yet"
          : "You are already marked on approved leave for today",
      );
    }

    if (existing?.status === AttendanceStatus.LEAVE) {
      throw new AppError("You are already marked on approved leave for today");
    }

    if (existing?.status === AttendanceStatus.ABSENT) {
      throw new AppError("Attendance for today is finalized as absent. Please request a correction.");
    }

    if (existing?.checkInTime) {
      throw new AppError(existing.checkOutTime ? "Attendance already completed for today" : "Attendance already checked in for today");
    }

    const checkInTime = new Date();

    // --- Late Mark Logic ---
    // Grace period ends at 10:10 AM. Any check-in after this is marked late.
    const LATE_THRESHOLD_HOUR = 10;
    const LATE_THRESHOLD_MINUTE = 10;
    const thresholdTime = new Date(checkInTime);
    thresholdTime.setHours(LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, 0, 0);

    const isLate = checkInTime > thresholdTime;
    const lateByMinutes = isLate
      ? Math.floor((checkInTime.getTime() - thresholdTime.getTime()) / 60000)
      : 0;
    // -------------------------

    const attendance = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkInTime,
            status: AttendanceStatus.PRESENT,
            isLate,
            lateByMinutes,
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId,
            attendanceDate: today,
            checkInTime,
            status: AttendanceStatus.PRESENT,
            isLate,
            lateByMinutes,
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
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        attendanceDate: buildAttendanceWhereForDate(today),
      },
      orderBy: { createdAt: "desc" },
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

// ── Break Session Routes ──────────────────────────────

router.get("/break/today", async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId;
    if (!employeeId) throw new AppError("Employee context is required", 400);

    const today = startOfDay(new Date());
    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, attendanceDate: buildAttendanceWhereForDate(today) },
      orderBy: { createdAt: "desc" },
    });

    if (!attendance) {
      return sendSuccess(response, "No attendance record for today", { breakSessions: [] });
    }

    const breakSessions = await prisma.breakSession.findMany({
      where: { attendanceId: attendance.id },
      orderBy: { startTime: "asc" },
    });

    return sendSuccess(response, "Break sessions fetched", { breakSessions });
  } catch (error) {
    next(error);
  }
});

router.post("/break/start", async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId;
    if (!employeeId) throw new AppError("Employee context is required", 400);

    const today = startOfDay(new Date());
    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, attendanceDate: buildAttendanceWhereForDate(today) },
      orderBy: { createdAt: "desc" },
    });

    if (!attendance?.checkInTime) throw new AppError("You must be checked in before starting a break");
    if (attendance.checkOutTime) throw new AppError("Your shift has already ended");

    const openBreak = await prisma.breakSession.findFirst({
      where: { attendanceId: attendance.id, endTime: null },
    });
    if (openBreak) throw new AppError("A break is already in progress");

    const breakSession = await prisma.breakSession.create({
      data: { attendanceId: attendance.id, employeeId, startTime: new Date() },
    });

    return sendSuccess(response, "Break started", breakSession, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/break/end", async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId;
    if (!employeeId) throw new AppError("Employee context is required", 400);

    const today = startOfDay(new Date());
    const attendance = await prisma.attendance.findFirst({
      where: { employeeId, attendanceDate: buildAttendanceWhereForDate(today) },
      orderBy: { createdAt: "desc" },
    });

    if (!attendance) throw new AppError("No attendance record found for today");

    const openBreak = await prisma.breakSession.findFirst({
      where: { attendanceId: attendance.id, endTime: null },
      orderBy: { startTime: "desc" },
    });

    if (!openBreak) throw new AppError("No active break session found");

    const endTime = new Date();
    const durationMinutes = Math.floor((endTime.getTime() - openBreak.startTime.getTime()) / 60000);

    const updated = await prisma.breakSession.update({
      where: { id: openBreak.id },
      data: { endTime, durationMinutes },
    });

    return sendSuccess(response, "Break ended", updated);
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
              where: {
                attendanceDate: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
              },
              select: { employeeId: true },
              distinct: ["employeeId"],
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
          updateAttendanceWithMissingCheckout: async (attendanceDate, cutoffHour) => {
            const attendancesToUpdate = await prisma.attendance.findMany({
              where: {
                attendanceDate: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
                checkInTime: { not: null },
                status: AttendanceStatus.PRESENT,
              },
            });

            let updatedCount = 0;
            for (const attendance of attendancesToUpdate) {
              const finalStatus = finalizeAttendanceStatus(
                attendance.checkInTime,
                attendance.checkOutTime
              );

              if (finalStatus !== attendance.status) {
                await prisma.attendance.update({
                  where: { id: attendance.id },
                  data: { status: finalStatus },
                });
                updatedCount++;
              }
            }

            return updatedCount;
          },
          isWorkingDay: async (attendanceDate) => {
            const exceptions = await prisma.calendarException.findMany({
              where: {
                date: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
              },
            });

            return getCalendarDayStatus(attendanceDate, exceptions).isWorkingDay;
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
    const requestedDate = request.query.date ? parseAttendanceDateInput(String(request.query.date)) : undefined;
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
        const isTeamLead = await hasEmployeeCapability(prisma, request.user.employeeId, "TEAM_LEAD");

        where = isTeamLead
          ? {
              OR: [{ employeeId: request.user.employeeId }, { employeeId: { in: await getScopedEmployeeIdsForTeamLead(prisma, request.user.employeeId) } }],
            }
          : { employeeId: request.user.employeeId };
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

    if (requestedDate) {
      const dateRange = {
        gte: startOfDay(requestedDate),
        lte: endOfDay(requestedDate),
      };

      where = {
        ...where,
        attendanceDate: dateRange,
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
    });

    const enrichedAttendance = await enrichAttendanceWithLeaveContext(attendance);

    return sendSuccess(response, "Attendance records fetched successfully", enrichedAttendance);
  } catch (error) {
    next(error);
  }
});

// Overtime Routes
router.get("/overtime/today", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const today = startOfDay(new Date());
    const overtimeSession = await prisma.overtimeSession.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    return sendSuccess(response, "Today's overtime session fetched successfully", { overtimeSession });
  } catch (error) {
    next(error);
  }
});

router.post("/overtime/start", validate(attendanceSchema), async (request, response, next) => {
  try {
    const employeeId = request.body.employeeId ?? request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const isPrivileged = ["ADMIN", "HR"].includes(request.user!.role);

    if (!isPrivileged && request.user?.employeeId !== employeeId) {
      throw new AppError("You are not authorized to start overtime for this employee", 403);
    }

    const today = startOfDay(new Date());
    
    // Check if regular attendance is completed
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        attendanceDate: buildAttendanceWhereForDate(today),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!attendance?.checkOutTime) {
      throw new AppError("Regular attendance checkout is required before starting overtime");
    }

    // Check if overtime session already exists
    const existingOvertime = await prisma.overtimeSession.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (existingOvertime) {
      if (existingOvertime.status === "ACTIVE") {
        throw new AppError("Overtime session already in progress");
      } else {
        throw new AppError("Overtime session already completed for today");
      }
    }

    const overtimeSession = await prisma.overtimeSession.create({
      data: {
        employeeId,
        date: today,
        startTime: new Date(),
        status: "ACTIVE",
      },
    });

    return sendSuccess(response, "Overtime started successfully", overtimeSession, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/overtime/end", validate(attendanceSchema), async (request, response, next) => {
  try {
    const employeeId = request.body.employeeId ?? request.user?.employeeId;

    if (!employeeId) {
      throw new AppError("Employee context is required", 400);
    }

    const isPrivileged = ["ADMIN", "HR"].includes(request.user!.role);

    if (!isPrivileged && request.user?.employeeId !== employeeId) {
      throw new AppError("You are not authorized to end overtime for this employee", 403);
    }

    const today = startOfDay(new Date());
    const overtimeSession = await prisma.overtimeSession.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (!overtimeSession) {
      throw new AppError("No active overtime session found");
    }

    if (overtimeSession.status !== "ACTIVE") {
      throw new AppError("Overtime session is not active");
    }

    const endTime = new Date();
    const duration = calculateOvertimeDuration(overtimeSession.startTime, endTime);

    const updatedSession = await prisma.overtimeSession.update({
      where: { id: overtimeSession.id },
      data: {
        endTime,
        duration,
        status: "COMPLETED",
      },
    });

    return sendSuccess(response, "Overtime ended successfully", updatedSession);
  } catch (error) {
    next(error);
  }
});

router.get("/overtime", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    const requestedMonth = request.query.month ? Number(request.query.month) : undefined;
    const requestedYear = request.query.year ? Number(request.query.year) : undefined;
    
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      if (!request.user.employeeId) {
        throw new AppError("Employee context is required", 400);
      }

      if (requestedEmployeeId && requestedEmployeeId !== request.user.employeeId) {
        const canAccess = await canTeamLeadAccessEmployee(prisma, request.user.employeeId, requestedEmployeeId);

        if (!canAccess) {
          throw new AppError("You are not authorized to view this overtime", 403);
        }

        where = { employeeId: requestedEmployeeId };
      } else {
        const isTeamLead = await hasEmployeeCapability(prisma, request.user.employeeId, "TEAM_LEAD");

        where = isTeamLead
          ? {
              OR: [{ employeeId: request.user.employeeId }, { employeeId: { in: await getScopedEmployeeIdsForTeamLead(prisma, request.user.employeeId) } }],
            }
          : { employeeId: request.user.employeeId };
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

    // Add month/year filter if provided
    if (requestedMonth && requestedYear) {
      const startDate = new Date(requestedYear, requestedMonth - 1, 1);
      const endDate = new Date(requestedYear, requestedMonth, 0);
      
      where = {
        ...where,
        date: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const overtimeSessions = await prisma.overtimeSession.findMany({
      where,
      include: {
        employee: true,
        verifier: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return sendSuccess(response, "Overtime sessions fetched successfully", overtimeSessions);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/overtime/:id/verify",
  requireRoles("ADMIN", "HR", "MANAGER"),
  validate(z.object({
    status: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: z.string().trim().optional(),
  })),
  async (request, response, next) => {
    try {
      const sessionId = Number(request.params.id);

      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw new AppError("Invalid overtime session");
      }

      const overtimeSession = await prisma.overtimeSession.findUnique({
        where: { id: sessionId },
        include: {
          employee: true,
        },
      });

      if (!overtimeSession) {
        throw new AppError("Overtime session not found", 404);
      }

      if (overtimeSession.status !== "COMPLETED") {
        throw new AppError("Only completed overtime sessions can be verified");
      }

      if (
        request.user?.role === "MANAGER" &&
        (!request.user.employeeId ||
          overtimeSession.employee.managerId !== request.user.employeeId)
      ) {
        throw new AppError("You are not authorized to verify this overtime session", 403);
      }

      if (request.body.status === "REJECTED" && !request.body.rejectionReason) {
        throw new AppError("Rejection reason is required");
      }

      const updatedSession = await prisma.overtimeSession.update({
        where: { id: sessionId },
        data: {
          status: request.body.status,
          verifiedBy: request.user?.employeeId,
          verifiedAt: new Date(),
          rejectionReason: request.body.status === "REJECTED" ? request.body.rejectionReason : null,
        },
        include: {
          employee: true,
          verifier: true,
        },
      });

      return sendSuccess(response, "Overtime session verified successfully", updatedSession);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
