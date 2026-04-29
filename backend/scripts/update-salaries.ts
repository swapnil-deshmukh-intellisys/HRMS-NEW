import { PrismaClient } from "@prisma/client";
import { calculateCompensationFromLpa } from "../src/modules/payroll/service.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating employee salaries...");

  const ceoEmail = "rutik.intellisys@gmail.com";
  const mdEmail = "mahesh.patil.intellisys@gmail.com";
  const hrEmail = "swapnil.deshmukh.intellisys@gmail.com";

  const packages = [
    { email: "ritesh.intellisys@gmail.com", lpa: 300000 },
    { email: "akshaymore.intellisysy@gmail.com", lpa: 300000 },
    { email: "harshada.intellisys@gmail.com", lpa: 312000 },
    { email: "rahuljadhav.intellisys@gmail.com", lpa: 312000 },
  ];

  const packageMap = new Map(packages.map(p => [p.email, p.lpa]));

  const employees = await prisma.employee.findMany({
    where: {
      user: {
        email: { notIn: [ceoEmail, mdEmail, hrEmail] }
      }
    },
    include: { user: true }
  });

  console.log(`Updating salaries for ${employees.length} employees...`);

  for (const employee of employees) {
    const lpa = packageMap.get(employee.user.email) || 150000; // Default to 1.5 LPA
    const compensation = calculateCompensationFromLpa(lpa);

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        annualPackageLpa: compensation.annualPackageLpa,
        grossMonthlySalary: compensation.grossMonthlySalary,
        basicMonthlySalary: compensation.basicMonthlySalary,
      }
    });

    console.log(`Updated ${employee.firstName}: ${lpa} LPA`);
  }

  console.log("Salary update completed.");
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
