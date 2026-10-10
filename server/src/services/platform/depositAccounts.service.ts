/**
 * Tazdan deposit bank accounts — the accounts customers are told to pay into.
 *
 * Changing one changes where customer money goes, so in production a new
 * account, any change to its payment details (bank, holder, account number,
 * IBAN, SWIFT, sort code, routing number, currency, country) and turning an
 * account back on need a second staff member's approval. Turning an account
 * off, or editing its branch/memo text, applies at once. Accounts are never
 * deleted: removing one deactivates it so its history stays. Every change is
 * audited.
 *
 * DEPOSIT_ACCOUNT_DUAL_CONTROL=0 disables the approval step (default: on in
 * production, off elsewhere).
 */
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from './audit';
import { registerApprovalHandler, requestApproval } from './approvals.service';
import type { Permission } from './rbac';

export const PAYMENT_FIELDS = ['currency', 'country', 'bankName', 'accountName', 'accountNumber', 'iban', 'swift', 'sortCode', 'routingNumber'] as const;

export interface DepositAccountInput {
  currency?: string; country?: string; bankName?: string; accountName?: string;
  accountNumber?: string | null; iban?: string | null; swift?: string | null; sortCode?: string | null;
  routingNumber?: string | null; branch?: string | null; memo?: string | null; isActive?: boolean;
}

export const dualControl = () =>
  (process.env.DEPOSIT_ACCOUNT_DUAL_CONTROL ?? (process.env.NODE_ENV === 'production' ? '1' : '0')) !== '0';

/** Does this change move where customers pay? */
export async function needsApproval(id: string | null, data: DepositAccountInput): Promise<boolean> {
  if (!id) return data.isActive !== false; // a new active account
  const current = await prisma.platformBankAccount.findUnique({ where: { id } });
  if (!current) throw new AppError('Deposit account not found', 404);
  if (data.isActive === true && !current.isActive) return true;
  return PAYMENT_FIELDS.some((f) => data[f] !== undefined && (data[f] ?? null) !== ((current as any)[f] ?? null));
}

/** Apply a change now (after approval, or for low-risk edits). */
export async function applyDepositAccountChange(id: string | null, data: DepositAccountInput, actorId: string, reason: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const normalised = { ...data, ...(data.currency ? { currency: data.currency.toUpperCase() } : {}), ...(data.country ? { country: data.country.toUpperCase() } : {}) };
  if (!id) {
    const row = await prisma.platformBankAccount.create({ data: normalised as any });
    await writeAudit(prisma, { actorId, action: 'DEPOSIT_ACCOUNT_CREATED', entity: 'PlatformBankAccount', entityId: row.id, after: row, reason, req });
    return row;
  }
  const before = await prisma.platformBankAccount.findUnique({ where: { id } });
  if (!before) throw new AppError('Deposit account not found', 404);
  const row = await prisma.platformBankAccount.update({ where: { id }, data: normalised as any });
  await writeAudit(prisma, { actorId, action: data.isActive === false && before.isActive ? 'DEPOSIT_ACCOUNT_DEACTIVATED' : 'DEPOSIT_ACCOUNT_UPDATED', entity: 'PlatformBankAccount', entityId: id, before, after: row, reason, req });
  return row;
}

/** Create or update, routing through approval when required. */
export async function changeDepositAccount(input: {
  id: string | null; data: DepositAccountInput; staffId: string; permissions: Set<Permission>; reason: string;
  req?: { ip?: string; headers?: Record<string, any> };
}): Promise<{ pendingApproval: true; approvalId: string } | { pendingApproval: false; bank: unknown }> {
  if (dualControl() && await needsApproval(input.id, input.data)) {
    const approval = await requestApproval({
      type: 'DEPOSIT_ACCOUNT_CHANGE',
      payload: { id: input.id, data: input.data },
      reason: input.reason.length >= 10 ? input.reason : `Deposit account change: ${input.reason}`,
      requestedById: input.staffId,
      subjectType: 'PlatformBankAccount',
      subjectId: input.id ?? undefined,
      permissions: input.permissions,
      req: input.req,
    });
    return { pendingApproval: true, approvalId: approval.id };
  }
  return { pendingApproval: false, bank: await applyDepositAccountChange(input.id, input.data, input.staffId, input.reason, input.req) };
}

registerApprovalHandler('DEPOSIT_ACCOUNT_CHANGE', {
  requestPermission: 'treasury.operate',
  approvePermission: 'treasury.operate',
  validate: (payload) => {
    if (!payload || typeof payload !== 'object' || !payload.data) throw new AppError('Invalid deposit account change', 400);
    if (!payload.id && (!payload.data.bankName || !payload.data.accountName || !payload.data.currency || !payload.data.country)) {
      throw new AppError('A new deposit account needs bank, account name, currency and country', 400);
    }
  },
  execute: async (payload, ctx) => {
    const row = await applyDepositAccountChange(payload.id ?? null, payload.data, ctx.approvedById, `${ctx.reason} (requested by ${ctx.requestedById})`);
    return { id: row.id, bankName: row.bankName, currency: row.currency, isActive: row.isActive };
  },
});
