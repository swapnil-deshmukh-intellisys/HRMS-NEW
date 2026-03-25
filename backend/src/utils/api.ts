import type { Response } from "express";

export function sendSuccess(response: Response, message: string, data: unknown, status = 200) {
  return response.status(status).json({
    success: true,
    message,
    data,
  });
}

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 10)));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
