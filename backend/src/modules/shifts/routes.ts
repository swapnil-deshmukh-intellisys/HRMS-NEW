import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";

const router = Router();

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const shiftSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format"),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format"),
  requiredMinutes: z.number().int().min(60, "Required minutes must be at least 60 (1 hour)").default(540),
  gracePeriodMinutes: z.number().int().min(0, "Grace period minutes must be at least 0").default(15),
  hasBreaks: z.boolean().default(true),
  allowMorningTea: z.boolean().default(true),
  allowLunch: z.boolean().default(true),
  allowEveningTea: z.boolean().default(true),
  allowDinner: z.boolean().default(true),
  morningTeaStart: z.string().regex(timeRegex, "Morning tea start must be in HH:MM format").default("10:30"),
  morningTeaEnd: z.string().regex(timeRegex, "Morning tea end must be in HH:MM format").default("11:15"),
  lunchStart: z.string().regex(timeRegex, "Lunch start must be in HH:MM format").default("12:00"),
  lunchEnd: z.string().regex(timeRegex, "Lunch end must be in HH:MM format").default("14:30"),
  eveningTeaStart: z.string().regex(timeRegex, "Evening tea start must be in HH:MM format").default("15:30"),
  eveningTeaEnd: z.string().regex(timeRegex, "Evening tea end must be in HH:MM format").default("17:00"),
  dinnerStart: z.string().regex(timeRegex, "Dinner start must be in HH:MM format").default("20:00"),
  dinnerEnd: z.string().regex(timeRegex, "Dinner end must be in HH:MM format").default("22:00"),
  employeeIds: z.array(z.number()).optional(),
});

const assignSchema = z.object({
  employeeIds: z.array(z.number()),
  shiftId: z.number().nullable(),
});

router.use(authenticate);

// 1. Fetch all shifts (Accessible to all roles to view their shift info or assign in UI)
router.get("/", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (_request, response, next) => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { employees: true },
        },
        employees: {
          select: { id: true },
        },
      },
    });

    return sendSuccess(response, "Shifts fetched successfully", shifts);
  } catch (error) {
    next(error);
  }
});

// 2. Create a new shift [ADMIN ONLY]
router.post("/", requireRoles("ADMIN"), validate(shiftSchema), async (request, response, next) => {
  try {
    const { name, startTime, employeeIds } = request.body;
    const existing = await prisma.shift.findUnique({
      where: { name },
    });

    if (existing) {
      throw new AppError("A shift with this name already exists", 400);
    }

    // Enforce: Lunch only for morning shifts (starts before 12:00 PM) and Dinner only for night shifts
    if (startTime) {
      const hour = parseInt(startTime.split(":")[0], 10);
      if (!isNaN(hour)) {
        if (hour < 12) {
          request.body.allowDinner = false;
        } else {
          request.body.allowLunch = false;
        }
      }
    }

    const shiftData = { ...request.body };
    delete shiftData.employeeIds;

    const shift = await prisma.shift.create({
      data: shiftData,
    });

    // Assign selected employees to the new shift
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      await prisma.employee.updateMany({
        where: { id: { in: employeeIds } },
        data: { shiftId: shift.id },
      });
    }

    return sendSuccess(response, "Shift created successfully", shift, 201);
  } catch (error) {
    next(error);
  }
});

// 3. Update an existing shift [ADMIN ONLY]
router.put("/:id", requireRoles("ADMIN"), validate(shiftSchema.partial()), async (request, response, next) => {
  try {
    const id = parseInt(request.params.id as string, 10);
    if (isNaN(id)) {
      throw new AppError("Invalid shift ID", 400);
    }

    const existing = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("Shift not found", 404);
    }

    if (request.body.name && request.body.name !== existing.name) {
      const nameConflict = await prisma.shift.findUnique({
        where: { name: request.body.name },
      });
      if (nameConflict) {
        throw new AppError("A shift with this name already exists", 400);
      }
    }

    // Enforce: Lunch only for morning shifts (starts before 12:00 PM) and Dinner only for night shifts
    const effectiveStartTime = request.body.startTime || existing.startTime;
    if (effectiveStartTime) {
      const hour = parseInt(effectiveStartTime.split(":")[0], 10);
      if (!isNaN(hour)) {
        if (hour < 12) {
          request.body.allowDinner = false;
        } else {
          request.body.allowLunch = false;
        }
      }
    }

    const { employeeIds } = request.body;
    const shiftData = { ...request.body };
    delete shiftData.employeeIds;

    const shift = await prisma.shift.update({
      where: { id },
      data: shiftData,
    });

    // Synchronize employees assigned to this shift
    if (employeeIds && Array.isArray(employeeIds)) {
      // 1. Unassign all employees currently assigned to this shift
      await prisma.employee.updateMany({
        where: { shiftId: id },
        data: { shiftId: null },
      });

      // 2. Assign the new set of selected employees
      if (employeeIds.length > 0) {
        await prisma.employee.updateMany({
          where: { id: { in: employeeIds } },
          data: { shiftId: id },
        });
      }
    }

    return sendSuccess(response, "Shift updated successfully", shift);
  } catch (error) {
    next(error);
  }
});

// 4. Delete a shift [ADMIN ONLY]
router.delete("/:id", requireRoles("ADMIN"), async (request, response, next) => {
  try {
    const id = parseInt(request.params.id as string, 10);
    if (isNaN(id)) {
      throw new AppError("Invalid shift ID", 400);
    }

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!shift) {
      throw new AppError("Shift not found", 404);
    }

    if (shift._count.employees > 0) {
      throw new AppError("Cannot delete shift because it is currently assigned to active employees", 400);
    }

    // Day Shift cannot be deleted to prevent locking employees out of default configurations
    if (shift.name === "Day Shift") {
      throw new AppError("The default Day Shift cannot be deleted", 400);
    }

    await prisma.shift.delete({
      where: { id },
    });

    return sendSuccess(response, "Shift deleted successfully", null);
  } catch (error) {
    next(error);
  }
});

// 5. Assign employees to a shift [ADMIN ONLY]
router.post("/assign", requireRoles("ADMIN"), validate(assignSchema), async (request, response, next) => {
  try {
    const { employeeIds, shiftId } = request.body;

    if (shiftId !== null) {
      const shift = await prisma.shift.findUnique({
        where: { id: shiftId },
      });
      if (!shift) {
        throw new AppError("Target shift not found", 404);
      }
    }

    const updateResult = await prisma.employee.updateMany({
      where: {
        id: { in: employeeIds },
      },
      data: {
        shiftId,
      },
    });

    return sendSuccess(
      response,
      `Successfully assigned ${updateResult.count} employee(s) to the shift`,
      { count: updateResult.count }
    );
  } catch (error) {
    next(error);
  }
});

export default router;
