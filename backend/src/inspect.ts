import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Roles ===");
  const roles = await prisma.role.findMany();
  console.log(JSON.stringify(roles, null, 2));

  console.log("=== Departments ===");
  const depts = await prisma.department.findMany();
  console.log(JSON.stringify(depts, null, 2));

  console.log("=== Existing Interns ===");
  const interns = await prisma.employee.findMany({
    where: {
      employmentType: "INTERNSHIP",
    },
    include: {
      user: true,
    }
  });
  console.log(JSON.stringify(interns, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
