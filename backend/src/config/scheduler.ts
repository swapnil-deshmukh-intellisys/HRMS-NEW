import cron from "node-cron";
import { prisma } from "./database.js";
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
      // 1. Get all active users with push subscriptions
      const subscriptions = await prisma.pushSubscription.findMany({
        where: {
          user: {
            isActive: true
          }
        }
      });

      console.log(`[Scheduler] Sending break reminders to ${subscriptions.length} devices...`);

      // 2. Broadcast the reminder
      const payload = JSON.stringify({
        notification: {
          title: "☕ Personal Break Time!",
          body: "It's 5:00 PM. Time to step away and recharge. Would you like to start your break?",
          data: {
            type: "BREAK_REMINDER",
            url: "/?triggerBreak=true"
          }
        }
      });

      for (const sub of subscriptions) {
        try {
          // Format compatible with our notifications service
          const subData = {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh
            }
          };
          await sendPushNotification(subData as any, payload);
        } catch (err) {
          console.error(`[Scheduler] Failed to send to sub ${sub.id}:`, err);
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
