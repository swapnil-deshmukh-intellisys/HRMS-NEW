import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const employee = await prisma.employee.findFirst({
      where: {
        user: {
          email: {
            contains: 'harshada',
            mode: 'insensitive'
          }
        }
      }
    });

    if (!employee) {
      console.log("No employee found with user email containing 'harshada'");
      return;
    }

    const employeeId = employee.id;

    // Define mock logs for today (2026-06-29) in IST.
    // 9:00 AM IST is 3:30 AM UTC.
    const mockLogs = [
      { eventType: 'WAKE', timeStr: '2026-06-29T03:30:00.000Z' },
      { eventType: 'UNLOCK', timeStr: '2026-06-29T03:31:00.000Z' },
      { eventType: 'IDLE_START', timeStr: '2026-06-29T04:45:00.000Z' },
      { eventType: 'IDLE_END', timeStr: '2026-06-29T05:00:00.000Z' },
      { eventType: 'LOCK', timeStr: '2026-06-29T06:15:00.000Z' },
      { eventType: 'UNLOCK', timeStr: '2026-06-29T06:30:00.000Z' },
    ];

    // Clear today's logs first
    const todayStart = new Date('2026-06-29T00:00:00.000Z');
    const todayEnd = new Date('2026-06-29T23:59:59.999Z');
    const deleteResult = await prisma.desktopActivityLog.deleteMany({
      where: {
        employeeId,
        timestamp: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    });
    console.log(`Deleted ${deleteResult.count} existing logs for today.`);

    // Insert new mock logs
    for (const log of mockLogs) {
      const created = await prisma.desktopActivityLog.create({
        data: {
          employeeId,
          eventType: log.eventType,
          timestamp: new Date(log.timeStr),
          ipAddress: '127.0.0.1'
        }
      });
      console.log(`Inserted ${created.eventType} log at ${created.timestamp.toISOString()}`);
    }

    console.log("\nSuccess: Simulated live desktop logs successfully loaded for Harshada Nichit!");

  } catch (e: any) {
    console.error("Error inserting mock logs:", e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
