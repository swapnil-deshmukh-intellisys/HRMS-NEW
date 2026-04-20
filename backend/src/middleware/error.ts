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

  console.error(error);

  return response.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
