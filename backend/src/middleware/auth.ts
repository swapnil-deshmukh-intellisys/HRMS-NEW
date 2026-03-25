import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/api.js";
import { verifyToken } from "../utils/auth.js";

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authentication required", 401);
    }

    const token = header.replace("Bearer ", "");
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        role: true,
        employee: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError("Invalid or inactive user", 401);
    }

    request.user = {
      id: user.id,
      role: user.role.name,
      employeeId: user.employee?.id,
      email: user.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: string[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(request.user.role)) {
      return next(new AppError("You are not authorized to access this resource", 403));
    }

    next();
  };
}
