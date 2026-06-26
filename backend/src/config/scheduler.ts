import cron from "node-cron";
import { toZonedTime } from 'date-fns-tz';
import { prisma } from "./prisma.js";
import { startOfDay, endOfDay, getCurrentTimeInIST, TIMEZONE } from "../utils/dates.js";
import { 
  finalizeAttendanceForDate, 
  buildApprovedLeaveWhereForAttendanceDate, 
  finalizeAttendanceStatus
} from "../modules/attendance/service.js";
import { buildPayrollPreview as buildPayrollData } from "../modules/payroll/service.js";
import { getCalendarDayStatus } from "../modules/calendar/service.js";
import { AttendanceStatus } from "@prisma/client";
import { sendPushNotification } from "../modules/notifications/service.js";
import { processOutbox } from "../services/outbox.js";
import { processGoogleSheetSyncQueue } from "../services/googleSheetsWorker.js";

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
 * Sends a notification to all active users about a birthday
 */
async function notifyTodayBirthdays() {
  try {
    const nowInIst = getCurrentTimeInIST();
    const currentMonth = nowInIst.getMonth();
    const currentDate = nowInIst.getDate();

    // Find employees whose birthday is today
    const birthdayEmployees = await prisma.employee.findMany({
      where: { 
        isActive: true,
        dateOfBirth: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true
      }
    });

    const celebrants = birthdayEmployees.filter(emp => {
      const dob = toZonedTime(new Date(emp.dateOfBirth!), TIMEZONE);
      return dob.getDate() === currentDate && dob.getMonth() === currentMonth;
    });

    if (celebrants.length === 0) return;

    // Fetch all active users to notify
    const allUsers = await prisma.user.findMany({
      where: { isActive: true }
    });

    console.log(`[Scheduler] Broadcasting birthdays for: ${celebrants.map(c => c.firstName).join(", ")}`);

    for (const celebrant of celebrants) {
      const title = "🎂 Birthday Celebration!";
      const body = `It's ${celebrant.firstName} ${celebrant.lastName}'s birthday today! Let's wish them a wonderful day! 🎉`;

      for (const user of allUsers) {
        try {
          await sendPushNotification(
            user.id,
            title,
            body,
            { 
              type: "BIRTHDAY_ALARM", 
              url: `/employees/${celebrant.id}` 
            }
          );
        } catch (err) {
          console.error(`[Scheduler] Failed to send birthday alert to user ${user.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("[Scheduler] Birthday notification job failed:", error);
  }
}

/**
 * Checks for approved leaves with approaching medical proof deadlines (due in less than 1 hour)
 * and sends a warning notification if not already sent.
 */
async function processMedicalProof1HourWarnings() {
  try {
    const now = new Date();
    // One hour from now plus a safety buffer of 5 minutes (due in <= 1h5m)
    const warningBuffer = new Date(now.getTime() + 65 * 60 * 1000);

    const approachingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        medicalProofRequired: true,
        medicalProofStatus: "PENDING_UPLOAD",
        medicalProofDueAt: {
          gt: now,
          lte: warningBuffer,
        },
      },
      include: {
        employee: {
          select: {
            userId: true,
            firstName: true,
          }
        }
      }
    });

    for (const leave of approachingLeaves) {
      if (!leave.employee.userId) continue;

      // Check if a warning was already sent to avoid duplicate notifications
      const existingWarning = await prisma.notification.findFirst({
        where: {
          userId: leave.employee.userId,
          type: "LEAVE_PROOF_WARNING_1H",
          link: { contains: `id=${leave.id}` }
        }
      });

      if (!existingWarning) {
        const { createNotification } = await import("../modules/notifications/service.js");
        await createNotification({
          userId: leave.employee.userId,
          title: "Medical Proof Due in 1 Hour! ⚠️",
          message: `Your medical proof for the Sick Leave is due in less than 1 hour. Please upload it now to avoid automatic conversion to Casual or Unpaid leave.`,
          type: "LEAVE_PROOF_WARNING_1H",
          link: `/leaves?id=${leave.id}`,
          sendPush: true,
        });
        console.log(`[Scheduler] Sent 1-hour medical proof warning for leave request ID ${leave.id}`);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Medical proof warning job failed:", error);
  }
}



/**
 * Initializes all automated background tasks (Cron Jobs)
 */
export function initScheduler() {

  // 📊 Google Sheets Sync: Every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    processGoogleSheetSyncQueue().catch(err => {
      console.error("[Scheduler] Google Sheets sync failed:", err);
    });
  });
  // ☕ Scheduled Morning Tea Break: 10:45 AM IST (Mon-Fri)
  cron.schedule("45 10 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 10:45 AM Morning Tea Break Reminder...");
    await broadcastBreakReminder(
      "☕ Morning Tea Break!",
      "It's 10:45 AM. Time for a quick morning tea break."
    );
  }, {
    timezone: "Asia/Kolkata"
  });

  // 🍱 Scheduled Lunch Break: 1:00 PM IST (Mon-Fri)
  cron.schedule("0 13 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 1:00 PM Lunch Break Reminder...");
    await broadcastBreakReminder(
      "🍱 Lunch Time!",
      "It's 1:00 PM. Time to grab some lunch and take a well-deserved break."
    );
  }, {
    timezone: "Asia/Kolkata"
  });

  // ☕ Scheduled Evening Tea Break: 4:10 PM IST (Mon-Fri)
  cron.schedule("10 16 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 4:10 PM Evening Tea Break Reminder...");
    await broadcastBreakReminder(
      "☕ Evening Tea Break!",
      "It's 4:10 PM. Time for a quick evening tea break to recharge."
    );
  }, {
    timezone: "Asia/Kolkata"
  });



  // 🕒 Automated Attendance Finalization: 7:00 AM IST daily
  // Runs at 7:00 AM to finalize the PREVIOUS day's records.
  cron.schedule("0 7 * * *", async () => {
    // Correctly get yesterday's date in IST regardless of server environment
    const nowInIst = getCurrentTimeInIST();
    const yesterday = new Date(nowInIst);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    
    console.log(`[Scheduler] Running 6:00 AM finalization for ${dateStr}...`);
    
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
            // Find all attendance records for this date that are checked in
            const attendancesToUpdate = await prisma.attendance.findMany({
              where: {
                attendanceDate: {
                  gte: startOfDay(attendanceDate),
                  lte: endOfDay(attendanceDate),
                },
                checkInTime: { not: null },
              },
            });

            let updatedCount = 0;
            for (const attendance of attendancesToUpdate) {
              if (!attendance.checkInTime) continue;
              if (attendance.checkOutTime) {
                // Already checked out, finalize status normally based on net worked minutes
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
              } else {
                // Checkout is missing! Let's check telemetry logs
                const lastEvent = await prisma.desktopActivityLog.findFirst({
                  where: {
                    employeeId: attendance.employeeId,
                    timestamp: {
                      gte: startOfDay(attendanceDate),
                      lte: endOfDay(attendanceDate),
                    },
                  },
                  orderBy: { timestamp: "desc" },
                });

                let checkOutTime: Date;
                let isAccidental = false;

                if (lastEvent) {
                  checkOutTime = lastEvent.timestamp;
                  // Accidental if last event was active/idle/wake etc, and not LOCK/SHUTDOWN
                  isAccidental = !["SHUTDOWN", "LOCK"].includes(lastEvent.eventType);
                } else {
                  // No desktop activity, fallback to check-in time plus 1 minute
                  checkOutTime = new Date(attendance.checkInTime.getTime() + 60 * 1000);
                  isAccidental = false; // Neglected
                }

                // Deduct break durations
                const grossMins = Math.floor((checkOutTime.getTime() - attendance.checkInTime.getTime()) / (1000 * 60));
                const breakSessions = await prisma.breakSession.findMany({
                  where: { attendanceId: attendance.id, endTime: { not: null } },
                });
                const totalBreakMinutes = breakSessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0);
                const workedMinutes = Math.max(0, grossMins - totalBreakMinutes);

                // Set status based on crash classification
                const finalStatus = isAccidental ? AttendanceStatus.PRESENT : AttendanceStatus.HALF_DAY;

                await prisma.attendance.update({
                  where: { id: attendance.id },
                  data: {
                    checkOutTime,
                    workedMinutes,
                    status: finalStatus,
                  },
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
    const nowInIst = getCurrentTimeInIST();
    
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
              salary: preview.totalPayableSalary,
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

  // 📮 Notification Outbox Processor: Every 30 minutes (fallback safety net for failed retries)
  cron.schedule("*/30 * * * *", async () => {
    try {
      await processOutbox();
    } catch (err) {
      console.error("[Scheduler] Outbox processing failed:", err);
    }
  });

  // 🎂 Daily Birthday Announcements: 10:15 AM IST daily
  cron.schedule("15 10 * * *", async () => {
    console.log("[Scheduler] Triggering 10:15 AM Birthday Notifications...");
    await notifyTodayBirthdays();
  }, {
    timezone: "Asia/Kolkata"
  });

  let isMedicalProofRunning = false;

  // 🕒 Medical Proof 1-Hour Warning Check: Run every minute (with concurrency lock)
  cron.schedule("* * * * *", async () => {
    if (isMedicalProofRunning) return;
    isMedicalProofRunning = true;
    try {
      await processMedicalProof1HourWarnings();
    } catch (err) {
      console.error("[Scheduler] Medical proof warning check failed:", err);
    } finally {
      isMedicalProofRunning = false;
    }
  });

  // 🧹 Google Sheets Sync Queue Cleanup: Daily at 3:00 AM IST
  cron.schedule("0 3 * * *", async () => {
    console.log("[Scheduler] Running daily cleanup for completed Google Sheets sync tasks...");
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const deleted = await prisma.googleSheetSyncQueue.deleteMany({
        where: {
          status: "COMPLETED",
          updatedAt: { lt: cutoff }
        }
      });
      console.log(`[Scheduler] Deleted ${deleted.count} completed sync queue tasks older than 30 days.`);
    } catch (err) {
      console.error("[Scheduler] Daily sync queue cleanup failed:", err);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  console.log("[Scheduler] Background tasks initialized (Attendance, Payroll, Break Reminders, Outbox, Birthdays, Medical Proof Warnings & Sheets Queue Cleanup active).");
}
