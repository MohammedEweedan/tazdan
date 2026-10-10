/**
 * Refund of a remittance that was already PAID (the beneficiary received the
 * money). The customer is made whole from corporate funds — PLATFORM →
 * customer — so it is a maker-checker action (REMITTANCE_REFUND approval).
 * Refunds before payout come straight out of REMITTANCE_CLEARING and need
 * no approval (remittance.service.refund).
 */
import type { RemittanceState } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { postLedger } from '../ledger/ledger.service';
import { registerApprovalHandler } from '../platform/approvals.service';
import { writeAudit } from '../platform/audit';
import { transition } from './stateMachine';

const PAID_STATES: RemittanceState[] = ['PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED'];

registerApprovalHandler('REMITTANCE_REFUND', {
  requestPermission: 'remittance.operate',
  approvePermission: 'remittance.refund.approve',
  validate: async (payload: { transferId?: string }) => {
    if (!payload?.transferId) throw new AppError('transferId is required', 400);
    const t = await prisma.remittanceTransfer.findUnique({ where: { id: payload.transferId } });
    if (!t) throw new AppError('Transfer not found', 404);
    if (!PAID_STATES.includes(t.state)) throw new AppError(`Only paid transfers need an approved goodwill refund (this one is ${t.state}); refund it directly instead`, 409);
  },
  execute: async (payload: { transferId: string }, ctx) => prisma.$transaction(async (tx) => {
    const t = await tx.remittanceTransfer.findUniqueOrThrow({ where: { id: payload.transferId } });
    if (!PAID_STATES.includes(t.state)) throw new AppError(`Transfer is now ${t.state}`, 409);
    const tr = { id: t.id, state: t.state, correlationId: t.correlationId };
    await transition(tx, tr, 'DISPUTED', { actorType: 'STAFF', actorId: ctx.approvedById, reason: `Goodwill refund approved: ${ctx.reason}` });
    await transition(tx, tr, 'REFUND_PENDING', { actorType: 'STAFF', actorId: ctx.approvedById, reason: ctx.reason });
    const total = new Decimal(t.totalDebit.toString());
    await tx.wallet.upsert({
      where: { userId_currency: { userId: t.userId, currency: t.sourceCurrency } },
      update: { balance: { increment: total.toFixed() } },
      create: { userId: t.userId, currency: t.sourceCurrency, balance: total.toFixed() },
    });
    const { groupId } = await postLedger(tx, {
      refType: 'remittance_goodwill_refund', refId: t.id, memo: `Goodwill refund ${t.reference}: ${ctx.reason}`.slice(0, 500),
      legs: [
        { type: 'PLATFORM', currency: t.sourceCurrency, amount: total.neg() },
        { type: 'USER', userId: t.userId, currency: t.sourceCurrency, amount: total },
      ],
    });
    await tx.remittanceRefund.create({ data: { transferId: t.id, amount: t.totalDebit, currency: t.sourceCurrency, reason: ctx.reason, status: 'COMPLETED', ledgerGroupId: groupId, requestedById: ctx.requestedById, completedAt: new Date() } });
    await tx.transaction.create({
      data: { userId: t.userId, type: 'ADMIN_CREDIT', currency: t.sourceCurrency, amount: total.toFixed(), fee: 0, balanceBefore: 0, balanceAfter: 0, reference: `${t.reference}-REFUND`, description: 'International transfer refund', metadata: { kind: 'remittance_refund', remittanceId: t.id } },
    });
    await transition(tx, tr, 'REFUNDED', { actorType: 'STAFF', actorId: ctx.approvedById, reason: 'Refunded from corporate funds', ledgerGroupIds: [groupId] });
    await writeAudit(tx, { actorId: ctx.approvedById, action: 'REMITTANCE_GOODWILL_REFUND', entity: 'RemittanceTransfer', entityId: t.id, after: { amount: total.toFixed(), currency: t.sourceCurrency, requestedById: ctx.requestedById, ledgerGroupId: groupId }, reason: ctx.reason });
    return { transferId: t.id, ledgerGroupId: groupId };
  }),
});
