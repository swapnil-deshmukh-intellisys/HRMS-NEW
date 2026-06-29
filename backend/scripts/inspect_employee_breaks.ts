import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeCode: "IITS0012" },
      include: {
        pointHistory: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!employee) {
      console.log("Employee with code IITS0012 not found.");
      return;
    }

    console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
    console.log(`Current Points: ${employee.points}`);
    console.log("\n--- Points History (All Deductions) ---");
    for (const ph of employee.pointHistory) {
      console.log(`- Date: ${ph.createdAt.toISOString()} | Amount: ${ph.amount} | Reason: ${ph.reason} | Mode: ${ph.mode}`);
    }

  } catch (e) {
    console.error("FAILED to query database:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
