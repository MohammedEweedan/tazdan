/**
 * Account closure — the in-app "delete my account" the App Store (5.1.1(v))
 * and Google Play require.
 *
 * A regulated money service cannot erase financial history on request, so
 * deletion is two steps:
 *   1. Closure (now): refused while the customer still has money, a reserved
 *      amount or anything in flight. Otherwise the account becomes CLOSED,
 *      sign-in is refused, every session, API key and push token is revoked,
 *      public profile data is removed and open listings are cancelled.
 *   2. Anonymisation (at erasureDueAt = closure + ACCOUNT_RETENTION_YEARS,
 *      default 5): name, contact details, date of birth, avatar and KYC
 *      documents are removed. Ledger, transactions and audit records stay,
 *      linked to an anonymous account (docs/regulatory/DATA_RETENTION.md).
 */
import fs from 'fs/promises';
import path from 'path';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { revokeAllUserSessions } from '../../middleware/auth';
import { writeAudit } from '../platform/audit';
import { recordTransition } from '../platform/lifecycle';

export const RETENTION_YEARS = () => Number(process.env.ACCOUNT_RETENTION_YEARS ?? '5');

/** `params` lets the app phrase the blocker in the customer's language. */
export interface ClosureBlocker { code: string; message: string; params?: Record<string, string | number> }

const OPEN_REMITTANCE_EXCLUDED = ['COMPLETED', 'EXPIRED', 'REFUNDED', 'REJECTED', 'CANCELLED'];

