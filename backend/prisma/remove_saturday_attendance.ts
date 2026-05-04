import { PrismaClient, CalendarExceptionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting targeted removal of WORKING SATURDAY attendance (April 2026)...');
  
  // 1. Find all Saturdays in April 2026 that were marked as WORKING_SATURDAY
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
    console.log('No Saturdays in April were marked as "WORKING_SATURDAY" in the database.');
    return;
  }

  console.log(`Found ${workingSaturdays.length} working Saturdays:`);
  workingSaturdays.forEach(ws => console.log(`- ${ws.date.toLocaleDateString()} (${ws.name || 'Unnamed'})`));

  let totalDeleted = 0;

  // 2. Delete attendance for ONLY those specific dates
  for (const exception of workingSaturdays) {
    const { count } = await prisma.attendance.deleteMany({
      where: {
        attendanceDate: {
          equals: exception.date
        }
      }
    });

    console.log(`- Removed ${count} attendance records for ${exception.date.toLocaleDateString()}`);
    totalDeleted += count;
  }

  console.log(`Total records removed: ${totalDeleted}`);
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
