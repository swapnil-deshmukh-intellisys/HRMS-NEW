import { type Prisma, type PrismaClient } from "@prisma/client";
import { getFinancialQuarterForDate, getFinancialYearForDate } from "./financial-year.js";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type LeaveTypePolicy = {
  id: number;
  code: string;
  defaultDaysPerYear: number;
  allocationMode: "YEARLY" | "QUARTERLY";
  quarterlyAllocationDays: number | null;
  carryForwardAllowed: boolean;
  carryForwardCap: number | null;
  policyEffectiveFromYear: number | null;
};

type BalanceWithPolicy = {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
  visibleDays: number;
  carryForwardDays: number;
  lastQuarterProcessed: number | null;
  leaveType: LeaveTypePolicy;
};

function getMaxCarryCap(leaveType: LeaveTypePolicy) {
  return leaveType.carryForwardCap ?? Number.POSITIVE_INFINITY;
}

export function isPolicyActiveForYear(leaveType: LeaveTypePolicy, year: number) {
  return leaveType.policyEffectiveFromYear !== null && year >= leaveType.policyEffectiveFromYear;
}

function getQuarterlyVisibleDays(leaveType: LeaveTypePolicy, carryForwardDays: number) {
  const currentQuarterAllocation = leaveType.quarterlyAllocationDays ?? 0;

  if (!leaveType.carryForwardAllowed) {
    return currentQuarterAllocation;
  }

  return Math.min(getMaxCarryCap(leaveType), carryForwardDays + currentQuarterAllocation);
}

function getInitialCarryForwardDays(leaveType: LeaveTypePolicy, previousRemainingDays: number) {
  if (!leaveType.carryForwardAllowed) {
    return 0;
  }

  return Math.min(getMaxCarryCap(leaveType), Math.max(previousRemainingDays, 0));
}

function shouldApplyQuarterlyPolicy(leaveType: LeaveTypePolicy, year: number) {
  return isPolicyActiveForYear(leaveType, year) && leaveType.allocationMode === "QUARTERLY";
}

async function normalizeLeaveBalance(
  prisma: PrismaLike,
  balance: BalanceWithPolicy,
  asOfDate: Date,
) {
  const currentQuarter = getFinancialQuarterForDate(asOfDate);
  const policyActive = isPolicyActiveForYear(balance.leaveType, balance.year);
  const quarterlyPolicy = shouldApplyQuarterlyPolicy(balance.leaveType, balance.year);

  const nextAllocatedDays = balance.leaveType.defaultDaysPerYear;
  let nextRemainingDays = balance.remainingDays;
  let nextVisibleDays = balance.visibleDays;
  let nextCarryForwardDays = balance.carryForwardDays;
  let nextLastQuarterProcessed = balance.lastQuarterProcessed;

  if (!policyActive) {
    nextVisibleDays = balance.remainingDays;
    nextCarryForwardDays = 0;
    nextLastQuarterProcessed = null;
  } else if (!quarterlyPolicy) {
    nextVisibleDays = balance.remainingDays;
    nextLastQuarterProcessed = null;
  } else {
    if (balance.lastQuarterProcessed === null) {
      nextRemainingDays = Math.max(balance.leaveType.defaultDaysPerYear + balance.carryForwardDays - balance.usedDays, 0);
      nextVisibleDays = getQuarterlyVisibleDays(balance.leaveType, balance.carryForwardDays);
      nextLastQuarterProcessed = currentQuarter;
    } else if (balance.lastQuarterProcessed < currentQuarter) {
      let rollingVisibleDays = balance.visibleDays;
      let rollingCarryForwardDays = balance.carryForwardDays;

      for (let quarter = balance.lastQuarterProcessed + 1; quarter <= currentQuarter; quarter += 1) {
        rollingCarryForwardDays = balance.leaveType.carryForwardAllowed
          ? Math.min(getMaxCarryCap(balance.leaveType), Math.max(rollingVisibleDays, 0))
          : 0;
        rollingVisibleDays = getQuarterlyVisibleDays(balance.leaveType, rollingCarryForwardDays);
      }

      nextCarryForwardDays = rollingCarryForwardDays;
      nextVisibleDays = rollingVisibleDays;
      nextLastQuarterProcessed = currentQuarter;
    }
  }

  const needsUpdate =
    nextAllocatedDays !== balance.allocatedDays ||
    nextRemainingDays !== balance.remainingDays ||
    nextVisibleDays !== balance.visibleDays ||
    nextCarryForwardDays !== balance.carryForwardDays ||
    nextLastQuarterProcessed !== balance.lastQuarterProcessed;

  if (!needsUpdate) {
    return balance;
  }

  return prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      allocatedDays: nextAllocatedDays,
      remainingDays: nextRemainingDays,
      visibleDays: nextVisibleDays,
      carryForwardDays: nextCarryForwardDays,
      lastQuarterProcessed: nextLastQuarterProcessed,
    } as never,
    include: {
      leaveType: true,
    },
  }) as unknown as Promise<BalanceWithPolicy>;
}

