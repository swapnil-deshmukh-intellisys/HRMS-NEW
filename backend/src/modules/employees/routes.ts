import { EmploymentStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, parsePagination, sendSuccess } from "../../utils/api.js";
import { hashPassword } from "../../utils/auth.js";
import { ensureEmployeeLeaveBalances } from "../../utils/leave-balance.js";

const router = Router();

const employeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(RoleName),
  employeeCode: z.string().min(2),
  firstName: z.string().min(2),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.coerce.number().int().positive(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  joiningDate: z.string().datetime(),
  employmentStatus: z.nativeEnum(EmploymentStatus).default(EmploymentStatus.ACTIVE),
});

const statusSchema = z.object({
  isActive: z.boolean(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
});

router.use(authenticate);

router.get("/", requireRoles("ADMIN", "HR", "MANAGER"), async (request, response, next) => {
  try {
    const { skip, limit, page } = parsePagination(request.query as Record<string, unknown>);
    const departmentId = request.query.departmentId ? Number(request.query.departmentId) : undefined;

    const where =
      request.user?.role === "MANAGER" && request.user.employeeId
        ? { managerId: request.user.employeeId, isActive: true, ...(departmentId ? { departmentId } : {}) }
        : { isActive: true, ...(departmentId ? { departmentId } : {}) };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.employee.count({ where }),
    ]);

    return sendSuccess(response, "Employees fetched successfully", {
      items: employees,
      pagination: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: { include: { role: true } },
        department: true,
        manager: true,
      },
    });

    if (!employee || !employee.isActive) {
      throw new AppError("Employee not found", 404);
    }

    if (request.user?.role === "MANAGER" && employee.managerId !== request.user.employeeId && employee.id !== request.user.employeeId) {
      throw new AppError("You are not authorized to view this employee", 403);
    }

    if (request.user?.role === "EMPLOYEE" && employee.id !== request.user.employeeId) {
      throw new AppError("You are not authorized to view this employee", 403);
    }

    return sendSuccess(response, "Employee fetched successfully", employee);
  } catch (error) {
    next(error);
  }
});

router.post("/", requireRoles("ADMIN", "HR"), validate(employeeSchema), async (request, response, next) => {
  try {
    const { password, role, ...employeeData } = request.body;
    const roleRecord = await prisma.role.findUnique({ where: { name: role } });

    if (!roleRecord) {
      throw new AppError("Role not found", 404);
    }

    const createdEmployee = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: employeeData.email,
          passwordHash: await hashPassword(password ?? "Password@123"),
          roleId: roleRecord.id,
        },
      });

      return transaction.employee.create({
        data: {
          userId: user.id,
          employeeCode: employeeData.employeeCode,
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          phone: employeeData.phone,
          departmentId: employeeData.departmentId,
          managerId: employeeData.managerId,
          joiningDate: new Date(employeeData.joiningDate),
          employmentStatus: employeeData.employmentStatus,
        },
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
        },
      });
    });

    await ensureEmployeeLeaveBalances(prisma, createdEmployee.id, new Date(employeeData.joiningDate).getFullYear());

    return sendSuccess(response, "Employee created successfully", createdEmployee, 201);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireRoles("ADMIN", "HR"), validate(employeeSchema.partial()), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingEmployee) {
      throw new AppError("Employee not found", 404);
    }

    const { role, password, email, joiningDate, ...employeeData } = request.body;

    const updatedEmployee = await prisma.$transaction(async (transaction) => {
      if (email || role || password) {
        const roleRecord = role ? await transaction.role.findUnique({ where: { name: role } }) : null;

        await transaction.user.update({
          where: { id: existingEmployee.userId },
          data: {
            ...(email ? { email } : {}),
            ...(password ? { passwordHash: await hashPassword(password) } : {}),
            ...(roleRecord ? { roleId: roleRecord.id } : {}),
          },
        });
      }

      return transaction.employee.update({
        where: { id },
        data: {
          ...employeeData,
          ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        },
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
        },
      });
    });

    return sendSuccess(response, "Employee updated successfully", updatedEmployee);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", requireRoles("ADMIN", "HR"), validate(statusSchema), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        isActive: request.body.isActive,
        deletedAt: request.body.isActive ? null : new Date(),
        employmentStatus: request.body.employmentStatus,
      },
      include: {
        user: true,
      },
    });

    await prisma.user.update({
      where: { id: employee.userId },
      data: {
        isActive: request.body.isActive,
      },
    });

    return sendSuccess(response, "Employee status updated successfully", employee);
  } catch (error) {
    next(error);
  }
});

export default router;
