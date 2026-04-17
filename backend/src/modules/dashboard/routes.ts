import { ApprovalStepStatus, AttendanceRegularizationStatus, AttendanceStatus, IncentiveStatus, LeaveStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { endOfDay, startOfDay } from "../../utils/dates.js";
import { getFinancialYearBounds, getFinancialYearForDate } from "../../utils/financial-year.js";
import { getEmployeeLeaveBalances } from "../../utils/leave-balance.js";
import { getScopedEmployeeIdsForTeamLead, hasEmployeeCapability } from "../../utils/team-lead.js";
import {
  buildApprovedLeaveWhereForAttendanceDate,
  buildAttendanceWhereForDate,
  getApprovedLeaveAttendanceStatusForDate,
} from "../attendance/service.js";
import { buildMonthCalendarDays } from "../calendar/service.js";

const router = Router();

router.use(authenticate);

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

async function getAttendanceTodayForEmployee(employeeId: number, today: Date) {
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

async function getEmployeeDashboardSharedData(employeeId: number, today: Date) {
  const currentYear = getFinancialYearForDate(today);
  const yearStart = startOfDay(getFinancialYearBounds(currentYear).start);
  const isTeamLead = employeeId ? await hasEmployeeCapability(prisma, employeeId, "TEAM_LEAD") : false;
  const scopedEmployeeIds = isTeamLead && employeeId ? await getScopedEmployeeIdsForTeamLead(prisma, employeeId) : [];

  const [attendanceToday, pendingLeaves, payrollCount, scopedTeamCount, pendingTeamLeaves, currentEmployee, leaveBalances, leaveRequests] =
    await Promise.all([
      getAttendanceTodayForEmployee(employeeId, today),
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
      employeeId
        ? prisma.employee.findUnique({
            where: {
              id: employeeId,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: {
                select: {
                  name: true,
                },
              },
              manager: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              user: {
                select: {
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
      getEmployeeLeaveBalances(prisma, employeeId, currentYear, today),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          OR: [{ startDate: { gte: yearStart } }, { endDate: { gte: today } }, { status: LeaveStatus.PENDING }],
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: {
                select: {
                  name: true,
                },
              },
              manager: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          leaveType: {
            select: {
              code: true,
              name: true,
            },
          },
          managerApprovedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          hrApprovedBy: {
            select: {
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

  return {
    attendanceToday,
    pendingLeaves,
    payrollCount,
    isTeamLead,
    scopedTeamCount,
    pendingTeamLeaves,
    currentEmployee,
    leaveBalances,
    leaveRequests,
  };
}

router.get("/employee-summary", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId ?? 0;
    const today = startOfDay(new Date());
    const role = request.user?.role;

    if (role === "HR" || role === "ADMIN") {
      const [pendingLeaves, payrollCount, pendingCorrectionRequests, pendingIncentiveApprovals] = await Promise.all([
        prisma.leaveRequest.count({
          where:
            role === "HR"
              ? {
                  status: LeaveStatus.PENDING,
                  hrApprovalStatus: ApprovalStepStatus.PENDING,
                }
              : {
                  status: LeaveStatus.PENDING,
                },
        }),
        prisma.payrollRecord.count(),
        prisma.attendanceRegularizationRequest.count({
          where: { status: AttendanceRegularizationStatus.PENDING },
        }),
        prisma.incentive.count({
          where: { status: IncentiveStatus.PENDING },
        }),
      ]);

      return sendSuccess(response, "Employee dashboard summary fetched successfully", {
        pendingLeaves,
        pendingTeamLeaves: 0,
        payrollCount,
        scopedTeamCount: 0,
        isTeamLead: false,
        pendingCorrectionRequests,
        pendingIncentiveApprovals,
      });
    }

    const summary = await getEmployeeDashboardSharedData(employeeId, today);
    const pendingCorrectionRequests =
      role === "MANAGER" && employeeId
        ? await prisma.attendanceRegularizationRequest.count({
            where: {
              status: AttendanceRegularizationStatus.PENDING,
              employee: {
                managerId: employeeId,
              },
              NOT: {
                employeeId,
              },
            },
          })
        : await prisma.attendanceRegularizationRequest.count({
            where: {
              status: AttendanceRegularizationStatus.PENDING,
              employeeId,
            },
          });

    return sendSuccess(response, "Employee dashboard summary fetched successfully", {
      ...summary,
      pendingCorrectionRequests,
      pendingIncentiveApprovals: 0,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/employee", requireRoles("EMPLOYEE", "MANAGER", "HR", "ADMIN"), async (request, response, next) => {
  try {
    const employeeId = request.user?.employeeId ?? 0;
    const today = startOfDay(new Date());
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const monthStart = startOfDay(new Date(currentYear, today.getMonth(), 1));
    const monthEnd = endOfDay(new Date(currentYear, today.getMonth() + 1, 0));
    const isMinimal = request.query.minimal === "true";
    const [sharedData, attendanceRecords, calendarExceptions] = await Promise.all([
      isMinimal ? Promise.resolve(null) : getEmployeeDashboardSharedData(employeeId, today),
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
    ]);

    const enrichedAttendanceRecords = await enrichAttendanceWithLeaveContext(attendanceRecords);

    const calendarDays = buildMonthCalendarDays({
      year: currentYear,
      month: currentMonth,
      exceptions: calendarExceptions,
    });

    return sendSuccess(response, "Employee dashboard fetched successfully", {
      ...(sharedData || {}),
      attendanceRecords: enrichedAttendanceRecords,
      calendarDays,
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

router.get("/hr", requireRoles("HR", "ADMIN"), async (request, response, next) => {
  try {
    const role = request.user?.role;
    const [employees, pendingLeaves, payrollCount, departments] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      prisma.leaveRequest.count({
        where:
          role === "HR"
            ? {
                status: LeaveStatus.PENDING,
                hrApprovalStatus: ApprovalStepStatus.PENDING,
              }
            : {
                status: LeaveStatus.PENDING,
              },
      }),
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
