/**
 * Idempotency keys for money requests.
 *
 * A client sends the same key (body `idempotencyKey` or an `Idempotency-Key`
 * header) when it retries a request whose reply was lost. The row the first
 * request created carries the key under a unique index, written in the same
 * transaction as the money movement, so a retry either finds that row and
 * gets it back, or fails against the first request (unique key, serialization
 * conflict, or a reservation the first one already made) and finds it then.
 * A key reused for a different request is refused, never replayed.
 */
import { AppError } from '../middleware/errorHandler';

export function idempotencyKeyFrom(req: { body?: any; headers?: Record<string, any> }): string | null {
  const raw = req.body?.idempotencyKey ?? req.headers?.['idempotency-key'];
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw new AppError('Idempotency-Key must be a string', 400, 'VALIDATION');
  const key = raw.trim();
  if (!key) return null;
  if (key.length > 120) throw new AppError('Idempotency-Key is too long', 400, 'VALIDATION');
  return key;
}

export function keyReused(what: string): AppError {
  return new AppError(`This Idempotency-Key was already used for a different ${what}`, 409, 'DUPLICATE_REQUEST');
}
