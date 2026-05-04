import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const outlookEmails = [
  { name: 'Jessica Lane', email: 'Jessica@theunicorntimes.com' },
  { name: 'Ethan Parker', email: 'ethan@theunicorntimes.com' },
  { name: 'Lily Peterson', email: 'Lily@theunicorntimes.com' },
  { name: 'Jasmin Huber', email: 'Jasmin@theunicorntimes.com' },
  { name: 'Kevin Marshall', email: 'kevin@theunicorntimes.com' },
  { name: 'Peter Gordon', email: 'Peter@theunicorntimes.com' },
  { name: 'Tyler Morgan', email: 'Tyler@theunicorntimes.com' },
  { name: 'Julia Mitchell', email: 'Julia@theunicorntimes.com' },
  { name: 'Lucy garcia', email: 'Lucy@theunicorntimes.com' },
  { name: 'Nora Harris', email: 'Nora@theunicorntimes.com' },
  { name: 'Allison Parker', email: 'Allison@theunicorntimes.com' },
  { name: 'Valeria Brown', email: 'Valeria@theunicorntimes.com' },
  { name: 'Jordan Thomas', email: 'Jordan@theunicorntimes.com' },
  { name: 'Mary Jones', email: 'Mary@theunicorntimes.com' },
  { name: 'Lisa Taylor', email: 'Lisa@theunicorntimes.com' },
  { name: 'Jason Marsh', email: 'Jason@theunicorntimes.com' },
  { name: 'Matt Turner', email: 'Matt@theunicorntimes.com' },
  { name: 'Lena Green', email: 'Lena@theunicorntimes.com' },
  { name: 'Juliana Martin', email: 'Juliana@theunicorntimes.com' },
  { name: 'Olivia Parker', email: 'Olivia@theunicorntimes.com' },
  { name: 'Carmen Gordon', email: 'Carmen@theunicorntimes.com' },
  { name: 'Martina Kelly', email: 'Martina@theunicorntimes.com' },
  { name: 'Isla Scott', email: 'Isla@theunicorntimes.com' },
  { name: 'Chiara Cooper', email: 'Chiara@theunicorntimes.com' },
];

async function main() {
  console.log('Seeding outlook emails...');
  for (const email of outlookEmails) {
    await prisma.outlookEmail.upsert({
      where: { email: email.email },
      update: {},
      create: email,
    });
  }
  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
