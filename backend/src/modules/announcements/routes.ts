import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";

const router = Router();

router.use(authenticate);

/**
 * @route GET /api/announcements
 * @desc Get all active announcements
 * @access Private
 */
router.get("/", async (req, res, next) => {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    return sendSuccess(res, "Announcements fetched successfully", announcements);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/announcements
 * @desc Create a new announcement
 * @access Restricted (ADMIN, HR, MANAGER)
 */
router.post("/", requireRoles("ADMIN", "HR", "MANAGER"), async (req, res, next) => {
  try {
    const { title, content, priority } = req.body;
    const employeeId = req.user?.employeeId;

    if (!employeeId) {
      throw new Error("Employee profile required to create announcements");
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        priority: priority || "NORMAL",
        createdById: employeeId,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            jobTitle: true
          }
        }
      }
    });

    return sendSuccess(res, "Announcement created successfully", announcement);
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/announcements/:id
 * @desc Deactivate an announcement
 * @access Restricted (ADMIN, HR, MANAGER)
 */
router.delete("/:id", requireRoles("ADMIN", "HR", "MANAGER"), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await prisma.announcement.update({
      where: { id: Number(id) },
      data: { isActive: false }
    });

    return sendSuccess(res, "Announcement deactivated successfully");
  } catch (error) {
    next(error);
  }
});

export default router;
