import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initializing Clients...');
  
  const tut = await prisma.client.upsert({
    where: { code: 'TUT' },
    update: {},
    create: {
      name: 'The Unicorn Times',
      code: 'TUT',
    },
  });

  const tec = await prisma.client.upsert({
    where: { code: 'TEC' },
    update: {},
    create: {
      name: 'The Entrepreneurial Chronicles',
      code: 'TEC',
    },
  });

  console.log('Linking existing emails to TUT...');
  await prisma.outlookEmail.updateMany({
    where: { 
      email: { contains: '@theunicorntimes.com' }
    },
    data: {
      clientId: tut.id
    }
  });

  console.log('Workspace initialization completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
