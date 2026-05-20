import { CalendarExceptionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { startOfDay, endOfDay } from "../../utils/dates.js";
import { buildMonthCalendarDays } from "./service.js";
import { getEmployeeLeaveBalanceByType, isPolicyActiveForYear } from "../../utils/leave-balance.js";
import { getFinancialYearForDate } from "../../utils/financial-year.js";

const router = Router();

const calendarQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
});

const workingSaturdaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

router.use(authenticate);

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  // We MUST use Date.UTC to prevent timezone shifts between server and DB
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

async function recalculateOverlappingLeaves(date: Date) {
  // 1. Find all APPROVED or PENDING leave requests covering this date
  const overlappingLeaves = await prisma.leaveRequest.findMany({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
      status: { in: ["APPROVED", "PENDING"] },
    },
    include: {
      leaveType: true,
    },
  });

  for (const leave of overlappingLeaves) {
    // 2. Fetch the calendar exceptions for this leave's date range
    const calendarExceptions = await prisma.calendarException.findMany({
      where: {
        date: {
          gte: startOfDay(leave.startDate),
          lte: startOfDay(leave.endDate),
        },
      },
    });

    // 3. Helper to determine if a date is a working day
    const isWorkingDay = (d: Date) => {
      const exception = calendarExceptions.find(
        (ex) => startOfDay(ex.date).getTime() === startOfDay(d).getTime()
      );
      if (exception) {
        return exception.type === "WORKING_SATURDAY";
      }
      const day = d.getDay();
      return day !== 0 && day !== 6;
    };

    // 4. Calculate new totalDays
    const sameDay =
      leave.startDate.getFullYear() === leave.endDate.getFullYear() &&
      leave.startDate.getMonth() === leave.endDate.getMonth() &&
      leave.startDate.getDate() === leave.endDate.getDate();

    let newTotalDays = 0;
    const current = startOfDay(leave.startDate);
    const finalDate = startOfDay(leave.endDate);

    while (current <= finalDate) {
      const attendanceDate = new Date(current);
      if (isWorkingDay(attendanceDate)) {
        const isStartDay = attendanceDate.getTime() === startOfDay(leave.startDate).getTime();
        const isEndDay = attendanceDate.getTime() === finalDate.getTime();

        if (sameDay) {
          newTotalDays += leave.startDayDuration === "HALF_DAY" ? 0.5 : 1;
        } else if ((isStartDay && leave.startDayDuration === "HALF_DAY") || (isEndDay && leave.endDayDuration === "HALF_DAY")) {
          newTotalDays += 0.5;
        } else {
          newTotalDays += 1;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    const oldTotalDays = leave.totalDays;
    const diff = newTotalDays - oldTotalDays;

    if (diff === 0) continue;

    if (leave.status === "APPROVED") {
      await prisma.$transaction(async (tx) => {
        const balance = await getEmployeeLeaveBalanceByType(
          tx as any,
          leave.employeeId,
          leave.leaveTypeId,
          getFinancialYearForDate(leave.startDate),
          new Date()
        );

        if (balance) {
          const oldDeducted = leave.deductedDays ?? leave.paidDays;
          const policyActive = isPolicyActiveForYear(leave.leaveType as any, getFinancialYearForDate(leave.startDate));
          const newDeducted = policyActive && leave.leaveType.deductFullQuotaOnApproval
            ? leave.leaveType.defaultDaysPerYear
            : Math.min(balance.remainingDays + oldDeducted, newTotalDays);

          const deductionDiff = newDeducted - oldDeducted;

          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              usedDays: Math.max(balance.usedDays + deductionDiff, 0),
              remainingDays: balance.remainingDays - deductionDiff,
              visibleDays: Math.max(balance.visibleDays - deductionDiff, 0),
            } as never,
          });

          await tx.leaveRequest.update({
            where: { id: leave.id },
            data: {
              totalDays: newTotalDays,
              paidDays: newDeducted,
              unpaidDays: Math.max(newTotalDays - newDeducted, 0),
              isUnpaid: newTotalDays - newDeducted > 0,
              deductedDays: newDeducted,
            } as never,
          });
        }
      });

      // Synchronize Attendance entries
      const attendanceEntries = [];
      const attCurrent = startOfDay(leave.startDate);
      const attFinal = startOfDay(leave.endDate);
      while (attCurrent <= attFinal) {
        const attendanceDate = new Date(attCurrent);
        if (isWorkingDay(attendanceDate)) {
          const isStartDay = attendanceDate.getTime() === startOfDay(leave.startDate).getTime();
          const isEndDay = attendanceDate.getTime() === attFinal.getTime();
          const isSameDay = isStartDay && isEndDay;
          let status = "LEAVE";
          if (isSameDay) {
            status = leave.startDayDuration === "HALF_DAY" ? "HALF_DAY" : "LEAVE";
          } else if ((isStartDay && leave.startDayDuration === "HALF_DAY") || (isEndDay && leave.endDayDuration === "HALF_DAY")) {
            status = "HALF_DAY";
          }
          attendanceEntries.push({ attendanceDate, status });
        }
        attCurrent.setDate(attCurrent.getDate() + 1);
      }

      await prisma.attendance.deleteMany({
        where: {
          employeeId: leave.employeeId,
          attendanceDate: {
            gte: startOfDay(leave.startDate),
            lte: endOfDay(leave.endDate),
          },
          status: { in: ["LEAVE", "HALF_DAY"] },
        },
      });

      for (const entry of attendanceEntries) {
        await prisma.attendance.upsert({
          where: {
            employeeId_attendanceDate: {
              employeeId: leave.employeeId,
              attendanceDate: entry.attendanceDate,
            },
          },
          update: {
            status: entry.status as any,
            workedMinutes: 0,
            checkInTime: null,
            checkOutTime: null,
          },
          create: {
            employeeId: leave.employeeId,
            attendanceDate: entry.attendanceDate,
            status: entry.status as any,
            workedMinutes: 0,
          },
        });
      }
    } else {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          totalDays: newTotalDays,
          paidDays: newTotalDays,
          unpaidDays: 0,
          isUnpaid: false,
        } as never,
      });
    }
  }
}

