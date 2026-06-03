import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { sendSuccess } from "../../utils/api.js";

const router = Router();

// Zod schemas for validation
const querySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const upsertSalesSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  outlookEmailId: z.coerce.number().int().positive(),
  amount: z.coerce.number().nonnegative(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

// GET /sales?month=X&year=Y
router.get("/", authenticate, validate(querySchema, "query"), async (request, response, next) => {
  try {
    const month = parseInt(request.query.month as string, 10);
    const year = parseInt(request.query.year as string, 10);

    const sales = await prisma.salesRecord.findMany({
      where: {
        month,
        year,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            jobTitle: true,
          },
        },
        outlookEmail: {
          select: {
            id: true,
            name: true,
            email: true,
            client: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return sendSuccess(response, "Sales records fetched successfully", sales);
  } catch (error) {
    next(error);
  }
});

// POST /sales (Create/Update manual sale)
router.post("/", authenticate, requireRoles("ADMIN", "HR", "MANAGER", "TEAM_LEAD"), validate(upsertSalesSchema), async (request, response, next) => {
  try {
    const { employeeId, outlookEmailId, amount, month, year } = request.body;

    const upsertedRecord = await prisma.salesRecord.upsert({
      where: {
        employeeId_outlookEmailId_month_year: {
          employeeId,
          outlookEmailId,
          month,
          year,
        },
      },
      update: {
        amount,
      },
      create: {
        employeeId,
        outlookEmailId,
        amount,
        month,
        year,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            jobTitle: true,
          },
        },
        outlookEmail: {
          select: {
            id: true,
            name: true,
            email: true,
            client: true,
          },
        },
      },
    });

    return sendSuccess(response, "Sales record updated successfully", upsertedRecord);
  } catch (error) {
    next(error);
  }
});

export default router;
