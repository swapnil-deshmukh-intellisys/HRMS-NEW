import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Diagnostic Report (Calendar & Attendance) ---');
  
  // 1. Check for Calendar Exceptions on May 1st, 2026
  const targetDate = new Date('2026-05-01T00:00:00.000Z');
  const exceptions = await prisma.calendarException.findMany({
    where: {
      date: {
        gte: new Date('2026-05-01T00:00:00Z'),
        lte: new Date('2026-05-01T23:59:59Z')
      }
    }
  });

  console.log('\n[1] Calendar Exceptions for May 1st:');
  if (exceptions.length === 0) {
    console.log('-> NO exception found for May 1st.');
  } else {
    exceptions.forEach(ex => {
      console.log(`-> Found: ${ex.name} (${ex.type}) | ID: ${ex.id} | Date: ${ex.date.toISOString()}`);
    });
  }

  // 2. Check for Attendance records for May 1st for a sample of employees
  const attendance = await prisma.attendance.findMany({
    where: {
      attendanceDate: {
        equals: targetDate
      }
    },
    take: 5,
    include: {
      employee: {
        select: { firstName: true, lastName: true }
      }
    }
  });

  console.log('\n[2] Sample Attendance Records for May 1st:');
  if (attendance.length === 0) {
    console.log('-> NO attendance records found for May 1st.');
  } else {
    attendance.forEach(att => {
      console.log(`-> ${att.employee.firstName} ${att.employee.lastName}: ${att.status}`);
    });
  }

  console.log('\n--- Diagnostic Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
