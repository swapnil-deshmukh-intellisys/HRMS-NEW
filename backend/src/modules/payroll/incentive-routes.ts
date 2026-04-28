import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRoles } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { 
  getIncentiveTypeDisplay, 
  getIncentiveStatusDisplay, 
  calculateMonthlyIncentives,
  calculateTotalPayrollWithIncentives 
} from "./incentive-service.js";

const router = Router();

const incentiveCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  type: z.nativeEnum("PERFORMANCE_BONUS" as any),
  amount: z.coerce.number().positive(),
  reason: z.string().trim().min(1),
  description: z.string().trim().optional(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
});

const incentiveReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().optional(),
});

router.use(authenticate);

router.post(
  "/incentives",
  requireRoles("ADMIN", "HR"),
  validate(incentiveCreateSchema),
  async (request, response, next) => {
    try {
      const incentive = await prisma.incentive.create({
        data: {
          employeeId: request.body.employeeId,
          type: request.body.type,
          amount: request.body.amount,
          reason: request.body.reason,
          description: request.body.description,
          month: request.body.month,
          year: request.body.year,
          status: "APPROVED",
          approvedBy: request.user?.employeeId,
          approvedAt: new Date(),
        },
        include: {
          employee: true,
        },
      });

      return sendSuccess(response, "Incentive created successfully", incentive, 201);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/incentives", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const requestedEmployeeId = request.query.employeeId ? Number(request.query.employeeId) : undefined;
    const requestedMonth = request.query.month ? Number(request.query.month) : undefined;
    const requestedYear = request.query.year ? Number(request.query.year) : undefined;
    
    let where: Record<string, unknown> = {};

    if (request.user?.role === "EMPLOYEE") {
      if (!request.user.employeeId) {
        throw new AppError("Employee context is required", 400);
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

    // Add month/year filter if provided
    if (requestedMonth && requestedYear) {
      const startDate = new Date(requestedYear, requestedMonth - 1, 1);
      const endDate = new Date(requestedYear, requestedMonth, 0);
      
      where = {
        ...where,
        month: requestedMonth,
        year: requestedYear,
      };
    }

    const incentives = await prisma.incentive.findMany({
      where,
      include: {
        employee: true,
        approver: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });

    // Add display properties
    const enrichedIncentives = incentives.map(incentive => ({
      ...incentive,
      typeDisplay: getIncentiveTypeDisplay(incentive.type),
      statusDisplay: getIncentiveStatusDisplay(incentive.status),
    }));

    return sendSuccess(response, "Incentives fetched successfully", enrichedIncentives);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/incentives/:id/review",
  requireRoles("ADMIN", "HR"),
  validate(incentiveReviewSchema),
  async (request, response, next) => {
    try {
      const incentiveId = Number(request.params.id);

      if (!Number.isInteger(incentiveId) || incentiveId <= 0) {
        throw new AppError("Invalid incentive");
      }

      const incentive = await prisma.incentive.findUnique({
        where: { id: incentiveId },
        include: {
          employee: true,
        },
      });

      if (!incentive) {
        throw new AppError("Incentive not found", 404);
      }

      if (incentive.status !== "PENDING") {
        throw new AppError("Only pending incentives can be reviewed");
      }


      if (request.body.status === "REJECTED" && !request.body.rejectionReason) {
        throw new AppError("Rejection reason is required");
      }

      const updatedIncentive = await prisma.incentive.update({
        where: { id: incentiveId },
        data: {
          status: request.body.status,
          approvedBy: request.user?.employeeId,
          approvedAt: new Date(),
          rejectionReason: request.body.status === "REJECTED" ? request.body.rejectionReason : null,
        },
        include: {
          employee: true,
          approver: true,
        },
      });

      const enrichedIncentive = {
        ...updatedIncentive,
        typeDisplay: getIncentiveTypeDisplay(updatedIncentive.type),
        statusDisplay: getIncentiveStatusDisplay(updatedIncentive.status),
      };

      // DB Notification
      import("./../notifications/service.js").then(ns => {
        const isApproved = updatedIncentive.status === "APPROVED";
        ns.createNotification({
          userId: updatedIncentive.employee.userId,
          title: isApproved ? "Incentive Approved! 💰" : "Incentive Rejected ❌",
          message: isApproved 
            ? `Your incentive of ₹${updatedIncentive.amount} for ${updatedIncentive.reason} has been approved.`
            : `Your incentive request for ${updatedIncentive.reason} was rejected.`,
          type: isApproved ? "INCENTIVE_APPROVED" : "INCENTIVE_REJECTED",
          link: "/payroll",
          sendPush: true
        }).catch(err => console.error("Failed to create incentive notification:", err));
      });

      return sendSuccess(response, "Incentive reviewed successfully", enrichedIncentive);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/incentives/summary/:employeeId/:month/:year", requireRoles("ADMIN", "HR", "MANAGER", "EMPLOYEE"), async (request, response, next) => {
  try {
    const employeeId = Number(request.params.employeeId);
    const month = Number(request.params.month);
    const year = Number(request.params.year);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      throw new AppError("Invalid employee ID");
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new AppError("Invalid month");
    }

    if (!Number.isInteger(year) || year < 2000) {
      throw new AppError("Invalid year");
    }

    // Check access permissions
    if (request.user?.role === "EMPLOYEE" && request.user.employeeId !== employeeId) {
      throw new AppError("You are not authorized to view this employee's incentives", 403);
    }

    if (request.user?.role === "MANAGER" && request.user.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { managerId: true },
      });

      if (employee?.managerId !== request.user.employeeId && employeeId !== request.user.employeeId) {
        throw new AppError("You are not authorized to view this employee's incentives", 403);
      }
    }

    const [incentives, payroll] = await Promise.all([
      prisma.incentive.findMany({
        where: {
          employeeId,
          month,
          year,
        },
      }),
      prisma.payrollRecord.findUnique({
        where: {
          employeeId_month_year: {
            employeeId,
            month,
            year,
          },
        },
        select: { salary: true },
      }),
    ]);

    const totalIncentives = calculateMonthlyIncentives(incentives);
    const baseSalary = payroll ? Number(payroll.salary) : 0;
    const payrollWithIncentives = calculateTotalPayrollWithIncentives(baseSalary, incentives.map(i => ({ ...i, amount: Number(i.amount) })));

    return sendSuccess(response, "Incentive summary fetched successfully", {
      employeeId,
      month,
      year,
      totalIncentives,
      baseSalary,
      grossSalary: payrollWithIncentives.grossSalary,
      incentiveCount: incentives.length,
      approvedIncentives: incentives.filter(i => i.status === "APPROVED" || i.status === "PAID").length,
      pendingIncentives: incentives.filter(i => i.status === "PENDING").length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
