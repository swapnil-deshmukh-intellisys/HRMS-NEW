import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer, { type FileFilterCallback, type StorageEngine } from "multer";
import sharp from "sharp";
import { EmployeeCapabilityType, EmploymentStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, parsePagination, sendSuccess } from "../../utils/api.js";
import { hashPassword } from "../../utils/auth.js";
import { getFinancialYearForDate } from "../../utils/financial-year.js";
import { ensureEmployeeLeaveBalances } from "../../utils/leave-balance.js";
import { canTeamLeadAccessEmployee } from "../../utils/team-lead.js";
import { calculateCompensationFromLpa } from "../payroll/service.js";

const router = Router();

const employeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(RoleName),
  employeeCode: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  annualPackageLpa: z.union([z.coerce.number().positive(), z.null()]).optional(),
  isOnProbation: z.boolean().optional(),
  probationEndDate: z.string().datetime().nullable().optional(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  managerId: z.coerce.number().int().positive().nullable().optional(),
  joiningDate: z.string().datetime().optional().nullable(),
  employmentStatus: z.nativeEnum(EmploymentStatus).default(EmploymentStatus.ACTIVE),
  panCardNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  employmentType: z.string().optional().nullable(),
  internshipType: z.string().optional().nullable(),
  stipend: z.union([z.coerce.number(), z.null()]).optional(),
  maritalStatus: z.string().optional().nullable(),
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
        orderBy: [
          { firstName: "asc" },
          { lastName: "asc" },
        ],
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

router.get("/birthdays/upcoming", async (request, response, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { 
        isActive: true,
        dateOfBirth: { not: null }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        jobTitle: true,
        department: { select: { name: true } }
      }
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    const upcomingDays = 30;

    const upcoming = employees.filter(emp => {
      if (!emp.dateOfBirth) return false;
      
      const dob = new Date(emp.dateOfBirth);
      const bMonth = dob.getMonth();
      const bDate = dob.getDate();

      // Create a date object for this year's birthday
      const thisYearBirthday = new Date(now.getFullYear(), bMonth, bDate);
      
      // If birthday already passed this year, check next year's birthday
      const nextBirthday = thisYearBirthday < new Date(now.getFullYear(), currentMonth, currentDate)
        ? new Date(now.getFullYear() + 1, bMonth, bDate)
        : thisYearBirthday;

      const diffTime = nextBirthday.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays >= 0 && diffDays <= upcomingDays;
    }).sort((a, b) => {
      const dobA = new Date(a.dateOfBirth!);
      const dobB = new Date(b.dateOfBirth!);
      
      const getNextBday = (dob: Date) => {
        const t = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        if (t < new Date(now.getFullYear(), currentMonth, currentDate)) t.setFullYear(t.getFullYear() + 1);
        return t.getTime();
      };

      return getNextBday(dobA) - getNextBday(dobB);
    });

    return sendSuccess(response, "Upcoming birthdays fetched successfully", upcoming);
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
        outlookEmails: {
          include: {
            client: true,
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

    if (!roleRecord) {
      throw new AppError("Role not found", 404);
    }

    const emailPrefix = employeeData.email.split("@")[0];
    const fallbackFirstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
    
    const finalFirstName = employeeData.firstName || fallbackFirstName;
    const finalLastName = employeeData.lastName || "User";
    const finalEmployeeCode = employeeData.employeeCode || `EMP-${Date.now()}`;
    const finalJoiningDate = employeeData.joiningDate ? new Date(employeeData.joiningDate) : new Date();

    let finalDepartmentId = employeeData.departmentId;
    if (!finalDepartmentId) {
      const firstDept = await prisma.department.findFirst({ where: { isActive: true } });
      if (!firstDept) {
        throw new AppError("No active department found to assign as default", 404);
      }
      finalDepartmentId = firstDept.id;
    }

    let compensationData = {
      annualPackageLpa: null as number | null,
      grossMonthlySalary: null as number | null,
      basicMonthlySalary: null as number | null,
    };

    if (employeeData.employmentType === "INTERNSHIP") {
      const stipendAmount = employeeData.internshipType === "PAID" && employeeData.stipend ? Number(employeeData.stipend) : 0;
      compensationData = {
        annualPackageLpa: null,
        grossMonthlySalary: stipendAmount,
        basicMonthlySalary: 0,
      };
    } else if (typeof employeeData.annualPackageLpa === "number") {
      compensationData = calculateCompensationFromLpa(employeeData.annualPackageLpa);
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
          employeeCode: finalEmployeeCode,
          firstName: finalFirstName,
          lastName: finalLastName,
          jobTitle: employeeData.jobTitle,
          phone: employeeData.phone,
          gender: employeeData.gender || null,
          ...compensationData,
          isOnProbation: employeeData.isOnProbation ?? false,
          probationEndDate: employeeData.probationEndDate ? new Date(employeeData.probationEndDate) : null,
          departmentId: finalDepartmentId,
          managerId: employeeData.managerId,
          joiningDate: finalJoiningDate,
          employmentStatus: employeeData.employmentStatus,
          panCardNumber: employeeData.panCardNumber,
          dateOfBirth: employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth) : null,
          employmentType: employeeData.employmentType || "FULL_TIME",
          internshipType: employeeData.internshipType,
          stipend: employeeData.stipend !== undefined && employeeData.stipend !== null ? Number(employeeData.stipend) : null,
          maritalStatus: employeeData.maritalStatus || null,
        },
        include: {
          user: { include: { role: true } },
          department: true,
          manager: true,
          capabilities: true,
        },
      });
    });

    await ensureEmployeeLeaveBalances(prisma, createdEmployee.id, getFinancialYearForDate(finalJoiningDate));

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

    const currentEmploymentType = employeeData.employmentType !== undefined ? employeeData.employmentType : existingEmployee.employmentType;
    let compensationData = null;

    if (currentEmploymentType === "INTERNSHIP") {
      const currentStipend = employeeData.stipend !== undefined ? employeeData.stipend : existingEmployee.stipend;
      const currentInternshipType = employeeData.internshipType !== undefined ? employeeData.internshipType : existingEmployee.internshipType;
      const stipendAmount = currentInternshipType === "PAID" && currentStipend ? Number(currentStipend) : 0;
      compensationData = {
        annualPackageLpa: null,
        grossMonthlySalary: stipendAmount,
        basicMonthlySalary: 0,
      };
    } else if (typeof employeeData.annualPackageLpa === "number") {
      compensationData = calculateCompensationFromLpa(employeeData.annualPackageLpa);
    } else if (request.body.annualPackageLpa === null) {
      compensationData = {
        annualPackageLpa: null,
        grossMonthlySalary: null,
        basicMonthlySalary: null,
      };
    }

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
          ...(compensationData ? compensationData : {}),
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

