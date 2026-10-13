/**
 * "Was this you?" emails for security changes. Sent to the account address
 * after the change, so a takeover that changes a credential is visible to the
 * real owner at once. Fire-and-forget: a mail failure never fails the change.
 */
import { prisma } from '../../utils/prisma';
import { sendEmail, emailErrorSummary } from '../email';
import { logger } from '../../utils/logger';

export type SecurityNoticeKind =
  | 'password_changed'
  | 'password_reset'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'two_factor_recovered';

const COPY: Record<SecurityNoticeKind, { subject: string; line: string }> = {
  password_changed: { subject: 'Your tazdan password was changed', line: 'The password for your tazdan account was just changed. Your other devices were signed out.' },
  password_reset: { subject: 'Your tazdan password was reset', line: 'The password for your tazdan account was just reset with a code sent to this address. Every device was signed out.' },
  two_factor_enabled: { subject: 'Two-factor authentication turned on', line: 'Two-factor authentication was just turned on for your tazdan account. From now on, security codes come from that authenticator app.' },
  two_factor_disabled: { subject: 'Two-factor authentication turned off', line: 'Two-factor authentication was just turned off for your tazdan account.' },
  two_factor_recovered: { subject: 'Two-factor authentication removed by recovery', line: 'Two-factor authentication was removed from your tazdan account using the recovery process. Every device was signed out.' },
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function sendSecurityNotice(userId: string, kind: SecurityNoticeKind, meta: { ip?: string | null } = {}): void {
  void (async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    if (!user?.email) return;
    const { subject, line } = COPY[kind];
    const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    await sendEmail({
      to: user.email,
      subject,
      sender: 'auth',
      html: `<p>Hi ${esc(user.firstName || 'there')},</p>
        <p>${esc(line)}</p>
        <p style="color:#666;font-size:13px">When: ${esc(when)}${meta.ip ? ` · From IP: ${esc(meta.ip)}` : ''}</p>
        <p><b>If this wasn't you</b>, reset your password from the sign-in screen now and contact support — someone may have access to your account.</p>`,
    });
  })().catch((err) => logger.warn('[security] notice email failed', { kind, err: emailErrorSummary(err) }));
}
