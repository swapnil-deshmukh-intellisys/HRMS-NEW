import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing Rahul Jadhav's department and role...");

  // 1. Create 'Management' department if it doesn't exist
  const managementDept = await prisma.department.upsert({
    where: { code: "MGMT" },
    update: {},
    create: {
      name: "Management",
      code: "MGMT",
    },
  });
  console.log(`Department 'Management' (MGMT) is ready.`);

  // 2. Find Rahul Jadhav
  const rahul = await prisma.employee.findFirst({
    where: { user: { email: "rahuljadhav.intellisys@gmail.com" } },
    include: { user: true }
  });

  if (rahul) {
    // Update role to MANAGER
    const managerRole = await prisma.role.findFirst({ where: { name: "MANAGER" } });
    
    if (managerRole) {
      await prisma.user.update({
        where: { id: rahul.userId },
        data: { roleId: managerRole.id }
      });
      console.log("Updated Rahul's system role to MANAGER.");
    }

    // Update department to Management
    await prisma.employee.update({
      where: { id: rahul.id },
      data: { departmentId: managementDept.id }
    });
    console.log("Moved Rahul to Management department.");
  } else {
    console.log("Rahul Jadhav not found.");
  }
  
  // Also move Rutik and Mahesh to Management?
  const executives = ["rutik.intellisys@gmail.com", "mahesh.patil.intellisys@gmail.com"];
  for (const email of executives) {
     const emp = await prisma.employee.findFirst({ where: { user: { email } } });
     if (emp) {
        await prisma.employee.update({
            where: { id: emp.id },
            data: { departmentId: managementDept.id }
        });
        console.log(`Moved ${email} to Management department.`);
     }
  }

  console.log("Cleanup complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
