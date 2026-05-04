import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";

const router = Router();

router.get("/bootstrap", authenticate, async (request, response, next) => {
  try {
    const userId = request.user!.id;
    const role = request.user!.role;
    const employeeId = request.user!.employeeId;

    // 1. Basic User & Employee Profile (Shallow by default)
    const userPromise = prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        employee: {
          include: {
            department: true,
            manager: true,
            capabilities: true,
            teamMembers: {
              include: {
                department: true,
                capabilities: true,
                outlookEmails: {
                  include: {
                    client: true
                  }
                }
              }
            },
            scopedTeamMembers: {
              include: {
                employee: {
                  include: {
                    department: true,
                    capabilities: true,
                    outlookEmails: {
                      include: {
                        client: true
                      }
                    }
                  }
                }
              }
            }
          },
        },
      },
    });

    // 2. Notifications (Latest 10)
    const notificationsPromise = prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // 3. Announcements (Latest 5)
    const announcementsPromise = prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        createdBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // 4. Clients Registry
    const clientsPromise = prisma.client.findMany({
      orderBy: { name: "asc" }
    });

    // 5. Role-Specific Summary Logic
    const [user, notifications, announcements, clients] = await Promise.all([
      userPromise,
      notificationsPromise,
      announcementsPromise,
      clientsPromise,
    ]);

    let summary: any = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (role === "ADMIN" || role === "HR") {
      const [
        employeeCount,
        deptCount,
        payrollCount,
        pendingLeaves,
        pendingRegs,
        pendingIncentives
      ] = await Promise.all([
        prisma.employee.count({ where: { isActive: true } }),
        prisma.department.count({ where: { isActive: true } }),
        prisma.payrollRecord.count(),
        prisma.leaveRequest.count({
          where: role === "HR"
            ? { status: "PENDING", hrApprovalStatus: "PENDING" }
            : { status: "PENDING" }
        }),
        prisma.attendanceRegularizationRequest.count({ where: { status: "PENDING" } }),
        prisma.incentive.count({ where: { status: "PENDING" } }),
      ]);

      summary = {
        employees: employeeCount,
        departments: deptCount,
        payrollCount,
        pendingLeaves,
        pendingCorrectionRequests: pendingRegs,
        pendingIncentiveApprovals: pendingIncentives,
      };
    } else if (role === "MANAGER" && employeeId) {
      const [teamCount, pendingLeaves, pendingRegs, attendanceToday, teamPresentToday] = await Promise.all([
        prisma.employee.count({ where: { managerId: employeeId, isActive: true } }),
        prisma.leaveRequest.count({
          where: {
            status: "PENDING",
            employee: { managerId: employeeId }
          }
        }),
        prisma.attendanceRegularizationRequest.count({
          where: {
            status: "PENDING",
            employee: { managerId: employeeId },
            NOT: { employeeId }
          }
        }),
        prisma.attendance.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId,
              attendanceDate: today,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            attendanceDate: today,
            status: { in: ["PRESENT", "HALF_DAY"] },
            employee: { managerId: employeeId }
          }
        }),
      ]);

      summary = {
        teamCount,
        pendingLeaves,
        pendingApprovals: pendingRegs,
        attendanceToday,
        teamPresentToday,
      };
    } else if (employeeId) {
      // Regular Employee
      const [attendanceToday, scopedTeamCount, pendingTeamLeaves] = await Promise.all([
        prisma.attendance.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId,
              attendanceDate: today,
            },
          },
        }),
        prisma.employeeTeamLeadScope.count({ where: { teamLeaderId: employeeId } }),
        prisma.leaveRequest.count({
          where: {
            status: "PENDING",
            employee: { teamLeads: { some: { teamLeaderId: employeeId } } }
          }
        }),
      ]);

      summary = {
        attendanceToday,
        scopedTeamCount,
        pendingTeamLeaves,
      };
    }

    // Add currentEmployee to summary for UI consistency
    if (user?.employee) {
      summary.currentEmployee = user.employee;
    }

    return sendSuccess(response, "App bootstrapped successfully", {
      user: {
        id: user?.id,
        email: user?.email,
        role: user?.role.name,
        employee: user?.employee,
      },
      summary,
      notifications,
      announcements,
      clients,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/outlook-emails", authenticate, async (_request, response, next) => {
  try {
    const emails = await prisma.outlookEmail.findMany({
      orderBy: { name: "asc" },
      include: { client: true }
    });
    return sendSuccess(response, "Outlook emails fetched successfully", emails);
  } catch (error) {
    next(error);
  }
});

export default router;
