import cron from "node-cron";
import { prisma } from "./prisma.js";
import { startOfDay, endOfDay } from "../utils/dates.js";
import { 
  finalizeAttendanceForDate, 
  buildApprovedLeaveWhereForAttendanceDate, 
  finalizeAttendanceStatus,
  buildPayrollPreview
} from "../modules/attendance/service.js";
import { buildPayrollPreview as buildPayrollData } from "../modules/payroll/service.js";
import { getCalendarDayStatus } from "../modules/calendar/service.js";
import { AttendanceStatus } from "@prisma/client";
import { sendPushNotification } from "../modules/notifications/service.js";

/**
 * Initializes all automated background tasks (Cron Jobs)
 */
async function broadcastBreakReminder(title: string, body: string) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true }
    });

    console.log(`[Scheduler] Sending "${title}" to ${users.length} active users...`);

    for (const user of users) {
      try {
        await sendPushNotification(
          user.id,
          title,
          body,
          { 
            type: "BREAK_REMINDER", 
            url: "/?triggerBreak=true" 
          }
        );
      } catch (err) {
        console.error(`[Scheduler] Failed to send to user ${user.id}:`, err);
      }
    }
  } catch (error) {
    console.error(`[Scheduler] ${title} job failed:`, error);
  }
}

/**
 * Initializes all automated background tasks (Cron Jobs)
 */
export function initScheduler() {
  // 🍱 Scheduled Lunch Break: 1:30 PM IST (Mon-Fri)
  cron.schedule("30 13 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 1:30 PM Lunch Break Reminder...");
    await broadcastBreakReminder(
      "🍱 Lunch Time!",
      "It's 1:30 PM. Time to grab some lunch and take a well-deserved break."
    );
  }, {
    timezone: "Asia/Kolkata"
  });

  // ☕ Scheduled Break Reminder: 5:00 PM IST (Mon-Fri)
  cron.schedule("0 17 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 5:00 PM Break Reminder...");
    await broadcastBreakReminder(
      "☕ Personal Break Time!",
      "It's 5:00 PM. Time to step away and recharge. Would you like to start your break?"
    );
  }, {
    timezone: "Asia/Kolkata"
  });

  // 🕒 Automated Attendance Finalization: 12:00 AM IST daily
  // Runs at midnight to finalize the PREVIOUS day's records.
  cron.schedule("0 0 * * *", async () => {
    // Correctly get yesterday's date in IST regardless of server environment
    const nowInIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const yesterday = new Date(nowInIst);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    console.log(`[Scheduler] Running midnight finalization for ${dateStr}...`);
    
    try {
      const result = await finalizeAttendanceForDate(
        { date: dateStr },
        {
          findActiveEmployees: async () =>
            prisma.employee.findMany({
              where: { isActive: true },
              select: {
                id: true,
                joiningDate: true,
              },
            }),
          findEmployeeIdsWithAttendance: async (attendanceDate) => {
            const records = await prisma.attendance.findMany({
              where: {
                attendanceDate: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
              },
              select: { employeeId: true },
              distinct: ["employeeId"],
            });

            return records.map((record) => record.employeeId);
          },
          findEmployeeIdsWithApprovedLeave: async (attendanceDate) => {
            const records = await prisma.leaveRequest.findMany({
              where: buildApprovedLeaveWhereForAttendanceDate(attendanceDate),
              select: { employeeId: true },
              distinct: ["employeeId"],
            });

            return records.map((record) => record.employeeId);
          },
          createAbsentAttendances: async (entries) => {
            const result = await prisma.attendance.createMany({
              data: entries,
              skipDuplicates: true,
            });

            return result.count;
          },
          updateAttendanceWithMissingCheckout: async (attendanceDate, _cutoffHour) => {
            const attendancesToUpdate = await prisma.attendance.findMany({
              where: {
                attendanceDate: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
                checkInTime: { not: null },
                status: AttendanceStatus.PRESENT,
              },
            });

            let updatedCount = 0;
            for (const attendance of attendancesToUpdate) {
              const finalStatus = finalizeAttendanceStatus(
                attendance.checkInTime,
                attendance.checkOutTime
              );

              if (finalStatus !== attendance.status) {
                await prisma.attendance.update({
                  where: { id: attendance.id },
                  data: { status: finalStatus },
                });
                updatedCount++;
              }
            }

            return updatedCount;
          },
          isWorkingDay: async (attendanceDate) => {
            const exceptions = await prisma.calendarException.findMany({
              where: {
                date: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
              },
            });

            return getCalendarDayStatus(attendanceDate, exceptions).isWorkingDay;
          },
        },
      );

      console.log(`[Scheduler] Finalization complete for ${dateStr}:`, result);
    } catch (err) {
      console.error(`[Scheduler] Attendance finalization failed for ${dateStr}:`, err);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  // 💰 Automated Monthly Payroll Generation: 12:00 AM on the 1st of every month
  // Generates draft payroll records for the previous month.
  cron.schedule("0 0 1 * *", async () => {
    const nowInIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    
    // Get the previous month and year
    let targetMonth = nowInIst.getMonth(); // getMonth() is 0-indexed, so this IS the previous month (0=Jan, 11=Dec)
    let targetYear = nowInIst.getFullYear();
    
    if (targetMonth === 0) { // If currently January, previous month is December of previous year
      targetMonth = 12;
      targetYear -= 1;
    } else {
      // No adjustment needed for targetMonth if we use 1-indexed for the DB
      // But wait: if it's May (4), targetMonth is 4 (April). Perfect.
    }
    
    // Convert targetMonth to 1-indexed for the business logic
    const monthNumber = targetMonth === 12 ? 12 : targetMonth; 

    console.log(`[Scheduler] Generating monthly payroll drafts for ${monthNumber}/${targetYear}...`);
    
    try {
      const activeEmployees = await prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true }
      });

      let createdCount = 0;
      for (const employee of activeEmployees) {
        try {
          // Check if record already exists to avoid duplicates
          const existing = await prisma.payrollRecord.findUnique({
            where: {
              employeeId_month_year: {
                employeeId: employee.id,
                month: monthNumber,
                year: targetYear
              }
            }
          });

          if (existing) continue;

          const preview = await buildPayrollData({
            employeeId: employee.id,
            month: monthNumber,
            year: targetYear,
            prisma
          });

          await prisma.payrollRecord.create({
            data: {
              employeeId: employee.id,
              month: monthNumber,
              year: targetYear,
              salary: preview.totalPayableAmount,
              status: "DRAFT"
            }
          });
          createdCount++;
        } catch (err) {
          console.error(`[Scheduler] Failed to generate payroll for employee ${employee.id}:`, err);
        }
      }

      console.log(`[Scheduler] Payroll generation complete. Created ${createdCount} draft records.`);
    } catch (err) {
      console.error("[Scheduler] Monthly payroll generation failed:", err);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  console.log("[Scheduler] Background tasks initialized (Attendance, Payroll, & Break Reminders active).");
}
