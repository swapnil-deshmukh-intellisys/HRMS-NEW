import { PrismaClient, CalendarExceptionType, AttendanceStatus, EmploymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

const checkInTimeStr = '10:00';
const checkOutTimeStr = '19:00';

async function main() {
  console.log('Starting population of WORKING SATURDAY attendance (April 2026)...');
  
  // 1. Find the working Saturdays
  const workingSaturdays = await prisma.calendarException.findMany({
    where: {
      type: CalendarExceptionType.WORKING_SATURDAY,
      date: {
        gte: new Date('2026-04-01T00:00:00Z'),
        lte: new Date('2026-04-30T23:59:59Z')
      }
    }
  });

  if (workingSaturdays.length === 0) {
    console.log('No Saturdays in April are marked as "WORKING_SATURDAY". Please add them to the calendar first.');
    return;
  }

  // 2. Find all active employees
  const employees = await prisma.employee.findMany({
    where: {
      employmentStatus: EmploymentStatus.ACTIVE,
      isActive: true
    }
  });

  console.log(`Populating attendance for ${employees.length} employees across ${workingSaturdays.length} Saturdays.`);

  let totalUpdated = 0;

  for (const exception of workingSaturdays) {
    const dateStr = exception.date.toISOString().split('T')[0];
    console.log(`Processing ${dateStr}...`);

    for (const emp of employees) {
      const checkInDate = new Date(`${dateStr}T${checkInTimeStr}:00`);
      const checkOutDate = new Date(`${dateStr}T${checkOutTimeStr}:00`);
      const workedMinutes = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000);

      await prisma.attendance.upsert({
        where: {
          employeeId_attendanceDate: {
            employeeId: emp.id,
            attendanceDate: exception.date,
          },
        },
        update: {
          checkInTime: checkInDate,
          checkOutTime: checkOutDate,
          workedMinutes,
          status: AttendanceStatus.PRESENT,
        },
        create: {
          employeeId: emp.id,
          attendanceDate: exception.date,
          checkInTime: checkInDate,
          checkOutTime: checkOutDate,
          workedMinutes,
          status: AttendanceStatus.PRESENT,
        },
      });
      totalUpdated++;
    }
  }

  console.log(`Total attendance records populated: ${totalUpdated}`);
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
