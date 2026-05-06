import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notificationId = 1;

  const n = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!n) {
    console.log(`Notification ${notificationId} not found.`);
    return;
  }

  console.log(`Deleting notification ${notificationId}: ${n.message}`);
  await prisma.notification.delete({
    where: { id: notificationId },
  });

  console.log("Deleted.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
