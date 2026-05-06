import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nikita = await prisma.employee.findFirst({
    where: {
      firstName: { contains: "Nikita", mode: "insensitive" },
    },
  });

  if (!nikita) {
    console.log("Nikita not found");
    return;
  }

  console.log(`Found Nikita: ID ${nikita.id} (${nikita.firstName} ${nikita.lastName})`);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: nikita.id,
    },
    include: {
      leaveType: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`Found ${leaves.length} leave requests:`);
  leaves.forEach((l) => {
    console.log(`- ID: ${l.id}, Type: ${l.leaveType.code}, Status: ${l.status}, Manager: ${l.managerApprovalStatus}, HR: ${l.hrApprovalStatus}, Dates: ${l.startDate.toISOString().split('T')[0]} to ${l.endDate.toISOString().split('T')[0]}, Created: ${l.createdAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
