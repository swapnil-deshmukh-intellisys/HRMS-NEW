import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.employee.updateMany({
    data: { joiningDate: new Date("2026-04-01") }
  });
  console.log("Updated", result.count, "employees.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
