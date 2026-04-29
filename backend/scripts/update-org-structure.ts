import { PrismaClient, EmployeeCapabilityType, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating Organization Structure...");

  // 1. Get the Role IDs
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map(r => [r.name, r.id]));

  const adminRoleId = roleMap.get(RoleName.ADMIN);
  const hrRoleId = roleMap.get(RoleName.HR);
  const managerRoleId = roleMap.get(RoleName.MANAGER);
  const employeeRoleId = roleMap.get(RoleName.EMPLOYEE);

  if (!adminRoleId || !hrRoleId || !managerRoleId || !employeeRoleId) {
    throw new Error("Missing roles in database.");
  }

  // 2. Define special entities by email
  const ceoEmail = "rutik.intellisys@gmail.com";
  const mdEmail = "mahesh.patil.intellisys@gmail.com";
  const hrEmail = "swapnil.deshmukh.intellisys@gmail.com";
  const managerEmail = "rahuljadhav.intellisys@gmail.com";

  const tlEmails = [
    "ritesh.intellisys@gmail.com",
    "harshada.intellisys@gmail.com",
    "akshaymore.intellisysy@gmail.com"
  ];

  // Get employee records for these people
  const specialEmployees = await prisma.employee.findMany({
    where: {
      user: {
        email: { in: [ceoEmail, mdEmail, hrEmail, managerEmail, ...tlEmails] }
      }
    },
    include: { user: true }
  });

  const empMap = new Map(specialEmployees.map(e => [e.user.email, e]));

  const ceo = empMap.get(ceoEmail);
  const md = empMap.get(mdEmail);
  const hr = empMap.get(hrEmail);
  const manager = empMap.get(managerEmail);

  if (!ceo || !md || !hr || !manager) {
    console.error("Critical staff missing from database.");
    return;
  }

  // 3. Update Roles
  console.log("Updating roles...");
  await prisma.user.update({ where: { id: ceo.userId }, data: { roleId: adminRoleId } });
  await prisma.user.update({ where: { id: md.userId }, data: { roleId: adminRoleId } });
  await prisma.user.update({ where: { id: hr.userId }, data: { roleId: hrRoleId } });
  await prisma.user.update({ where: { id: manager.userId }, data: { roleId: hrRoleId } }); // User specifically asked for HR role for Rahul

  // 4. Update Hierarchy (Reporting To)
  console.log("Setting up reporting lines...");
  
  // CEO and MD report to no one
  await prisma.employee.updateMany({
    where: { id: { in: [ceo.id, md.id] } },
    data: { managerId: null }
  });

  // HR and Main Manager report to CEO
  await prisma.employee.updateMany({
    where: { id: { in: [hr.id, manager.id] } },
    data: { managerId: ceo.id }
  });

  // Everyone else reports to Rahul (Manager)
  await prisma.employee.updateMany({
    where: { 
      id: { notIn: [ceo.id, md.id, hr.id, manager.id] } 
    },
    data: { managerId: manager.id }
  });

  // 5. Add Team Lead Capabilities
  console.log("Adding Team Lead capabilities...");
  for (const email of tlEmails) {
    const tl = empMap.get(email);
    if (tl) {
      await prisma.employeeCapability.upsert({
        where: {
          employeeId_capability: {
            employeeId: tl.id,
            capability: EmployeeCapabilityType.TEAM_LEAD
          }
        },
        update: {},
        create: {
          employeeId: tl.id,
          capability: EmployeeCapabilityType.TEAM_LEAD
        }
      });
      console.log(`Added TL capability to ${tl.firstName}`);
    }
  }

  console.log("Organization structure updated successfully.");
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
