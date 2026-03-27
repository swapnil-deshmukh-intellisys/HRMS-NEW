import { EmployeeCapabilityType, EmploymentStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, parsePagination, sendSuccess } from "../../utils/api.js";
import { hashPassword } from "../../utils/auth.js";
import { ensureEmployeeLeaveBalances } from "../../utils/leave-balance.js";
import { canTeamLeadAccessEmployee } from "../../utils/team-lead.js";
import { calculateCompensationFromLpa } from "../payroll/service.js";

const router = Router();

const employeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(RoleName),
  employeeCode: z.string().min(2),
  firstName: z.string().min(2),
  lastName: z.string().min(1),
  jobTitle: z.string().trim().min(2).optional(),
  phone: z.string().optional(),
  annualPackageLpa: z.union([z.coerce.number().positive(), z.null()]).optional(),
  isOnProbation: z.boolean().optional(),
  probationEndDate: z.string().datetime().nullable().optional(),
  departmentId: z.coerce.number().int().positive(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  joiningDate: z.string().datetime(),
  employmentStatus: z.nativeEnum(EmploymentStatus).default(EmploymentStatus.ACTIVE),
});

const statusSchema = z.object({
  isActive: z.boolean(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
});

const employeeCapabilitySchema = z.object({
  capability: z.nativeEnum(EmployeeCapabilityType),
});

const teamLeadScopeSchema = z.object({
  employeeIds: z.array(z.coerce.number().int().positive()).default([]),
});

const teamLeadConfigSchema = z.object({
  enabled: z.boolean(),
  employeeIds: z.array(z.coerce.number().int().positive()).default([]),
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
          capabilities: true,
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
        capabilities: true,
        scopedTeamMembers: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!employee || !employee.isActive) {
      throw new AppError("Employee not found", 404);
    }

    if (request.user?.role === "MANAGER" && employee.managerId !== request.user.employeeId && employee.id !== request.user.employeeId) {
      throw new AppError("You are not authorized to view this employee", 403);
    }

    if (request.user?.role === "EMPLOYEE" && employee.id !== request.user.employeeId) {
      if (!request.user.employeeId || !(await canTeamLeadAccessEmployee(prisma, request.user.employeeId, employee.id))) {
        throw new AppError("You are not authorized to view this employee", 403);
      }
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
    const compensationData =
      typeof employeeData.annualPackageLpa === "number"
        ? calculateCompensationFromLpa(employeeData.annualPackageLpa)
        : {
            annualPackageLpa: null,
            grossMonthlySalary: null,
            basicMonthlySalary: null,
          };

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
          jobTitle: employeeData.jobTitle,
          phone: employeeData.phone,
          ...compensationData,
          isOnProbation: employeeData.isOnProbation ?? false,
          probationEndDate: employeeData.probationEndDate ? new Date(employeeData.probationEndDate) : null,
          departmentId: employeeData.departmentId,
          managerId: employeeData.managerId,
          joiningDate: new Date(employeeData.joiningDate),
          employmentStatus: employeeData.employmentStatus,
        },
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
          capabilities: true,
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
    const compensationData =
      typeof employeeData.annualPackageLpa === "number" ? calculateCompensationFromLpa(employeeData.annualPackageLpa) : null;

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
      } else if (!existingEmployee.user.isActive && existingEmployee.isActive) {
        await transaction.user.update({
          where: { id: existingEmployee.userId },
          data: {
            isActive: true,
          },
        });
      }

      return transaction.employee.update({
        where: { id },
        data: {
          ...employeeData,
          ...(compensationData
            ? compensationData
            : request.body.annualPackageLpa === null
              ? {
                  annualPackageLpa: null,
                  grossMonthlySalary: null,
                  basicMonthlySalary: null,
                }
              : {}),
          ...(request.body.isOnProbation !== undefined ? { isOnProbation: request.body.isOnProbation } : {}),
          ...(request.body.probationEndDate !== undefined
            ? { probationEndDate: request.body.probationEndDate ? new Date(request.body.probationEndDate) : null }
            : {}),
          ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        },
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
          capabilities: true,
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

router.post("/:id/capabilities", requireRoles("ADMIN", "HR"), validate(employeeCapabilitySchema), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, isActive: true },
    });

    if (!employee || !employee.isActive) {
      throw new AppError("Employee not found", 404);
    }

    const capability = await prisma.employeeCapability.upsert({
      where: {
        employeeId_capability: {
          employeeId,
          capability: request.body.capability,
        },
      },
      update: {},
      create: {
        employeeId,
        capability: request.body.capability,
      },
    });

    return sendSuccess(response, "Employee capability assigned successfully", capability, 201);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/capabilities/:capability", requireRoles("ADMIN", "HR"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const capability = request.params.capability as EmployeeCapabilityType;

    if (!Object.values(EmployeeCapabilityType).includes(capability)) {
      throw new AppError("Invalid employee capability", 400);
    }

    await prisma.$transaction([
      prisma.employeeCapability.deleteMany({
        where: {
          employeeId,
          capability,
        },
      }),
      ...(capability === EmployeeCapabilityType.TEAM_LEAD
        ? [prisma.employeeTeamLeadScope.deleteMany({ where: { teamLeaderId: employeeId } })]
        : []),
    ]);

    return sendSuccess(response, "Employee capability removed successfully", null);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/team-scope", requireRoles("ADMIN", "HR"), validate(teamLeadScopeSchema), async (request, response, next) => {
  try {
    const teamLeaderId = Number(request.params.id);

    const teamLeader = await prisma.employee.findUnique({
      where: { id: teamLeaderId },
      include: {
        capabilities: true,
      },
    });

    if (!teamLeader || !teamLeader.isActive) {
      throw new AppError("Employee not found", 404);
    }

    const hasTeamLeadCapability = teamLeader.capabilities.some(
      (capability) => capability.capability === EmployeeCapabilityType.TEAM_LEAD,
    );

    if (!hasTeamLeadCapability) {
      throw new AppError("Assign TEAM_LEAD capability before defining team scope");
    }

    const uniqueEmployeeIds: number[] = [...new Set(request.body.employeeIds as number[])].filter(
      (employeeId) => employeeId !== teamLeaderId,
    );

    if (uniqueEmployeeIds.length > 0) {
      const scopedEmployees = await prisma.employee.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          isActive: true,
          user: {
            role: {
              name: RoleName.EMPLOYEE,
            },
          },
        },
        select: { id: true },
      });

      if (scopedEmployees.length !== uniqueEmployeeIds.length) {
        throw new AppError("Only active employees can be assigned to a team leader scope");
      }
    }

    await prisma.$transaction([
      prisma.employeeTeamLeadScope.deleteMany({
        where: { teamLeaderId },
      }),
      ...(uniqueEmployeeIds.length
        ? [
            prisma.employeeTeamLeadScope.createMany({
              data: uniqueEmployeeIds.map((employeeId) => ({
                teamLeaderId,
                employeeId,
              })),
            }),
          ]
        : []),
    ]);

    const scope = await prisma.employeeTeamLeadScope.findMany({
      where: { teamLeaderId },
      include: {
        employee: true,
      },
    });

    return sendSuccess(response, "Team lead scope updated successfully", scope);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/team-lead-config", requireRoles("ADMIN", "HR"), validate(teamLeadConfigSchema), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const enabled = request.body.enabled;
    const uniqueEmployeeIds: number[] = [...new Set(request.body.employeeIds as number[])].filter((id) => id !== employeeId);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!employee || !employee.isActive) {
      throw new AppError("Employee not found", 404);
    }

    if (uniqueEmployeeIds.length > 0) {
      const scopedEmployees = await prisma.employee.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          isActive: true,
          user: {
            role: {
              name: RoleName.EMPLOYEE,
            },
          },
        },
        select: { id: true },
      });

      if (scopedEmployees.length !== uniqueEmployeeIds.length) {
        throw new AppError("Only active employees can be assigned to a team leader scope");
      }
    }

    await prisma.$transaction(async (transaction) => {
      if (enabled) {
        await transaction.employeeCapability.upsert({
          where: {
            employeeId_capability: {
              employeeId,
              capability: EmployeeCapabilityType.TEAM_LEAD,
            },
          },
          update: {},
          create: {
            employeeId,
            capability: EmployeeCapabilityType.TEAM_LEAD,
          },
        });

        await transaction.employeeTeamLeadScope.deleteMany({
          where: { teamLeaderId: employeeId },
        });

        if (uniqueEmployeeIds.length > 0) {
          await transaction.employeeTeamLeadScope.createMany({
            data: uniqueEmployeeIds.map((scopedEmployeeId) => ({
              teamLeaderId: employeeId,
              employeeId: scopedEmployeeId,
            })),
          });
        }

        return;
      }

      await transaction.employeeCapability.deleteMany({
        where: {
          employeeId,
          capability: EmployeeCapabilityType.TEAM_LEAD,
        },
      });

      await transaction.employeeTeamLeadScope.deleteMany({
        where: { teamLeaderId: employeeId },
      });
    });

    const updatedEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        capabilities: true,
        scopedTeamMembers: {
          include: {
            employee: {
              include: {
                user: {
                  include: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return sendSuccess(response, "Team lead configuration updated successfully", updatedEmployee);
  } catch (error) {
    next(error);
  }
});

export default router;
