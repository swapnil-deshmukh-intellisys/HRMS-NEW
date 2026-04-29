import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  const depts = await prisma.department.findMany();
  const leaveTypes = await prisma.leaveType.findMany();
  const holidays = await prisma.calendarException.findMany();

  console.log(JSON.stringify({
    roles: roles.map(r => r.name),
    depts: depts.map(d => d.code),
    leaveTypes: leaveTypes.map(l => ({
      name: l.name,
      code: l.code,
      defaultDaysPerYear: l.defaultDaysPerYear,
      allocationMode: l.allocationMode,
      quarterlyAllocationDays: l.quarterlyAllocationDays
    })),
    holidaysCount: holidays.length
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
