/**
 * API-key authentication for the public business API (/api/v1).
 *
 * Accepts `Authorization: Bearer tzk_…` or `X-Api-Key: tzk_…`. A READ_ONLY
 * key may call any GET endpoint whose scope it would otherwise need; writes
 * need the specific scope. The business must not be suspended, and the
 * owning user must be active.
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../types';
import { AppError } from './errorHandler';
import { prisma } from '../utils/prisma';
import { authenticateKey, recordUsage, type ApiScope } from '../services/business/apiKeys.service';

export function requireApiKey(scope: ApiScope) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : undefined;
      const raw = header ?? (typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : undefined);
      if (!raw) throw new AppError('API key required', 401);
      const key = await authenticateKey(raw);
      if (!key) throw new AppError('Invalid, revoked or expired API key', 401);
      const read = req.method === 'GET';
      const allowed = key.permissions.includes(scope) || (read && key.permissions.includes('READ_ONLY'));
      if (!allowed) throw new AppError(`This key lacks the ${scope} permission`, 403);
      const owner = await prisma.user.findUnique({ where: { id: key.business!.userId }, select: { status: true } });
      if (owner?.status !== 'ACTIVE') throw new AppError('This business account is not active', 403);
      // The key acts with its creator's current role: it stops working when the
      // creator leaves the team, and loses payout rights if they are downgraded.
      const role = key.userId === key.business!.userId ? 'OWNER'
        : (await prisma.businessTeamMember.findFirst({ where: { businessId: key.businessId!, userId: key.userId, status: 'ACTIVE' }, select: { role: true } }))?.role;
      if (!role) throw new AppError('The person who created this key is no longer on the team', 401);
      if (scope === 'PAYOUTS' && !read && !['OWNER', 'ADMIN'].includes(role)) throw new AppError('This key’s creator can no longer send payouts', 403);
      req.apiKey = { id: key.id, businessId: key.businessId, userId: key.userId, permissions: key.permissions, role };
      recordUsage(key.id);
      next();
    } catch (err) { next(err); }
  };
}
