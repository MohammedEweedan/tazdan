import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  // Operational errors — safe to surface to the caller.
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Zod validation — return a structured message but no Zod internals.
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    return res.status(400).json({ error: 'Validation failed', issues });
  }

  // Prisma errors — never leak schema / query details to the client.
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    // Log server-side with a request ID for support tracing.
    const tag = `[err:${Date.now().toString(36)}]`;
    // eslint-disable-next-line no-console
    console.error(tag, req.method, req.path, err.message);
    return res.status(400).json({ error: 'Bad request', ref: tag });
  }

  // Anything else is an unexpected internal error. Log with stack but
  // return a generic message — stack traces in API responses are an
  // information disclosure vulnerability.
  const tag = `[err:${Date.now().toString(36)}]`;
  // eslint-disable-next-line no-console
  console.error(tag, req.method, req.path, err);
  return res.status(500).json({ error: 'Internal server error', ref: tag });
}
