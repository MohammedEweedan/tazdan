/**
 * Controlled ledger adjustments (operator credits and debits).
 *
 * There is no way to edit a balance directly. An adjustment is a balanced
 * journal between the customer's USER account and the ADJUSTMENT account,
 * with a customer-visible ADMIN_CREDIT / ADMIN_DEBIT history row, an audit
 * record naming requester and approver, and a lifecycle record.
 *
 * Adjustments above MANUAL_ADJUSTMENT_SINGLE_USD (default 100 USD) must be
 * approved by a second staff member (see approvals.service).
 */
import { Prisma, type Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { debitAvailable, parsePositiveAmount } from '../wallet/atomicWallet';
import { isLedgerCurrency, postLedger } from './ledger.service';
import { writeAudit } from '../platform/audit';
import { recordTransition } from '../platform/lifecycle';
import { registerApprovalHandler } from '../platform/approvals.service';

export const SINGLE_CONTROL_LIMIT_USD = () => Number(process.env.MANUAL_ADJUSTMENT_SINGLE_USD ?? '100');

const ENUM_CURRENCIES = new Set([
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
  'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND',
]);

export interface AdjustmentInput {
  userId: string;
  currency: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: string | number;
  reason: string;
  requestedById: string;
  approvedById: string;
  approvalRequestId?: string | null;
}

export function validateAdjustment(payload: Partial<AdjustmentInput>): void {
  if (!payload.userId || typeof payload.userId !== 'string') throw new AppError('userId is required', 400);
  const currency = String(payload.currency ?? '').toUpperCase();
  if (!ENUM_CURRENCIES.has(currency) || !isLedgerCurrency(currency)) {
    throw new AppError(`Adjustments are supported for ledger currencies only (got ${currency || 'none'})`, 400);
  }
  if (payload.direction !== 'CREDIT' && payload.direction !== 'DEBIT') throw new AppError('direction must be CREDIT or DEBIT', 400);
  parsePositiveAmount(payload.amount);
}

export async function postAdjustment(input: AdjustmentInput) {
  validateAdjustment(input);
  const currency = input.currency.toUpperCase() as Currency;
  const amount = parsePositiveAmount(input.amount);
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AppError('User not found', 404);
  const reference = `ADJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const signed = input.direction === 'CREDIT' ? amount : amount.neg();

  return prisma.$transaction(async (tx) => {
    const before = await tx.wallet.findUnique({ where: { userId_currency: { userId: input.userId, currency } } });
    const balanceBefore = new Decimal(before?.balance.toString() ?? '0');

    if (input.direction === 'CREDIT') {
      await tx.wallet.upsert({
        where: { userId_currency: { userId: input.userId, currency } },
        create: { userId: input.userId, currency, balance: new Prisma.Decimal(amount.toFixed()) },
        update: { balance: { increment: new Prisma.Decimal(amount.toFixed()) } },
      });
    } else {
      // A debit may only take spendable funds; reservations stay intact.
      await debitAvailable(tx, input.userId, currency, amount);
    }

    const { groupId } = await postLedger(tx, {
      refType: 'adjustment',
      refId: reference,
      memo: `${input.direction} adjustment: ${input.reason}`.slice(0, 500),
      legs: [
        { type: 'USER', userId: input.userId, currency, amount: signed },
        { type: 'ADJUSTMENT', currency, amount: signed.neg() },
      ],
    }, { allowNegativeUser: input.direction === 'CREDIT' });

    const txRow = await tx.transaction.create({
      data: {
        userId: input.userId,
        type: input.direction === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        currency,
        amount: new Prisma.Decimal(signed.toFixed()),
        fee: new Prisma.Decimal(0),
        balanceBefore: new Prisma.Decimal(balanceBefore.toFixed()),
        balanceAfter: new Prisma.Decimal(balanceBefore.plus(signed).toFixed()),
        reference,
        description: input.direction === 'CREDIT' ? 'Account credit from Tazdan' : 'Account correction by Tazdan',
        metadata: { kind: 'adjustment', ledgerGroupId: groupId, approvalRequestId: input.approvalRequestId ?? null },
      },
    });

    await recordTransition(tx, {
      entityType: 'ADJUSTMENT', entityId: reference, fromState: null, toState: 'POSTED',
      actorType: 'STAFF', actorId: input.approvedById, reason: input.reason, ledgerGroupIds: [groupId],
    });
    await writeAudit(tx, {
      actorId: input.approvedById,
      action: input.direction === 'CREDIT' ? 'LEDGER_ADJUSTMENT_CREDIT' : 'LEDGER_ADJUSTMENT_DEBIT',
      entity: 'Wallet',
      entityId: input.userId,
      before: { balance: balanceBefore.toFixed(), currency },
      after: {
        balance: balanceBefore.plus(signed).toFixed(), currency, amount: amount.toFixed(), reference,
        ledgerGroupId: groupId, requestedById: input.requestedById, approvedById: input.approvedById,
        approvalRequestId: input.approvalRequestId ?? null,
      },
      reason: input.reason,
    });
    await tx.notification.create({
      data: {
        userId: input.userId,
        title: input.direction === 'CREDIT' ? `Funds credited: ${amount.toFixed()} ${currency}` : `Balance corrected: -${amount.toFixed()} ${currency}`,
        message: input.reason.slice(0, 500),
        type: 'deposit',
      },
    });
    return { reference, ledgerGroupId: groupId, transactionId: txRow.id };
  });
}

registerApprovalHandler('LEDGER_ADJUSTMENT', {
  requestPermission: 'adjustments.request',
  approvePermission: 'adjustments.approve',
  validate: (payload) => validateAdjustment(payload),
  execute: (payload, ctx) => postAdjustment({
    ...(payload as AdjustmentInput),
    reason: ctx.reason,
    requestedById: ctx.requestedById,
    approvedById: ctx.approvedById,
    approvalRequestId: ctx.requestId,
  }),
});
