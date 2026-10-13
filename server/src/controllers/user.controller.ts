import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { recordRiskEvent } from '../services/risk/engine';
import { AuthRequest } from '../types';
import { revokeSessionAccess } from '../middleware/auth';
import { BCRYPT_COST, sensitiveActionSucceeded, verifyPasswordForSensitiveAction } from '../services/security/credentials';
import { sendSecurityNotice } from '../services/security/notify';

const personName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, 'Use letters, spaces, apostrophes and hyphens only');

const updateProfileSchema = z.object({
  firstName: personName.optional(),
  lastName: personName.optional(),
  phone: z.string().max(32).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
});

export class UserController {
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);
      const current = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { phone: true, firstName: true, lastName: true, kycStatus: true },
      });
      if (!current) throw new AppError('User not found', 404);

      // The phone number is an identity factor (2FA recovery, OTP). It used
      // to be changeable here with no re-verification while `phoneVerified`
      // stayed true — a stolen session could swap in its own number.
      if (data.phone !== undefined && data.phone.replace(/[^\d+]/g, '') !== (current.phone ?? '')) {
        throw new AppError('Changing your phone number needs identity verification. Contact support.', 400);
      }
      // After identity verification the legal name must match the documents.
      const renames = (data.firstName !== undefined && data.firstName !== current.firstName) ||
        (data.lastName !== undefined && data.lastName !== current.lastName);
      if (renames && (current.kycStatus === 'APPROVED' || current.kycStatus === 'PENDING')) {
        throw new AppError('Your name is verified. Contact support to change it.', 409);
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { firstName: data.firstName, lastName: data.lastName },
        select: {
          id: true, email: true, phone: true, firstName: true,
          lastName: true, role: true, kycStatus: true,
        },
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * The customer's limits for each action: what they can do now, when each
   * period resets, and what the next verification level allows. The app shows
   * this before the customer confirms, so nobody is sent a security code for
   * an order their limit would refuse.
   */
  static async getLimits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { allLimitStatuses, LIMITS_TIMEZONE } = await import('../utils/kycLimits');
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true, kycTier: true } });
      const actions = await allLimitStatuses(req.user!.id);
      res.json({ kycStatus: user?.kycStatus, tier: actions.SEND.tier, timezone: LIMITS_TIMEZONE(), actions });
    } catch (error) { next(error); }
  }

  /** What stands between the customer and closing their account. */
  static async getClosure(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { closureBlockers, RETENTION_YEARS } = await import('../services/account/closure.service');
      const blockers = await closureBlockers(req.user!.id);
      res.json({ canClose: blockers.length === 0, blockers, retentionYears: RETENTION_YEARS() });
    } catch (error) { next(error); }
  }

  /**
   * Close (delete) the account. Always needs a server-checked code — never a
   * device biometric alone — because it cannot be undone from the app.
   */
  static async closeAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        confirm: z.literal('CLOSE'),
        reason: z.string().trim().max(500).optional(),
        stepUpCode: z.string().regex(/^\d{6}$/).optional(),
      }).parse(req.body);
      const { closureBlockers, closeAccount } = await import('../services/account/closure.service');
      const blockers = await closureBlockers(req.user!.id);
      if (blockers.length) throw new AppError('Settle these before closing your account', 409, 'CLOSURE_BLOCKED', { blockers });

      const { issueStepUp, verifyStepUp } = await import('../services/security/stepUp.service');
      if (!body.stepUpCode) {
        const { method } = await issueStepUp(req.user!.id, 'account_close');
        throw new AppError(
          `Security verification required. ${method === 'totp' ? 'Enter your authenticator code.' : 'Enter the code we emailed you.'}`,
          401, 'STEP_UP_REQUIRED', { method },
        );
      }
      await verifyStepUp(req.user!.id, 'account_close', body.stepUpCode);
      const result = await closeAccount(req.user!.id, { reason: body.reason, req });
      res.json({ closed: true, closedAt: result.closedAt, erasureDueAt: result.erasureDueAt });
    } catch (error) { next(error); }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = changePasswordSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new AppError('User not found', 404);

      // Capped (5 per 15 minutes) so a stolen session is not an unthrottled password oracle.
      const check = await verifyPasswordForSensitiveAction(user.id, user.passwordHash, data.currentPassword);
      if (check === 'locked') throw new AppError('Too many attempts. Try again in 15 minutes.', 429);
      if (check === 'invalid') throw new AppError('Current password is incorrect', 400);
      if (await bcrypt.compare(data.newPassword, user.passwordHash)) {
        throw new AppError('Choose a password you have not used for this account.', 400);
      }

      const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_COST);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginAttempts: 0, lockoutUntil: null } });
      await sensitiveActionSucceeded(user.id);

      // A password change is usually a reaction to suspected compromise:
      // sign out every OTHER session (refresh tokens + their live access
      // tokens), keep the one making this request.
      const currentSid = req.user?.sid;
      const revokedAt = new Date();
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null, ...(currentSid ? { id: { not: currentSid } } : {}) },
        data: { revokedAt },
      });
      const others = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt, ...(currentSid ? { id: { not: currentSid } } : {}) },
        select: { id: true },
      });
      await Promise.all(others.map((o) => revokeSessionAccess(o.id)));

      void recordRiskEvent(user.id, 'SECURITY_CHANGE', { change: 'password_changed' }, 'MEDIUM');
      sendSecurityNotice(user.id, 'password_changed', { ip: req.ip });
      res.json({ message: 'Password changed successfully', signedOutSessions: others.length });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verification documents. `level` says what they are for:
   *   IDENTITY        ID + selfie (first verification; Level 1)
   *   ADDRESS         proof of address (raises to Level 2)
   *   SOURCE_OF_FUNDS payslip, bank statement or business papers (Level 3)
   * A customer who is already verified keeps their level and limits while an
   * upgrade is reviewed — submitting more documents never takes limits away.
   */
  static async submitKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) throw new AppError('At least one document is required', 400);

      const level = String(req.body.level ?? 'IDENTITY').toUpperCase();
      if (!['IDENTITY', 'ADDRESS', 'SOURCE_OF_FUNDS'].includes(level)) throw new AppError('Unknown verification level', 400);
      const documentType = level === 'IDENTITY' ? (req.body.documentType || 'identity') : level.toLowerCase();
      const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true, kycTier: true } });
      if (!user) throw new AppError('User not found', 404);
      const upgrade = user.kycStatus === 'APPROVED';
      if (!upgrade && level !== 'IDENTITY') throw new AppError('Verify your identity first', 400);
      if (upgrade && level === 'IDENTITY') throw new AppError('Your identity is already verified', 409);

      await prisma.kYCDocument.createMany({
        data: files.map((file) => ({ userId: req.user!.id, documentType, documentUrl: `/uploads/${file.filename}` })),
      });

      // The MOCK provider approves at once so flows are testable locally; it
      // can never run in production (MANUAL review there, and validateEnv
      // refuses KYC_PROVIDER=MOCK). The NODE_ENV check is a second guard.
      const isProd = process.env.NODE_ENV === 'production';
      const provider = (process.env.KYC_PROVIDER || (isProd ? 'MANUAL' : 'MOCK')).toUpperCase();
      const targetTier = level === 'SOURCE_OF_FUNDS' ? 'TIER_3' : 'TIER_2';
      if (provider === 'MOCK' && !isProd) {
        await prisma.user.update({ where: { id: req.user!.id }, data: { kycStatus: 'APPROVED', kycTier: targetTier } });
        await prisma.kYCDocument.updateMany({ where: { userId: req.user!.id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedAt: new Date() } });
        res.json({ message: 'Verification approved', kycStatus: 'APPROVED', kycTier: targetTier, autoApproved: true });
        return;
      }

      if (upgrade) {
        res.json({ message: 'Documents submitted for review', kycStatus: 'APPROVED', kycTier: user.kycTier, upgradePending: true });
        return;
      }
      await prisma.user.update({ where: { id: req.user!.id }, data: { kycStatus: 'PENDING' } });
      res.json({ message: 'KYC documents submitted for review', kycStatus: 'PENDING' });
    } catch (error) {
      next(error);
    }
  }

  static async getKYCStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { kycStatus: true, kycTier: true },
      });
      const documents = await prisma.kYCDocument.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, documentType: true, status: true, rejectionReason: true, createdAt: true, reviewedAt: true },
      });
      const pending = documents.filter((d) => d.status === 'PENDING');
      const lastRejected = documents.find((d) => d.status === 'REJECTED');
      res.json({
        kycStatus: user?.kycStatus,
        kycTier: user?.kycTier,
        pendingUpgrade: user?.kycStatus === 'APPROVED' && pending.length > 0 ? pending[0].documentType : null,
        rejectionReason: lastRejected?.rejectionReason ?? null,
        documents,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({ notifications, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user!.id },
        data: { isRead: true },
      });
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  static async getReferrals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { referralCode: true },
      });
      const referrals = await prisma.user.findMany({
        where: { referredBy: req.user!.id },
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      });
      res.json({ referralCode: user?.referralCode, totalReferrals: referrals.length, referrals });
    } catch (error) {
      next(error);
    }
  }

  static async addBankAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { bankName, accountNumber, accountName, branch, country, currency, sortCode, routingNumber, iban, swift } = req.body;
      
      // Validate required fields
      if (!bankName || !accountNumber || !accountName) {
        throw new AppError('Bank name, account number, and account name are required', 400);
      }
      if (!country || !currency) {
        throw new AppError('Country and currency are required', 400);
      }

      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId: req.user!.id,
          bankName,
          accountNumber,
          accountName,
          branch: branch || null,
          country,
          currency,
          sortCode: sortCode || null,
          routingNumber: routingNumber || null,
          iban: iban || null,
          swift: swift || null,
        } as any,
      });
      res.status(201).json({ bankAccount });
    } catch (error) {
      next(error);
    }
  }

  static async getBankAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ bankAccounts });
    } catch (error) {
      next(error);
    }
  }

  /** Link an external USDT wallet address (TRC20/ERC20) for on-chain sends */
  static async linkUSDTWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { address, network, label } = req.body;
      if (!address) throw new AppError('Wallet address is required', 400);
      if (!['TRC20', 'ERC20'].includes(network)) throw new AppError('Network must be TRC20 or ERC20', 400);

      // Basic address validation
      if (network === 'TRC20' && !address.startsWith('T')) throw new AppError('Invalid TRC20 address', 400);
      if (network === 'ERC20' && !address.startsWith('0x')) throw new AppError('Invalid ERC20 address', 400);

      const linked = await prisma.linkedWallet.create({
        data: {
          userId: req.user!.id,
          address,
          network,
          label: label || `${network} Wallet`,
        },
      });
      res.status(201).json({ wallet: linked });
    } catch (error) {
      next(error);
    }
  }

  /** List user's linked external USDT wallets */
  static async getLinkedWallets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wallets = await prisma.linkedWallet.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ wallets });
    } catch (error) {
      next(error);
    }
  }

  /** Delete a linked external wallet */
  static async deleteLinkedWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wallet = await prisma.linkedWallet.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!wallet) throw new AppError('Linked wallet not found', 404);
      await prisma.linkedWallet.delete({ where: { id: wallet.id } });
      res.json({ message: 'Linked wallet removed' });
    } catch (error) {
      next(error);
    }
  }

  /** Generate account statement */
  static async generateStatement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { format = 'pdf' } = req.query;
      
      // Get user data
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          wallets: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 100, // Last 100 transactions
          },
        },
      });

      if (!user) throw new AppError('User not found', 404);

      // Every interpolated value is escaped: names are customer-supplied.
      const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
      // Generate simple HTML statement
      const statementHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Account Statement - ${esc(user.firstName)} ${esc(user.lastName)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .balance { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>tazdan Exchange</h1>
            <h2>Account Statement</h2>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="section">
            <h3>Account Information</h3>
            <p><strong>Name:</strong> ${esc(user.firstName)} ${esc(user.lastName)}</p>
            <p><strong>Email:</strong> ${esc(user.email)}</p>
            <p><strong>Phone:</strong> ${esc(user.phone || 'N/A')}</p>
            <p><strong>Account Status:</strong> ${esc(user.kycStatus)}</p>
          </div>

          <div class="section">
            <h3>Wallet Balances</h3>
            <table>
              <tr><th>Currency</th><th>Balance</th><th>Frozen</th><th>Available</th></tr>
              ${user.wallets.map(wallet => `
                <tr>
                  <td>${wallet.currency}</td>
                  <td class="balance">${wallet.balance}</td>
                  <td>${wallet.frozen}</td>
                  <td>${parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString())}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="section">
            <h3>Recent Transactions</h3>
            <table>
              <tr><th>Date</th><th>Type</th><th>Currency</th><th>Amount</th><th>Status</th></tr>
              ${user.transactions.slice(0, 50).map(tx => `
                <tr>
                  <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td>${tx.type}</td>
                  <td>${tx.currency}</td>
                  <td>${tx.amount}</td>
                  <td>${tx.fee || '0'}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="section">
            <p><em>This is an official statement from tazdan Exchange.</em></p>
            <p><em>For any questions, please contact support@tazdan.com</em></p>
          </div>
        </body>
        </html>
      `;

      if (format === 'pdf') {
        // For now, return HTML. In production, you'd use a PDF library like puppeteer
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="statement-${user.id}.html"`);
        res.send(statementHtml);
      } else {
        res.json({ statement: statementHtml });
      }
    } catch (error) {
      next(error);
    }
  }
}
