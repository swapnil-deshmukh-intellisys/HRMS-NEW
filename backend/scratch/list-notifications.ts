import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notifications = await prisma.notification.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  console.log("Recent Notifications:");
  notifications.forEach((n) => {
    console.log(`- ID: ${n.id}, UserID: ${n.userId}, Title: ${n.title}, Link: ${n.link}, Created: ${n.createdAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
