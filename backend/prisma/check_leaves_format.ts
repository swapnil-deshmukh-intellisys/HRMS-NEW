import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sampleLeave = await prisma.leaveRequest.findFirst({
    include: { leaveType: true },
  });

  console.log('Sample Leave Request:', sampleLeave);
}

main().finally(() => prisma.$disconnect());
