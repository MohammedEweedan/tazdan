/**
 * Compliance / fraud case management.
 *
 * Workflow: OPEN → ASSIGNED → INVESTIGATING → AWAITING_INFORMATION ⇄
 * INVESTIGATING → ESCALATED → CLOSED (any open state may close with a
 * resolution). Every change appends a CaseNote (append-only) and an audit
 * record, so the case history is complete and cannot be rewritten.
 */
import { randomBytes } from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import type { Prisma } from '@prisma/client';

type Client = Prisma.TransactionClient | typeof prisma;

export const CASE_STATUSES = ['OPEN', 'ASSIGNED', 'INVESTIGATING', 'AWAITING_INFORMATION', 'ESCALATED', 'CLOSED'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ['ASSIGNED', 'INVESTIGATING', 'ESCALATED', 'CLOSED'],
  ASSIGNED: ['INVESTIGATING', 'ESCALATED', 'AWAITING_INFORMATION', 'CLOSED'],
  INVESTIGATING: ['AWAITING_INFORMATION', 'ESCALATED', 'CLOSED'],
  AWAITING_INFORMATION: ['INVESTIGATING', 'ESCALATED', 'CLOSED'],
  ESCALATED: ['INVESTIGATING', 'AWAITING_INFORMATION', 'CLOSED'],
  CLOSED: [],
};

/** SLA by priority (hours to first decision). */
const SLA_HOURS: Record<string, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 };

export interface OpenCaseInput {
  type: string;
  title: string;
  summary?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subjectUserId?: string | null;
  subjectBusinessId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  riskDecisionId?: string | null;
  openedById?: string | null;
  evidence?: unknown;
}

export async function openCase(input: OpenCaseInput, client: Client = prisma) {
  const priority = input.priority ?? 'MEDIUM';
  const reference = `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const c = await client.complianceCase.create({
    data: {
      reference,
      type: input.type,
      priority,
      title: input.title,
      summary: input.summary ?? null,
      subjectUserId: input.subjectUserId ?? null,
      subjectBusinessId: input.subjectBusinessId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      riskDecisionId: input.riskDecisionId ?? null,
      openedById: input.openedById ?? null,
      slaDueAt: new Date(Date.now() + (SLA_HOURS[priority] ?? 72) * 3600_000),
    },
  });
  await client.caseNote.create({
    data: {
      caseId: c.id,
      authorId: input.openedById ?? null,
      authorType: input.openedById ? 'STAFF' : 'SYSTEM',
      kind: 'STATUS_CHANGE',
      body: `Case opened: ${input.title}`,
      attachments: input.evidence === undefined ? undefined : (JSON.parse(JSON.stringify(input.evidence)) as Prisma.InputJsonValue),
    },
  });
  if (input.openedById) {
    await writeAudit(client, { actorId: input.openedById, action: 'CASE_OPEN', entity: 'ComplianceCase', entityId: c.id, after: { type: c.type, priority, subjectUserId: c.subjectUserId } });
  }
  return c;
}

export async function transitionCase(input: {
  caseId: string;
  to: CaseStatus;
  actorId: string;
  note: string;
  resolution?: string;
  assignedToId?: string | null;
  req?: { ip?: string; headers?: Record<string, any> };
}) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.complianceCase.findUnique({ where: { id: input.caseId } });
    if (!c) throw new AppError('Case not found', 404);
    const from = c.status as CaseStatus;
    if (from !== input.to && !CASE_TRANSITIONS[from]?.includes(input.to)) {
      throw new AppError(`A ${from} case cannot move to ${input.to}`, 409);
    }
    if (input.to === 'CLOSED' && !input.resolution?.trim()) throw new AppError('Closing a case needs a resolution', 400);
    const moved = await tx.complianceCase.updateMany({
      where: { id: c.id, status: from },
      data: {
        status: input.to,
        ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        ...(input.to === 'CLOSED' ? { closedAt: new Date(), resolution: input.resolution!.trim() } : {}),
      },
    });
    if (moved.count !== 1) throw new AppError('Case changed while you were editing — refresh', 409);
    await tx.caseNote.create({
      data: {
        caseId: c.id, authorId: input.actorId, authorType: 'STAFF',
        kind: input.to === 'ESCALATED' ? 'ESCALATION' : input.to === 'AWAITING_INFORMATION' ? 'REQUEST_INFORMATION' : 'STATUS_CHANGE',
        body: `${from} → ${input.to}: ${input.note}`,
      },
    });
    await writeAudit(tx, {
      actorId: input.actorId, action: 'CASE_TRANSITION', entity: 'ComplianceCase', entityId: c.id,
      before: { status: from, assignedToId: c.assignedToId }, after: { status: input.to, assignedToId: input.assignedToId ?? c.assignedToId, resolution: input.resolution ?? null },
      reason: input.note, req: input.req,
    });
    return tx.complianceCase.findUniqueOrThrow({ where: { id: c.id }, include: { notes: { orderBy: { createdAt: 'asc' } } } });
  });
}

export async function addCaseNote(input: { caseId: string; actorId: string | null; authorType?: 'STAFF' | 'SYSTEM' | 'AI'; kind?: string; body: string; attachments?: unknown }) {
  const c = await prisma.complianceCase.findUnique({ where: { id: input.caseId }, select: { id: true } });
  if (!c) throw new AppError('Case not found', 404);
  return prisma.caseNote.create({
    data: {
      caseId: c.id,
      authorId: input.actorId,
      authorType: input.authorType ?? 'STAFF',
      kind: input.kind ?? 'NOTE',
      body: input.body,
      attachments: input.attachments === undefined ? undefined : (JSON.parse(JSON.stringify(input.attachments)) as Prisma.InputJsonValue),
    },
  });
}