/** Everything that must be settled before the account can close. */
export async function closureBlockers(userId: string, client: any = prisma): Promise<ClosureBlocker[]> {
  const db = client;
  const [wallets, uw, deposits, withdrawals, trades, links, remittances, business, cards] = await Promise.all([
    db.wallet.findMany({ where: { userId, OR: [{ balance: { not: 0 } }, { frozen: { not: 0 } }] }, select: { currency: true, balance: true, frozen: true } }),
    db.userWallet.findUnique({ where: { userId }, select: { ethBalance: true, btcBalance: true, solBalance: true, usdtErc20Bal: true, usdtTrc20Bal: true, altBalances: true } }),
    db.deposit.count({ where: { userId, status: { in: ['PENDING', 'WAITING_CONFIRMATION'] } } }),
    db.withdrawal.count({ where: { userId, status: { in: ['PENDING', 'PROCESSING'] } } }),
    db.p2PTrade.count({ where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED'] } } }),
    db.claimLink.count({ where: { senderId: userId, status: 'PENDING' } }),
    db.remittanceTransfer.count({ where: { userId, state: { notIn: OPEN_REMITTANCE_EXCLUDED as any } } }),
    db.businessProfile.findUnique({ where: { userId }, select: { id: true } }),
    db.card.count({ where: { userId, status: { in: ['PENDING', 'ACTIVE', 'FROZEN'] } } }),
  ]);

  const out: ClosureBlocker[] = [];
  for (const w of wallets) {
    const bal = new Decimal(w.balance.toString());
    if (!bal.isZero()) out.push({ code: 'BALANCE', message: `Move or withdraw your ${bal.toString()} ${w.currency} balance`, params: { amount: bal.toString(), currency: w.currency } });
    else out.push({ code: 'RESERVED', message: `${w.frozen.toString()} ${w.currency} is reserved for a pending action`, params: { amount: w.frozen.toString(), currency: w.currency } });
  }
  if (uw) {
    const crypto: Array<[string, unknown]> = [['ETH', uw.ethBalance], ['BTC', uw.btcBalance], ['SOL', uw.solBalance], ['USDT (ERC-20)', uw.usdtErc20Bal], ['USDT (TRC-20)', uw.usdtTrc20Bal]];
    for (const [asset, v] of crypto) {
      if (!new Decimal(String(v ?? 0)).isZero()) out.push({ code: 'CRYPTO_BALANCE', message: `Withdraw your ${String(v)} ${asset}`, params: { amount: String(v), currency: asset } });
    }
    for (const [asset, v] of Object.entries((uw.altBalances ?? {}) as Record<string, unknown>)) {
      if (!new Decimal(String(v ?? 0)).isZero()) out.push({ code: 'CRYPTO_BALANCE', message: `Withdraw your ${String(v)} ${asset}`, params: { amount: String(v), currency: asset } });
    }
  }
  if (deposits) out.push({ code: 'PENDING_DEPOSIT', message: `${deposits} deposit${deposits > 1 ? 's are' : ' is'} waiting for confirmation`, params: { count: deposits } });
  if (withdrawals) out.push({ code: 'PENDING_WITHDRAWAL', message: `${withdrawals} withdrawal${withdrawals > 1 ? 's are' : ' is'} still being processed`, params: { count: withdrawals } });
  if (trades) out.push({ code: 'OPEN_TRADE', message: `${trades} P2P trade${trades > 1 ? 's are' : ' is'} still open`, params: { count: trades } });
  if (links) out.push({ code: 'OPEN_CLAIM_LINK', message: `Cancel or wait for ${links} unclaimed payment link${links > 1 ? 's' : ''}`, params: { count: links } });
  if (remittances) out.push({ code: 'TRANSFER_IN_FLIGHT', message: `${remittances} international transfer${remittances > 1 ? 's are' : ' is'} still in progress`, params: { count: remittances } });
  if (cards) out.push({ code: 'ACTIVE_CARD', message: 'Cancel your card first' });
  if (business) {
    const batches = await db.businessPayoutBatch.count({ where: { businessId: business.id, status: { in: ['PENDING_APPROVAL', 'COMPLIANCE_REVIEW', 'EXECUTING'] } } });
    if (batches) out.push({ code: 'BUSINESS_PAYOUTS', message: `${batches} business payout batch${batches > 1 ? 'es are' : ' is'} still open`, params: { count: batches } });
  }
  return out;
}

/** Close the customer's account. Caller has already verified a step-up code. */
export async function closeAccount(userId: string, opts: { reason?: string | null; req?: { ip?: string; headers?: Record<string, any> } } = {}) {
  const now = new Date();
  const erasureDueAt = new Date(now);
  erasureDueAt.setFullYear(erasureDueAt.getFullYear() + RETENTION_YEARS());

  await prisma.$transaction(async (tx) => {
    // Lock the customer and their wallets so no credit or debit lands between
    // the checks and the status change.
    const [user] = await tx.$queryRaw<Array<{ id: string; status: string }>>`SELECT "id", "status"::text AS status FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    if (!user) throw new AppError('Account not found', 404);
    if (user.status === 'CLOSED') throw new AppError('This account is already closed', 409);
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      // A restricted account is closed by the compliance team, not self-service.
      throw new AppError('This account is under review. Contact support to close it.', 409, 'COMPLIANCE_HOLD');
    }
    await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "UserWallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const blockers = await closureBlockers(userId, tx);
    if (blockers.length) throw new AppError('Settle these before closing your account', 409, 'CLOSURE_BLOCKED', { blockers });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: 'CLOSED', closedAt: now, closureReason: opts.reason?.trim().slice(0, 500) || null, erasureDueAt,
        profilePublic: false, bio: null, avatarUrl: null, expoPushToken: null,
      },
    });
    await tx.p2PListing.updateMany({ where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } }, data: { status: 'CANCELLED' } });
    await tx.aPIKey.updateMany({ where: { userId, isActive: true }, data: { isActive: false, revokedAt: now } });
    await recordTransition(tx as any, {
      entityType: 'USER', entityId: userId, fromState: user.status, toState: 'CLOSED',
      actorType: 'USER', actorId: userId, reason: opts.reason?.trim() || 'Customer closed the account',
    });
    await writeAudit(tx as any, {
      actorId: userId, action: 'ACCOUNT_CLOSED', entity: 'User', entityId: userId,
      after: { closedAt: now.toISOString(), erasureDueAt: erasureDueAt.toISOString() }, reason: opts.reason ?? null, req: opts.req,
    });
  });
  await revokeAllUserSessions(userId);
  logger.info('[account] closed at customer request', { userId });
  return { closedAt: now, erasureDueAt };
}

/**
 * Anonymise closed accounts whose retention period has ended. Removes
 * personal data and KYC documents; keeps the anonymous user row so ledger,
 * transaction and audit records stay intact.
 */
export async function anonymiseDueAccounts(now = new Date(), limit = 200): Promise<number> {
  const due = await prisma.user.findMany({
    where: { status: 'CLOSED', anonymisedAt: null, erasureDueAt: { lte: now } },
    select: { id: true, kycDocuments: { select: { id: true, documentUrl: true } } },
    take: limit,
  });
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  for (const u of due) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: {
          email: `closed+${u.id}@anonymised.invalid`, phone: null, phoneCountryCode: null,
          firstName: 'Closed', lastName: 'Account', username: null, dateOfBirth: null,
          bio: null, avatarUrl: null, expoPushToken: null, notificationPrefs: undefined,
          twoFactorSecret: null, twoFactorEnabled: false, lastLoginIp: null,
          passwordHash: 'ANONYMISED', anonymisedAt: now,
        },
      });
      await tx.kYCDocument.deleteMany({ where: { userId: u.id } });
      await writeAudit(tx as any, { actorId: null, action: 'ACCOUNT_ANONYMISED', entity: 'User', entityId: u.id, after: { at: now.toISOString(), kycDocuments: u.kycDocuments.length } });
    });
    for (const d of u.kycDocuments) {
      if (!d.documentUrl.startsWith('/uploads/')) continue;
      const file = path.join(uploadDir, path.basename(d.documentUrl));
      await fs.unlink(file).catch(() => { /* already gone */ });
    }
  }
  if (due.length) logger.info('[account] anonymised closed accounts', { count: due.length });
  return due.length;
}

let started = false;
/** Daily anonymisation job (one worker only). */
export function startAnonymisationJob(intervalMs = 24 * 3600_000): void {
  if (started) return;
  started = true;
  setInterval(() => { void anonymiseDueAccounts().catch((e) => logger.error('[account] anonymisation failed', { err: e })); }, intervalMs).unref?.();
}
