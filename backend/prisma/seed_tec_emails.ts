import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tecEmails = [
  { name: 'Sam Morgan', email: 'sam@theentrepreneurialchronicle.com' },
  { name: 'Clara Finch', email: 'clara@theentrepreneurialchronicle.com' },
  { name: 'Sophia Brown', email: 'sophia@theentrepreneurialchronicle.com' },
  { name: 'Jess Cooper', email: 'jess@theentrepreneurialchronicle.com' },
  { name: 'Diana Parker', email: 'diana@theentrepreneurialchronicle.com' },
  { name: 'Victoria Langley', email: 'victoria@theentrepreneurialchronicle.com' },
  { name: 'Alina Taylor', email: 'alina@theentrepreneurialchronicle.com' },
  { name: 'Amelia Foster', email: 'amelia@theentrepreneurialchronicle.com' },
  { name: 'Grace Carter', email: 'grace@theentrepreneurialchronicle.com' },
  { name: 'Eliana Turner', email: 'eliana@theentrepreneurialchronicle.com' },
  { name: 'Liam Spencer', email: 'liam@theentrepreneurialchronicle.com' },
  { name: 'Alex', email: 'alex@theentrepreneurialchronicle.com' },
  { name: 'Emma Collins', email: 'emma@theentrepreneurialchronicle.com' },
  { name: 'Fiona Barrett', email: 'fiona@theentrepreneurialchronicle.com' },
  { name: 'Daniel Foster', email: 'daniel@theentrepreneurialchronicle.com' },
  { name: 'Lacy William', email: 'lacy@theentrepreneurialchronicle.com' },
  { name: 'Robert Lee', email: 'Robert@theentrepreneurialchronicle.com' },
  { name: 'Mark Gibson', email: 'Mark@theentrepreneurialchronicle.com' },
  { name: 'Charlie Anderson', email: 'Charlie@theentrepreneurialchronicle.com' },
  { name: 'Juan Martin', email: 'Juan@theentrepreneurialchronicle.com' },
  { name: 'Manuel Gael', email: 'Manuel@theentrepreneurialchronicle.com' },
  { name: 'Antonio Lopez', email: 'Antonio@theentrepreneurialchronicle.com' },
  { name: 'John Kelly', email: 'John@theentrepreneurialchronicle.com' },
  { name: 'Lily James', email: 'Lily@theentrepreneurialchronicle.com' },
];

async function main() {
  console.log('Seeding TEC emails...');
  
  const client = await prisma.client.findUnique({
    where: { code: 'TEC' }
  });

  if (!client) {
    console.error('TEC client not found. Please run init_workspaces.ts first.');
    return;
  }

  for (const item of tecEmails) {
    await prisma.outlookEmail.upsert({
      where: { email: item.email },
      update: { clientId: client.id },
      create: {
        ...item,
        clientId: client.id
      },
    });
  }
  
  console.log('TEC Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
