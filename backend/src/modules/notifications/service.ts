import webpush from "web-push";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../services/mailer.js";
import { 
  getGenericNotificationEmail, 
  getLeaveRequestEmail, 
  getTaskAssignedEmail, 
  getAnnouncementEmail 
} from "../../utils/emailTemplates.js";

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export async function saveSubscription(userId: number, body: any) {
  const payload = body.subscription || body;

  // Check if this subscription already exists for this user to avoid duplicates
  const existing = await prisma.pushSubscription.findFirst({
    where: {
      userId,
      payload: {
        equals: payload
      }
    }
  });

  if (existing) return existing;

  return prisma.pushSubscription.create({
    data: {
      userId,
      payload: payload
    }
  });
}

export async function sendPushNotification(userId: number, title: string, body: string, data?: any) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  });

  const payload = JSON.stringify({
    notification: {
      title,
      body,
      icon: "/favicon.svg", // Path to your icon
      badge: "/favicon.svg",
      data: {
        url: "/", // Default redirect
        ...data
      }
    }
  });

  const notifications = subscriptions.map(async (sub) => {
    try {
      // payload is stored as Json in Prisma, cast to PushSubscription for webpush
      await webpush.sendNotification(sub.payload as any, payload);
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription has expired or is no longer valid, delete it
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        console.error("Error sending push notification:", error);
      }
    }
  });

  return Promise.all(notifications);
}

export async function createNotification(params: {
  userId: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  sendPush?: boolean;
  sendEmail?: boolean;
  extraData?: any;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link,
    },
  });

  if (params.sendPush) {
    void sendPushNotification(params.userId, params.title, params.message, { url: params.link });
  }

  if (params.sendEmail) {
    // Fire and forget email sending so it doesn't block the API response
    void (async () => {
      try {
        const user = await prisma.user.findUnique({ where: { id: params.userId } });
        if (user && user.email) {
          let htmlContent = "";
          const appUrl = process.env.FRONTEND_URL || "http://localhost:5173";
          const fullLink = params.link ? `${appUrl}${params.link}` : undefined;

          if (params.type === "LEAVE_REQUEST" && params.extraData) {
            htmlContent = getLeaveRequestEmail(
              params.extraData.employeeName, 
              params.extraData.leaveType, 
              params.extraData.startDate, 
              params.extraData.endDate, 
              fullLink || appUrl
            );
          } else if (params.type === "TASK_ASSIGNED" && params.extraData) {
            htmlContent = getTaskAssignedEmail(
              params.title, 
              params.extraData.assignedBy, 
              fullLink || appUrl
            );
          } else if (params.type === "ANNOUNCEMENT" && params.extraData) {
            htmlContent = getAnnouncementEmail(
              params.title, 
              params.extraData.priority, 
              params.message, 
              fullLink || appUrl
            );
          } else {
            htmlContent = getGenericNotificationEmail(params.title, params.message, fullLink);
          }
          
          await sendEmail(user.email, params.title, htmlContent);
        }
      } catch (err) {
        console.error("Failed to send email for notification asynchronously:", err);
      }
    })();
  }

  return notification;
}

export async function getUserNotifications(userId: number, limit = 100) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return prisma.notification.findMany({
    where: {
      userId,
      OR: [
        { isRead: false },
        { createdAt: { gte: sevenDaysAgo } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markAsRead(notificationId: number) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: number) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// Helper to send to multiple users (e.g. all admins)
export async function sendToUsers(userIds: number[], title: string, body: string, data?: any) {
  return Promise.all(userIds.map(id => sendPushNotification(id, title, body, data)));
}
