import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employeeCode = 'IITS0012';
  
  console.log(`Searching for employee with code: ${employeeCode}...`);
  const employee = await prisma.employee.findUnique({
    where: { employeeCode },
  });

  if (!employee) {
    console.error(`Employee with code ${employeeCode} not found!`);
    process.exit(1);
  }

  console.log(`Found Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);

  // Find attendance records where checkInTime is set but checkOutTime is null
  const missingCheckouts = await prisma.attendance.findMany({
    where: {
      employeeId: employee.id,
      checkInTime: { not: null },
      checkOutTime: null,
    },
    orderBy: {
      attendanceDate: 'asc',
    },
  });

  console.log(`Found ${missingCheckouts.length} attendance records with missing checkouts.`);

  if (missingCheckouts.length === 0) {
    console.log('No records need updating.');
    return;
  }

  for (const record of missingCheckouts) {
    if (!record.checkInTime) continue;

    // Generate random minutes between 8 hours (480 mins) and 9 hours (540 mins)
    const randomMinutes = Math.floor(Math.random() * 61) + 480;
    const checkInTime = new Date(record.checkInTime);
    const checkOutTime = new Date(checkInTime.getTime() + randomMinutes * 60 * 1000);

    const formattedDate = record.attendanceDate.toISOString().split('T')[0];
    const formattedCheckIn = checkInTime.toLocaleTimeString('en-US', { hour12: false });
    const formattedCheckOut = checkOutTime.toLocaleTimeString('en-US', { hour12: false });
    const hours = (randomMinutes / 60).toFixed(2);

    console.log(`Updating date ${formattedDate}:`);
    console.log(`  - Check-In:  ${formattedCheckIn}`);
    console.log(`  - Check-Out: ${formattedCheckOut} (Duration: ${hours} hours / ${randomMinutes} mins)`);

    await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOutTime,
        workedMinutes: randomMinutes,
        status: AttendanceStatus.PRESENT,
      },
    });
  }

  console.log('Successfully updated all missing checkouts.');
}

main()
  .catch((e) => {
    console.error('Error executing script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
