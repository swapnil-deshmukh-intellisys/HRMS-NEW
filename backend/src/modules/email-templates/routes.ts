import { Router } from "express";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess, AppError } from "../../utils/api.js";
import { emailTemplateService } from "../../services/emailTemplateService.js";
import { sendEmail } from "../../services/mailer.js";
import { prisma } from "../../config/prisma.js";

const router = Router();

// Secure all endpoints to ADMIN and HR roles exclusively
router.use(authenticate);
router.use(requireRoles("ADMIN", "HR"));

/**
 * GET /api/email-templates
 * Retrieve all global styles and template configurations
 */
router.get("/", (req, res, next) => {
  try {
    const data = emailTemplateService.getTemplates();
    return sendSuccess(res, "Templates and styles fetched successfully", data);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/email-templates/styles
 * Update global layout CSS variables
 */
router.put("/styles", (req, res, next) => {
  try {
    const { BASE_STYLES, CARD_STYLES, HEADER_STYLES, BUTTON_STYLES } = req.body;
    const updated = emailTemplateService.updateGlobalStyles({
      BASE_STYLES,
      CARD_STYLES,
      HEADER_STYLES,
      BUTTON_STYLES,
    });
    return sendSuccess(res, "Global email styles updated successfully", updated);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email-templates/styles/reset
 * Reset global layout CSS variables to factory defaults
 */
router.post("/styles/reset", (req, res, next) => {
  try {
    const defaultStyles = emailTemplateService.resetGlobalStyles();
    return sendSuccess(res, "Global email styles reset to default", defaultStyles);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/email-templates/:id
 * Save customized subject and body content for a specific template
 */
router.put("/:id", (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body;
    
    const updated = emailTemplateService.updateTemplate(id, { subject, body });
    return sendSuccess(res, `Template '${id}' updated successfully`, updated);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email-templates/:id/reset
 * Restore specific template to system factory default
 */
router.post("/:id/reset", (req, res, next) => {
  try {
    const { id } = req.params;
    const restored = emailTemplateService.resetTemplate(id);
    return sendSuccess(res, `Template '${id}' reset to system default`, restored);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email-templates/:id/send-test
 * Dispatches an actual test email using custom-rendered subject and body with mock variables
 */
router.post("/:id/send-test", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { to, variables } = req.body;

    if (!to) {
      throw new AppError("Recipient email 'to' address is required", 400);
    }

    // Render the custom template with provided variables
    const { subject, html } = emailTemplateService.render(id, variables || {});

    // Dispatch the email via SMTP transporter
    await sendEmail(to, `[Test Preview] ${subject}`, html);

    return sendSuccess(res, "Test email dispatched successfully", {
      recipient: to,
      subject: `[Test Preview] ${subject}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email-templates/send-manual
 * Securely dispatches generic notification emails to targeted recipients (All, Department, or Single Employee)
 */
router.post("/send-manual", async (req, res, next) => {
  try {
    const { recipientType, employeeId, departmentId, subject, title, message, link } = req.body;

    if (!subject || !title || !message) {
      throw new AppError("Subject, Title, and Message are required fields", 400);
    }

    // 1. Gather all target employees
    let employees: Array<{ id: number; email: string; firstName: string; lastName: string; userId: number | null }> = [];

    if (recipientType === "single") {
      if (!employeeId) {
        throw new AppError("Employee selection is required for single recipient type", 400);
      }
      const emp = await prisma.employee.findUnique({
        where: { id: Number(employeeId) },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userId: true,
          user: {
            select: {
              email: true
            }
          }
        }
      });
      if (!emp) {
        throw new AppError("Selected employee not found", 404);
      }
      if (emp.user?.email) {
        employees.push({
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          userId: emp.userId,
          email: emp.user.email
        });
      }
    } else if (recipientType === "department") {
      if (!departmentId) {
        throw new AppError("Department selection is required for department recipient type", 400);
      }
      const emps = await prisma.employee.findMany({
        where: { departmentId: Number(departmentId), isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userId: true,
          user: {
            select: {
              email: true
            }
          }
        }
      });
      employees = emps
        .filter(e => e.user?.email)
        .map(e => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          userId: e.userId,
          email: e.user.email
        }));
    } else if (recipientType === "all") {
      const emps = await prisma.employee.findMany({
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          userId: true,
          user: {
            select: {
              email: true
            }
          }
        }
      });
      employees = emps
        .filter(e => e.user?.email)
        .map(e => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          userId: e.userId,
          email: e.user.email
        }));
    } else {
      throw new AppError("Invalid recipient type", 400);
    }

    if (employees.length === 0) {
      return sendSuccess(res, "No eligible employees found with email addresses", { sentCount: 0 });
    }

    // 2. Render the generic email template
    const rendered = emailTemplateService.render("generic_notification", {
      title,
      message,
      link,
    });

    // 3. Dispatch emails & Create DB Notifications in background
    let sentCount = 0;
    const nsPromise = import("../notifications/service.js");

    await Promise.all(employees.map(async (emp) => {
      try {
        // Send email
        await sendEmail(emp.email, subject, rendered.html);
        sentCount++;

        // Add DB Notification (so it shows in the app, but with sendEmail: false to avoid duplicate emails!)
        if (emp.userId) {
          const ns = await nsPromise;
          await ns.createNotification({
            userId: emp.userId,
            title: `✉️ ${subject}`,
            message: title,
            type: "GENERIC",
            link: link || undefined,
            sendEmail: false
          });
        }
      } catch (err) {
        console.error(`Failed to send manual email to employee ${emp.id}:`, err);
      }
    }));

    return sendSuccess(res, `Manual email dispatch complete`, { sentCount });
  } catch (error) {
    next(error);
  }
});

export default router;
