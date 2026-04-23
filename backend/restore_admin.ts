import { PrismaClient, RoleName, EmploymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Saymyname@2812", 10);
  
  const adminRole = await prisma.role.findUnique({
    where: { name: RoleName.ADMIN }
  });

  const hrdep = await prisma.department.findUnique({
    where: { code: "ADMIN" }
  });

  if (!adminRole || !hrdep) {
    console.error("Roles or Departments not seeded. Run npx prisma db seed first.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: "swapnil@intellisys.com",
      passwordHash,
      roleId: adminRole.id,
      employee: {
        create: {
          employeeCode: "EMP001",
          firstName: "Swapnil",
          lastName: "Deshmukh",
          departmentId: hrdep.id,
          joiningDate: new Date(),
          employmentStatus: EmploymentStatus.ACTIVE,
        }
      }
    }
  });

  console.log("Admin user created:", user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
