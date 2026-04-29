import { PrismaClient } from "@prisma/client";
import { ensureEmployeeLeaveBalances } from "../src/utils/leave-balance.js";
import { getFinancialYearForDate } from "../src/utils/financial-year.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting leave balance initialization...");

  const employees = await prisma.employee.findMany({
    where: { isActive: true }
  });

  if (employees.length === 0) {
    console.error("No active employees found.");
    return;
  }

  const currentYear = getFinancialYearForDate(new Date());
  console.log(`Initializing balances for ${employees.length} employees for Year ${currentYear}...`);

  for (const employee of employees) {
    process.stdout.write(`Processing ${employee.firstName} ${employee.lastName}... `);
    try {
      await ensureEmployeeLeaveBalances(prisma, employee.id, currentYear, new Date());
      console.log("✅");
    } catch (error) {
      console.log("❌");
      console.error(`Error for ${employee.id}:`, error);
    }
  }

  console.log("Leave balance initialization completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
