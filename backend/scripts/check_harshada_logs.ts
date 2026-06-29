import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const totalLogs = await prisma.desktopActivityLog.count();
    console.log("Total DesktopActivityLog records in database:", totalLogs);

    if (totalLogs > 0) {
      const logs = await prisma.desktopActivityLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          employee: {
            include: {
              user: true
            }
          }
        }
      });
      console.log("\nRECENT LOGS:");
      logs.forEach(l => {
        console.log(`Employee: ${l.employee.firstName} ${l.employee.lastName} (${l.employee.user?.email}) | Event: ${l.eventType} | Time: ${l.timestamp}`);
      });
    } else {
      console.log("No desktop activity logs found for any user.");
    }
  } catch (e: any) {
    console.error("Error:", e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
