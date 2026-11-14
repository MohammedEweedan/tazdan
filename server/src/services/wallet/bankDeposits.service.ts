/**
 * Staff confirmation of manual bank deposits — the one place a deposit is
 * credited from a staff decision. Both staff endpoints (admin panel and
 * /api/deposits/:id/confirm) use it.
 *
 * Controls:
 *   - segregation of duties: nobody confirms a deposit to their own account;
 *   - dual control: at or above DEPOSIT_DUAL_CONTROL_USD (default 5,000 USD)
 *     the confirmation becomes a DEPOSIT_CONFIRMATION approval request and a
 *     second staff member (not the requester, not the depositor) releases it;
 *   - exactly once: the credit is a conditional status transition, so
 *     concurrent confirmations or a direct confirm racing an approval credit
 *     nothing twice.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { usdRate } from '../../utils/kycLimits';
import { postLedger, isLedgerCurrency } from '../ledger/ledger.service';
import { assertTransitioned } from './atomicWallet';
import { assertNotSelf } from '../platform/segregation';
import { recordTransition } from '../platform/lifecycle';
import { writeAudit } from '../platform/audit';
import { registerApprovalHandler, requestApproval } from '../platform/approvals.service';
import type { Permission } from '../platform/rbac';

const AWAITING = ['WAITING_CONFIRMATION', 'PENDING'] as const;
export const depositDualControlUsd = () => Number(process.env.DEPOSIT_DUAL_CONTROL_USD ?? 5_000);

type Req = { ip?: string; headers?: Record<string, any>; originalUrl?: string };

/** Credit a deposit that is still awaiting confirmation. Exactly once. */
async function credit(depositId: string, actorId: string, notes: string | null, req?: Req, approval?: { requestId: string; requestedById: string }) {
  return prisma.$transaction(async (tx: any) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new AppError('Deposit not found', 404);
    const moved = await tx.deposit.updateMany({
      where: { id: deposit.id, status: { in: [...AWAITING] } },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: actorId, adminNotes: notes ?? deposit.adminNotes },
    });
    assertTransitioned(moved, 'Deposit already processed');
    const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: deposit.userId, currency: deposit.currency } } });
    const balanceBefore = new Decimal(wallet?.balance.toString() ?? '0');
    const amount = new Decimal(deposit.amount.toString());
    await tx.wallet.upsert({
      where: { userId_currency: { userId: deposit.userId, currency: deposit.currency } },
      update: { balance: { increment: amount } },
      create: { userId: deposit.userId, currency: deposit.currency, balance: amount },
    });
    if (isLedgerCurrency(deposit.currency)) {
      await postLedger(tx, {
        refType: 'deposit', refId: deposit.id, memo: `Staff-confirmed deposit ${deposit.currency}`,
        legs: [
          { type: 'SYSTEM_ONRAMP', currency: deposit.currency, amount: amount.neg() },
          { type: 'USER', userId: deposit.userId, currency: deposit.currency, amount },
        ],
      });
    }
    await tx.transaction.create({ data: { userId: deposit.userId, type: 'DEPOSIT', currency: deposit.currency, amount: deposit.amount, balanceBefore, balanceAfter: balanceBefore.add(amount), reference: deposit.reference, description: `Deposit confirmed via ${deposit.paymentMethod}` } });
    await tx.notification.create({ data: { userId: deposit.userId, title: 'Deposit Confirmed', message: `Your deposit of ${amount.toString()} ${deposit.currency} has been confirmed and credited to your account.`, type: 'deposit' } });
    await recordTransition(tx, { entityType: 'DEPOSIT', entityId: deposit.id, fromState: deposit.status, toState: 'CONFIRMED', actorType: 'STAFF', actorId, reason: notes });
    await writeAudit(tx, {
      actorId, action: 'CONFIRM_DEPOSIT', entity: 'Deposit', entityId: deposit.id,
      before: { status: deposit.status },
      after: { status: 'CONFIRMED', amount: deposit.amount, currency: deposit.currency, ...(approval ? { approvalRequestId: approval.requestId, requestedById: approval.requestedById } : {}) },
      reason: notes, req,
    });
    return { userId: deposit.userId as string, amount: amount.toString(), currency: deposit.currency as string };
  });
}

registerApprovalHandler('DEPOSIT_CONFIRMATION', {
  requestPermission: 'deposits.confirm',
  approvePermission: 'deposits.confirm',
  validate: (payload: any) => {
    if (!payload || typeof payload.depositId !== 'string' || typeof payload.userId !== 'string') throw new AppError('Invalid deposit approval', 400);
  },
  execute: async (payload: any, ctx) => {
    // The approver is the second control; the beneficiary check in the
    // approvals service already refused requester/approver = depositor.
    const current = await prisma.deposit.findUnique({ where: { id: payload.depositId } });
    if (!current || current.userId !== payload.userId || current.amount.toString() !== String(payload.amount) || current.currency !== payload.currency) {
      throw new AppError('The deposit changed after the approval was requested — request it again', 409);
    }
    return credit(payload.depositId, ctx.approvedById, `Dual control: requested by ${ctx.requestedById}, approved by ${ctx.approvedById}. ${ctx.reason}`.slice(0, 1000), undefined, { requestId: ctx.requestId, requestedById: ctx.requestedById });
  },
});

export type ConfirmResult =
  | { credited: true; userId: string; amount: string; currency: string }
  | { credited: false; pendingApproval: true; approvalId: string };

export async function confirmBankDeposit(input: {
  depositId: string;
  staffId: string;
  notes?: string | null;
  permissions?: Set<Permission>;
  req?: Req;
}): Promise<ConfirmResult> {
  const deposit = await prisma.deposit.findUnique({ where: { id: input.depositId } });
  if (!deposit) throw new AppError('Deposit not found', 404);
  assertNotSelf(input.staffId, [deposit.userId], 'confirm_deposit', { ipAddress: input.req?.ip, path: input.req?.originalUrl });
  if (!(AWAITING as readonly string[]).includes(deposit.status)) throw new AppError('Deposit is not awaiting confirmation', 400);

  const usd = Number(deposit.amount) * (await usdRate(deposit.currency));
  if (!Number.isFinite(usd) || usd >= depositDualControlUsd()) {
    const open = await prisma.approvalRequest.findFirst({
      where: { type: 'DEPOSIT_CONFIRMATION', subjectType: 'DEPOSIT', subjectId: deposit.id, status: 'PENDING' },
    });
    if (open) return { credited: false, pendingApproval: true, approvalId: open.id };
    const approval = await requestApproval({
      type: 'DEPOSIT_CONFIRMATION',
      payload: { depositId: deposit.id, userId: deposit.userId, amount: deposit.amount.toString(), currency: deposit.currency, reference: deposit.reference },
      reason: (input.notes?.trim() || `Confirm bank deposit ${deposit.reference} of ${deposit.amount} ${deposit.currency}`).padEnd(10, '.'),
      requestedById: input.staffId,
      subjectType: 'DEPOSIT',
      subjectId: deposit.id,
      permissions: input.permissions ?? new Set<Permission>(['deposits.confirm']),
      req: input.req,
    });
    return { credited: false, pendingApproval: true, approvalId: approval.id };
  }
  const done = await credit(deposit.id, input.staffId, input.notes ?? null, input.req);
  return { credited: true, ...done };
}
