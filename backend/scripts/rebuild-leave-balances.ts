import { LeaveAllocationMode, LeaveStatus, PrismaClient, type LeaveType } from "@prisma/client";
import { getFinancialQuarterForDate, getFinancialYearBounds, getFinancialYearForDate } from "../src/utils/financial-year.js";

const prisma = new PrismaClient();

type ParsedArgs = {
  apply: boolean;
  employeeId?: number;
  year?: number;
};

type ComputedBalanceRow = {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  visibleDays: number;
  carryForwardDays: number;
  lastQuarterProcessed: number | null;
};

type ApprovedLeaveRequest = {
  employeeId: number;
  leaveTypeId: number;
  startDate: Date;
  paidDays: number;
  deductedDays: number | null;
  fullQuotaDeducted: boolean;
  leaveType: LeaveType;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    apply: argv.includes("--apply"),
  };

  for (const arg of argv) {
    if (arg.startsWith("--employeeId=")) {
      parsed.employeeId = Number(arg.split("=")[1]);
    }

    if (arg.startsWith("--year=")) {
      parsed.year = Number(arg.split("=")[1]);
    }
  }

  if (parsed.employeeId !== undefined && (!Number.isInteger(parsed.employeeId) || parsed.employeeId <= 0)) {
    throw new Error("`--employeeId` must be a positive integer");
  }

  if (parsed.year !== undefined && (!Number.isInteger(parsed.year) || parsed.year < 2000)) {
    throw new Error("`--year` must be a valid year like 2026");
  }

  return parsed;
}

function isPolicyActiveForYear(leaveType: LeaveType, year: number) {
  return leaveType.policyEffectiveFromYear !== null && year >= leaveType.policyEffectiveFromYear;
}

function getMaxCarryCap(leaveType: LeaveType) {
  return leaveType.carryForwardCap ?? Number.POSITIVE_INFINITY;
}

function getInitialCarryForwardDays(leaveType: LeaveType, previousRemainingDays: number) {
  if (!leaveType.carryForwardAllowed) {
    return 0;
  }

  return Math.min(getMaxCarryCap(leaveType), Math.max(previousRemainingDays, 0));
}

function getQuarterlyVisibleDays(leaveType: LeaveType, carryForwardDays: number) {
  const currentQuarterAllocation = leaveType.quarterlyAllocationDays ?? 0;

  if (!leaveType.carryForwardAllowed) {
    return currentQuarterAllocation;
  }

  return Math.min(getMaxCarryCap(leaveType), carryForwardDays + currentQuarterAllocation);
}

function getDeductedDaysForRequest(request: ApprovedLeaveRequest) {
  if (request.deductedDays !== null) {
    return request.deductedDays;
  }

  const requestYear = getFinancialYearForDate(request.startDate);
  const policyActive = isPolicyActiveForYear(request.leaveType, requestYear);

  if (policyActive && (request.fullQuotaDeducted || request.leaveType.deductFullQuotaOnApproval)) {
    return request.leaveType.defaultDaysPerYear;
  }

  return request.paidDays;
}

