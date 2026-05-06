import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { message: { contains: "Nikita", mode: "insensitive" } },
        { title: { contains: "Nikita", mode: "insensitive" } }
      ]
    }
  });

  console.log("Nikita Related Notifications:");
  notifications.forEach((n) => {
    console.log(`- ID: ${n.id}, UserID: ${n.userId}, Title: ${n.title}, Message: ${n.message}, Created: ${n.createdAt}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
