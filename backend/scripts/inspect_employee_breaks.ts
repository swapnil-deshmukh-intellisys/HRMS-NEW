import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeCode: "IITS0012" },
      include: {
        attendances: {
          where: {
            attendanceDate: {
              gte: new Date("2026-06-28T00:00:00.000Z"),
              lte: new Date("2026-07-02T23:59:59.999Z")
            }
          },
          include: {
            breakSessions: true
          }
        }
      }
    });

    if (!employee) {
      console.log("Employee with code IITS0012 not found.");
      return;
    }

    const pointHistory = await prisma.pointHistory.findMany({
      where: {
        employeeId: employee.id,
        createdAt: {
          gte: new Date("2026-06-30T00:00:00.000Z")
        }
      },
      orderBy: { createdAt: "desc" }
    });

    console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
    console.log(`Current Leaderboard Points: ${employee.points}`);
    
    console.log("\n--- Today's Attendance Record (June 30, 2026) ---");
    if (employee.attendances.length === 0) {
      console.log("No attendance record found for today.");
    } else {
      for (const att of employee.attendances) {
        console.log(`Check-In Time: ${att.checkInTime ? att.checkInTime.toISOString() : "Not Checked In"}`);
        console.log(`Lateness: ${att.lateByMinutes} min`);
        console.log(`Is Late: ${att.isLate}`);
        console.log(`Penalty Minutes: ${att.penaltyMinutes} min`);
        console.log(`Status: ${att.status}`);
      }
    }

    console.log("\n--- Today's Point Deductions (June 30, 2026) ---");
    if (pointHistory.length === 0) {
      console.log("No point transactions logged today.");
    } else {
      for (const ph of pointHistory) {
        console.log(`- Time: ${ph.createdAt.toISOString()} | Amount: ${ph.amount} | Reason: ${ph.reason} | Mode: ${ph.mode}`);
      }
    }

  } catch (e) {
    console.error("FAILED to query database:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
