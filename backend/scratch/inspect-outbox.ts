import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const outboxItems = await prisma.notificationOutbox.findMany({
    where: {
      type: "LEAVE_REQUESTED",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  console.log("Recent Outbox Items (LEAVE_REQUESTED):");
  outboxItems.forEach((item) => {
    console.log(`- ID: ${item.id}, Status: ${item.status}, Payload: ${JSON.stringify(item.payload, null, 2)}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
