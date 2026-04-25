import { LeaveStatus, PayrollStatus, PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/api.js";
import { calculateTotalPayrollWithIncentives } from "./incentive-service.js";
import { startOfDay, endOfDay } from "../../utils/dates.js";
import { getCalendarDayStatus } from "../calendar/service.js";

export function assertPayrollEditable(status: PayrollStatus) {
  if (status === PayrollStatus.FINALIZED) {
    throw new AppError("Finalized payroll records cannot be updated", 400);
  }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCompensationFromLpa(annualPackageLpa: number) {
  const grossMonthlySalary = roundCurrency(annualPackageLpa / 12);
  const basicMonthlySalary = roundCurrency(grossMonthlySalary / 2);

  return {
    annualPackageLpa: roundCurrency(annualPackageLpa),
    grossMonthlySalary,
    basicMonthlySalary,
  };
}

export function calculatePayrollBreakdown(grossMonthlySalary: number, basicMonthlySalary: number, month: number) {
  const pf = roundCurrency(0.12 * basicMonthlySalary);
  const gratuity = roundCurrency(0.0481 * basicMonthlySalary);
  const pt = month === 3 ? 300 : 200;
  const netSalary = roundCurrency(grossMonthlySalary - pf - gratuity - pt);
  const perDaySalary = roundCurrency(netSalary / 30);
  const perHourSalary = roundCurrency(perDaySalary / 9);

  return {
    pf,
    gratuity,
    pt,
    netSalary,
    perDaySalary,
    perHourSalary,
  };
}

export function calculatePayrollPreview(input: {
  grossMonthlySalary: number;
  basicMonthlySalary: number;
  month: number;
  absentDeductionDays?: number;
  halfDayDeductionDays?: number;
  deductibleDays: number;
  probationMultiplier?: number;
}) {
  const breakdown = calculatePayrollBreakdown(input.grossMonthlySalary, input.basicMonthlySalary, input.month);
  const deductionAmount = roundCurrency(breakdown.perDaySalary * input.deductibleDays);
  const finalSalaryBeforeProbation = roundCurrency(breakdown.netSalary - deductionAmount);
  // User Rule: Probation staff always get exactly 50% for their period on probation.
  const multiplier = input.probationMultiplier ?? 1;
  const probationAdjustedSalary = roundCurrency(finalSalaryBeforeProbation * multiplier);
  const finalSalary = probationAdjustedSalary;

  return {
    ...breakdown,
    absentDeductionDays: input.absentDeductionDays ?? input.deductibleDays,
    halfDayDeductionDays: input.halfDayDeductionDays ?? 0,
    deductibleDays: input.deductibleDays,
    deductionAmount,
    finalSalaryBeforeProbation,
    probationMultiplier: multiplier,
    probationAdjustedSalary,
    finalSalary,
  };
}

export async function buildPayrollPreview(params: {
  employeeId: number;
  month: number;
  year: number;
  prisma: PrismaClient;
}) {
  const { employeeId, month, year, prisma } = params;

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

  // Calculate month boundaries
  const monthStart = startOfDay(new Date(year, month - 1, 1));
  const monthEnd = endOfDay(new Date(year, month, 0));

  const today = startOfDay(new Date());
  const effectiveRangeEnd = today < startOfDay(monthEnd) ? today : startOfDay(monthEnd);

  const [calendarExceptions, monthAttendances, approvedLeaves] = await Promise.all([
    prisma.calendarException.findMany({
      where: {
        date: {
          gte: startOfDay(monthStart),
          lte: effectiveRangeEnd,
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        employeeId,
        attendanceDate: {
          gte: startOfDay(monthStart),
          lte: effectiveRangeEnd,
        },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: effectiveRangeEnd },
        endDate: { gte: startOfDay(monthStart) },
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
  
  let totalDailyWeights = 0;
  let tenureDaysInMonth = 0;

  const cursor = startOfDay(monthStart);

  while (cursor <= monthEnd) {
    const timestamp = cursor.getTime();
    const isWithinTenure = cursor >= startOfDay(employee.joiningDate);
    const isPastToday = cursor > today;

    if (!isWithinTenure) {
      absentDeductionDays += 1;
      deductibleDays += 1;
    } else {
      tenureDaysInMonth += 1;
      
      const isStillOnProbation = employee.isOnProbation && (!employee.probationEndDate || cursor <= startOfDay(employee.probationEndDate));
      totalDailyWeights += isStillOnProbation ? 0.5 : 1.0;

      if (!isPastToday) {
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
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  const effectiveProbationMultiplier = tenureDaysInMonth > 0 ? totalDailyWeights / tenureDaysInMonth : 1;

  const preview = calculatePayrollPreview({
    grossMonthlySalary: employee.grossMonthlySalary,
    basicMonthlySalary: employee.basicMonthlySalary,
    month,
    absentDeductionDays,
    halfDayDeductionDays,
    deductibleDays,
    probationMultiplier: effectiveProbationMultiplier,
  });

  const incentives = await prisma.incentive.findMany({
    where: {
      employeeId,
      month,
      year,
      status: { in: ["APPROVED", "PAID"] },
    },
  });

  const verifiedOvertime = await prisma.overtimeSession.findMany({
    where: {
      employeeId,
      status: "VERIFIED",
      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
    select: { duration: true },
  });

  const totalOvertimeMinutes = verifiedOvertime.reduce((sum, session) => sum + (session.duration || 0), 0);

  const payrollWithIncentives = calculateTotalPayrollWithIncentives(
    preview.finalSalary,
    incentives.map(i => ({ ...i, amount: Number(i.amount) }))
  );

  return {
    ...preview,
    employee,
    month,
    year,
    totalIncentives: payrollWithIncentives.totalIncentives,
    totalPayableSalary: payrollWithIncentives.grossSalary,
    incentives: incentives.map(incentive => ({
      id: incentive.id,
      type: incentive.type,
      amount: Number(incentive.amount),
      reason: incentive.reason,
      status: incentive.status,
    })),
    totalOvertimeMinutes,
  };
}
