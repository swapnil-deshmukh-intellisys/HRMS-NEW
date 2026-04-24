import cron from "node-cron";
import { prisma } from "./prisma.js";
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

  console.log("[Scheduler] Background tasks initialized (Lunch & Evening Break Reminders active).");
}