router.put("/:id/outlook-emails", requireRoles("ADMIN", "HR", "MANAGER"), validate(z.object({ emailIds: z.array(z.number().int().positive()) })), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const { emailIds } = request.body;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, isActive: true },
    });

    if (!employee || !employee.isActive) {
      throw new AppError("Employee not found", 404);
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        outlookEmails: {
          set: emailIds.map((id: number) => ({ id })),
        },
      },
      include: {
        outlookEmails: true,
      },
    });

    return sendSuccess(response, "Outlook emails assigned successfully", updatedEmployee.outlookEmails);
  } catch (error) {
    next(error);
  }
});

// ── Employee Points ────────────────────────────────────────────────────────
// PATCH /employees/:id/points — managers can add/set points for employees
router.patch(
  "/:id/points",
  requireRoles("ADMIN", "HR", "MANAGER"),
  validate(z.object({
    points: z.coerce.number().int().min(0),
    mode: z.enum(["add", "subtract", "set"]).default("add"),
    reason: z.string().trim().min(1, "Reason is required"),
  })),
  async (request, response, next) => {
    try {
      const employeeId = Number(request.params.id);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, isActive: true, points: true, managerId: true, userId: true },
      });

      if (!employee || !employee.isActive) {
        throw new AppError("Employee not found", 404);
      }

      // Managers can only award points to their direct reports
      if (request.user?.role === "MANAGER" && employee.managerId !== request.user.employeeId) {
        throw new AppError("You are not authorized to award points to this employee", 403);
      }

      const { points, mode, reason } = request.body;
      let newPoints: number;

      if (mode === "set") {
        newPoints = points;
      } else if (mode === "subtract") {
        newPoints = (employee.points ?? 0) - points;
      } else {
        newPoints = (employee.points ?? 0) + points;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const emp = await tx.employee.update({
          where: { id: employeeId },
          data: { points: newPoints },
          select: { id: true, firstName: true, lastName: true, points: true },
        });

        await tx.pointHistory.create({
          data: {
            employeeId,
            amount: points,
            reason,
            mode,
            givenById: request.user?.employeeId ?? null,
          }
        });

        let notificationMsg = "";
        let notificationTitle = "Points Updated";
        if (mode === "add") {
          notificationMsg = `You received ${points} points. Reason: ${reason}`;
          notificationTitle = "Points Awarded";
        } else if (mode === "subtract") {
          notificationMsg = `${points} points were deducted. Reason: ${reason}`;
          notificationTitle = "Points Deducted";
        } else {
          notificationMsg = `Your points were set to ${points}. Reason: ${reason}`;
        }

        await tx.notification.create({
          data: {
            userId: employee.userId,
            title: notificationTitle,
            message: notificationMsg,
            type: "POINTS_UPDATE",
            link: "/team/leaderboard",
          }
        });

        return emp;
      });

      return sendSuccess(response, "Points updated successfully", updated);
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:id/points-history", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    const history = await prisma.pointHistory.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      include: {
        givenBy: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    return sendSuccess(response, "Points history fetched successfully", history);
  } catch (error) {
    next(error);
  }
});

