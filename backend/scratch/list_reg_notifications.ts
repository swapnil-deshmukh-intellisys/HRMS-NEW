
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const notifications = await prisma.notification.findMany({
    where: {
      type: 'ATTENDANCE_REGULARIZATION_REQUESTED'
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('--- Regularization Notifications ---');
  notifications.forEach(n => {
    console.log(`ID: ${n.id} | UserID: ${n.userId} | Message: ${n.message} | CreatedAt: ${n.createdAt.toISOString()}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
