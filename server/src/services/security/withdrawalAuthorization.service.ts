import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { verifyTotpOnce } from './totp';
import { AppError } from '../../middleware/errorHandler';

/** A single MFA approval permits retries of exactly one withdrawal request.
 * It never authorises changed amounts, destinations, assets, or networks. */
export async function authorizeWithdrawal(input: {
  userId: string; secret: string; code: string; key?: string;
  asset: string; network: string; amount: string; toAddress: string;
}): Promise<boolean> {
  if (!input.key) return verifyTotpOnce(input.userId, input.secret, input.code, { window: 1 });
  const id = `withdrawal_auth_${crypto.createHash('sha256').update(`${input.userId}:${input.key}`).digest('hex')}`;
  const digest = crypto.createHash('sha256').update(JSON.stringify([
    input.asset.toUpperCase(), input.network.toUpperCase(), new Decimal(input.amount).toString(), input.toAddress,
  ])).digest('hex');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const prior = await tx.stepUpChallenge.findUnique({ where: { id } });
    if (prior) {
      if (prior.codeHash !== digest) throw new AppError('Idempotency key was used for different withdrawal terms', 409, 'DUPLICATE_REQUEST');
      if (prior.expiresAt.getTime() > Date.now()) return true;
    }
    if (!await verifyTotpOnce(input.userId, input.secret, input.code, { window: 1, client: tx })) return false;
    const data = { codeHash: digest, method: 'WITHDRAWAL_AUTHORIZATION', action: 'withdrawal_request', consumedAt: new Date(), expiresAt: new Date(Date.now() + 5 * 60_000) };
    await tx.stepUpChallenge.upsert({ where: { id }, create: { id, userId: input.userId, ...data }, update: data });
    return true;
  });
}
