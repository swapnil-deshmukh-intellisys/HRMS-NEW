import { CalendarExceptionType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { startOfDay } from "../../utils/dates.js";
import { buildMonthCalendarDays } from "./service.js";

const router = Router();

const calendarQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
});

const workingSaturdaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

router.use(authenticate);

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

router.get("/", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), validate(calendarQuerySchema, "query"), async (request, response, next) => {
  try {
    const month = Number(request.query.month);
    const year = Number(request.query.year);
    const monthStart = startOfDay(new Date(year, month - 1, 1));
    const monthEnd = startOfDay(new Date(year, month, 0));

    const exceptions = await prisma.calendarException.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      orderBy: { date: "asc" },
    });

    const days = buildMonthCalendarDays({ year, month, exceptions });

    return sendSuccess(response, "Calendar fetched successfully", {
      month,
      year,
      days,
      exceptions,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/holidays", requireRoles("ADMIN", "HR"), validate(holidaySchema), async (request, response, next) => {
  try {
    const date = parseDateInput(request.body.date);

    const calendarException = await prisma.calendarException.upsert({
      where: { date },
      update: {
        type: CalendarExceptionType.HOLIDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
      create: {
        date,
        type: CalendarExceptionType.HOLIDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
    });

    return sendSuccess(response, "Holiday saved successfully", calendarException, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/working-saturdays", requireRoles("ADMIN", "HR"), validate(workingSaturdaySchema), async (request, response, next) => {
  try {
    const date = parseDateInput(request.body.date);

    if (date.getDay() !== 6) {
      throw new AppError("Only Saturdays can be marked as working days");
    }

    const calendarException = await prisma.calendarException.upsert({
      where: { date },
      update: {
        type: CalendarExceptionType.WORKING_SATURDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
      create: {
        date,
        type: CalendarExceptionType.WORKING_SATURDAY,
        name: request.body.name,
        description: request.body.description,
        createdById: request.user!.id,
      },
    });

    return sendSuccess(response, "Working Saturday saved successfully", calendarException, 201);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireRoles("ADMIN", "HR"), async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("Invalid calendar exception id");
    }

    await prisma.calendarException.delete({
      where: { id },
    });

    return sendSuccess(response, "Calendar exception removed successfully", { id });
  } catch (error) {
    next(error);
  }
});

export default router;
