/**
 * Security event log for the security operations view. Writes are
 * fire-and-forget: a logging failure must never fail the request it describes.
 */
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

export type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'MFA_FAILURE'
  | 'RATE_LIMITED'
  | 'ADMIN_LOGIN'
  | 'PERMISSION_CHANGE'
  | 'WEBHOOK_REJECTED'
  | 'STEP_UP_FAILED'
  | 'NEW_DEVICE'
  | 'SESSION_REVOKED'
  | 'ACCESS_DENIED'
  | 'CONTROL_CHANGED';

export async function recordSecurityEvent(event: {
  type: SecurityEventType;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string | null;
  ipAddress?: string | null;
  path?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: event.type,
        severity: event.severity ?? 'LOW',
        userId: event.userId ?? null,
        ipAddress: event.ipAddress ?? null,
        path: event.path ?? null,
        details: (event.details ?? undefined) as any,
      },
    });
  } catch (err) {
    logger.warn('[security-event] write failed', { type: event.type, err: (err as Error).message });
  }
}
