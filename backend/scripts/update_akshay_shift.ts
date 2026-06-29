import { PrismaClient, AttendanceStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Update Akshay's shift to Day Shift (id: 1)
    const emp = await prisma.employee.update({
      where: { id: 7 },
      data: { shiftId: 1 }
    });
    console.log("Updated Akshay's shiftId to 1 (Day Shift).");

    // 2. Find today's attendance record for Akshay (Employee 7)
    const today = new Date();
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: 7,
        attendanceDate: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
        }
      }
    });

    if (attendance) {
      // 9:07 AM is 7 minutes late for 9:00 AM shift.
      // Grace period is 5 minutes, so 7 minutes is past the grace period.
      // According to the logic: lateByMinutes >= 5 triggers penaltyMinutes = 20, penaltyPoints = 1
      const updatedAttendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          isLate: true,
          lateByMinutes: 7,
          penaltyMinutes: 20
        }
      });
      console.log("Updated today's attendance record for Akshay to reflect 7 mins late and 20 mins penalty:");
      console.log(JSON.stringify(updatedAttendance, null, 2));
    } else {
      console.log("No attendance record found for Akshay today to update.");
    }
  } catch (e: any) {
    console.error("Error updating Akshay's shift and attendance:", e.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
