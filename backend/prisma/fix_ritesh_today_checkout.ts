import { PrismaClient, AttendanceStatus } from '@prisma/client';

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

  // Find the attendance record for today (represented in UTC as 2026-06-08T18:30:00.000Z due to timezone offsets)
  const todayRecord = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  if (!todayRecord) {
    console.log('No attendance record found for today.');
    return;
  }

  console.log('Before reset:', todayRecord);

  const updatedRecord = await prisma.attendance.update({
    where: { id: todayRecord.id },
    data: {
      checkOutTime: null,
      workedMinutes: 0,
      status: AttendanceStatus.PRESENT,
    },
  });

  console.log('Successfully reset today\'s checkout record.');
  console.log('After reset:', updatedRecord);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
