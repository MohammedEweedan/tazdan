/**
 * Auth-gated download route for files in /uploads: KYC documents (passports,
 * IDs, proof of address) and deposit proofs. These must NEVER be publicly
 * fetchable (the old `express.static('/uploads')` mount allowed that).
 *
 * Rules:
 *  - Caller must be authenticated.
 *  - A customer may read only their own file: a KYC document or deposit proof
 *    whose stored path is exactly `/uploads/<name>` on their account.
 *  - Staff go through the same gate as every staff route (requireAdmin: DB
 *    re-check, staff 2FA in production, optional IP allowlist) and need a
 *    document permission (customers.kyc.review, customers.pii or
 *    deposits.confirm). Every staff view is audited.
 *  - Ownership is checked before the file system is touched, so the route is
 *    not an existence oracle for other people's files.
 */
import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate, requireAdmin } from './auth';
import { AppError } from './errorHandler';
import { AuthRequest } from '../types';
import { prisma } from '../utils/prisma';
import { loadStaffContext } from '../services/platform/rbac';
import { writeAudit } from '../services/platform/audit';

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
);

const SAFE_NAME = /^[A-Za-z0-9_-]{8,80}\.(jpg|jpeg|png|webp|pdf)$/;
const DOCUMENT_PERMISSIONS = ['customers.kyc.review', 'customers.pii', 'deposits.confirm'] as const;

export const protectedUploadsRouter = Router();

async function ownsFile(userId: string, storedPath: string): Promise<boolean> {
  const [doc, deposit, avatar] = await Promise.all([
    prisma.kYCDocument.findFirst({ where: { userId, documentUrl: storedPath }, select: { id: true } }),
    prisma.deposit.findFirst({ where: { userId, proofImageUrl: storedPath }, select: { id: true } }),
    prisma.user.findFirst({ where: { id: userId, avatarUrl: storedPath }, select: { id: true } }),
  ]);
  return Boolean(doc || deposit || avatar);
}

function runAdminGate(req: AuthRequest, res: Response): Promise<void> {
  return new Promise((resolve, reject) => requireAdmin(req, res, (err?: unknown) => (err ? reject(err) : resolve())));
}

protectedUploadsRouter.get(
  '/:filename',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const name = req.params.filename;
      if (!name || !SAFE_NAME.test(name)) throw new AppError('Invalid filename', 400);
      const absolute = path.resolve(UPLOAD_DIR, name);
      if (!absolute.startsWith(UPLOAD_DIR + path.sep)) throw new AppError('Invalid path', 400);
      const storedPath = `/uploads/${name}`;

      let staffView = false;
      if (!(await ownsFile(req.user!.id, storedPath))) {
        if (req.user?.role !== 'ADMIN') throw new AppError('Forbidden', 403);
        await runAdminGate(req, res);
        const staff = await loadStaffContext(req.user!.id);
        if (!staff || !DOCUMENT_PERMISSIONS.some((p) => staff.permissions.has(p))) {
          throw new AppError('Missing permission to view customer documents', 403, 'AUTHORIZATION');
        }
        staffView = true;
      }

      if (!fs.existsSync(absolute)) throw new AppError('File not found', 404);

      if (staffView) {
        await writeAudit(prisma, { actorId: req.user!.id, action: 'CUSTOMER_DOCUMENT_VIEWED', entity: 'Upload', entityId: name, req });
      }
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(absolute);
    } catch (e) {
      next(e);
    }
  }
);
