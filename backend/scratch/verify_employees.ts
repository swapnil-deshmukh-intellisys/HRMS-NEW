import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      user: { select: { email: true } }
    }
  });
  const roles = await prisma.role.findMany();
  
  console.log(JSON.stringify({ employees, roles }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
