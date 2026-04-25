import { PrismaClient } from "@prisma/client";
import { buildPayrollPreview } from "../src/modules/payroll/service.js";

const prisma = new PrismaClient();

async function check() {
  try {
    const employee = await prisma.employee.findFirst({ 
      where: { 
        isActive: true,
        grossMonthlySalary: { not: null }
      } 
    });
    
    if (!employee) {
      console.log("No active employee with compensation found");
      return;
    }

    const preview = await buildPayrollPreview({
      employeeId: employee.id,
      month: 4,
      year: 2026,
      prisma
    });

    console.log("API PREVIEW KEYS:", Object.keys(preview));
    console.log("totalPayableAmount:", preview.totalPayableAmount);
    console.log("netBaseSalary:", preview.netBaseSalary);
    console.log("finalSalary:", preview.finalSalary);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
