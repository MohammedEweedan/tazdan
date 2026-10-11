/**
 * Staff role-based access control for the Control Cockpit and the admin API.
 *
 * Staff are users with role ADMIN. What each one may do comes from
 * `User.staffRoles`. Permissions per role are defined here, in code, so a
 * change to who can move money goes through code review.
 *
 * Backward compatibility: an ADMIN with no staff roles is treated as
 * SUPER_ADMIN, so the existing mobile admin console keeps working. The
 * cockpit flags those accounts so they can be given explicit roles.
 */
import type { NextFunction, Response } from 'express';
import type { StaffRole } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import type { AuthRequest } from '../../types';
import { recordSecurityEvent } from './securityEvents';

export const PERMISSIONS = [
  'cockpit.view',
  'customers.read', 'customers.pii', 'customers.freeze', 'customers.limits',
  'customers.sessions.revoke', 'customers.kyc.review',
  'businesses.read', 'businesses.kyb.review',
  'transactions.read', 'ledger.read',
  'adjustments.request', 'adjustments.approve',
  'deposits.confirm', 'withdrawals.approve',
  'remittance.read', 'remittance.operate', 'remittance.refund.approve', 'remittance.configure',
  'fx.read', 'fx.override',
  'treasury.read', 'treasury.operate',
  'providers.read', 'providers.control',
  'recon.read', 'recon.run', 'recon.resolve',
  'compliance.read', 'compliance.case.manage', 'compliance.decide', 'watchlist.manage', 'rules.manage',
  'fraud.read', 'fraud.case.manage',
  'support.read', 'support.reply',
  'disputes.resolve',
  'finance.read', 'forecast.read',
  'system.read', 'security.read', 'audit.read',
  'controls.read', 'controls.operate',
  'staff.manage',
  'settings.manage',
  'ai.use', 'ai.approve',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = PERMISSIONS.filter((p) => p.endsWith('.read') || p === 'cockpit.view');

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  EXECUTIVE: [
    'cockpit.view', 'customers.read', 'businesses.read', 'transactions.read', 'remittance.read',
    'fx.read', 'treasury.read', 'providers.read', 'recon.read', 'compliance.read', 'fraud.read',
    'finance.read', 'forecast.read', 'system.read', 'security.read', 'audit.read', 'controls.read', 'ai.use',
  ],
  OPERATIONS: [
    'cockpit.view', 'customers.read', 'customers.pii', 'businesses.read', 'transactions.read', 'ledger.read',
    'deposits.confirm', 'withdrawals.approve', 'remittance.read', 'remittance.operate', 'providers.read',
    'providers.control', 'recon.read', 'recon.run', 'recon.resolve', 'support.read', 'controls.read',
    'controls.operate', 'system.read', 'fx.read', 'treasury.read', 'disputes.resolve', 'ai.use',
  ],
  FINANCE: [
    'cockpit.view', 'transactions.read', 'ledger.read', 'adjustments.request', 'adjustments.approve',
    'remittance.read', 'remittance.refund.approve', 'fx.read', 'treasury.read', 'recon.read', 'recon.run',
    'recon.resolve', 'finance.read', 'forecast.read', 'audit.read', 'businesses.read', 'ai.use',
  ],
  TREASURY: [
    'cockpit.view', 'ledger.read', 'remittance.read', 'fx.read', 'fx.override', 'treasury.read',
    'treasury.operate', 'providers.read', 'recon.read', 'finance.read', 'forecast.read', 'ai.use',
  ],
  COMPLIANCE: [
    'cockpit.view', 'customers.read', 'customers.pii', 'customers.freeze', 'customers.limits',
    'customers.kyc.review', 'businesses.read', 'businesses.kyb.review', 'transactions.read', 'remittance.read',
    'compliance.read', 'compliance.case.manage', 'compliance.decide', 'watchlist.manage', 'rules.manage',
    'fraud.read', 'fraud.case.manage', 'audit.read', 'controls.read', 'disputes.resolve', 'ai.use', 'ai.approve',
  ],
  AML_ANALYST: [
    'cockpit.view', 'customers.read', 'customers.pii', 'businesses.read', 'transactions.read', 'remittance.read',
    'compliance.read', 'compliance.case.manage', 'fraud.read', 'ai.use',
  ],
  FRAUD_ANALYST: [
    'cockpit.view', 'customers.read', 'transactions.read', 'remittance.read', 'fraud.read', 'fraud.case.manage',
    'compliance.read', 'customers.sessions.revoke', 'ai.use',
  ],
  SUPPORT: [
    'cockpit.view', 'customers.read', 'customers.pii', 'transactions.read', 'remittance.read',
    'support.read', 'support.reply', 'ai.use',
  ],
  SECURITY: [
    'cockpit.view', 'security.read', 'audit.read', 'customers.read', 'customers.sessions.revoke',
    'controls.read', 'controls.operate', 'system.read', 'providers.read',
  ],
  TECH_OPS: ['cockpit.view', 'system.read', 'providers.read', 'controls.read', 'security.read'],
  AUDITOR: READ_ALL,
};

export interface StaffContext {
  roles: StaffRole[];
  permissions: Set<Permission>;
  /** ADMIN without explicit roles — treated as SUPER_ADMIN. */
  implicitSuperAdmin: boolean;
}

export function permissionsFor(roles: StaffRole[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) out.add(p);
  return out;
}

const cache = new Map<string, { at: number; ctx: StaffContext | null }>();
const CACHE_MS = 60_000;

export function invalidateStaffCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function loadStaffContext(userId: string): Promise<StaffContext | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ctx;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, staffRoles: true },
  });
  let ctx: StaffContext | null = null;
  if (user && user.role === 'ADMIN' && user.status === 'ACTIVE') {
    const implicit = user.staffRoles.length === 0;
    const roles: StaffRole[] = implicit ? ['SUPER_ADMIN'] : user.staffRoles;
    ctx = { roles, permissions: permissionsFor(roles), implicitSuperAdmin: implicit };
  }
  cache.set(userId, { at: Date.now(), ctx });
  return ctx;
}

/**
 * Gate a route on one or more permissions (all required). Mount AFTER
 * `authenticate` and `requireAdmin`, which already re-check the account,
 * enforce staff 2FA in production and the optional IP allowlist.
 */
export function requirePermission(...needed: Permission[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError('Authentication required', 401));
    loadStaffContext(req.user.id)
      .then((ctx) => {
        if (!ctx) return next(new AppError('Staff access required', 403));
        req.staff = ctx;
        const missing = needed.filter((p) => !ctx.permissions.has(p));
        if (missing.length) {
          void recordSecurityEvent({
            type: 'ACCESS_DENIED',
            severity: 'MEDIUM',
            userId: req.user!.id,
            ipAddress: req.ip,
            path: req.originalUrl,
            details: { missing },
          });
          return next(new AppError(`Missing permission: ${missing.join(', ')}`, 403, 'AUTHORIZATION'));
        }
        next();
      })
      .catch(next);
  };
}

export function hasPermission(req: AuthRequest, permission: Permission): boolean {
  return Boolean(req.staff?.permissions.has(permission));
}
