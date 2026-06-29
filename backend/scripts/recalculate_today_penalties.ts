import { PrismaClient, AttendanceStatus } from '@prisma/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
const prisma = new PrismaClient();

const TIMEZONE = 'Asia/Kolkata';

// Helper to parse "HH:MM" into minutes
const parseTimeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (isNaN(hours) || isNaN(minutes)) ? 0 : hours * 60 + minutes;
};

async function main() {
  try {
    const startOfToday = fromZonedTime("2026-06-29 00:00:00", TIMEZONE);
    const endOfToday = fromZonedTime("2026-06-29 23:59:59.999", TIMEZONE);

    // Get all attendances for today
    const attendances = await prisma.attendance.findMany({
      where: {
        attendanceDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      include: {
        employee: {
          include: {
            shift: true
          }
        },
        breakSessions: true
      }
    });

    console.log(`Found ${attendances.length} attendances for today (June 29).`);

    for (const att of attendances) {
      const employee = att.employee;
      if (!employee) continue;
      const shift = employee.shift;

      // 1. Recalculate late check-in
      let checkInPenaltyPoints = 0;
      let checkInPenaltyMinutes = 0;
      let checkInLateMins = 0;
      let isHalfDay = false;

      if (att.checkInTime) {
        const shiftStartTimeStr = shift?.startTime || "09:00";
        const [startHour, startMinute] = shiftStartTimeStr.split(":").map(Number);
        
        const checkInLocal = toZonedTime(att.checkInTime, TIMEZONE);
        const shiftStartLocal = new Date(checkInLocal);
        shiftStartLocal.setHours(startHour, startMinute, 0, 0);
        const shiftStartInUTC = fromZonedTime(shiftStartLocal, TIMEZONE);

        checkInLateMins = att.checkInTime > shiftStartInUTC
          ? Math.floor((att.checkInTime.getTime() - shiftStartInUTC.getTime()) / 60000)
          : 0;

        if (checkInLateMins >= 60) {
          isHalfDay = true;
          const additionalHours = Math.floor((checkInLateMins - 60) / 60);
          checkInPenaltyPoints = 10 + (additionalHours * 10);
          checkInPenaltyPoints = Math.min(checkInPenaltyPoints, 40);
          checkInPenaltyMinutes = 0;
        } else if (checkInLateMins >= 30) {
          checkInPenaltyPoints = 10;
          checkInPenaltyMinutes = 60;
        } else if (checkInLateMins >= 15) {
          checkInPenaltyPoints = 5;
          checkInPenaltyMinutes = 45;
        } else if (checkInLateMins >= 10) {
          checkInPenaltyPoints = 2;
          checkInPenaltyMinutes = 30;
        } else if (checkInLateMins >= 6) {
          checkInPenaltyPoints = 1;
          checkInPenaltyMinutes = 20;
        } else if (checkInLateMins > 0) {
          checkInPenaltyPoints = 1;
          checkInPenaltyMinutes = 0;
        }
      }

      // 2. Recalculate break penalties
      let totalBreakPenaltyPoints = 0;
      let totalBreakPenaltyMinutes = 0;
      
      const shiftStartTimeStr = shift?.startTime || "09:00";
      const shiftStartHour = parseInt(shiftStartTimeStr.split(":")[0], 10);
      const isMorningShift = !isNaN(shiftStartHour) && shiftStartHour < 12;

      const morningTeaStartMins = parseTimeToMinutes(shift?.morningTeaStart || "10:30");
      const morningTeaEndMins = parseTimeToMinutes(shift?.morningTeaEnd || "11:15");
      const lunchStartMins = parseTimeToMinutes(shift?.lunchStart || "12:00");
      const lunchEndMins = parseTimeToMinutes(shift?.lunchEnd || "14:30");
      const eveningTeaStartMins = parseTimeToMinutes(shift?.eveningTeaStart || "15:30");
      const eveningTeaEndMins = parseTimeToMinutes(shift?.eveningTeaEnd || "17:00");
      const dinnerStartMins = parseTimeToMinutes(shift?.dinnerStart || "20:00");
      const dinnerEndMins = parseTimeToMinutes(shift?.dinnerEnd || "22:00");

      for (const bs of att.breakSessions) {
        if (!bs.endTime) continue;

        const durationMinutes = bs.durationMinutes;
        const bStartLocal = toZonedTime(bs.startTime, TIMEZONE);
        const startHour = bStartLocal.getHours();
        const startMin = bStartLocal.getMinutes();
        const totalStartMins = startHour * 60 + startMin;

        let breakLabel = "Break";
        let allowedDuration = 0;
        const hasBreaks = shift ? shift.hasBreaks : true;

        if (hasBreaks) {
          if (totalStartMins >= morningTeaStartMins && totalStartMins <= morningTeaEndMins) {
            breakLabel = "Morning Tea Break";
            allowedDuration = (shift ? shift.allowMorningTea : true) ? 15 : 0;
          } else if (totalStartMins >= lunchStartMins && totalStartMins <= lunchEndMins) {
            breakLabel = "Lunch";
            allowedDuration = (isMorningShift && (shift ? shift.allowLunch : true)) ? 40 : 0;
          } else if (totalStartMins >= eveningTeaStartMins && totalStartMins <= eveningTeaEndMins) {
            breakLabel = "Evening Tea Break";
            allowedDuration = (shift ? shift.allowEveningTea : true) ? 20 : 0;
          } else if (totalStartMins >= dinnerStartMins && totalStartMins <= dinnerEndMins) {
            breakLabel = "Dinner Break";
            allowedDuration = (!isMorningShift && (shift ? shift.allowDinner : true)) ? 40 : 0;
          }
        }

        let breakPenaltyPoints = 0;
        let breakPenaltyMinutes = 0;

        if (allowedDuration > 0 && durationMinutes > allowedDuration) {
          const lateBy = durationMinutes - allowedDuration;
          if (lateBy >= 60) {
            isHalfDay = true;
            const additionalHours = Math.floor((lateBy - 60) / 60);
            breakPenaltyPoints = 10 + (additionalHours * 10);
            breakPenaltyPoints = Math.min(breakPenaltyPoints, 40);
          } else if (lateBy >= 30) {
            breakPenaltyPoints = 10;
            breakPenaltyMinutes = 60;
          } else if (lateBy >= 15) {
            breakPenaltyPoints = 5;
            breakPenaltyMinutes = 45;
          } else if (lateBy >= 10) {
            breakPenaltyPoints = 2;
            breakPenaltyMinutes = 30;
          } else if (lateBy >= 6) {
            breakPenaltyPoints = 1;
            breakPenaltyMinutes = 20;
          } else if (lateBy > 0) {
            breakPenaltyPoints = 1;
            breakPenaltyMinutes = 0;
          }
        }

        totalBreakPenaltyPoints += breakPenaltyPoints;
        totalBreakPenaltyMinutes += breakPenaltyMinutes;

        // If there was a break penalty, update the description in the point history log to match correct break label
        if (breakPenaltyPoints > 0) {
          const ph = await prisma.pointHistory.findFirst({
            where: {
              employeeId: employee.id,
              reason: {
                startsWith: "Late return from"
              },
              createdAt: {
                gte: startOfToday
              }
            }
          });
          if (ph) {
            const newReason = `Late return from ${breakLabel} by ${durationMinutes - allowedDuration} minutes`;
            await prisma.pointHistory.update({
              where: { id: ph.id },
              data: { reason: newReason }
            });
            console.log(`Updated point history log for ${employee.firstName} (${employee.employeeCode}): '${ph.reason}' -> '${newReason}'`);
          }
        }
      }

      const newTotalPenaltyMinutes = checkInPenaltyMinutes + totalBreakPenaltyMinutes;
      const expectedPointsDeduction = checkInPenaltyPoints + totalBreakPenaltyPoints;

      console.log(`Employee: ${employee.firstName} ${employee.lastName} (${employee.employeeCode})`);
      console.log(`- Old Penalty Minutes: ${att.penaltyMinutes} | New: ${newTotalPenaltyMinutes}`);
      
      // Update attendance record in database
      await prisma.attendance.update({
        where: { id: att.id },
        data: {
          penaltyMinutes: newTotalPenaltyMinutes,
          status: isHalfDay ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT
        }
      });
    }

    console.log("Recalculation and database correction complete!");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
