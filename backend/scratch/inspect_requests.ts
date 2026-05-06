
import { PrismaClient } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Kolkata';

async function main() {
  const requests = await prisma.attendanceRegularizationRequest.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { employee: true }
  });

  console.log('--- Last 10 Correction Requests ---');
  requests.forEach(req => {
    console.log(`ID: ${req.id} | Employee: ${req.employee.firstName} ${req.employee.lastName}`);
    console.log(`Attendance Date: ${req.attendanceDate.toISOString()}`);
    console.log(`Proposed In (Raw): ${req.proposedCheckInTime?.toISOString() || 'N/A'}`);
    if (req.proposedCheckInTime) {
        console.log(`Proposed In (IST): ${toZonedTime(req.proposedCheckInTime, TIMEZONE).toLocaleString('en-IN', { timeZone: TIMEZONE })}`);
    }
    console.log(`Proposed Out (Raw): ${req.proposedCheckOutTime?.toISOString() || 'N/A'}`);
    if (req.proposedCheckOutTime) {
        console.log(`Proposed Out (IST): ${toZonedTime(req.proposedCheckOutTime, TIMEZONE).toLocaleString('en-IN', { timeZone: TIMEZONE })}`);
    }
    console.log(`Created At: ${req.createdAt.toISOString()}`);
    console.log('-----------------------------------');
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
