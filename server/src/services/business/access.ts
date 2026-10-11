/**
 * Who may do what inside a business account.
 *
 * A business is a BusinessProfile owned by one user (BusinessProfile.userId),
 * whose wallets hold the business's money. Other people join as team members
 * (BusinessTeamMember) with a role. The owner always has an OWNER membership
 * row, created on first access for accounts that predate team support.
 */
import type { BusinessProfile } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';

export const TEAM_ROLES = ['OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type BusinessAction =
  | 'read'
  | 'profile.edit'
  | 'team.manage'
  | 'keys.manage'
  | 'webhooks.manage'
  | 'payouts.create'
  | 'payouts.approve'
  | 'kyb.submit';

const CAN: Record<BusinessAction, TeamRole[]> = {
  read: ['OWNER', 'ADMIN', 'ANALYST', 'DEVELOPER'],
  'profile.edit': ['OWNER', 'ADMIN'],
  'team.manage': ['OWNER', 'ADMIN'],
  'keys.manage': ['OWNER', 'ADMIN', 'DEVELOPER'],
  'webhooks.manage': ['OWNER', 'ADMIN', 'DEVELOPER'],
  'payouts.create': ['OWNER', 'ADMIN'],
  'payouts.approve': ['OWNER', 'ADMIN'],
  'kyb.submit': ['OWNER'],
};

export interface BusinessContext {
  business: BusinessProfile;
  role: TeamRole;
  memberId: string;
  userId: string;
}

/** Resolve the business the caller acts for (owner first, then membership). */
export async function resolveBusiness(userId: string): Promise<BusinessContext> {
  const owned = await prisma.businessProfile.findUnique({ where: { userId } });
  if (owned) {
    const member = await ensureOwnerMember(owned, userId);
    return { business: owned, role: 'OWNER', memberId: member.id, userId };
  }
  const membership = await prisma.businessTeamMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { business: true },
    orderBy: { joinedAt: 'asc' },
  });
  if (!membership) throw new AppError('This account is not a business account or team member', 403, 'AUTHORIZATION');
  return { business: membership.business, role: membership.role as TeamRole, memberId: membership.id, userId };
}

async function ensureOwnerMember(business: BusinessProfile, userId: string) {
  const existing = await prisma.businessTeamMember.findFirst({ where: { businessId: business.id, userId } });
  if (existing) return existing;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  return prisma.businessTeamMember.create({
    data: { businessId: business.id, userId, email: user.email.toLowerCase(), role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
  });
}

export function can(ctx: BusinessContext, action: BusinessAction): boolean {
  return CAN[action].includes(ctx.role);
}

export function assertCan(ctx: BusinessContext, action: BusinessAction): void {
  if (!can(ctx, action)) throw new AppError(`Your role (${ctx.role}) cannot do this`, 403, 'AUTHORIZATION');
}

/** Money can move only once the business is verified. */
export function assertKybApproved(business: BusinessProfile): void {
  if (business.kybStatus !== 'APPROVED') {
    throw new AppError('Business verification (KYB) must be approved before payouts can be sent', 403, 'COMPLIANCE_HOLD');
  }
}

/** Active OWNER/ADMIN members other than `exceptUserId` — possible second approvers. */
export async function otherApprovers(businessId: string, exceptUserId: string): Promise<number> {
  return prisma.businessTeamMember.count({
    where: { businessId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] }, userId: { not: exceptUserId } },
  });
}
