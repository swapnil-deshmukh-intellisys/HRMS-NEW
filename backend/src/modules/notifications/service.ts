import webpush from "web-push";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

// Initialize web-push with VAPID keys
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export async function saveSubscription(userId: number, payload: any) {
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

// Helper to send to multiple users (e.g. all admins)
export async function sendToUsers(userIds: number[], title: string, body: string, data?: any) {
  return Promise.all(userIds.map(id => sendPushNotification(id, title, body, data)));
}