router.get("/", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), validate(calendarQuerySchema, "query"), async (request, response, next) => {
  try {
    const month = Number(request.query.month);
    const year = Number(request.query.year);
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const [exceptions, approvedLeaves] = await Promise.all([
      prisma.calendarException.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: "asc" },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          OR: [
            { startDate: { gte: monthStart, lte: monthEnd } },
            { endDate: { gte: monthStart, lte: monthEnd } },
            { AND: [{ startDate: { lte: monthStart } }, { endDate: { gte: monthEnd } }] },
          ],
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const days = buildMonthCalendarDays({ 
      year, 
      month, 
      exceptions, 
      leaves: approvedLeaves as any 
    });

    return sendSuccess(response, "Calendar fetched successfully", {
      month,
      year,
      days,
      exceptions,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/holidays", requireRoles("ADMIN", "HR"), validate(holidaySchema), async (request, response, next) => {
  try {
    const date = parseDateInput(request.body.date);

    const calendarException = await prisma.calendarException.upsert({
      where: { date },
      update: {
        type: CalendarExceptionType.HOLIDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
      create: {
        date,
        type: CalendarExceptionType.HOLIDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
    });

    await recalculateOverlappingLeaves(date);

    return sendSuccess(response, "Holiday saved successfully", calendarException, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/working-saturdays", requireRoles("ADMIN", "HR"), validate(workingSaturdaySchema), async (request, response, next) => {
  try {
    const date = parseDateInput(request.body.date);

    if (date.getDay() !== 6) {
      throw new AppError("Only Saturdays can be marked as working days");
    }

    const calendarException = await prisma.calendarException.upsert({
      where: { date },
      update: {
        type: CalendarExceptionType.WORKING_SATURDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
      create: {
        date,
        type: CalendarExceptionType.WORKING_SATURDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
    });

    await recalculateOverlappingLeaves(date);

    return sendSuccess(response, "Working Saturday saved successfully", calendarException, 201);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRoles("ADMIN", "HR"), async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("Invalid calendar exception id");
    }

    const calendarException = await prisma.calendarException.findUnique({
      where: { id },
    });

    if (!calendarException) {
      throw new AppError("Calendar exception not found", 404);
    }

    await prisma.calendarException.delete({
      where: { id },
    });

    await recalculateOverlappingLeaves(calendarException.date);

    return sendSuccess(response, "Calendar exception removed successfully", { id });
  } catch (error) {
    next(error);
  }
});

export default router;
