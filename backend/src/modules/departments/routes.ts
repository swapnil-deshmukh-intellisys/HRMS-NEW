import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";

const router = Router();

const departmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20).transform((value) => value.toUpperCase()),
});

router.use(authenticate);

router.get("/", requireRoles("ADMIN", "HR", "MANAGER"), async (_request, response, next) => {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return sendSuccess(response, "Departments fetched successfully", departments);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles("ADMIN", "HR"), validate(departmentSchema), async (request, response, next) => {
  try {
    const department = await prisma.department.create({
      data: request.body,
    });

    return sendSuccess(response, "Department created successfully", department, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireRoles("ADMIN", "HR"), validate(departmentSchema), async (request, response, next) => {
  try {
    const id = Number(request.params.id);

    if (Number.isNaN(id)) {
      throw new AppError("Invalid department id");
    }

    const department = await prisma.department.update({
      where: { id },
      data: request.body,
    });

    return sendSuccess(response, "Department updated successfully", department);
  } catch (error) {
    next(error);
  }
});

export default router;
