import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('--- NIKITA KEDAR CLEANUP ---');
  
  // Find employee exactly by name provided
  const employee = await prisma.employee.findFirst({
    where: {
      firstName: { equals: 'Nikita', mode: 'insensitive' },
      lastName: { equals: 'kedar', mode: 'insensitive' }
    }
  });

  if (!employee) {
    console.error('Employee "Nikita kedar" not found.');
    return;
  }

  console.log(`Found Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);

  // Find the duplicate record (the 2:41 PM one)
  // 2:41 PM is 14:41
  const duplicates = await prisma.attendance.findMany({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        gte: new Date('2026-05-04T00:00:00Z'),
        lte: new Date('2026-05-04T23:59:59Z')
      }
    }
  });

  console.log(`Found ${duplicates.length} attendance records for today.`);

  for (const record of duplicates) {
    const checkInTime = record.checkInTime;
    if (checkInTime) {
      const hours = checkInTime.getHours();
      const minutes = checkInTime.getMinutes();
      
      // Match 14:41 (2:41 PM)
      if (hours === 14 && minutes === 41) {
        await prisma.attendance.delete({
          where: { id: record.id }
        });
        console.log(`[DELETED] Duplicate record from 2:41 PM (ID: ${record.id})`);
      } else {
        console.log(`[KEEP] Correct record (Check-in: ${hours}:${minutes})`);
      }
    }
  }

  console.log('--- CLEANUP COMPLETED ---');
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
