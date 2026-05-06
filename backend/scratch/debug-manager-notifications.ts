import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const leaveId = 2; // Nikita's current leave

  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: {
      employee: {
        include: {
          manager: true,
        },
      },
    },
  });

  if (!leave || !leave.employee.manager) {
    console.log("Leave or Manager not found");
    return;
  }

  const manager = leave.employee.manager;
  console.log(`Manager: ${manager.firstName} ${manager.lastName} (Employee ID: ${manager.id}, User ID: ${manager.userId})`);

  if (!manager.userId) {
    console.log("Manager User ID not found");
    return;
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId: manager.userId,
      type: "LEAVE_REQUESTED"
    }
  });

  console.log(`Found ${notifications.length} notifications for manager:`);
  notifications.forEach(n => {
    console.log(`- ID: ${n.id}, Title: ${n.title}, Link: "${n.link}", Created: ${n.createdAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
