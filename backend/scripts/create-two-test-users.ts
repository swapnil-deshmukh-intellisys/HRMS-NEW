import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcrypt";
import { ensureEmployeeLeaveBalances } from "../src/utils/leave-balance";
import { getFinancialYearForDate } from "../src/utils/financial-year";

const prisma = new PrismaClient();

const testEmployees = [
  {
    email: "test1@gmail.com",
    firstName: "Test",
    lastName: "One",
    employeeCode: "TEST-101",
  },
  {
    email: "test2@gmail.com",
    firstName: "Test",
    lastName: "Two",
    employeeCode: "TEST-102",
  }
];

async function main() {
  const password = "Password@123";
  const passwordHash = await bcrypt.hash(password, 10);

  // Find EMPLOYEE role
  const roleRecord = await prisma.role.findUnique({ where: { name: RoleName.EMPLOYEE } });
  if (!roleRecord) {
    throw new Error("EMPLOYEE role not found in database");
  }

  // Find a default department (Software Development or any active one)
  let department = await prisma.department.findFirst({ where: { code: "SD" } });
  if (!department) {
    department = await prisma.department.findFirst({ where: { isActive: true } });
  }
  if (!department) {
    throw new Error("No active department found in database");
  }

  // Find Day Shift (shiftId: 1) or any active shift
  let shift = await prisma.shift.findFirst({ where: { id: 1 } });
  if (!shift) {
    shift = await prisma.shift.findFirst();
  }

  const joiningDate = new Date();

  console.log("Creating test employees...");

  for (const data of testEmployees) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      console.log(`User with email ${data.email} already exists. Skipping.`);
      continue;
    }

    const createdEmployee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          roleId: roleRecord.id,
          isActive: true
        }
      });

      return tx.employee.create({
        data: {
          userId: user.id,
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          departmentId: department!.id,
          shiftId: shift?.id ?? null,
          joiningDate,
          employmentStatus: "ACTIVE",
          employmentType: "FULL_TIME",
          isActive: true,
          jobTitle: "QA Tester",
          grossMonthlySalary: 30000,
          basicMonthlySalary: 15000,
          isOnProbation: false,
        }
      });
    });

    // Seed leave balances
    await ensureEmployeeLeaveBalances(prisma, createdEmployee.id, getFinancialYearForDate(joiningDate));
    console.log(`Successfully created test employee: ${data.firstName} ${data.lastName} (${data.email})`);
  }

  console.log("Completed!");
}

main()
  .catch((e) => console.error("Error creating test users:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
