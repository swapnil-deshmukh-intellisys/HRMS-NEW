import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { getUserNotifications, markAsRead, markAllAsRead, saveSubscription } from "./service.js";
import { env } from "../../config/env.js";

const router = Router();

router.use(authenticate);

router.get("/vapid-public-key", (req, res) => {
  return sendSuccess(res, "VAPID public key fetched", { publicKey: env.VAPID_PUBLIC_KEY });
});

router.get("/", async (req, res, next) => {
  try {
    const notifications = await getUserNotifications(req.user!.id);
    return sendSuccess(res, "Notifications fetched successfully", notifications);
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", async (req, res, next) => {
  try {
    await markAllAsRead(req.user!.id);
    return sendSuccess(res, "All notifications marked as read", null);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/read", async (req, res, next) => {
  try {
    await markAsRead(Number(req.params.id));
    return sendSuccess(res, "Notification marked as read", null);
  } catch (error) {
    next(error);
  }
});

router.post("/subscribe", async (req, res, next) => {
  try {
    await saveSubscription(req.user!.id, req.body);
    return sendSuccess(res, "Push subscription saved successfully", null);
  } catch (error) {
    next(error);
  }
});

router.post("/test-birthday-email", async (req, res, next) => {
  try {
    const { employeeId, title, message, theme } = req.body;
    const { prisma } = await import("../../config/prisma.js");
    const { sendEmail } = await import("../../services/mailer.js");
    const { getBirthdayWishEmail } = await import("../../utils/emailTemplates.js");

    let recipientName = "Valued Employee";
    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: Number(employeeId) }
      });
      if (employee) {
        recipientName = `${employee.firstName} ${employee.lastName}`;
      }
    }

    const html = getBirthdayWishEmail(recipientName, title, message, theme);
    const targetEmail = "swapnil.deshmukh.intellisys@gmail.com";

    await sendEmail(targetEmail, `[Preview Test] Birthday Wishes for ${recipientName}! 🎂`, html);

    return sendSuccess(res, "Test birthday email dispatched successfully", {
      recipientEmail: targetEmail,
      recipientName
    });
  } catch (error) {
    next(error);
  }
});

export default router;
