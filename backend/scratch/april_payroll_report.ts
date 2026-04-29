import { PrismaClient } from "@prisma/client";
import { buildPayrollPreview } from "../src/modules/payroll/service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Generating April 2026 Payroll Report...");

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      grossMonthlySalary: { not: null }
    },
    include: { user: true }
  });

  const report = [];

  for (const employee of employees) {
    try {
      const preview = await buildPayrollPreview({
        employeeId: employee.id,
        month: 4,
        year: 2026,
        prisma
      });

      report.push({
        name: `${employee.firstName} ${employee.lastName}`,
        email: employee.user.email,
        lpa: employee.annualPackageLpa,
        grossMonthly: preview.grossMonthlySalary,
        deductibleDays: preview.deductibleDays,
        deductionAmount: preview.deductionAmount,
        netPayable: preview.totalPayableSalary
      });
    } catch (err) {
      console.error(`Error for ${employee.firstName}:`, err);
    }
  }

  console.log("REPORT_START");
  console.log(JSON.stringify(report, null, 2));
  console.log("REPORT_END");
}

main()
  .finally(() => prisma.$disconnect());
