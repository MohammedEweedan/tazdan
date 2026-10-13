import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();
export function attachRequestContext(_req: Request, res: Response, next: NextFunction) {
  // Server-generated ids prevent attacker-controlled identifiers entering logs.
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requestContext.run({ requestId }, next);
}
