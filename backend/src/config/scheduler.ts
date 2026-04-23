import cron from "node-cron";
import { prisma } from "./prisma.js";
import { sendPushNotification } from "../modules/notifications/service.js";

/**
 * Initializes all automated background tasks (Cron Jobs)
 */
export function initScheduler() {
  // ☕ Scheduled Break Reminder: 5:00 PM IST (Mon-Fri)
  // IST (UTC+5:30) 17:00 => UTC 11:30
  cron.schedule("30 11 * * 1-5", async () => {
    console.log("[Scheduler] Triggering 5:00 PM Break Reminder...");
    try {
      // 1. Get all active users who might need a reminder
      const users = await prisma.user.findMany({
        where: { isActive: true }
      });

      console.log(`[Scheduler] Sending break reminders to ${users.length} active users...`);

      // 2. Broadcast the reminder using the service helper
      for (const user of users) {
        try {
          await sendPushNotification(
            user.id,
            "☕ Personal Break Time!",
            "It's 5:00 PM. Time to step away and recharge. Would you like to start your break?",
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
      console.error("[Scheduler] Break reminder job failed:", error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  console.log("[Scheduler] Background tasks initialized (5 PM Break Reminder active).");
}
