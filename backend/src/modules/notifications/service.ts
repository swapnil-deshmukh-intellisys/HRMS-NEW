import webpush from "web-push";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

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

  return notification;
}

export async function getUserNotifications(userId: number, limit = 50) {
  return prisma.notification.findMany({
    where: { userId },
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
