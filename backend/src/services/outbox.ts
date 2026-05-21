import { prisma } from "../config/prisma.js";
import { sendEmail } from "./mailer.js";
import { 
  getGenericNotificationEmail, 
  getLeaveRequestEmail, 
  getTaskAssignedEmail, 
  getAnnouncementEmail,
  getLeaveApprovedEmail,
  getLeaveRejectedEmail
} from "../utils/emailTemplates.js";


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

      if (payload.sendEmail) {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (user && user.email) {
          let htmlContent = "";
          const appUrl = process.env.FRONTEND_URL || "http://localhost:5173";
          const fullLink = payload.link ? `${appUrl}${payload.link}` : undefined;

          if (payload.type === "LEAVE_REQUESTED" && payload.extraData) {
            htmlContent = getLeaveRequestEmail(
              payload.extraData.employeeName, 
              payload.extraData.leaveType, 
              payload.extraData.startDate, 
              payload.extraData.endDate, 
              fullLink || appUrl
            );
          } else if ((payload.type === "LEAVE_APPROVED" || payload.type === "LEAVE_PROOF_REMINDER") && payload.extraData) {
            htmlContent = getLeaveApprovedEmail(
              payload.extraData.employeeName,
              payload.extraData.leaveType,
              payload.extraData.startDate,
              payload.extraData.endDate,
              payload.extraData.approvedBy,
              fullLink || appUrl
            );
          } else if (payload.type === "LEAVE_REJECTED" && payload.extraData) {
            htmlContent = getLeaveRejectedEmail(
              payload.extraData.employeeName,
              payload.extraData.leaveType,
              payload.extraData.startDate,
              payload.extraData.endDate,
              payload.extraData.rejectedBy,
              payload.extraData.reason,
              fullLink || appUrl
            );
          } else if (payload.type === "TASK_ASSIGNED" && payload.extraData) {
            htmlContent = getTaskAssignedEmail(
              payload.title, 
              payload.extraData.assignedBy, 
              fullLink || appUrl
            );
          } else if (payload.type === "ANNOUNCEMENT" && payload.extraData) {
            htmlContent = getAnnouncementEmail(
              payload.title, 
              payload.extraData.priority, 
              payload.message, 
              fullLink || appUrl
            );
          } else {
            htmlContent = getGenericNotificationEmail(payload.title, payload.message, fullLink);
          }
          
          await sendEmail(user.email, payload.title, htmlContent);
        }
      }

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
