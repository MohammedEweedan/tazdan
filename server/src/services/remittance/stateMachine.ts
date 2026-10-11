/**
 * Remittance lifecycle state machine.
 *
 * Happy path:
 *   CREATED → QUOTED → COMPLIANCE_PENDING → APPROVED → FUNDING_PENDING → FUNDED
 *   → ROUTING → ROUTED → SETTLEMENT_PENDING → SETTLED → PAYOUT_PENDING → PAID
 *   → RECONCILIATION_PENDING → RECONCILED → COMPLETED
 * Exceptions: EXPIRED, REJECTED, CANCELLED, FAILED, MANUAL_REVIEW,
 *   REFUND_PENDING, REFUNDED, DISPUTED.
 *
 * A transition is a conditional UPDATE on the current state plus an
 * append-only StateTransition row in the same transaction. Arbitrary status
 * edits are impossible: only listed edges are accepted.
 */
import type { Prisma, RemittanceState } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { recordTransition, type ActorType } from '../platform/lifecycle';

type Tx = Prisma.TransactionClient;

export const EDGES: Record<RemittanceState, RemittanceState[]> = {
  CREATED: ['QUOTED', 'CANCELLED', 'EXPIRED'],
  QUOTED: ['COMPLIANCE_PENDING', 'CANCELLED', 'EXPIRED'],
  COMPLIANCE_PENDING: ['APPROVED', 'REJECTED', 'MANUAL_REVIEW'],
  MANUAL_REVIEW: ['APPROVED', 'REFUND_PENDING', 'REJECTED', 'FUNDING_PENDING'],
  APPROVED: ['FUNDING_PENDING', 'CANCELLED'],
  FUNDING_PENDING: ['FUNDED', 'FAILED', 'CANCELLED', 'MANUAL_REVIEW'],
  FUNDED: ['ROUTING', 'MANUAL_REVIEW', 'REFUND_PENDING'],
  ROUTING: ['ROUTED', 'FAILED', 'REFUND_PENDING'],
  ROUTED: ['SETTLEMENT_PENDING', 'REFUND_PENDING'],
  SETTLEMENT_PENDING: ['SETTLED', 'REFUND_PENDING'],
  SETTLED: ['PAYOUT_PENDING', 'REFUND_PENDING'],
  PAYOUT_PENDING: ['PAID', 'FAILED', 'ROUTING', 'REFUND_PENDING'],
  PAID: ['RECONCILIATION_PENDING', 'DISPUTED', 'REFUND_PENDING'],
  RECONCILIATION_PENDING: ['RECONCILED', 'DISPUTED', 'REFUND_PENDING'],
  RECONCILED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['DISPUTED'],
  FAILED: ['ROUTING', 'REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED'],
  DISPUTED: ['REFUND_PENDING', 'COMPLETED'],
  EXPIRED: [],
  REJECTED: ['REFUND_PENDING'],
  CANCELLED: ['REFUND_PENDING'],
  REFUNDED: [],
};

const TIMESTAMP: Partial<Record<RemittanceState, string>> = {
  FUNDED: 'fundedAt', ROUTED: 'routedAt', SETTLED: 'settledAt', PAID: 'paidAt',
  COMPLETED: 'completedAt', CANCELLED: 'cancelledAt', REFUNDED: 'refundedAt',
};

export interface TransitionOpts {
  actorType: ActorType;
  actorId?: string | null;
  reason?: string | null;
  provider?: string | null;
  providerResponse?: unknown;
  riskDecisionId?: string | null;
  ledgerGroupIds?: string[];
  data?: Prisma.RemittanceTransferUpdateManyMutationInput;
}

export async function transition(tx: Tx, transfer: { id: string; state: RemittanceState; correlationId: string }, to: RemittanceState, opts: TransitionOpts) {
  if (!EDGES[transfer.state]?.includes(to)) {
    throw new AppError(`Remittance cannot move from ${transfer.state} to ${to}`, 409, 'TRANSACTION_CONFLICT');
  }
  const ts = TIMESTAMP[to];
  const moved = await tx.remittanceTransfer.updateMany({
    where: { id: transfer.id, state: transfer.state },
    data: { ...(opts.data ?? {}), state: to, ...(ts ? { [ts]: new Date() } : {}) },
  });
  if (moved.count !== 1) throw new AppError('Remittance changed state concurrently — retry', 409, 'TRANSACTION_CONFLICT');
  await recordTransition(tx, {
    entityType: 'REMITTANCE', entityId: transfer.id, fromState: transfer.state, toState: to,
    actorType: opts.actorType, actorId: opts.actorId ?? null, reason: opts.reason ?? null,
    provider: opts.provider ?? null, providerResponse: opts.providerResponse, riskDecisionId: opts.riskDecisionId ?? null,
    ledgerGroupIds: opts.ledgerGroupIds ?? [], correlationId: transfer.correlationId,
  });
  transfer.state = to;
  return transfer;
}

/** Walk several edges in order (each recorded). */
export async function walk(tx: Tx, transfer: { id: string; state: RemittanceState; correlationId: string }, path: RemittanceState[], opts: TransitionOpts) {
  for (const to of path) await transition(tx, transfer, to, opts);
  return transfer;
}