// ── Employee Documents ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const documentsUploadsDir = path.resolve(__dirname, "../../../uploads/documents");

const documentUpload = multer({
  storage: multer.diskStorage({
    destination: (
      _request: Express.Request,
      _file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void,
    ) => callback(null, documentsUploadsDir),
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9-_]/g, "_");
      callback(null, `${crypto.randomUUID()}-${baseName}${extension}`);
    },
  }) satisfies StorageEngine,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_request: Express.Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    callback(null, true);
  },
});

router.get("/:id/documents", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    // Basic access control
    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
       throw new AppError("You are not authorized to view these documents", 403);
    }
    if (request.user?.role === "MANAGER") {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { managerId: true } });
      if (employee?.managerId !== request.user.employeeId && request.user.employeeId !== employeeId) {
        throw new AppError("You are not authorized to view these documents", 403);
      }
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(response, "Documents fetched successfully", documents);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/documents", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), documentUpload.single("document"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    // Basic access control (Admin/HR can upload for anyone, Employee can upload for themselves)
    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
       throw new AppError("You can only upload documents to your own profile", 403);
    }

    if (!request.file) {
      throw new AppError("No document provided", 400);
    }

    const { name } = request.body;

    const document = await prisma.employeeDocument.create({
      data: {
        employeeId,
        name: name || request.file.originalname,
        originalName: request.file.originalname,
        filePath: `/uploads/documents/${request.file.filename}`,
        mimeType: request.file.mimetype,
        size: request.file.size,
      },
    });

    return sendSuccess(response, "Document uploaded successfully", document, 201);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/documents/:documentId", requireRoles("ADMIN", "HR", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const documentId = Number(request.params.documentId);

    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
       throw new AppError("You can only delete your own documents", 403);
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.employeeId !== employeeId) {
      throw new AppError("Document not found", 404);
    }
    await prisma.employeeDocument.delete({
      where: { id: documentId },
    });

    try {
      const fullPath = path.resolve(__dirname, "../../..", document.filePath.replace(/^\//, ""));
      await fs.unlink(fullPath);
    } catch (err) {
      console.error("Failed to delete file from disk:", err);
    }

    return sendSuccess(response, "Document deleted successfully", null);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/documents/:documentId", requireRoles("ADMIN", "HR", "EMPLOYEE"), validate(z.object({ name: z.string().trim().min(1, "Name is required") })), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const documentId = Number(request.params.documentId);

    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
       throw new AppError("You can only rename your own documents", 403);
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.employeeId !== employeeId) {
      throw new AppError("Document not found", 404);
    }

    const updated = await prisma.employeeDocument.update({
      where: { id: documentId },
      data: { name: request.body.name },
    });

    return sendSuccess(response, "Document renamed successfully", updated);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/documents/:documentId/download", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);
    const documentId = Number(request.params.documentId);

    // Access control
    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
       throw new AppError("You are not authorized to view this document", 403);
    }
    if (request.user?.role === "MANAGER") {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { managerId: true } });
      if (employee?.managerId !== request.user.employeeId && request.user.employeeId !== employeeId) {
        throw new AppError("You are not authorized to view this document", 403);
      }
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.employeeId !== employeeId) {
      throw new AppError("Document not found", 404);
    }

    const fullPath = path.resolve(__dirname, "../../..", document.filePath.replace(/^\//, ""));
    response.download(fullPath, document.originalName);
  } catch (error) {
    next(error);
  }
});

