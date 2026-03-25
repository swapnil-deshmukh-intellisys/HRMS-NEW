import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";
import { ensureEmployeeLeaveBalances } from "../src/utils/leave-balance.js";

const prisma = new PrismaClient();

async function main() {
  for (const role of [RoleName.ADMIN, RoleName.HR, RoleName.MANAGER, RoleName.EMPLOYEE]) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.ADMIN },
  });

  const department = await prisma.department.upsert({
    where: { code: "ADMIN" },
    update: {},
    create: { name: "Administration", code: "ADMIN" },
  });

  await prisma.department.upsert({
    where: { code: "SD" },
    update: {},
    create: { name: "Software Development", code: "SD" },
  });

  for (const departmentSeed of [
    { name: "HR", code: "HR" },
    { name: "Finance", code: "FIN" },
    { name: "Sales", code: "SALES" },
    { name: "Marketing", code: "MKT" },
    { name: "Operations", code: "OPS" },
    { name: "Customer Support", code: "CS" },
  ]) {
    await prisma.department.upsert({
      where: { code: departmentSeed.code },
      update: {},
      create: departmentSeed,
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hrms.local" },
    update: {
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      email: "admin@hrms.local",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      roleId: adminRole.id,
      isActive: true,
    },
  });

  for (const leaveType of [
    { name: "Casual Leave", code: "CL", defaultDaysPerYear: 12 },
    { name: "Sick Leave", code: "SL", defaultDaysPerYear: 10 },
    { name: "Earned Leave", code: "EL", defaultDaysPerYear: 15 },
  ]) {
    await prisma.leaveType.upsert({
      where: { code: leaveType.code },
      update: leaveType,
      create: leaveType,
    });
  }

  const adminEmployee = await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {
      departmentId: department.id,
      employmentStatus: "ACTIVE",
      isActive: true,
    },
    create: {
      userId: adminUser.id,
      employeeCode: "EMP001",
      firstName: "System",
      lastName: "Admin",
      departmentId: department.id,
      joiningDate: new Date(),
    },
  });

  await ensureEmployeeLeaveBalances(prisma, adminEmployee.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
