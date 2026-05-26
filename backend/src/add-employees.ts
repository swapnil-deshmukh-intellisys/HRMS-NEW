import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { ensureEmployeeLeaveBalances } from "./utils/leave-balance.js";
import { getFinancialYearForDate } from "./utils/financial-year.js";

const prisma = new PrismaClient();

const employeesToAdd = [
  {
    firstName: "Sanjana",
    lastName: "Ganvir",
    email: "sanjanaganvir.intellisys@gmail.com",
    dob: new Date("2002-10-13T00:00:00.000Z"),
    joiningDate: new Date("2026-05-14T09:00:00.000Z"),
    pan: "DTSPG5566D",
    phone: "7620920205",
    jobTitle: "Data Analyst Intern"
  },
  {
    firstName: "Shubham",
    lastName: "Rathod",
    email: "shubhamrathod.intellisys@gmail.com",
    dob: new Date("2004-03-05T00:00:00.000Z"),
    joiningDate: new Date("2026-05-14T09:00:00.000Z"),
    pan: null,
    phone: "9359834735",
    jobTitle: "Data Analyst Intern"
  },
  {
    firstName: "Prajakta",
    lastName: "Gaikwad",
    email: "prajaktagaikwad.intellisys@gmail.com",
    dob: new Date("1999-10-09T00:00:00.000Z"),
    joiningDate: new Date("2026-05-14T09:00:00.000Z"),
    pan: "BYTPG7216C",
    phone: "8380065458",
    jobTitle: "Data Analyst Intern"
  },
  {
    firstName: "Shubham",
    lastName: "Kale",
    email: "shubhamkale.intellisys@gmail.com",
    dob: new Date("2001-06-12T00:00:00.000Z"),
    joiningDate: new Date("2026-05-14T09:00:00.000Z"),
    pan: "IXFPK8226N",
    phone: "7620554761",
    jobTitle: "Data Analyst Intern"
  }
];

async function main() {
  const defaultPasswordHash = await bcrypt.hash("Password@123", 10);
  const roleRecord = await prisma.role.findUnique({ where: { name: "EMPLOYEE" } });
  if (!roleRecord) {
    throw new Error("EMPLOYEE role not found in database");
  }

  console.log("Starting import of 4 employees...");

  for (let i = 0; i < employeesToAdd.length; i++) {
    const data = employeesToAdd[i];
    
    // Check if user already exists to avoid duplicates
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      console.log(`User with email ${data.email} already exists. Skipping.`);
      continue;
    }

    const employeeCode = `EMP-${Date.now()}-${i}`;

    const createdEmployee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: defaultPasswordHash,
          roleId: roleRecord.id,
          isActive: true
        }
      });

      return tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          departmentId: 2, // Software Development
          managerId: 36, // Same manager as cohort
          joiningDate: data.joiningDate,
          employmentStatus: "ACTIVE",
          isActive: true,
          jobTitle: data.jobTitle,
          annualPackageLpa: null,
          grossMonthlySalary: 0,
          basicMonthlySalary: 0,
          isOnProbation: false,
          probationEndDate: null,
          panCardNumber: data.pan,
          dateOfBirth: data.dob,
          employmentType: "INTERNSHIP",
          internshipType: "UNPAID",
          stipend: 0
        }
      });
    });

    // Seed leave balances
    await ensureEmployeeLeaveBalances(prisma, createdEmployee.id, getFinancialYearForDate(data.joiningDate));
    console.log(`Successfully created employee: ${data.firstName} ${data.lastName} (${data.email})`);
  }

  console.log("All employees imported successfully!");
}

main()
  .catch((e) => console.error("Error running script:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