// ── Employee Avatar (Profile Picture) Upload/Delete ──────────────────────────
const avatarsUploadsDir = path.resolve(__dirname, "../../../uploads/avatars");

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_request: Express.Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
      callback(null, true);
    } else {
      callback(new Error("Only image files are allowed!"));
    }
  },
});

router.post("/:id/avatar", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), avatarUpload.single("avatar"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    // Access control: Employee/Manager can only upload their own avatar, Admin/HR can upload for anyone
    if ((request.user?.role === "EMPLOYEE" || request.user?.role === "MANAGER") && request.user.employeeId !== employeeId) {
       throw new AppError("You can only upload a profile picture to your own profile", 403);
    }

    if (!request.file) {
      throw new AppError("No image file provided", 400);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, profilePictureUrl: true }
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    // If employee already had an avatar, let's delete the old file from disk
    if (employee.profilePictureUrl) {
      try {
        const oldFullPath = path.resolve(__dirname, "../../..", employee.profilePictureUrl.replace(/^\//, ""));
        await fs.unlink(oldFullPath);
      } catch (err) {
        console.error("Failed to delete old avatar file from disk:", err);
      }
    }

    // Create optimized file name and paths
    const filename = `avatar-${crypto.randomUUID()}.webp`;
    const outputFilePath = path.join(avatarsUploadsDir, filename);

    // Process image: resize to 256x256 and convert to webp at 80% quality
    await sharp(request.file.buffer)
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(outputFilePath);

    const profilePictureUrl = `/uploads/avatars/${filename}`;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { profilePictureUrl },
    });

    return sendSuccess(response, "Profile picture uploaded and optimized successfully", { profilePictureUrl: updated.profilePictureUrl });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/avatar", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.id);

    // Access control: Employee/Manager can only delete their own profile picture
    if ((request.user?.role === "EMPLOYEE" || request.user?.role === "MANAGER") && request.user.employeeId !== employeeId) {
       throw new AppError("You can only delete your own profile picture", 403);
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, profilePictureUrl: true }
    });

    if (!employee) {
      throw new AppError("Employee not found", 404);
    }

    if (employee.profilePictureUrl) {
      try {
        const fullPath = path.resolve(__dirname, "../../..", employee.profilePictureUrl.replace(/^\//, ""));
        await fs.unlink(fullPath);
      } catch (err) {
        console.error("Failed to delete avatar file from disk:", err);
      }
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { profilePictureUrl: null },
    });

    return sendSuccess(response, "Profile picture deleted successfully", null);
  } catch (error) {
    next(error);
  }
});

export default router;
