import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Searching for "Misplaced" Holiday (Timezone Shift Check) ---');
  
  // Search for ANY exception around May 1st
  const exceptions = await prisma.calendarException.findMany({
    where: {
      date: {
        gte: new Date('2026-04-25T00:00:00Z'),
        lte: new Date('2026-05-05T23:59:59Z')
      }
    }
  });

  console.log('\nExceptions found within 5 days of May 1st:');
  if (exceptions.length === 0) {
    console.log('-> NONE found anywhere near May 1st.');
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
