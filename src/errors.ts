import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Request validation failed",
      code: "VALIDATION_ERROR",
      details: err.issues
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const statusCode = err.code === "P2002" ? 409 : 400;
    res.status(statusCode).json({
      error: "Database request failed",
      code: err.code,
      details: err.meta
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: "Database validation failed",
      code: "DB_VALIDATION_ERROR"
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(500).json({
    error: message,
    code: "INTERNAL_SERVER_ERROR"
  });
}
