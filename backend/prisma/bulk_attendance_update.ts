import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

const updates = [
  { name: 'Ritesh Jawale', checkIn: '10:04' },
  { name: 'Akshay More', checkIn: '10:00' },
  { name: 'Gaurav Ramane', checkIn: '10:00' },
  { name: 'Drushti Bothikar', checkIn: '10:00' },
  { name: 'Priyanka Shevkar', checkIn: '10:00' }, // Corrected spelling
  { name: 'Dhanashree Nikhade', checkIn: '10:00' },
  { name: 'Vaishnavi Chopade', checkIn: '10:00' },
  { name: 'Suraj Molke', checkIn: '10:06' }, // Now registered
  { name: 'Harshada Nichit', checkIn: '12:15' },
  { name: 'Nikita kedar', checkIn: '10:15' }, // Case sensitive match might be needed
  { name: 'Rushikesh Bhaganagare', checkIn: '10:06' },
  { name: 'Rahul Jadhav', checkIn: '10:03' },
];

const checkOutTimeStr = '19:00';
const todayStr = '2026-05-04';

async function main() {
  console.log('Starting bulk attendance update (corrected names)...');
  
  for (const item of updates) {
    const parts = item.name.split(' ');
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    
    // Use case-insensitive search to be robust
    const employee = await prisma.employee.findFirst({
      where: {
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
    });

    if (!employee) {
      console.warn(`[SKIP] Employee not found: ${item.name}`);
      continue;
    }

    const checkInDate = new Date(`${todayStr}T${item.checkIn}:00`);
    const checkOutDate = new Date(`${todayStr}T${checkOutTimeStr}:00`);
    const workedMinutes = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000);

    const attendanceDate = new Date(todayStr);
    attendanceDate.setHours(0, 0, 0, 0);

    await prisma.attendance.upsert({
      where: {
        employeeId_attendanceDate: {
          employeeId: employee.id,
          attendanceDate,
        },
      },
      update: {
        checkInTime: checkInDate,
        checkOutTime: checkOutDate,
        workedMinutes,
        status: AttendanceStatus.PRESENT,
      },
      create: {
        employeeId: employee.id,
        attendanceDate,
        checkInTime: checkInDate,
        checkOutTime: checkOutDate,
        workedMinutes,
        status: AttendanceStatus.PRESENT,
      },
    });

    console.log(`[OK] Updated attendance for ${item.name} (${employee.firstName} ${employee.lastName})`);
  }

  console.log('Bulk update completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
