import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRolesOrCapability } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { sendSuccess, AppError } from "../../utils/api.js";

const router = Router();

const bulkCreateTasksSchema = z.object({
  employeeId: z.number().nullable().optional(),
  tasks: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional().nullable(),
    })
  ).min(1),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  employeeId: z.number().nullable().optional(),
  isCompleted: z.boolean().optional(),
});

// GET /api/tasks - Employees fetch their assigned and general tasks
router.get("/", authenticate, async (request, response, next) => {
  try {
    const employeeId = request.user!.employeeId;
    if (!employeeId) {
      return sendSuccess(response, "No tasks assigned", []);
    }

    const tasks = await prisma.managerTask.findMany({
      where: {
        OR: [
          { employeeId },
          { employeeId: null }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
          }
        },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        completions: {
          where: { employeeId }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Map general tasks to represent whether the current employee has completed them
    const formattedTasks = tasks.map((task) => {
      if (task.employeeId === null) {
        const isUserCompleted = task.completions.length > 0;
        return {
          ...task,
          isCompleted: isUserCompleted,
          completedAt: isUserCompleted ? task.completions[0].completedAt : null,
          completedById: isUserCompleted ? employeeId : null
        };
      }
      return task;
    });

    return sendSuccess(response, "Tasks fetched successfully", formattedTasks);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/items/:itemId - Toggle a task completion state (compatible endpoint structure)
router.put("/items/:itemId", authenticate, async (request, response, next) => {
  try {
    const itemId = Number(request.params.itemId);
    const { isCompleted } = request.body;
    const employeeId = request.user!.employeeId;

    if (!employeeId) {
      throw new AppError("Employee profile not found", 400);
    }

    const task = await prisma.managerTask.findUnique({
      where: { id: itemId }
    });

    if (!task) {
      throw new AppError("Task not found", 404);
    }

    // Ensure authorized: assignee, or it's a general task (null employeeId), or creator
    if (
      task.employeeId !== null &&
      task.employeeId !== employeeId &&
      task.creatorId !== employeeId
    ) {
      throw new AppError("You are not authorized to update this task", 403);
    }

    let updated;

    if (task.employeeId === null) {
      // General Task completion management
      if (isCompleted) {
        await prisma.generalTaskCompletion.upsert({
          where: {
            taskId_employeeId: {
              taskId: itemId,
              employeeId
            }
          },
          create: {
            taskId: itemId,
            employeeId
          },
          update: {}
        });
      } else {
        await prisma.generalTaskCompletion.deleteMany({
          where: {
            taskId: itemId,
            employeeId
          }
        });
      }

      updated = {
        ...task,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? employeeId : null
      };
    } else {
      // Direct Task completion management
      updated = await prisma.managerTask.update({
        where: { id: itemId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
          completedById: isCompleted ? employeeId : null
        },
        include: {
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
            }
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      });
    }

    // TRIGGER NOTIFICATION TO MANAGER
    if (isCompleted) {
      const taskCreator = await prisma.employee.findUnique({
        where: { id: task.creatorId },
        select: { userId: true }
      });
      const completerEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true }
      });

      if (taskCreator && completerEmployee) {
        import("../notifications/service.js").then(ns => {
          ns.createNotification({
            userId: taskCreator.userId,
            title: task.employeeId === null ? "General Task Completed" : "Direct Task Completed",
            message: `${completerEmployee.firstName} ${completerEmployee.lastName} completed: "${task.title}"`,
            type: "TASK",
            link: "/tasks/manage",
            sendEmail: true, // Optionally notify manager of completion
          }).catch(err => console.error("Error sending task completion notification", err));
        });
      }
    }

    return sendSuccess(response, "Task updated successfully", updated);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/employees - Fetch all active employees (for manager assignments)
router.get("/employees", authenticate, requireRolesOrCapability(["MANAGER", "ADMIN"], ["TEAM_LEAD"]), async (request, response, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { firstName: "asc" },
        { lastName: "asc" }
      ]
    });

    return sendSuccess(response, "Employees fetched successfully", employees);
  } catch (error) {
    next(error);
  }
});

// GET /api/tasks/manager - Fetch tasks created by the manager
router.get("/manager", authenticate, requireRolesOrCapability(["MANAGER", "ADMIN"], ["TEAM_LEAD"]), async (request, response, next) => {
  try {
    const employeeId = request.user!.employeeId;
    if (!employeeId) {
      throw new AppError("Manager profile not found", 400);
    }

    const tasks = await prisma.managerTask.findMany({
      where: { creatorId: employeeId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        },
        completions: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return sendSuccess(response, "Manager tasks fetched successfully", tasks);
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/manager - Bulk create individual standalone tasks
router.post("/manager", authenticate, requireRolesOrCapability(["MANAGER", "ADMIN"], ["TEAM_LEAD"]), validate(bulkCreateTasksSchema), async (request, response, next) => {
  try {
    const creatorId = request.user!.employeeId;
    if (!creatorId) {
      throw new AppError("Manager profile not found", 400);
    }

    const { employeeId, tasks } = request.body;

    const createdTasks = await Promise.all(
      tasks.map((task: any) =>
        prisma.managerTask.create({
          data: {
            title: task.title,
            description: task.description || null,
            creatorId,
            employeeId: employeeId || null,
          }
        })
      )
    );

    // TRIGGER NOTIFICATION TO ASSIGNED EMPLOYEE(S)
    try {
      if (employeeId) {
        // Direct assignment notification
        const assignee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { userId: true }
        });
        if (assignee) {
          import("../notifications/service.js").then(ns => {
            Promise.all(createdTasks.map(t => 
              ns.createNotification({
                userId: assignee.userId,
                title: "New Task Assignment",
                message: `You have been assigned a new task: "${t.title}"`,
                type: "TASK_ASSIGNED",
                link: "/dashboard",
                sendEmail: true,
                extraData: { assignedBy: "Your Manager" }
              })
            )).catch(err => console.error(err));
          });
        }
      } else {
        // General assignment notification to all active employees (excluding the creator manager themselves)
        const activeEmployees = await prisma.employee.findMany({
          where: { isActive: true, id: { not: creatorId } },
          select: { userId: true }
        });

        const notificationsData: any[] = [];
        for (const t of createdTasks) {
          for (const emp of activeEmployees) {
            notificationsData.push({
              userId: emp.userId,
              title: "New Company General Task",
              message: `A new general task is available: "${t.title}"`,
              type: "TASK",
              link: "/dashboard"
            });
          }
        }

        if (notificationsData.length > 0) {
          import("../notifications/service.js").then(ns => {
            Promise.all(notificationsData.map(data => ns.createNotification({
              ...data,
              type: "TASK_ASSIGNED",
              sendEmail: true,
              extraData: { assignedBy: "Management" }
            }))).catch(err => console.error(err));
          });
        }
      }
    } catch (notifError) {
      console.error("Failed to generate task assignments notifications", notifError);
    }

    return sendSuccess(response, "Tasks created successfully", createdTasks);
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/manager/:id - Update an individual task
router.put("/manager/:id", authenticate, requireRolesOrCapability(["MANAGER", "ADMIN"], ["TEAM_LEAD"]), validate(updateTaskSchema), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const creatorId = request.user!.employeeId;
    if (!creatorId) {
      throw new AppError("Manager profile not found", 400);
    }

    const existingTask = await prisma.managerTask.findUnique({
      where: { id }
    });

    if (!existingTask) {
      throw new AppError("Task not found", 404);
    }

    if (existingTask.creatorId !== creatorId) {
      throw new AppError("You are not authorized to edit this task", 403);
    }

    const { title, description, employeeId, isCompleted } = request.body;

    const updatedTask = await prisma.managerTask.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        employeeId: employeeId !== undefined ? (employeeId || null) : existingTask.employeeId,
        isCompleted: isCompleted !== undefined ? isCompleted : existingTask.isCompleted,
        completedAt: isCompleted === true ? new Date() : isCompleted === false ? null : existingTask.completedAt,
        completedById: isCompleted === true ? creatorId : isCompleted === false ? null : existingTask.completedById,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          }
        },
        completions: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              }
            }
          }
        }
      }
    });

    return sendSuccess(response, "Task updated successfully", updatedTask);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/manager/:id - Delete an individual task
router.delete("/manager/:id", authenticate, requireRolesOrCapability(["MANAGER", "ADMIN"], ["TEAM_LEAD"]), async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const creatorId = request.user!.employeeId;
    if (!creatorId) {
      throw new AppError("Manager profile not found", 400);
    }

    const existingTask = await prisma.managerTask.findUnique({
      where: { id }
    });

    if (!existingTask) {
      throw new AppError("Task not found", 404);
    }

    if (existingTask.creatorId !== creatorId) {
      throw new AppError("You are not authorized to delete this task", 403);
    }

    await prisma.managerTask.delete({
      where: { id }
    });

    return sendSuccess(response, "Task deleted successfully", null);
  } catch (error) {
    next(error);
  }
});

export default router;
