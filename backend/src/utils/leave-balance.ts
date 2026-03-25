import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function ensureEmployeeLeaveBalances(
  prisma: PrismaLike,
  employeeId: number,
  year = new Date().getFullYear(),
) {
  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      isActive: true,
    },
  });

  for (const leaveType of leaveTypes) {
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
        allocatedDays: leaveType.defaultDaysPerYear,
        usedDays: 0,
        remainingDays: leaveType.defaultDaysPerYear,
      },
    });
  }
}
