import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/api.js";

export function notFound(_request: Request, response: Response) {
  return response.status(404).json({
    success: false,
    message: "Route not found",
  });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof AppError) {
    console.warn(`[AppError] ${error.statusCode}: ${error.message}`);
    return response.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: any; message: string };
    
    // P2002 is Unique Constraint Violation
    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field';
      const message = `Duplicate entry: ${field} already exists.`;
      console.error(`[Prisma Error P2002] ${message}`);
      return response.status(409).json({
        success: false,
        message,
      });
    }
    
    console.error(`[Prisma Error ${prismaError.code}]`, prismaError);
  } else {
    console.error('[Unhandled Error]', error);
  }

  return response.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : "Internal server error",
  });
}
