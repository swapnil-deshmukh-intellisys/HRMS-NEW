import { PrismaClient, AttendanceStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Fetching all ABSENT records from the database...");
    const absents = await prisma.attendance.findMany({
      where: { status: AttendanceStatus.ABSENT },
      select: { id: true, attendanceDate: true }
    });

    console.log(`Found ${absents.length} total ABSENT records. Filtering weekend records...`);
    const weekendIdsToDelete: number[] = [];

    for (const record of absents) {
      const date = new Date(record.attendanceDate);
      const day = date.getDay(); // 0 is Sunday, 6 is Saturday
      if (day === 0 || day === 6) {
        // Check if there is a WORKING_SATURDAY exception for this date
        const exception = await prisma.calendarException.findFirst({
          where: {
            date: {
              gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
              lte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
            },
            type: "WORKING_SATURDAY"
          }
        });

        if (!exception) {
          weekendIdsToDelete.push(record.id);
        }
      }
    }

    console.log(`Found ${weekendIdsToDelete.length} invalid weekend ABSENT records (with no working Saturday exception) to delete.`);
    
    if (weekendIdsToDelete.length > 0) {
      const result = await prisma.attendance.deleteMany({
        where: {
          id: { in: weekendIdsToDelete }
        }
      });
      console.log(`Successfully deleted ${result.count} invalid weekend ABSENT records.`);
    } else {
      console.log("No invalid weekend ABSENT records found to delete.");
    }
  } catch (e) {
    console.error("Error during database cleanup:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
