import { prisma } from "../config/prisma.js";

export async function addToOutbox(params: {
  type: string;
  payload: any;
}) {
  return prisma.notificationOutbox.create({
    data: {
      type: params.type,
      payload: params.payload,
    },
  });
}

/**
 * In a real-world scenario, this would be picked up by a separate worker.
 * For this project, we can call it via a scheduler or a simple interval.
 */
export async function processOutbox() {
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING" },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const item of pending) {
    try {
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "PROCESSING" },
      });

      // Import service dynamically to avoid circular dependencies
      const { createNotification } = await import("../modules/notifications/service.js");
      
      const payload = item.payload as any;
      await createNotification({
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        link: payload.link,
        sendPush: payload.sendPush,
      });

      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "COMPLETED" },
      });
    } catch (error: any) {
      console.error(`Failed to process outbox item ${item.id}:`, error);
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          attempts: item.attempts + 1,
          lastError: error.message,
        },
      });
    }
  }
}
