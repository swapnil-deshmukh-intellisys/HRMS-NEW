import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNikita() {
  console.log('--- NIKITA KEDAR CHECK ---');
  
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Nikita', mode: 'insensitive' } },
        { lastName: { contains: 'Kedar', mode: 'insensitive' } }
      ]
    },
    select: { id: true, firstName: true, lastName: true, employeeCode: true }
  });
  
  console.log('Employees found:', employees);

  for (const emp of employees) {
    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId: emp.id,
        attendanceDate: {
          gte: new Date('2026-05-04T00:00:00Z'),
          lte: new Date('2026-05-04T23:59:59Z')
        }
      }
    });
    console.log(`Attendance for ${emp.firstName} ${emp.lastName} (ID: ${emp.id}):`, 
      attendance.map(a => ({ id: a.id, date: a.attendanceDate, checkIn: a.checkInTime }))
    );
  }

  console.log('--- CHECK END ---');
}

checkNikita()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
