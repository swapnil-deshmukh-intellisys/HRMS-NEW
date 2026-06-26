import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating clients to TSP (The Star Prime)...');
  
  // 1. Upsert the TSP client
  const tsp = await prisma.client.upsert({
    where: { code: 'TSP' },
    update: {},
    create: {
      name: 'The Star Prime',
      code: 'TSP',
    },
  });

  console.log(`TSP Client upserted: ${tsp.name} (ID: ${tsp.id})`);

  // 2. Update all existing Outlook emails to point to the TSP client
  const updateResult = await prisma.outlookEmail.updateMany({
    data: {
      clientId: tsp.id
    }
  });

  console.log(`Updated ${updateResult.count} Outlook emails to point to TSP.`);

  // 3. (Optional) Clean up old client records to keep the database pristine
  const deleteResult = await prisma.client.deleteMany({
    where: {
      code: {
        in: ['TUT', 'TEC']
      }
    }
  });
  console.log(`Cleaned up ${deleteResult.count} old client records.`);

  console.log('Migration to TSP completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
