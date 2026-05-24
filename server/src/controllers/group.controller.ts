/**
 * GroupController — multi-party chats with optional liquidity pools.
 *
 * Separate from MessageController (which handles 1-to-1 DMs) — keeps
 * DM behaviour pristine and lets group concerns evolve independently.
 *
 * Real-time: every mutation emits a Socket.IO event into each member's
 * personal room (`user:{id}`) so connected clients update instantly.
 * The event names are namespaced: `group:created`, `group:updated`,
 * `group:member-added`, `group:member-removed`, `group:message`,
 * `group:message-edited`, `group:message-deleted`, `group:dissolved`.
 *
 * Permissions: each member has a role (OWNER / ADMIN / MEMBER) plus
 * an optional `permissions` JSON for granular overrides. The helper
 * `can()` resolves a permission key against both — overrides win,
 * then role defaults.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Server as IOServer } from 'socket.io';

import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const EDIT_WINDOW_MS = 5 * 60_000;

// ── Permission helpers ─────────────────────────────────────────────

type PermKey =
  | 'canInvite'
  | 'canRemove'
  | 'canRename'
  | 'canManagePool'
  | 'canPinMessage';

const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  OWNER:  { canInvite: true,  canRemove: true,  canRename: true,  canManagePool: true,  canPinMessage: true  },
  ADMIN:  { canInvite: true,  canRemove: true,  canRename: true,  canManagePool: true,  canPinMessage: true  },
  MEMBER: { canInvite: false, canRemove: false, canRename: false, canManagePool: false, canPinMessage: false },
};

function can(role: string, overrides: any | null | undefined, key: PermKey): boolean {
  if (overrides && typeof overrides === 'object' && key in overrides) {
    return Boolean(overrides[key]);
  }
  return ROLE_DEFAULTS[role]?.[key] ?? false;
}

// ── Realtime emit ──────────────────────────────────────────────────

function emit(req: AuthRequest, userIds: string[], event: string, payload: any) {
  const io = req.app.get('io') as IOServer | undefined;
  if (!io) return;
  for (const uid of new Set(userIds)) io.to(`user:${uid}`).emit(event, payload);
}

// ── Wire shapes ────────────────────────────────────────────────────

function groupToWire(g: any) {
  return {
    id:           g.id,
    name:         g.name,
    description:  g.description ?? null,
    avatarUrl:    g.avatarUrl ?? null,
    createdById:  g.createdById,
    dissolvedAt:  g.dissolvedAt ?? null,
    createdAt:    g.createdAt,
    updatedAt:    g.updatedAt,
    members:      Array.isArray(g.members) ? g.members.map(memberToWire) : undefined,
    pool:         g.pool ? poolToWire(g.pool) : null,
    lastMessage:  g.messages?.[0] ? messageToWire(g.messages[0]) : null,
    unreadCount:  typeof g._unreadCount === 'number' ? g._unreadCount : undefined,
  };
}

function memberToWire(m: any) {
  return {
    id:         m.id,
    userId:     m.userId,
    role:       m.role,
    permissions: m.permissions ?? null,
    joinedAt:   m.joinedAt,
    leftAt:     m.leftAt ?? null,
    lastReadAt: m.lastReadAt ?? null,
    user: m.user ? {
      id:        m.user.id,
      username:  m.user.username ?? null,
      firstName: m.user.firstName,
      lastName:  m.user.lastName,
      avatarUrl: m.user.avatarUrl ?? null,
    } : undefined,
  };
}

function messageToWire(m: any) {
  return {
    id:            m.id,
    groupId:       m.groupId,
    senderId:      m.senderId,
    type:          m.type,
    content:       m.deletedAt ? '' : m.content,
    attachmentUrl: m.deletedAt ? null : (m.attachmentUrl ?? null),
    metadata:      m.metadata ?? null,
    replyToId:     m.replyToId ?? null,
    editedAt:      m.editedAt ?? null,
    deletedAt:     m.deletedAt ?? null,
    createdAt:     m.createdAt,
  };
}

function poolToWire(p: any) {
  return {
    id:              p.id,
    groupId:         p.groupId,
    name:            p.name,
    kind:            p.kind,
    status:          p.status,
    targetAmountUsd: p.targetAmountUsd ? String(p.targetAmountUsd) : null,
    deadline:        p.deadline ?? null,
    totalBalanceUsd: String(p.totalBalanceUsd),
    createdById:     p.createdById,
    createdAt:       p.createdAt,
    members:         Array.isArray(p.members) ? p.members.map((m: any) => ({
      id: m.id, userId: m.userId,
      totalContributedUsd: String(m.totalContributedUsd),
      totalWithdrawnUsd:   String(m.totalWithdrawnUsd),
      joinedAt: m.joinedAt,
    })) : undefined,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

async function loadMembership(groupId: string, userId: string) {
  const m = await (prisma as any).groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
  if (!m || m.leftAt) throw new AppError('Not a member of this group', 403);
  if (m.group.dissolvedAt) throw new AppError('Group has been dissolved', 410);
  return m;
}

async function memberUserIds(groupId: string): Promise<string[]> {
  const rows = await (prisma as any).groupMember.findMany({
    where: { groupId, leftAt: null },
    select: { userId: true },
  });
  return rows.map((r: any) => r.userId);
}

// ── Validation schemas ─────────────────────────────────────────────

const createGroupSchema = z.object({
  name:        z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  avatarUrl:   z.string().url().optional(),
  memberIds:   z.array(z.string().uuid()).min(1).max(48), // 1+ initial members in addition to creator
  pool:        z.object({
    name:            z.string().min(1).max(80),
    kind:            z.enum(['SHARED_WALLET', 'GOAL_BASED']),
    targetAmountUsd: z.number().positive().optional(),
    deadline:        z.string().datetime().optional(),
  }).optional(),
});

const renameGroupSchema = z.object({
  name:        z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  avatarUrl:   z.string().url().nullable().optional(),
});

const sendMessageSchema = z.object({
  content:   z.string().max(4_000).optional().default(''),
  replyToId: z.string().uuid().optional(),
});

const updateRoleSchema = z.object({
  role:        z.enum(['ADMIN', 'MEMBER']),
  permissions: z.record(z.boolean()).optional().nullable(),
});

// ── Controller methods ─────────────────────────────────────────────

export const GroupController = {
  /** POST /api/groups — create a new group, optionally with a pool. */
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const parsed = createGroupSchema.parse(req.body);

      // Dedup + drop me from incoming list (I'm added below as OWNER).
      const others = Array.from(new Set(parsed.memberIds.filter((id) => id !== me)));
      if (others.length === 0) throw new AppError('Add at least one other member', 400);

      // Sanity: every memberId must exist.
      const found = await prisma.user.findMany({
        where: { id: { in: others } },
        select: { id: true },
      });
      if (found.length !== others.length) {
        throw new AppError('One or more invited users do not exist', 400);
      }

      // Goal-based pool requires a target amount.
      if (parsed.pool?.kind === 'GOAL_BASED' && !parsed.pool.targetAmountUsd) {
        throw new AppError('Goal-based pools require a target amount', 400);
      }

      const group = await prisma.$transaction(async (tx: any) => {
        const g = await tx.groupChat.create({
          data: {
            name:        parsed.name,
            description: parsed.description ?? null,
            avatarUrl:   parsed.avatarUrl ?? null,
            createdById: me,
            members: {
              create: [
                { userId: me,   role: 'OWNER' },
                ...others.map((uid) => ({ userId: uid, role: 'MEMBER' as const })),
              ],
            },
          },
          include: {
            members: { include: { user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } } },
          },
        });

        let pool: any = null;
        if (parsed.pool) {
          pool = await tx.liquidityPool.create({
            data: {
              groupId:         g.id,
              name:            parsed.pool.name,
              kind:            parsed.pool.kind,
              status:          parsed.pool.kind === 'GOAL_BASED' ? 'LOCKED' : 'OPEN',
              targetAmountUsd: parsed.pool.targetAmountUsd ?? null,
              deadline:        parsed.pool.deadline ? new Date(parsed.pool.deadline) : null,
              createdById:     me,
              // Pool members mirror group members on creation.
              members: { create: [me, ...others].map((uid) => ({ userId: uid })) },
            },
            include: { members: true },
          });

          // POOL_CREATED system message so the timeline shows it.
          await tx.groupMessage.create({
            data: {
              groupId: g.id,
              senderId: me,
              type: 'POOL_CREATED',
              content: '',
              metadata: { poolId: pool.id, name: pool.name, kind: pool.kind },
            },
          });
        }

        return { g, pool };
      });

      const payload = groupToWire({ ...group.g, pool: group.pool });
      emit(req, [me, ...others], 'group:created', payload);
      res.status(201).json({ group: payload });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/groups — list my groups with last message + unread count. */
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const memberships = await (prisma as any).groupMember.findMany({
        where: { userId: me, leftAt: null },
        select: { groupId: true, lastReadAt: true },
      });
      const groupIds = memberships.map((m: any) => m.groupId);
      if (groupIds.length === 0) return res.json({ groups: [] });

      const groups = await (prisma as any).groupChat.findMany({
        where: { id: { in: groupIds } },
        include: {
          pool: { include: { members: true } },
          members: { include: { user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Cheap per-group unread count — count messages after this user's lastReadAt.
      const readAtMap = new Map<string, Date | null>(
        memberships.map((m: any) => [m.groupId, m.lastReadAt]),
      );
      const unreadCounts = await Promise.all(
        groups.map(async (g: any) => {
          const after = readAtMap.get(g.id);
          const count = await (prisma as any).groupMessage.count({
            where: {
              groupId: g.id,
              senderId: { not: me },
              createdAt: after ? { gt: after } : undefined,
            },
          });
          return [g.id, count] as const;
        }),
      );
      const unreadMap = new Map(unreadCounts);

      res.json({
        groups: groups.map((g: any) =>
          groupToWire({ ...g, _unreadCount: unreadMap.get(g.id) ?? 0 }),
        ),
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/groups/:id — full group detail. */
  async getOne(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      await loadMembership(groupId, me);

      const g = await (prisma as any).groupChat.findUnique({
        where: { id: groupId },
        include: {
          pool: { include: { members: true } },
          members: {
            where: { leftAt: null },
            include: { user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
          },
        },
      });
      if (!g) throw new AppError('Group not found', 404);
      res.json({ group: groupToWire(g) });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/groups/:id — rename / change description / avatar. */
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const parsed = renameGroupSchema.parse(req.body);
      const membership = await loadMembership(groupId, me);
      if (!can(membership.role, membership.permissions, 'canRename')) {
        throw new AppError('You cannot edit this group', 403);
      }

      const updated = await (prisma as any).groupChat.update({
        where: { id: groupId },
        data: {
          ...(parsed.name        !== undefined ? { name: parsed.name } : {}),
          ...(parsed.description !== undefined ? { description: parsed.description } : {}),
          ...(parsed.avatarUrl   !== undefined ? { avatarUrl: parsed.avatarUrl } : {}),
        },
      });

      const ids = await memberUserIds(groupId);
      const payload = groupToWire(updated);
      emit(req, ids, 'group:updated', payload);
      res.json({ group: payload });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/groups/:id/members — add members. */
  async addMembers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const { userIds } = z.object({ userIds: z.array(z.string().uuid()).min(1).max(20) }).parse(req.body);
      const membership = await loadMembership(groupId, me);
      if (!can(membership.role, membership.permissions, 'canInvite')) {
        throw new AppError('You cannot add members to this group', 403);
      }

      // Filter out existing active members.
      const existing = await (prisma as any).groupMember.findMany({
        where: { groupId, userId: { in: userIds }, leftAt: null },
        select: { userId: true },
      });
      const existingIds = new Set(existing.map((m: any) => m.userId));
      const fresh = userIds.filter((id) => !existingIds.has(id));
      if (fresh.length === 0) return res.json({ added: [] });

      const created = await prisma.$transaction(
        fresh.map((uid) =>
          (prisma as any).groupMember.upsert({
            where: { groupId_userId: { groupId, userId: uid } },
            create: { groupId, userId: uid, role: 'MEMBER' },
            update: { leftAt: null, role: 'MEMBER' },
            include: { user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
          }),
        ),
      );

      // Add them to the pool too if one exists.
      const pool = await (prisma as any).liquidityPool.findUnique({ where: { groupId } });
      if (pool) {
        await prisma.$transaction(
          fresh.map((uid) =>
            (prisma as any).liquidityPoolMember.upsert({
              where: { poolId_userId: { poolId: pool.id, userId: uid } },
              create: { poolId: pool.id, userId: uid },
              update: {},
            }),
          ),
        );
      }

      const allIds = await memberUserIds(groupId);
      const wired = created.map(memberToWire);
      emit(req, allIds, 'group:member-added', { groupId, members: wired });
      res.status(201).json({ added: wired });
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/groups/:id/members/:userId — remove or self-leave. */
  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const targetId = req.params.userId;
      const membership = await loadMembership(groupId, me);

      const isSelf = me === targetId;
      if (!isSelf && !can(membership.role, membership.permissions, 'canRemove')) {
        throw new AppError('You cannot remove members from this group', 403);
      }

      const target = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetId } },
      });
      if (!target || target.leftAt) throw new AppError('Member not in group', 404);
      if (target.role === 'OWNER' && !isSelf) {
        throw new AppError('The owner cannot be removed', 400);
      }

      await (prisma as any).groupMember.update({
        where: { groupId_userId: { groupId, userId: targetId } },
        data:  { leftAt: new Date() },
      });

      const allIds = await memberUserIds(groupId);
      emit(req, [...allIds, targetId], 'group:member-removed', { groupId, userId: targetId, self: isSelf });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/groups/:id/members/:userId — promote/demote + permission overrides. */
  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const targetId = req.params.userId;
      const parsed = updateRoleSchema.parse(req.body);

      const membership = await loadMembership(groupId, me);
      // Only OWNER can change roles in v1.
      if (membership.role !== 'OWNER') throw new AppError('Only the owner can change roles', 403);
      if (targetId === me) throw new AppError('Cannot change your own role', 400);

      const target = await (prisma as any).groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetId } },
      });
      if (!target || target.leftAt) throw new AppError('Member not in group', 404);
      if (target.role === 'OWNER') throw new AppError('Cannot change the owner', 400);

      const updated = await (prisma as any).groupMember.update({
        where: { groupId_userId: { groupId, userId: targetId } },
        data: {
          role:        parsed.role,
          permissions: parsed.permissions === undefined ? target.permissions : parsed.permissions,
        },
        include: { user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } } },
      });

      const allIds = await memberUserIds(groupId);
      emit(req, allIds, 'group:member-updated', { groupId, member: memberToWire(updated) });
      res.json({ member: memberToWire(updated) });
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/groups/:id — dissolve the group (owner only). */
  async dissolve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const membership = await loadMembership(groupId, me);
      if (membership.role !== 'OWNER') throw new AppError('Only the owner can dissolve a group', 403);

      // If a pool exists with a non-zero balance, refuse — owner must
      // settle/close the pool first via the LP routes.
      const pool = await (prisma as any).liquidityPool.findUnique({ where: { groupId } });
      if (pool && Number(pool.totalBalanceUsd) > 0 && pool.status !== 'DISSOLVED' && pool.status !== 'COMPLETED') {
        throw new AppError('Settle the liquidity pool before dissolving the group', 400);
      }

      await (prisma as any).groupChat.update({
        where: { id: groupId },
        data:  { dissolvedAt: new Date() },
      });

      const allIds = await memberUserIds(groupId);
      emit(req, allIds, 'group:dissolved', { groupId });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/groups/:id/messages?before=&limit= — paginated history. */
  async listMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      await loadMembership(groupId, me);

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const before = req.query.before as string | undefined;
      const beforeDate = before ? new Date(before) : undefined;

      const messages = await (prisma as any).groupMessage.findMany({
        where: {
          groupId,
          ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({
        messages: messages.map(messageToWire),
        nextBefore: messages.length === limit ? messages[messages.length - 1].createdAt : null,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/groups/:id/messages — send text or image.
   *
   * The image case is handled via multer in the route (req.file). If a
   * file is attached we set type=IMAGE and attachmentUrl=/uploads/media/<file>.
   */
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      await loadMembership(groupId, me);

      const parsed = sendMessageSchema.parse(req.body ?? {});
      const file = (req as any).file as Express.Multer.File | undefined;

      const hasText = !!parsed.content && parsed.content.trim().length > 0;
      if (!hasText && !file) {
        throw new AppError('Message must include text or an image', 400);
      }

      const attachmentUrl = file ? `/uploads/media/${file.filename}` : null;
      const type = file ? 'IMAGE' : 'TEXT';

      const created = await (prisma as any).groupMessage.create({
        data: {
          groupId,
          senderId:      me,
          type,
          content:       parsed.content ?? '',
          attachmentUrl,
          replyToId:     parsed.replyToId ?? null,
        },
      });
      // Bump group.updatedAt so list ordering is fresh.
      await (prisma as any).groupChat.update({ where: { id: groupId }, data: { updatedAt: new Date() } });

      const allIds = await memberUserIds(groupId);
      const wire = messageToWire(created);
      emit(req, allIds, 'group:message', wire);
      res.status(201).json({ message: wire });
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/groups/:id/messages/:msgId — edit own TEXT message. */
  async editMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const msgId = req.params.msgId;
      const { content } = z.object({ content: z.string().min(1).max(4_000) }).parse(req.body);
      await loadMembership(groupId, me);

      const msg = await (prisma as any).groupMessage.findFirst({ where: { id: msgId, groupId } });
      if (!msg) throw new AppError('Message not found', 404);
      if (msg.senderId !== me) throw new AppError('Cannot edit someone else\'s message', 403);
      if (msg.type !== 'TEXT') throw new AppError('Only text messages can be edited', 400);
      if (msg.deletedAt) throw new AppError('Cannot edit a deleted message', 400);
      if (Date.now() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS) {
        throw new AppError('Edit window has expired', 400);
      }

      const updated = await (prisma as any).groupMessage.update({
        where: { id: msgId },
        data:  { content, editedAt: new Date() },
      });

      const allIds = await memberUserIds(groupId);
      const wire = messageToWire(updated);
      emit(req, allIds, 'group:message-edited', wire);
      res.json({ message: wire });
    } catch (err) {
      next(err);
    }
  },

  /** DELETE /api/groups/:id/messages/:msgId — soft-delete (sender or admin). */
  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      const msgId = req.params.msgId;
      const membership = await loadMembership(groupId, me);

      const msg = await (prisma as any).groupMessage.findFirst({ where: { id: msgId, groupId } });
      if (!msg) throw new AppError('Message not found', 404);

      const isMine = msg.senderId === me;
      const isAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
      if (!isMine && !isAdmin) throw new AppError('Cannot delete this message', 403);
      if (msg.deletedAt) return res.json({ ok: true });

      const updated = await (prisma as any).groupMessage.update({
        where: { id: msgId },
        data:  { deletedAt: new Date(), content: '', attachmentUrl: null },
      });

      const allIds = await memberUserIds(groupId);
      emit(req, allIds, 'group:message-deleted', { id: updated.id, groupId });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/groups/:id/read — mark all messages up to now as read for me. */
  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const groupId = req.params.id;
      await loadMembership(groupId, me);
      await (prisma as any).groupMember.update({
        where: { groupId_userId: { groupId, userId: me } },
        data:  { lastReadAt: new Date() },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
};
