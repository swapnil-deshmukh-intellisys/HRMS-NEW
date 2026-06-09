import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employeeCode = 'IITS0012';
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
  });

  if (!employee) {
    console.error('Employee not found');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // We should query for any attendance record on today's date
  const todayRecord = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  console.log('Today\'s Date:', today.toISOString().split('T')[0]);
  console.log('Record found:', todayRecord);
}

main().finally(() => prisma.$disconnect());
