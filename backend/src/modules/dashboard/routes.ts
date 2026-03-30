import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { endOfDay, startOfDay } from "../../utils/dates.js";
import { getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import { buildApprovedLeaveWhereForAttendanceDate, getApprovedLeaveAttendanceStatusForDate } from "../attendance/service.js";
import { buildMonthCalendarDays } from "../calendar/service.js";

const router = Router();

router.use(authenticate);

router.get("/employee", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId ?? 0;
    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const monthStart = startOfDay(new Date(currentYear, today.getMonth(), 1));
    const monthEnd = endOfDay(new Date(currentYear, today.getMonth() + 1, 0));
    const yearStart = startOfDay(new Date(currentYear, 0, 1));
    const isTeamLead = employeeId ? await hasEmployeeCapability(prisma, employeeId, "TEAM_LEAD") : false;
    const scopedEmployeeIds = isTeamLead && employeeId ? await getScopedEmployeeIdsForTeamLead(prisma, employeeId) : [];

    const [
      attendanceTodayRecord,
      approvedLeaveToday,
      pendingLeaves,
      payrollCount,
      scopedTeamCount,
      pendingTeamLeaves,
      attendanceRecords,
      calendarExceptions,
      currentEmployee,
      leaveBalances,
      leaveRequests,
    ] = await Promise.all([
      prisma.attendance.findUnique({
        where: {
          employeeId_attendanceDate: {
            employeeId,
            attendanceDate: today,
          },
        },
      }),
      prisma.leaveRequest.findFirst({
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
      prisma.attendance.findMany({
        where: {
          employeeId,
          attendanceDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: {
          attendanceDate: "asc",
        },
      }),
      prisma.calendarException.findMany({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: {
          date: "asc",
        },
      }),
      employeeId
        ? prisma.employee.findUnique({
            where: {
              id: employeeId,
            },
            include: {
              department: true,
              manager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              user: {
                select: {
                  email: true,
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              capabilities: {
                select: {
                  capability: true,
                },
              },
            },
          })
        : Promise.resolve(null),
      prisma.leaveBalance.findMany({
        where: {
          employeeId,
          year: currentYear,
        },
        include: {
          leaveType: true,
        },
        orderBy: {
          leaveType: {
            code: "asc",
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          OR: [
            { startDate: { gte: yearStart } },
            { endDate: { gte: today } },
            { status: LeaveStatus.PENDING },
          ],
        },
        include: {
          employee: {
            include: {
              department: true,
              manager: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              user: {
                select: {
                  email: true,
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          leaveType: true,
          managerApprovedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          hrApprovedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          startDate: "desc",
        },
        take: 100,
      }),
    ]);

    const attendanceToday =
      attendanceTodayRecord ??
      (approvedLeaveToday
        ? {
            id: 0,
            employeeId,
            attendanceDate: today,
            checkInTime: null,
            checkOutTime: null,
            workedMinutes: 0,
            status: getApprovedLeaveAttendanceStatusForDate(approvedLeaveToday, today) === AttendanceStatus.HALF_DAY
              ? AttendanceStatus.HALF_DAY
              : AttendanceStatus.LEAVE,
          }
        : null);

    const calendarDays = buildMonthCalendarDays({
      year: currentYear,
      month: currentMonth,
      exceptions: calendarExceptions,
    });

    return sendSuccess(response, "Employee dashboard fetched successfully", {
      attendanceToday,
      pendingLeaves,
      payrollCount,
      isTeamLead,
      scopedTeamCount,
      pendingTeamLeaves,
      attendanceRecords,
      calendarDays,
      currentEmployee,
      leaveBalances,
      leaveRequests,
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
