/**
 * Can this person receive a payment from that sender?
 *
 * One rule set for every person-to-person path (transfers by handle/email/
 * phone, the Send screen and chat payments): the transfer endpoints enforce it
 * server-side, and GET /api/transactions/recipient-check lets the app ask
 * before the customer types an amount.
 *
 * The answer never says WHY a recipient is unavailable — suspended, banned,
 * closed, unverified signup or a compliance hold all read the same, and an
 * unknown id reads the same as all of them, so the check cannot be used to
 * learn another customer's account status or to enumerate ids.
 */
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { isBlocked } from '../platform/controls.service';

export type RecipientReason = 'SELF' | 'UNAVAILABLE';
export type RecipientCheck = { canReceive: true } | { canReceive: false; reason: RecipientReason };

/** House accounts hold platform money for presentation; customers never pay them. */
const HOUSE_USERNAMES = new Set(['platform', 'support']);

export const RECIPIENT_UNAVAILABLE_MESSAGE = 'This person can’t receive payments right now.';

export async function checkRecipient(
  senderId: string,
  recipientId: string,
  opts: { currency?: string | null } = {},
): Promise<RecipientCheck> {
  if (!recipientId) return { canReceive: false, reason: 'UNAVAILABLE' };
  if (recipientId === senderId) return { canReceive: false, reason: 'SELF' };
  const user = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { status: true, username: true },
  });
  if (!user || user.status !== 'ACTIVE') return { canReceive: false, reason: 'UNAVAILABLE' };
  if (user.username && HOUSE_USERNAMES.has(user.username.toLowerCase())) return { canReceive: false, reason: 'UNAVAILABLE' };
  // Compliance holds set from the cockpit: the whole customer, their
  // transfers, or the wallet the money would land in.
  if (await isBlocked('USER', recipientId)) return { canReceive: false, reason: 'UNAVAILABLE' };
  if (await isBlocked('USER', `${recipientId}:transfers`)) return { canReceive: false, reason: 'UNAVAILABLE' };
  if (opts.currency && (await isBlocked('WALLET', `${recipientId}:${opts.currency.toUpperCase()}`))) {
    return { canReceive: false, reason: 'UNAVAILABLE' };
  }
  return { canReceive: true };
}

/** Throw the customer-facing refusal (400) when the recipient cannot receive. */
export async function assertRecipientCanReceive(
  senderId: string,
  recipientId: string,
  opts: { currency?: string | null } = {},
): Promise<void> {
  const check = await checkRecipient(senderId, recipientId, opts);
  if (check.canReceive) return;
  if (check.reason === 'SELF') throw new AppError('Cannot transfer to yourself', 400, 'VALIDATION', { reason: 'SELF' });
  throw new AppError(RECIPIENT_UNAVAILABLE_MESSAGE, 400, 'VALIDATION', { reason: 'UNAVAILABLE' });
}
