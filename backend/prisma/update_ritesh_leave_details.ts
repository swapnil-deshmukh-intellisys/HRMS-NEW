import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leaveRequestId = 13; // ID of the leave request we created earlier
  const newReason = `I would like to request a half-day leave today due to some personal urgency that requires my attention.

I will ensure that any pending work is managed accordingly and will resume work as scheduled.`;

  // 1 June 2026, 03:00 PM local time (IST = UTC+5:30) -> UTC time is 09:30 AM
  const newCreatedAt = new Date('2026-06-01T09:30:00.000Z');

  console.log(`Updating LeaveRequest ID ${leaveRequestId}...`);

  const updatedRequest = await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: {
      reason: newReason,
      createdAt: newCreatedAt,
    },
  });

  console.log('Successfully updated leave request detail!');
  console.log('Updated Record:', {
    id: updatedRequest.id,
    reason: updatedRequest.reason,
    createdAt: updatedRequest.createdAt,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
