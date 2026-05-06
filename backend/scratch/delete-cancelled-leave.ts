import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leaveId = 1; // Nikita's cancelled leave ID

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
  });

  if (!leave) {
    console.log(`Leave request ${leaveId} not found.`);
    return;
  }

  console.log(`Deleting leave request ${leaveId} (Status: ${leave.status}, Employee ID: ${leave.employeeId})...`);

  // Clean up notifications related to this leave
  const notifications = await prisma.notification.deleteMany({
    where: {
      link: { contains: `id=${leaveId}` }
    }
  });
  console.log(`Deleted ${notifications.count} notifications.`);

  await prisma.leaveRequest.delete({
    where: { id: leaveId },
  });

  console.log("Successfully deleted the leave request.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
