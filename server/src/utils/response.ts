/**
 * Standard API response envelope.
 *
 *   { success: true,  data: ..., meta?: ... }
 *   { success: false, error: { code, message, details? } }
 *
 * Existing controllers use ad-hoc shapes — those are NOT changed here. New
 * controllers (on-ramp, off-ramp, markets, handles) should use these helpers
 * from day one. We can migrate older endpoints incrementally.
 */

import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, statusCode = 200) {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function fail(
  res: Response,
  message: string,
  code = 'BAD_REQUEST',
  statusCode = 400,
  details?: unknown,
) {
  const body: ApiError = { success: false, error: { code, message, details } };
  return res.status(statusCode).json(body);
}

/** Pagination meta builder. */
export function paginationMeta(total: number, page: number, limit: number) {
  return {
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
