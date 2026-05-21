import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRolesOrCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { sendSuccess } from "../../utils/api.js";

const router = Router();

const todoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  reminderTime: z.string().datetime().optional().nullable(),
});

const updateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  isCompleted: z.boolean().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  reminderTime: z.string().datetime().optional().nullable(),
});

// Get all todos for current user
router.get("/", authenticate, async (request, response, next) => {
  try {
    const todos = await prisma.todo.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "desc" },
    });
    return sendSuccess(response, "Todos fetched successfully", todos);
  } catch (error) {
    next(error);
  }
});

// Get all employees' personal todos (Manager/HR only)
router.get("/employees", authenticate, requireRolesOrCapability(["MANAGER", "HR", "ADMIN"], ["TEAM_LEAD"]), async (request, response, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        user: {
          todos: {
            some: {}
          }
        }
      },
      include: {
        department: true,
        user: {
          include: {
            todos: {
              orderBy: { createdAt: "desc" }
            }
          }
        }
      },
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" }
      ]
    });

    const result = employees.map(emp => ({
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      employeeCode: emp.employeeCode,
      department: emp.department?.name,
      todos: emp.user.todos
    }));

    return sendSuccess(response, "Employee todos fetched successfully", result);
  } catch (error) {
    next(error);
  }
});

// Create todo
router.post("/", authenticate, validate(todoSchema), async (request, response, next) => {
  try {
    const todo = await prisma.todo.create({
      data: {
        ...request.body,
        userId: request.user!.id,
      },
    });
    return sendSuccess(response, "Todo created successfully", todo);
  } catch (error) {
    next(error);
  }
});

// Update todo
router.put("/:id", authenticate, validate(updateTodoSchema), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const todo = await prisma.todo.update({
      where: { id, userId: request.user!.id },
      data: request.body,
    });
    return sendSuccess(response, "Todo updated successfully", todo);
  } catch (error) {
    next(error);
  }
});

// Delete todo
router.delete("/:id", authenticate, async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    await prisma.todo.delete({
      where: { id, userId: request.user!.id },
    });
    return sendSuccess(response, "Todo deleted successfully", null);
  } catch (error) {
    next(error);
  }
});

export default router;
