/**
 * Maker-checker approvals.
 *
 * A sensitive action (ledger adjustment, remittance refund, FX override…) is
 * first REQUESTED with a reason. A different staff member holding the
 * approving permission then APPROVES or REJECTS it. Approval executes the
 * registered handler once; the request row records the outcome.
 *
 * The decision is a conditional status transition, so two approvers clicking
 * at once cannot execute the action twice.
 */
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { writeAudit } from './audit';
import type { Permission } from './rbac';

export type ApprovalType =
  | 'LEDGER_ADJUSTMENT'
  | 'REMITTANCE_REFUND'
  | 'FX_OVERRIDE'
  | 'DEPOSIT_ACCOUNT_CHANGE';

interface Handler {
  /** Permission needed to request this type. */
  requestPermission: Permission;
  /** Permission needed to approve it. */
  approvePermission: Permission;
  /** Validate the payload at request time; throw AppError to refuse. */
  validate: (payload: any) => Promise<void> | void;
  /** Perform the action. Return a JSON-safe summary stored on the request. */
  execute: (payload: any, ctx: { requestId: string; requestedById: string; approvedById: string; reason: string }) => Promise<unknown>;
}

const handlers = new Map<ApprovalType, Handler>();

export function registerApprovalHandler(type: ApprovalType, handler: Handler): void {
  handlers.set(type, handler);
}

function handlerFor(type: string): Handler {
  const h = handlers.get(type as ApprovalType);
  if (!h) throw new AppError(`Unknown approval type ${type}`, 400);
  return h;
}

export function approvalPermissions(type: ApprovalType): { request: Permission; approve: Permission } {
  const h = handlerFor(type);
  return { request: h.requestPermission, approve: h.approvePermission };
}

const DEFAULT_TTL_HOURS = 48;

export async function requestApproval(input: {
  type: ApprovalType;
  payload: Record<string, unknown>;
  reason: string;
  requestedById: string;
  subjectType?: string;
  subjectId?: string;
  permissions: Set<Permission>;
  req?: { ip?: string; headers?: Record<string, any> };
}) {
  const h = handlerFor(input.type);
  if (!input.permissions.has(h.requestPermission)) {
    throw new AppError(`Missing permission: ${h.requestPermission}`, 403, 'AUTHORIZATION');
  }
  if (!input.reason || input.reason.trim().length < 10) {
    throw new AppError('A reason of at least 10 characters is required', 400);
  }
  await h.validate(input.payload);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        type: input.type,
        payload: input.payload as any,
        reason: input.reason.trim(),
        requestedById: input.requestedById,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        expiresAt: new Date(Date.now() + DEFAULT_TTL_HOURS * 3600_000),
      },
    });
    await writeAudit(tx, {
      actorId: input.requestedById, action: 'APPROVAL_REQUESTED', entity: 'ApprovalRequest', entityId: created.id,
      after: { type: input.type, payload: input.payload, subjectType: input.subjectType, subjectId: input.subjectId },
      reason: input.reason, req: input.req,
    });
    return created;
  });
  return row;
}

export async function decideApproval(input: {
  id: string;
  approve: boolean;
  deciderId: string;
  note?: string;
  permissions: Set<Permission>;
  req?: { ip?: string; headers?: Record<string, any> };
}) {
  const request = await prisma.approvalRequest.findUnique({ where: { id: input.id } });
  if (!request) throw new AppError('Approval request not found', 404);
  const h = handlerFor(request.type);
  if (!input.permissions.has(h.approvePermission)) {
    throw new AppError(`Missing permission: ${h.approvePermission}`, 403, 'AUTHORIZATION');
  }
  if (request.requestedById === input.deciderId) {
    throw new AppError('The requester cannot approve their own request (maker-checker)', 403, 'AUTHORIZATION');
  }
  if (request.status !== 'PENDING') throw new AppError(`Request is already ${request.status.toLowerCase()}`, 409);
  if (request.expiresAt.getTime() < Date.now()) {
    await prisma.approvalRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
    throw new AppError('Request has expired', 409);
  }

  const claimed = await prisma.approvalRequest.updateMany({
    where: { id: request.id, status: 'PENDING' },
    data: {
      status: input.approve ? 'APPROVED' : 'REJECTED',
      decidedById: input.deciderId,
      decisionNote: input.note ?? null,
      decidedAt: new Date(),
    },
  });
  if (claimed.count !== 1) throw new AppError('Request was decided by someone else', 409);

  await writeAudit(prisma, {
    actorId: input.deciderId,
    action: input.approve ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
    entity: 'ApprovalRequest',
    entityId: request.id,
    before: { status: 'PENDING' },
    after: { status: input.approve ? 'APPROVED' : 'REJECTED', type: request.type },
    reason: input.note ?? null,
    req: input.req,
  });

  if (!input.approve) return prisma.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });

  try {
    const result = await h.execute(request.payload, {
      requestId: request.id,
      requestedById: request.requestedById,
      approvedById: input.deciderId,
      reason: request.reason,
    });
    return prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'EXECUTED', executedAt: new Date(), result: JSON.parse(JSON.stringify(result ?? null)) },
    });
  } catch (err) {
    logger.error('[approvals] execution failed', { id: request.id, type: request.type, err: (err as Error).message });
    await prisma.approvalRequest.update({
      where: { id: request.id },
      data: { status: 'FAILED', result: { error: (err as Error).message } },
    });
    throw err instanceof AppError ? err : new AppError(`Approved but execution failed: ${(err as Error).message}`, 500);
  }
}

export async function listApprovals(filter: { status?: string; type?: string } = {}) {
  return prisma.approvalRequest.findMany({
    where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.type ? { type: filter.type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}
