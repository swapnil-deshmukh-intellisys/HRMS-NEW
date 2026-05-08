
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const notificationId = 6;
  
  try {
    const deleted = await prisma.notification.delete({
      where: { id: notificationId }
    });
    console.log(`Successfully deleted notification ID: ${deleted.id}`);
  } catch (error) {
    console.error(`Failed to delete notification ID ${notificationId}:`, error);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
