import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employeeCode = 'IITS0012';
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
    include: {
      leaveBalances: {
        include: { leaveType: true },
      },
    },
  });

  if (!employee) {
    console.error('Employee not found');
    return;
  }

  console.log(`Employee: ${employee.firstName} ${employee.lastName}`);
  console.log('Leave Balances:');
  employee.leaveBalances.forEach((b) => {
    console.log(`- ${b.leaveType.name} (${b.leaveType.code}): remaining=${b.remainingDays}, used=${b.usedDays}`);
  });

  const june1 = new Date('2026-06-01T00:00:00.000Z');
  
  const attendance = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      attendanceDate: june1,
    },
  });

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      startDate: { lte: june1 },
      endDate: { gte: june1 },
    },
    include: { leaveType: true },
  });

  console.log('Attendance on June 1, 2026:', attendance);
  console.log('Leave Requests covering June 1, 2026:', leaves);
}

main().finally(() => prisma.$disconnect());