function buildQuarterlyBalanceState(
  leaveType: LeaveType,
  year: number,
  initialCarryForwardDays: number,
  approvedRequests: ApprovedLeaveRequest[],
  asOfDate: Date,
) {
  const asOfFinancialYear = getFinancialYearForDate(asOfDate);
  const processedQuarter = year < asOfFinancialYear ? 4 : getFinancialQuarterForDate(asOfDate);
  const quarterlyDeductions = new Map<number, number>();

  for (const request of approvedRequests) {
    const quarter = getFinancialQuarterForDate(request.startDate);
    quarterlyDeductions.set(quarter, (quarterlyDeductions.get(quarter) ?? 0) + getDeductedDaysForRequest(request));
  }

  let carryForwardDays = initialCarryForwardDays;
  let visibleDays = getQuarterlyVisibleDays(leaveType, carryForwardDays);

  for (let quarter = 1; quarter <= processedQuarter; quarter += 1) {
    visibleDays = Math.max(visibleDays - (quarterlyDeductions.get(quarter) ?? 0), 0);

    if (quarter < processedQuarter) {
      carryForwardDays = leaveType.carryForwardAllowed ? Math.min(getMaxCarryCap(leaveType), visibleDays) : 0;
      visibleDays = getQuarterlyVisibleDays(leaveType, carryForwardDays);
    }
  }

  return {
    visibleDays,
    carryForwardDays,
    lastQuarterProcessed: processedQuarter,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = new Date();
  const currentYear = getFinancialYearForDate(today);

  if (args.year !== undefined && args.year > currentYear) {
    throw new Error(`Future year rebuild is not supported. Today is in ${currentYear}.`);
  }

  const employees = await prisma.employee.findMany({
    where: args.employeeId ? { id: args.employeeId } : undefined,
    select: {
      id: true,
      joiningDate: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (employees.length === 0) {
    throw new Error("No employees found for the requested scope.");
  }

  const leaveTypes = await prisma.leaveType.findMany({
    orderBy: {
      code: "asc",
    },
  });

  if (leaveTypes.length === 0) {
    throw new Error("No leave types found.");
  }

  const earliestJoinYear = employees.reduce(
    (earliest, employee) => Math.min(earliest, getFinancialYearForDate(employee.joiningDate)),
    currentYear,
  );
  const earliestBounds = getFinancialYearBounds(earliestJoinYear);
  const latestBounds = getFinancialYearBounds((args.year ?? currentYear) + 1);
  const requestFilters = {
    gte: earliestBounds.start,
    lt: latestBounds.start,
  };

  const approvedLeaveRequests = (await prisma.leaveRequest.findMany({
    where: {
      status: LeaveStatus.APPROVED,
      employeeId: args.employeeId,
      startDate: requestFilters,
    },
    select: {
      employeeId: true,
      leaveTypeId: true,
      startDate: true,
      paidDays: true,
      deductedDays: true,
      fullQuotaDeducted: true,
      leaveType: true,
    },
    orderBy: [
      { employeeId: "asc" },
      { startDate: "asc" },
    ],
  })) as ApprovedLeaveRequest[];

  const requestsByEmployeeYearType = new Map<string, ApprovedLeaveRequest[]>();

  for (const request of approvedLeaveRequests) {
    const key = `${request.employeeId}:${getFinancialYearForDate(request.startDate)}:${request.leaveTypeId}`;
    const bucket = requestsByEmployeeYearType.get(key);
    if (bucket) {
      bucket.push(request);
    } else {
      requestsByEmployeeYearType.set(key, [request]);
    }
  }

  const rowsToCreate: ComputedBalanceRow[] = [];
  const touchedYears = new Set<number>();

  for (const employee of employees) {
    const startYear = getFinancialYearForDate(employee.joiningDate);
    const endYear = args.year ?? currentYear;

    if (startYear > endYear) {
      continue;
    }

    const previousRemainingByLeaveType = new Map<number, number>();

    for (let year = startYear; year <= endYear; year += 1) {
      for (const leaveType of leaveTypes) {
        const policyActive = isPolicyActiveForYear(leaveType, year);
        const initialCarryForwardDays = policyActive
          ? getInitialCarryForwardDays(leaveType, previousRemainingByLeaveType.get(leaveType.id) ?? 0)
          : 0;
        const approvedRequestsForYear = requestsByEmployeeYearType.get(`${employee.id}:${year}:${leaveType.id}`) ?? [];
        const usedDays = approvedRequestsForYear.reduce((sum, request) => sum + getDeductedDaysForRequest(request), 0);
        const allocatedDays = leaveType.defaultDaysPerYear;
        const remainingDays = Math.max(allocatedDays + initialCarryForwardDays - usedDays, 0);

        let visibleDays = remainingDays;
        let carryForwardDays = initialCarryForwardDays;
        let lastQuarterProcessed: number | null = null;

        if (policyActive && leaveType.allocationMode === LeaveAllocationMode.QUARTERLY) {
          const quarterlyState = buildQuarterlyBalanceState(
            leaveType,
            year,
            initialCarryForwardDays,
            approvedRequestsForYear,
            today,
          );

          visibleDays = quarterlyState.visibleDays;
          carryForwardDays = quarterlyState.carryForwardDays;
          lastQuarterProcessed = quarterlyState.lastQuarterProcessed;
        }

        if (args.year === undefined || year === args.year) {
          touchedYears.add(year);
          rowsToCreate.push({
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year,
            allocatedDays,
            usedDays,
            remainingDays,
            visibleDays,
            carryForwardDays,
            lastQuarterProcessed,
          });
        }

        previousRemainingByLeaveType.set(leaveType.id, remainingDays);
      }
    }
  }

  const preview = {
    employees: employees.length,
    years: Array.from(touchedYears).sort((left, right) => left - right),
    leaveTypes: leaveTypes.length,
    balancesToWrite: rowsToCreate.length,
    approvedRequestsRead: approvedLeaveRequests.length,
    mode: args.apply ? "apply" : "dry-run",
  };

  console.log("Leave balance rebuild preview:");
  console.table(preview);

  if (!args.apply) {
    console.log("Dry run only. No database changes were made.");
    console.log("Re-run with `--apply` to delete and recreate balances for this scope.");
    return;
  }

  const employeeIds = employees.map((employee) => employee.id);
  const years = Array.from(touchedYears);

  await prisma.$transaction(async (transaction) => {
    await transaction.leaveBalance.deleteMany({
      where: {
        employeeId: { in: employeeIds },
        year: { in: years },
      },
    });

    await transaction.leaveBalance.createMany({
      data: rowsToCreate,
    });
  });

  console.log(`Rebuilt ${rowsToCreate.length} leave balance rows successfully.`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
