import { prisma } from "../src/config/prisma.js";

async function main() {
  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: { employees: true }
      },
      employees: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isActive: true
        }
      }
    }
  });

  console.log("=== Departments in Database ===");
  for (const dept of departments) {
    console.log(`Department: ${dept.name} (${dept.code})`);
    console.log(`- ID: ${dept.id}`);
    console.log(`- Employee Count (_count): ${dept._count.employees}`);
    console.log(`- Employees list length: ${dept.employees.length}`);
    console.log(`- Employees:`, dept.employees.map(e => `${e.firstName} ${e.lastName} (Active: ${e.isActive})`));
    console.log("------------------------");
  }
}

main()
  .catch(err => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
