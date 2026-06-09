import { LeaveStatus, PayrollStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { endOfDay, startOfDay, TIMEZONE } from "../../utils/dates.js";
import { formatInTimeZone } from 'date-fns-tz';
import { getCalendarDayStatus } from "../calendar/service.js";
import { assertPayrollEditable, buildPayrollPreview } from "./service.js";
import { calculateTotalPayrollWithIncentives } from "./incentive-service.js";
import { createAuditLog } from "../../services/audit.js";

import * as XLSX from "xlsx";

type PayrollPreviewWithIncentives = Awaited<ReturnType<typeof buildPayrollPreview>>;

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

const exportQuerySchema = z.object({
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

async function buildPayrollPreviewInternal(employeeId: number, month: number, year: number): Promise<PayrollPreviewWithIncentives> {
  return buildPayrollPreview({ employeeId, month, year, prisma });
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

router.get("/export-report", requireRoles("ADMIN", "HR"), validate(exportQuerySchema, "query"), async (request, response, next) => {
  try {
    const month = Number(request.query.month);
    const year = Number(request.query.year);

    // Fetch active employees
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" },
      ],
    });

    const monthStart = startOfDay(new Date(year, month - 1, 1));
    const monthEnd = endOfDay(new Date(year, month, 0));

    const today = startOfDay(new Date());
    const effectiveRangeEnd = today < startOfDay(monthEnd) ? today : startOfDay(monthEnd);

    const calendarExceptions = await prisma.calendarException.findMany({
      where: {
        date: {
          gte: startOfDay(monthStart),
          lte: effectiveRangeEnd,
        },
      },
    });

    let totalWorkingDays = 0;
    const workingDaysCursor = startOfDay(new Date(year, month - 1, 1));
    while (workingDaysCursor <= monthEnd) {
      const isWorkingDay = getCalendarDayStatus(workingDaysCursor, calendarExceptions).isWorkingDay;
      if (isWorkingDay) {
        totalWorkingDays += 1;
      }
      workingDaysCursor.setDate(workingDaysCursor.getDate() + 1);
    }

    const wsData: any[][] = [
      [
        "Employee Name",
        "Total Working Days",
        "Present Days",
        "Absent Days",
        "Half Days",
        "Approved Leaves",
        "Paid Leaves",
        "Unpaid Leaves",
        "Deductible Days"
      ]
    ];

    for (const emp of employees) {
      const [monthAttendances, approvedLeaves] = await Promise.all([
        prisma.attendance.findMany({
          where: {
            employeeId: emp.id,
            attendanceDate: {
              gte: startOfDay(monthStart),
              lte: effectiveRangeEnd,
            },
          },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId: emp.id,
            status: LeaveStatus.APPROVED,
            startDate: { lte: effectiveRangeEnd },
            endDate: { gte: startOfDay(monthStart) },
          },
          select: {
            startDate: true,
            endDate: true,
            isUnpaid: true,
          },
        }),
      ]);

      const attendanceByDate = new Map(
        monthAttendances.map((a) => [startOfDay(a.attendanceDate).getTime(), a])
      );

      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let approvedLeavesCount = 0;
      let paidLeavesCount = 0;
      let unpaidLeavesCount = 0;

      const cursor = startOfDay(monthStart);
      while (cursor <= monthEnd) {
        const timestamp = cursor.getTime();
        const isWithinTenure = cursor >= startOfDay(emp.joiningDate) && (!emp.deletedAt || cursor <= startOfDay(emp.deletedAt));

        if (isWithinTenure) {
          const isWorkingDay = getCalendarDayStatus(cursor, calendarExceptions).isWorkingDay;
          const attendance = attendanceByDate.get(timestamp);
          
          // Check if there is an approved leave request on this day
          const matchingLeave = approvedLeaves.find(l => {
            const start = startOfDay(l.startDate);
            const end = startOfDay(l.endDate);
            return cursor >= start && cursor <= end;
          });

          if (matchingLeave) {
            approvedLeavesCount += 1;
            if (matchingLeave.isUnpaid) {
              unpaidLeavesCount += 1;
            } else {
              paidLeavesCount += 1;
            }
          } else {
            const isPastToday = cursor > today;
            if (!isPastToday && isWorkingDay) {
              if (attendance) {
                if (attendance.status === "PRESENT") {
                  presentDays += 1;
                } else if (attendance.status === "HALF_DAY") {
                  presentDays += 0.5;
                  halfDays += 1;
                } else if (attendance.status === "ABSENT") {
                  absentDays += 1;
                }
              } else {
                absentDays += 1;
              }
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      let deductibleDays = 0;
      try {
        const preview = await buildPayrollPreview({
          employeeId: emp.id,
          month,
          year,
          prisma,
        });
        deductibleDays = preview.deductibleDays;
      } catch (err) {
        // Resilient fallback logic when buildPayrollPreview fails (e.g. no compensation package)
        let tenureDeduction = 0;
        const checkCursor = startOfDay(monthStart);
        while (checkCursor <= monthEnd) {
          const isWithinTenure = checkCursor >= startOfDay(emp.joiningDate) && (!emp.deletedAt || checkCursor <= startOfDay(emp.deletedAt));
          if (!isWithinTenure) {
            tenureDeduction += 1;
          }
          checkCursor.setDate(checkCursor.getDate() + 1);
        }
        deductibleDays = absentDays + (halfDays * 0.5) + unpaidLeavesCount + tenureDeduction;
      }

      wsData.push([
        `${emp.firstName} ${emp.lastName}`,
        totalWorkingDays,
        presentDays,
        absentDays,
        halfDays,
        approvedLeavesCount,
        paidLeavesCount,
        unpaidLeavesCount,
        deductibleDays,
      ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws["!cols"] = [
      { wch: 25 }, // Employee Name
      { wch: 20 }, // Total Working Days
      { wch: 12 }, // Present Days
      { wch: 12 }, // Absent Days
      { wch: 10 }, // Half Days
      { wch: 15 }, // Approved Leaves
      { wch: 12 }, // Paid Leaves
      { wch: 12 }, // Unpaid Leaves
      { wch: 15 }  // Deductible Days
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="Employee_Monthly_Summary_Report_${month}_${year}.xlsx"`
    );
    
    return response.send(buffer);
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
    const preview = await buildPayrollPreviewInternal(employeeId, month, year);

    return sendSuccess(response, "Payroll preview fetched successfully", preview);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles("ADMIN", "HR"), validate(payrollSchema), async (request, response, next) => {
  try {
    const generatedPreview = request.body.salary ? null : await buildPayrollPreviewInternal(request.body.employeeId, request.body.month, request.body.year);
    const payrollRecord = await prisma.payrollRecord.create({
      data: {
        ...request.body,
        salary: request.body.salary ?? (generatedPreview!.totalPayableSalary),
      },
      include: {
        employee: true,
      },
    });

    await createAuditLog({
      userId: request.user!.id,
      action: "CREATE",
      entity: "PayrollRecord",
      entityId: payrollRecord.id,
      newData: payrollRecord,
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
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
    const generatedPreview = request.body.salary ? null : await buildPayrollPreviewInternal(nextEmployeeId, nextMonth, nextYear);

    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: {
        ...request.body,
        ...(request.body.salary ? {} : { salary: generatedPreview!.totalPayableSalary }),
      },
      include: {
        employee: true,
      },
    });

    await createAuditLog({
      userId: request.user!.id,
      action: "UPDATE",
      entity: "PayrollRecord",
      entityId: updated.id,
      oldData: existing,
      newData: updated,
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
    });

    if (updated.status === "FINALIZED") {
      import("./../notifications/service.js").then(ns => {
        ns.createNotification({
          userId: updated.employee.userId,
          title: "Payslip Ready! 🧾",
          message: `Your payslip for ${formatInTimeZone(new Date(updated.year, updated.month - 1, 1), TIMEZONE, 'MMMM yyyy')} is now available.`,
          type: "PAYROLL_FINALIZED",
          link: "/payroll",
          sendPush: true
        }).catch(err => console.error("Failed to create payroll notification:", err));
      });
    }

    return sendSuccess(response, "Payroll record updated successfully", updated);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/breakdown", async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: { employee: true },
    });

    if (!record) {
      throw new AppError("Payroll record not found", 404);
    }

    await assertPayrollAccess(record.employeeId, request.user!);

    const preview = await buildPayrollPreviewInternal(record.employeeId, record.month, record.year);

    return sendSuccess(response, "Payroll breakdown fetched successfully", preview);
  } catch (error) {
    next(error);
  }
});

import incentiveRoutes from "./incentive-routes.js";

// Mount incentive routes
router.use("/", incentiveRoutes);

export default router;
