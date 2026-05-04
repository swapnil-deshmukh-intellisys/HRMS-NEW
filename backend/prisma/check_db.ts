import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDb() {
  console.log('--- DATABASE CHECK ---');
  
  const clients = await prisma.client.findMany();
  console.log('Clients:', clients.map(c => ({ id: c.id, code: c.code, name: c.name })));

  const emails = await prisma.outlookEmail.findMany({
    include: { client: true }
  });
  console.log('Total Emails:', emails.length);
  console.log('Emails with Client:', emails.filter(e => e.clientId).length);
  
  const employees = await prisma.employee.findMany({
    where: { outlookEmails: { some: {} } },
    include: { outlookEmails: { include: { client: true } } }
  });
  
  console.log('Employees with Assigned Emails:', employees.length);
  employees.forEach(emp => {
    console.log(`- ${emp.firstName} ${emp.lastName}:`, emp.outlookEmails.map(e => `${e.email} (${e.client?.code || 'NO CLIENT'})`));
  });

  console.log('--- CHECK END ---');
}

checkDb()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
