import { LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { startOfDay } from "../../utils/dates.js";

const router = Router();

router.use(authenticate);

router.get("/employee", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId ?? 0;
    const today = startOfDay(new Date());

    const [attendanceToday, pendingLeaves, payrollCount] = await Promise.all([
      prisma.attendance.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId,
            attendanceDate: today,
          },
        },
      }),
      prisma.leaveRequest.count({
        where: {
          employeeId,
          status: LeaveStatus.PENDING,
        },
      }),
      prisma.payrollRecord.count({
        where: { employeeId },
      }),
    ]);

    return sendSuccess(response, "Employee dashboard fetched successfully", {
      attendanceToday,
      pendingLeaves,
      payrollCount,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/manager", requireRoles("MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const managerId = request.user?.employeeId ?? 0;
    const [teamCount, pendingApprovals] = await Promise.all([
      prisma.employee.count({
        where: {
          managerId,
          isActive: true,
        },
      }),
      prisma.leaveRequest.count({
        where: {
          status: LeaveStatus.PENDING,
          employee: { managerId },
        },
      }),
    ]);

    return sendSuccess(response, "Manager dashboard fetched successfully", {
      teamCount,
      pendingApprovals,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/hr", requireRoles("HR", "ADMIN"), async (_request, response, next) => {
  try {
    const [employees, pendingLeaves, payrollCount, departments] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      prisma.payrollRecord.count(),
      prisma.department.count({ where: { isActive: true } }),
    ]);

    return sendSuccess(response, "HR dashboard fetched successfully", {
      employees,
      pendingLeaves,
      payrollCount,
      departments,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
