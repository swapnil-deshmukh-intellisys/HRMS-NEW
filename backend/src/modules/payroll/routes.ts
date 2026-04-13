import { LeaveStatus, PayrollStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { endOfDay, startOfDay } from "../../utils/dates.js";
import { getCalendarDayStatus } from "../calendar/service.js";
import { assertPayrollEditable, calculatePayrollPreview } from "./service.js";

const router = Router();

const payrollSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  salary: z.coerce.number().positive().optional(),
  status: z.nativeEnum(PayrollStatus).default(PayrollStatus.DRAFT),
});

const payrollPreviewQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
});

router.use(authenticate);

function getMonthBounds(month: number, year: number) {
  return {
    monthStart: startOfDay(new Date(year, month - 1, 1)),
    monthEnd: endOfDay(new Date(year, month, 0)),
  };
}

async function assertPayrollAccess(requestedEmployeeId: number, requestUser: NonNullable<Express.Request["user"]>) {
  if (requestUser.role === "EMPLOYEE") {
    if (requestedEmployeeId !== requestUser.employeeId) {
      throw new AppError("You are not authorized to view this employee payroll", 403);
    }
    return;
  }

  if (requestUser.role === "MANAGER" && requestUser.employeeId) {
    if (requestedEmployeeId === requestUser.employeeId) {
      return;
    }

    const managedEmployee = await prisma.employee.findUnique({
      where: { id: requestedEmployeeId },
      select: { id: true, managerId: true },
    });

    if (!managedEmployee || managedEmployee.managerId !== requestUser.employeeId) {
      throw new AppError("You are not authorized to view this employee payroll", 403);
    }
  }
}

