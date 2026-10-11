import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

/**
 * Stable, client-facing error categories. Clients can branch on `code`
 * without parsing messages; `error` stays the human-readable text.
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'STEP_UP_REQUIRED'
  | 'AUTHORIZATION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_FUNDS'
  | 'LIMIT_EXCEEDED'
  | 'COMPLIANCE_HOLD'
  | 'FRAUD_HOLD'
  | 'FEATURE_DISABLED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_NOT_ACTIVATED'
  | 'SETTLEMENT_PENDING'
  | 'DUPLICATE_REQUEST'
  | 'TRANSACTION_CONFLICT'
  | 'RATE_LIMITED'
  | 'ACCOUNT_CLOSED'
  | 'CLOSURE_BLOCKED'
  | 'SYSTEM_FAILURE';

function defaultCode(statusCode: number): ErrorCode {
  if (statusCode === 400) return 'VALIDATION';
  if (statusCode === 401) return 'AUTHENTICATION';
  if (statusCode === 403) return 'AUTHORIZATION';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'TRANSACTION_CONFLICT';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 503) return 'FEATURE_DISABLED';
  return 'SYSTEM_FAILURE';
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code: ErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code?: ErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code ?? defaultCode(statusCode);
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** Short, sortable correlation tag shared between the log line and the
 *  client `ref`, so a user-reported "ref: err:xxxx" maps straight to the
 *  full server-side record. */
function makeRef(): string {
  return `err:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Build a structured, READABLE log record for an error. The previous
 *  handler logged `{ err }`, which Winston's formatters flatten into a
 *  near-useless blob — so a real 500 showed up as just "Internal server
 *  error" with no cause. This captures the actual name/message/stack plus
 *  the request context (method, path, status, who) needed to diagnose it,
 *  while never putting any of it in the client response. */
function buildLogMeta(err: Error, req: Request, statusCode: number, ref: string) {
  const anyErr = err as Error & { code?: string; meta?: unknown };
  const userId = (req as Request & { user?: { id?: string } }).user?.id ?? null;
  return {
    ref,
    method: req.method,
    path: req.originalUrl ?? req.path,
    statusCode,
    userId,
    ip: req.ip,
    name: err.name,
    message: err.message,
    code: anyErr.code,          // Prisma error code (e.g. P2002), if any
    meta: anyErr.meta,          // Prisma meta (table/field), if any
    stack: err.stack,
  };
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
    if (err.statusCode >= 500) {
      const ref = makeRef();
      logger.error(`[${ref}] ${req.method} ${req.originalUrl ?? req.path} → ${err.statusCode} ${err.message}`,
        buildLogMeta(err, req, err.statusCode, ref));
      Sentry.captureException(err);
      return res.status(err.statusCode).json({ error: err.message, code: err.code, ref });
    }
    // 4xx operational errors are expected (bad input, auth, etc.) — log at
    // warn so they're visible in logs without polluting error metrics.
    logger.warn(`${req.method} ${req.originalUrl ?? req.path} → ${err.statusCode} ${err.message}`);
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
      ...(err.code === 'STEP_UP_REQUIRED' ? { requiresStepUp: true } : {}),
    });
  }

  // Zod validation — return a structured message but no Zod internals.
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    logger.warn(`${req.method} ${req.originalUrl ?? req.path} → 400 validation`, { issues });
    return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION', issues });
  }

  // Prisma errors — never leak schema / query details to the client, but log
  // the full code/meta/stack server-side so the cause is actually findable.
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    const ref = makeRef();
    logger.error(`[${ref}] ${req.method} ${req.originalUrl ?? req.path} → DB error ${err.name}`,
      buildLogMeta(err, req, 400, ref));
    Sentry.captureException(err);
    return res.status(400).json({ error: 'Bad request', code: 'VALIDATION', ref });
  }

  // Anything else is an unexpected internal error. Log the real name,
  // message, and stack with full request context — return only a generic
  // message + ref (stack traces in API responses are an info-disclosure bug).
  const ref = makeRef();
  logger.error(`[${ref}] ${req.method} ${req.originalUrl ?? req.path} → 500 ${err.name}: ${err.message}`,
    buildLogMeta(err, req, 500, ref));
  Sentry.captureException(err);
  return res.status(500).json({ error: 'Internal server error', code: 'SYSTEM_FAILURE', ref });
}
