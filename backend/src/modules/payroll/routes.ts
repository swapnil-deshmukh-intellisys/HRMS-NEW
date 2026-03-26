import { PayrollStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { assertPayrollEditable } from "./service.js";

const router = Router();

const payrollSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  salary: z.coerce.number().positive(),
  status: z.nativeEnum(PayrollStatus).default(PayrollStatus.DRAFT),
});

router.use(authenticate);

router.get("/", async (request, response, next) => {
  try {
    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      if (requestedEmployeeId && requestedEmployeeId !== request.user.employeeId) {
        throw new AppError("You are not authorized to view this employee payroll", 403);
      }

      where = { employeeId: request.user.employeeId };
    } else if (request.user?.role === "MANAGER" && request.user.employeeId) {
      where = requestedEmployeeId
        ? requestedEmployeeId === request.user.employeeId
          ? { employeeId: requestedEmployeeId }
          : { employeeId: requestedEmployeeId, employee: { managerId: request.user.employeeId } }
        : { employee: { managerId: request.user.employeeId } };
    } else if (requestedEmployeeId) {
      where = { employeeId: requestedEmployeeId };
    }

    const payrollRecords = await prisma.payrollRecord.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return sendSuccess(response, "Payroll records fetched successfully", payrollRecords);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles("ADMIN", "HR"), validate(payrollSchema), async (request, response, next) => {
  try {
    const payrollRecord = await prisma.payrollRecord.create({
      data: request.body,
      include: {
        employee: true,
      },
    });

    return sendSuccess(response, "Payroll record created successfully", payrollRecord, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireRoles("ADMIN", "HR"), validate(payrollSchema.partial()), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existing = await prisma.payrollRecord.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Payroll record not found", 404);
    }

    assertPayrollEditable(existing.status);

    const updated = await prisma.payrollRecord.update({
      where: { id },
      data: request.body,
      include: {
        employee: true,
      },
    });

    return sendSuccess(response, "Payroll record updated successfully", updated);
  } catch (error) {
    next(error);
  }
});

export default router;
