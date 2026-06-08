import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { emitDiscussion } from '../utils/realtime';

const TAGS = new Set(['BULLISH', 'BEARISH', 'WATCH']);

function cleanSymbol(input: unknown): string {
  const symbol = String(input ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (!symbol || symbol.length > 24) throw new AppError('Invalid asset symbol', 400);
  return symbol;
}

function cleanBody(input: unknown): string {
  const body = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!body) throw new AppError('Message is required', 400);
  if (body.length > 280) throw new AppError('Message is too long', 400);
  return body;
}

function cleanTag(input: unknown): 'BULLISH' | 'BEARISH' | 'WATCH' {
  const tag = String(input ?? 'WATCH').toUpperCase();
  return TAGS.has(tag) ? tag as 'BULLISH' | 'BEARISH' | 'WATCH' : 'WATCH';
}

function shapePost(row: any) {
  const user = row.user ?? {};
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    symbol: row.symbol,
    body: row.body,
    tag: row.tag,
    createdAt: row.createdAt,
    author: {
      id: user.id,
      username: user.username,
      displayName: user.username ? `@${user.username}` : name || 'Trader',
      avatarUrl: user.avatarUrl ?? null,
    },
  };
}

export class AssetDiscussionController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const symbol = cleanSymbol(req.params.symbol);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 50);
      const rows = await (prisma as any).assetDiscussionPost.findMany({
        where: { symbol, deletedAt: null, hiddenByMod: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
      res.json({ posts: rows.map(shapePost) });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const symbol = cleanSymbol(req.params.symbol);
      const body = cleanBody(req.body?.body);
      const tag = cleanTag(req.body?.tag);
      const row = await (prisma as any).assetDiscussionPost.create({
        data: {
          symbol,
          body,
          tag,
          userId: req.user.id,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
      const post = shapePost(row);
      emitDiscussion(req, symbol, 'discussion:new', { post });
      res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /:symbol/:id — author can delete their own post; admins any post. */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const id = String(req.params.id ?? '');
      const post = await (prisma as any).assetDiscussionPost.findUnique({ where: { id } });
      if (!post || post.deletedAt) throw new AppError('Post not found', 404);
      const isAuthor = post.userId === req.user.id;
      const isAdmin = req.user.role === 'ADMIN';
      if (!isAuthor && !isAdmin) throw new AppError('Not allowed', 403);
      await (prisma as any).assetDiscussionPost.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      emitDiscussion(req, post.symbol, 'discussion:removed', { id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /** POST /:symbol/:id/report — one report per user; auto-hide past threshold. */
  static async report(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const id = String(req.params.id ?? '');
      const post = await (prisma as any).assetDiscussionPost.findUnique({ where: { id } });
      if (!post || post.deletedAt) throw new AppError('Post not found', 404);
      const reportedBy: string[] = post.reportedBy ?? [];
      if (reportedBy.includes(req.user.id)) {
        return res.json({ ok: true, alreadyReported: true });
      }
      const nextReporters = [...reportedBy, req.user.id];
      const AUTO_HIDE_THRESHOLD = 3;
      await (prisma as any).assetDiscussionPost.update({
        where: { id },
        data: {
          reportedBy: nextReporters,
          reportCount: nextReporters.length,
          hiddenByMod: nextReporters.length >= AUTO_HIDE_THRESHOLD,
        },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /** GET /moderation/queue — admin: posts pending review (reported/hidden). */
  static async moderationQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'ADMIN') throw new AppError('Not allowed', 403);
      const rows = await (prisma as any).assetDiscussionPost.findMany({
        where: { deletedAt: null, reportCount: { gt: 0 } },
        orderBy: { reportCount: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });
      res.json({ posts: rows.map((r: any) => ({ ...shapePost(r), reportCount: r.reportCount, hiddenByMod: r.hiddenByMod })) });
    } catch (err) {
      next(err);
    }
  }
}
