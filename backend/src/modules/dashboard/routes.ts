import { LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { startOfDay } from "../../utils/dates.js";
import { getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";

const router = Router();

router.use(authenticate);

router.get("/employee", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId ?? 0;
    const today = startOfDay(new Date());
    const isTeamLead = employeeId ? await hasEmployeeCapability(prisma, employeeId, "TEAM_LEAD") : false;
    const scopedEmployeeIds = isTeamLead && employeeId ? await getScopedEmployeeIdsForTeamLead(prisma, employeeId) : [];

    const [attendanceToday, pendingLeaves, payrollCount, scopedTeamCount, pendingTeamLeaves] = await Promise.all([
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
      scopedEmployeeIds.length
        ? prisma.employee.count({
            where: {
              id: { in: scopedEmployeeIds },
              isActive: true,
            },
          })
        : Promise.resolve(0),
      scopedEmployeeIds.length
        ? prisma.leaveRequest.count({
            where: {
              employeeId: { in: scopedEmployeeIds },
              status: LeaveStatus.PENDING,
            },
          })
        : Promise.resolve(0),
    ]);

    return sendSuccess(response, "Employee dashboard fetched successfully", {
      attendanceToday,
      pendingLeaves,
      payrollCount,
      isTeamLead,
      scopedTeamCount,
      pendingTeamLeaves,
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
