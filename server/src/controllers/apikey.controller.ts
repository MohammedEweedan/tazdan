import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class APIKeyController {
  // List user's API keys
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const keys = await prisma.aPIKey.findMany({
        where: { userId: req.user!.id },
        select: { id: true, name: true, prefix: true, permissions: true, isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ keys });
    } catch (error) {
      next(error);
    }
  }

  // Create a new API key
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, permissions = ['read'], expiresInDays } = req.body;
      if (!name) throw new AppError('Name is required', 400);

      const existing = await prisma.aPIKey.count({ where: { userId: req.user!.id } });
      if (existing >= 10) throw new AppError('Maximum 10 API keys allowed', 400);

      // Generate key: awk_<random 48 chars>
      const raw = 'awk_' + crypto.randomBytes(36).toString('base64url');
      const prefix = raw.slice(0, 12) + '...';
      const keyHash = crypto.createHash('sha256').update(raw).digest('hex');

      const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;

      const key = await prisma.aPIKey.create({
        data: {
          userId: req.user!.id,
          name,
          keyHash,
          prefix,
          permissions,
          expiresAt,
        },
      });

      // Return the raw key ONCE — user must save it
      res.status(201).json({
        key: { id: key.id, name: key.name, prefix: key.prefix, permissions: key.permissions, expiresAt: key.expiresAt, createdAt: key.createdAt },
        rawKey: raw,
        message: 'Save this key now. It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }

  // Revoke an API key
  static async revoke(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await prisma.aPIKey.updateMany({
        where: { id, userId: req.user!.id },
        data: { isActive: false },
      });
      if (result.count === 0) throw new AppError('Key not found', 404);
      res.json({ message: 'API key revoked' });
    } catch (error) {
      next(error);
    }
  }

  // Delete an API key
  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.aPIKey.deleteMany({ where: { id, userId: req.user!.id } });
      res.json({ message: 'API key deleted' });
    } catch (error) {
      next(error);
    }
  }
}
