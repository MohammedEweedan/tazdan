/**
 * Privileged-action audit trail. Answers who / what / when / where / why /
 * before / after for every staff action. AuditLog is append-only at the
 * database level (trigger), so a written record cannot be edited later.
 *
 * Pass the transaction client when the action itself runs in a transaction,
 * so the audit row commits or rolls back with it.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

type Client = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  /** The request, for IP and user agent. */
  req?: { ip?: string; headers?: Record<string, any> };
}

function json(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  // Round-trip through JSON so Decimal / Date values serialise predictably.
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

export async function writeAudit(client: Client, input: AuditInput): Promise<void> {
  const after = input.reason ? { ...(json(input.after) as object ?? {}), _reason: input.reason } : json(input.after);
  await client.auditLog.create({
    data: {
      userId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValues: json(input.before),
      newValues: after as Prisma.InputJsonValue | undefined,
      ipAddress: input.req?.ip ?? null,
      userAgent: (input.req?.headers?.['user-agent'] as string | undefined)?.slice(0, 500) ?? null,
    },
  });
}
