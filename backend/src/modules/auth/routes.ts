import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { AppError, sendSuccess } from "../../utils/api.js";
import { loginUser } from "./service.js";

const router = Router();

const DEEP_USER_INCLUDE = {
  role: true,
  employee: {
    include: {
      department: true,
      manager: true,
      capabilities: true,
      outlookEmails: {
        include: {
          client: true,
        },
      },
      teamMembers: {
        include: {
          department: true,
          capabilities: true,
          outlookEmails: {
            include: {
              client: true,
            },
          },
        },
      },
      scopedTeamMembers: {
        include: {
          employee: {
            include: {
              department: true,
              capabilities: true,
              outlookEmails: {
                include: {
                  client: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/login", validate(loginSchema), async (request, response, next) => {
  try {
    const { email, password } = request.body;
    const normalizedEmail = email.toLowerCase();
    const loginResult = await loginUser(
      { email: normalizedEmail, password },
      {
        findUserByEmail: (userEmail) =>
          prisma.user.findUnique({
            where: { email: userEmail },
            include: DEEP_USER_INCLUDE,
          }),
      },
    );

    return sendSuccess(response, "Login successful", {
      token: loginResult.token,
      user: loginResult.user,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Can't reach database server") || error.message.includes("invocation"))) {
      return next(new AppError("Database connection failed. Please check your internet connection and try again.", 503));
    }
    next(error);
  }
});

router.post("/logout", authenticate, async (_request, response) => sendSuccess(response, "Logout successful", null));

router.get("/me", authenticate, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: DEEP_USER_INCLUDE,
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return sendSuccess(response, "Authenticated user profile", {
      id: user.id,
      email: user.email,
      role: user.role.name,
      employee: user.employee,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
