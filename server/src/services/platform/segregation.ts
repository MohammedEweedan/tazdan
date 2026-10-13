/**
 * Segregation of duties for staff actions.
 *
 * Staff accounts are ordinary users too: they can hold wallets, make
 * deposits and request withdrawals. A staff member must never be the person
 * who confirms their own deposit, releases their own withdrawal, approves
 * their own KYC or credit, or decides a dispute, case or approval in which
 * they are the customer. Those actions go to a colleague.
 */
import { AppError } from '../../middleware/errorHandler';
import { recordSecurityEvent } from './securityEvents';

export function isSelf(actorId: string | undefined | null, subjectUserIds: Array<string | null | undefined>): boolean {
  return Boolean(actorId) && subjectUserIds.some((id) => Boolean(id) && id === actorId);
}

/** Refuse (403) when the acting staff member is one of the subjects. */
export function assertNotSelf(
  actorId: string | undefined | null,
  subjectUserIds: Array<string | null | undefined>,
  action: string,
  meta: { ipAddress?: string | null; path?: string | null } = {},
): void {
  if (!isSelf(actorId, subjectUserIds)) return;
  void recordSecurityEvent({
    type: 'ACCESS_DENIED', severity: 'HIGH', userId: actorId ?? null,
    ipAddress: meta.ipAddress ?? null, path: meta.path ?? null,
    details: { reason: 'segregation_of_duties', action },
  });
  throw new AppError(
    'Staff cannot perform this action on their own account. Another staff member must do it (segregation of duties).',
    403,
    'AUTHORIZATION',
  );
}
