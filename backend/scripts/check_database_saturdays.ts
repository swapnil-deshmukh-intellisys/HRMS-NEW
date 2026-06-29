import { PrismaClient, AttendanceStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const records = await prisma.attendance.findMany({
      where: {
        status: AttendanceStatus.ABSENT,
      },
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        status: true,
        createdAt: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        }
      }
    });

    console.log(`Total ABSENT records in DB: ${records.length}`);
    
    // Filter records that fall on Saturday (6) or Sunday (0)
    const weekendAbsents = records.filter(r => {
      const day = new Date(r.attendanceDate).getDay();
      return day === 0 || day === 6;
    });

    console.log(`Total Weekend (Sat/Sun) ABSENT records: ${weekendAbsents.length}`);
    const groupedByDate: Record<string, any[]> = {};
    weekendAbsents.forEach(r => {
      const dStr = r.attendanceDate.toISOString();
      if (!groupedByDate[dStr]) {
        groupedByDate[dStr] = [];
      }
      groupedByDate[dStr].push({
        id: r.id,
        employeeCode: r.employee.employeeCode,
        createdAt: r.createdAt
      });
    });
    
    console.log("Weekend ABSENT records grouped by date with createdAt samples:");
    for (const [date, records] of Object.entries(groupedByDate)) {
      console.log(`\nDate: ${date} (Count: ${records.length})`);
      console.log("Samples:", JSON.stringify(records.slice(0, 3), null, 2));
    }

    const exceptions = await prisma.calendarException.findMany({
      orderBy: { date: "asc" }
    });
    console.log(`\nTotal CalendarExceptions in DB: ${exceptions.length}`);
    console.log(JSON.stringify(exceptions, null, 2));
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
