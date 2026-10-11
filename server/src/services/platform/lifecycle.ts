/**
 * Unified lifecycle log. Every state change of a financial object is written
 * here inside the same transaction as the change itself, so the history and
 * the state can never disagree. StateTransition is append-only (trigger).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

type Client = Prisma.TransactionClient | typeof prisma;

export type ActorType = 'USER' | 'STAFF' | 'SYSTEM' | 'PROVIDER';

export interface TransitionInput {
  entityType: string;
  entityId: string;
  fromState: string | null;
  toState: string;
  actorType: ActorType;
  actorId?: string | null;
  reason?: string | null;
  provider?: string | null;
  providerResponse?: unknown;
  riskDecisionId?: string | null;
  ledgerGroupIds?: string[];
  correlationId?: string | null;
}

export async function recordTransition(client: Client, t: TransitionInput) {
  return client.stateTransition.create({
    data: {
      entityType: t.entityType,
      entityId: t.entityId,
      fromState: t.fromState,
      toState: t.toState,
      actorType: t.actorType,
      actorId: t.actorId ?? null,
      reason: t.reason ?? null,
      provider: t.provider ?? null,
      providerResponse: t.providerResponse === undefined
        ? undefined
        : (JSON.parse(JSON.stringify(t.providerResponse)) as Prisma.InputJsonValue),
      riskDecisionId: t.riskDecisionId ?? null,
      ledgerGroupIds: t.ledgerGroupIds ?? [],
      correlationId: t.correlationId ?? null,
    },
  });
}

export function listTransitions(entityType: string, entityId: string) {
  return prisma.stateTransition.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
  });
}
