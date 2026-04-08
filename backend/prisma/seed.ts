import { LeaveAllocationMode, PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const role of [RoleName.ADMIN, RoleName.HR, RoleName.MANAGER, RoleName.EMPLOYEE]) {
    await prisma.role.upsert({
      where: { name: role },
      update: {},
      create: { name: role },
    });
  }

  await prisma.department.upsert({
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
  for (const leaveType of [
    {
      name: "Casual Leave",
      code: "CL",
      defaultDaysPerYear: 12,
      allocationMode: LeaveAllocationMode.QUARTERLY,
      quarterlyAllocationDays: 3,
      carryForwardAllowed: false,
      carryForwardCap: null,
      requiresAttachmentAfterDays: null,
      deductFullQuotaOnApproval: false,
      maxUsagesPerYear: null,
      policyEffectiveFromYear: 2026,
    },
    {
      name: "Sick Leave",
      code: "SL",
      defaultDaysPerYear: 8,
      allocationMode: LeaveAllocationMode.QUARTERLY,
      quarterlyAllocationDays: 2,
      carryForwardAllowed: true,
      carryForwardCap: 15,
      requiresAttachmentAfterDays: 2,
      deductFullQuotaOnApproval: false,
      maxUsagesPerYear: null,
      policyEffectiveFromYear: 2026,
    },
    {
      name: "Earned Leave",
      code: "EL",
      defaultDaysPerYear: 15,
      allocationMode: LeaveAllocationMode.YEARLY,
      quarterlyAllocationDays: null,
      carryForwardAllowed: false,
      carryForwardCap: null,
      requiresAttachmentAfterDays: null,
      deductFullQuotaOnApproval: false,
      maxUsagesPerYear: null,
      policyEffectiveFromYear: null,
    },
    {
      name: "Maternity Leave",
      code: "MAT",
      defaultDaysPerYear: 90,
      allocationMode: LeaveAllocationMode.YEARLY,
      quarterlyAllocationDays: null,
      carryForwardAllowed: false,
      carryForwardCap: null,
      requiresAttachmentAfterDays: null,
      deductFullQuotaOnApproval: true,
      maxUsagesPerYear: 1,
      policyEffectiveFromYear: 2026,
    },
    {
      name: "Paternity Leave",
      code: "PAT",
      defaultDaysPerYear: 10,
      allocationMode: LeaveAllocationMode.YEARLY,
      quarterlyAllocationDays: null,
      carryForwardAllowed: false,
      carryForwardCap: null,
      requiresAttachmentAfterDays: null,
      deductFullQuotaOnApproval: true,
      maxUsagesPerYear: 1,
      policyEffectiveFromYear: 2026,
    },
    {
      name: "Bereavement Leave",
      code: "BRV",
      defaultDaysPerYear: 5,
      allocationMode: LeaveAllocationMode.YEARLY,
      quarterlyAllocationDays: null,
      carryForwardAllowed: false,
      carryForwardCap: null,
      requiresAttachmentAfterDays: null,
      deductFullQuotaOnApproval: true,
      maxUsagesPerYear: 1,
      policyEffectiveFromYear: 2026,
    },
  ]) {
    await prisma.leaveType.upsert({
      where: { code: leaveType.code },
      update: leaveType,
      create: leaveType,
    });
  }
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