async function buildPayrollPreview(employeeId: number, month: number, year: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      joiningDate: true,
      annualPackageLpa: true,
      grossMonthlySalary: true,
      basicMonthlySalary: true,
      isOnProbation: true,
      probationEndDate: true,
    },
  });

  if (!employee) {
    throw new AppError("Employee not found", 404);
  }

  if (employee.grossMonthlySalary == null || employee.basicMonthlySalary == null) {
    throw new AppError("Employee compensation is not configured", 400);
  }

  const { monthStart, monthEnd } = getMonthBounds(month, year);
  const effectiveRangeStart =
    startOfDay(employee.joiningDate) > startOfDay(monthStart) ? startOfDay(employee.joiningDate) : startOfDay(monthStart);
  const today = startOfDay(new Date());
  const effectiveRangeEnd = today < startOfDay(monthEnd) ? today : startOfDay(monthEnd);

  if (effectiveRangeStart > effectiveRangeEnd) {
    const preview = calculatePayrollPreview({
      grossMonthlySalary: employee.grossMonthlySalary,
      basicMonthlySalary: employee.basicMonthlySalary,
      month,
      deductibleDays: 0,
    });

    return {
      employee,
      month,
      year,
      ...preview,
    };
  }

  const [calendarExceptions, monthAttendances, approvedLeaves] = await Promise.all([
    prisma.calendarException.findMany({
      where: {
        date: {
          gte: effectiveRangeStart,
          lte: effectiveRangeEnd,
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        employeeId,
        attendanceDate: {
          gte: effectiveRangeStart,
          lte: effectiveRangeEnd,
        },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: effectiveRangeEnd },
        endDate: { gte: effectiveRangeStart },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const attendanceByDate = new Map(
    monthAttendances.map((attendance) => [startOfDay(attendance.attendanceDate).getTime(), attendance]),
  );
  const leaveDates = new Set<number>();

  for (const leaveRequest of approvedLeaves) {
    const cursor = startOfDay(leaveRequest.startDate);
    const finalDate = startOfDay(leaveRequest.endDate);

    while (cursor <= finalDate) {
      leaveDates.add(cursor.getTime());
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let deductibleDays = 0;
  let absentDeductionDays = 0;
  let halfDayDeductionDays = 0;
  const cursor = startOfDay(effectiveRangeStart);

  while (cursor <= effectiveRangeEnd) {
    const timestamp = cursor.getTime();
    const isWorkingDay = getCalendarDayStatus(cursor, calendarExceptions).isWorkingDay;
    const attendance = attendanceByDate.get(timestamp);
    const hasApprovedLeave = leaveDates.has(timestamp);
    const isHalfDay = attendance?.status === "HALF_DAY";
    const hasQualifyingAttendance = Boolean(attendance && attendance.status !== "ABSENT");

    if (isWorkingDay && !hasApprovedLeave && isHalfDay) {
      halfDayDeductionDays += 0.5;
      deductibleDays += 0.5;
    } else if (isWorkingDay && !hasQualifyingAttendance && !hasApprovedLeave) {
      absentDeductionDays += 1;
      deductibleDays += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const preview = calculatePayrollPreview({
    grossMonthlySalary: employee.grossMonthlySalary,
    basicMonthlySalary: employee.basicMonthlySalary,
    month,
    absentDeductionDays,
    halfDayDeductionDays,
    deductibleDays,
    isOnProbation: employee.isOnProbation,
  });

  return {
    employee,
    month,
    year,
    ...preview,
  };
}

router.get("/", async (request, response, next) => {
  try {
    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      if (requestedEmployeeId && requestedEmployeeId !== request.user.employeeId) {
        throw new AppError("You are not authorized to view this employee payroll", 403);
      }

      where = { employeeId: request.user.employeeId };
    } else if (request.user?.role === "MANAGER" && request.user.employeeId) {
      where = requestedEmployeeId
        ? requestedEmployeeId === request.user.employeeId
          ? { employeeId: requestedEmployeeId }
          : { employeeId: requestedEmployeeId, employee: { managerId: request.user.employeeId } }
        : { employee: { managerId: request.user.employeeId } };
    } else if (requestedEmployeeId) {
      where = { employeeId: requestedEmployeeId };
    }

    const payrollRecords = await prisma.payrollRecord.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return sendSuccess(response, "Payroll records fetched successfully", payrollRecords);
  } catch (error) {
    next(error);
  }
});

router.get("/preview", validate(payrollPreviewQuerySchema, "query"), async (request, response, next) => {
  try {
    const employeeId = Number(request.query.employeeId);
    const month = Number(request.query.month);
    const year = Number(request.query.year);

    await assertPayrollAccess(employeeId, request.user!);
    const preview = await buildPayrollPreview(employeeId, month, year);

    return sendSuccess(response, "Payroll preview fetched successfully", preview);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles("ADMIN", "HR"), validate(payrollSchema), async (request, response, next) => {
  try {
    const generatedPreview = request.body.salary ? null : await buildPayrollPreview(request.body.employeeId, request.body.month, request.body.year);
    const payrollRecord = await prisma.payrollRecord.create({
      data: {
        ...request.body,
        salary: request.body.salary ?? generatedPreview!.finalSalary,
      },
      include: {
        employee: true,
      },
    });

    return sendSuccess(response, "Payroll record created successfully", payrollRecord, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireRoles("ADMIN", "HR"), validate(payrollSchema.partial()), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.payrollRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Payroll record not found", 404);
    }

    assertPayrollEditable(existing.status);
    const nextEmployeeId = request.body.employeeId ?? existing.employeeId;
    const nextMonth = request.body.month ?? existing.month;
    const nextYear = request.body.year ?? existing.year;
    const generatedPreview = request.body.salary ? null : await buildPayrollPreview(nextEmployeeId, nextMonth, nextYear);

    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: {
        ...request.body,
        ...(request.body.salary ? {} : { salary: generatedPreview!.finalSalary }),
      },
      include: {
        employee: true,
      },
    });

    return sendSuccess(response, "Payroll record updated successfully", updated);
  } catch (error) {
    next(error);
  }
});

import incentiveRoutes from "./incentive-routes.js";

// Mount incentive routes
router.use("/", incentiveRoutes);

export default router;
