import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const latestAttendance = await prisma.attendance.findFirst({
    where: { employeeId: 5 },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Latest Attendance:', JSON.stringify(latestAttendance, null, 2));
}

main().finally(() => prisma.$disconnect());