export async function ensureEmployeeLeaveBalances(
  prisma: PrismaLike,
  employeeId: number,
  year = getFinancialYearForDate(new Date()),
  asOfDate = new Date(),
) {
  const leaveTypes = (await prisma.leaveType.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  })) as unknown as LeaveTypePolicy[];

  const previousBalances =
    year > 0
      ? await prisma.leaveBalance.findMany({
          where: {
            employeeId,
            year: year - 1,
          },
        })
      : [];

  const previousBalanceMap = new Map(previousBalances.map((balance) => [balance.leaveTypeId, balance]));
  const currentQuarter = getFinancialQuarterForDate(asOfDate);

  for (const leaveType of leaveTypes) {
    const policyActive = isPolicyActiveForYear(leaveType, year);
    const previousBalance = previousBalanceMap.get(leaveType.id);
    const carryForwardDays = policyActive ? getInitialCarryForwardDays(leaveType, previousBalance?.remainingDays ?? 0) : 0;
    const allocatedDays = leaveType.defaultDaysPerYear;
    const remainingDays = allocatedDays + carryForwardDays;
    const visibleDays =
      shouldApplyQuarterlyPolicy(leaveType, year) ? getQuarterlyVisibleDays(leaveType, carryForwardDays) : remainingDays;

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId,
          leaveTypeId: leaveType.id,
          year,
        },
      },
      update: {},
      create: {
        employeeId,
        leaveTypeId: leaveType.id,
        year,
        allocatedDays,
        usedDays: 0,
        remainingDays,
        visibleDays,
        carryForwardDays,
        lastQuarterProcessed: shouldApplyQuarterlyPolicy(leaveType, year) ? currentQuarter : null,
      } as never,
    });
  }
}

export async function getEmployeeLeaveBalances(
  prisma: PrismaLike,
  employeeId: number,
  year = getFinancialYearForDate(new Date()),
  asOfDate = new Date(),
) {
  const balances = (await prisma.leaveBalance.findMany({
    where: {
      employeeId,
      year,
    },
    include: {
      leaveType: true,
    },
    orderBy: {
      leaveType: {
        code: "asc",
      },
    },
  })) as unknown as BalanceWithPolicy[];

  return Promise.all(balances.map((balance) => normalizeLeaveBalance(prisma, balance, asOfDate)));
}

export async function getEmployeeLeaveBalanceByType(
  prisma: PrismaLike,
  employeeId: number,
  leaveTypeId: number,
  year = getFinancialYearForDate(new Date()),
  asOfDate = new Date(),
) {
  const balance = (await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId,
        leaveTypeId,
        year,
      },
    },
    include: {
      leaveType: true,
    },
  })) as unknown as BalanceWithPolicy | null;

  if (!balance) {
    return null;
  }

  return normalizeLeaveBalance(prisma, balance, asOfDate);
}
