import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Querying Test User Employee Info ===");
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: "Test", mode: "insensitive" } },
        { lastName: { contains: "User", mode: "insensitive" } }
      ]
    },
    include: {
      user: true,
    }
  });

  for (const emp of employees) {
    console.log(`ID: ${emp.id}`);
    console.log(`Name: ${emp.firstName} ${emp.lastName}`);
    console.log(`Email: ${emp.user.email}`);
    console.log(`Joining Date: ${emp.joiningDate}`);
    console.log(`Employment Status: ${emp.employmentStatus}`);
    console.log(`Is Active: ${emp.isActive}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });
