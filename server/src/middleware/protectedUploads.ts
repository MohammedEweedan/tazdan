/**
 * Auth-gated download route for files in /uploads. The bucket holds KYC
 * documents (passports, IDs, proof of address) — these must NEVER be
 * publicly fetchable, which the previous `express.static('/uploads')`
 * mount allowed for anyone who guessed a filename.
 *
 * Rules:
 *  - Caller must be authenticated.
 *  - Caller must own the document (KYCDocument.userId === caller) OR be ADMIN.
 *  - Filename must be a simple basename (no traversal, no slashes).
 */
import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from './auth';
import { AppError } from './errorHandler';
import { AuthRequest } from '../types';
import { prisma } from '../utils/prisma';

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
);

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export const protectedUploadsRouter = Router();

protectedUploadsRouter.get(
  '/:filename',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const name = req.params.filename;
      if (!name || !SAFE_NAME.test(name) || name.startsWith('.')) {
        throw new AppError('Invalid filename', 400);
      }

      const absolute = path.resolve(UPLOAD_DIR, name);
      // Ensure resolved path is within UPLOAD_DIR (belt + braces).
      if (!absolute.startsWith(UPLOAD_DIR + path.sep)) {
        throw new AppError('Invalid path', 400);
      }
      if (!fs.existsSync(absolute)) {
        throw new AppError('File not found', 404);
      }

      // Ownership / role check. We treat anything under /uploads as
      // sensitive (KYC, avatars, dispute evidence) and require the
      // caller to either own it via KYCDocument or be ADMIN.
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isAdmin) {
        const doc = await prisma.kYCDocument.findFirst({
          where: {
            userId: req.user!.id,
            documentUrl: { contains: name },
          },
        }).catch(() => null);
        if (!doc) {
          // Not a KYC doc owner — allow only if it's the user's own
          // avatar (the User.avatarUrl field stores the same basename).
          const owner = await prisma.user.findFirst({
            where: { id: req.user!.id, avatarUrl: { contains: name } },
            select: { id: true },
          });
          if (!owner) throw new AppError('Forbidden', 403);
        }
      }

      res.sendFile(absolute);
    } catch (e) {
      next(e);
    }
  }
);
