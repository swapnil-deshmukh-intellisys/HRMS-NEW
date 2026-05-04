import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for Holidays in March 2026 ---');
  
  const exceptions = await prisma.calendarException.findMany({
    where: {
      date: {
        gte: new Date('2026-03-01T00:00:00Z'),
        lte: new Date('2026-03-31T23:59:59Z')
      }
    }
  });

  if (exceptions.length === 0) {
    console.log('-> NO exceptions found in March 2026.');
  } else {
    exceptions.forEach(ex => {
      console.log(`-> Date: ${ex.date.toISOString()} | Name: ${ex.name} | Type: ${ex.type}`);
    });
  }

  console.log('\n--- End of Search ---');
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
