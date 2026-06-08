import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { emitDiscussion } from '../utils/realtime';

const TAGS = new Set(['BULLISH', 'BEARISH', 'WATCH']);
const EMOJI_AVATARS = ['🟦', '🟩', '🟧', '🟪', '🟨', '💎', '🚀', '⚡', '🌙', '🔥', '🧠', '🪙', '📈', '🛡️'];

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

function looksLikeUrl(v?: string | null): boolean {
  if (!v) return false;
  return /^https?:\/\//i.test(v) || v.startsWith('/') || v.includes('://');
}

function looksLikeEmoji(v?: string | null): boolean {
  if (!v || looksLikeUrl(v)) return false;
  return /[^\u0020-\u007E]/.test(v);
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function emojiForUser(user: any): string {
  const stored = String(user.avatarEmoji ?? user.avatarUrl ?? '').trim();
  if (looksLikeEmoji(stored)) return stored;
  const seed = String(user.id ?? user.username ?? user.firstName ?? 'trader');
  return EMOJI_AVATARS[hashSeed(seed) % EMOJI_AVATARS.length];
}

const postInclude = {
  user: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
    },
  },
  _count: { select: { replies: true } },
} as const;

const replyInclude = postInclude;

function shapePost(row: any, viewerId?: string | null) {
  const user = row.user ?? {};
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const likedBy: string[] = Array.isArray(row.likedBy) ? row.likedBy : [];
  const replies = Array.isArray(row.replies)
    ? row.replies.map((reply: any) => shapePost(reply, viewerId))
    : undefined;
  return {
    id: row.id,
    symbol: row.symbol,
    parentId: row.parentId ?? null,
    body: row.body,
    tag: row.tag,
    createdAt: row.createdAt,
    likeCount: Number(row.likeCount ?? likedBy.length ?? 0),
    likedByMe: viewerId ? likedBy.includes(viewerId) : false,
    replyCount: Number(row._count?.replies ?? replies?.length ?? 0),
    replies,
    author: {
      id: user.id,
      username: user.username,
      displayName: user.username ? `@${user.username}` : name || 'Trader',
      avatarUrl: looksLikeUrl(user.avatarUrl) ? user.avatarUrl : null,
      avatarEmoji: emojiForUser(user),
    },
  };
}

async function loadPostForShape(id: string, viewerId?: string | null) {
  const row = await (prisma as any).assetDiscussionPost.findUnique({
    where: { id },
    include: {
      ...postInclude,
      replies: {
        where: { deletedAt: null, hiddenByMod: false },
        orderBy: { createdAt: 'asc' },
        take: 3,
        include: replyInclude,
      },
    },
  });
  return row ? shapePost(row, viewerId) : null;
}

export class AssetDiscussionController {
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const symbol = cleanSymbol(req.params.symbol);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 50);
      const rows = await (prisma as any).assetDiscussionPost.findMany({
        where: { symbol, parentId: null, deletedAt: null, hiddenByMod: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          ...postInclude,
          replies: {
            where: { deletedAt: null, hiddenByMod: false },
            orderBy: { createdAt: 'asc' },
            take: 3,
            include: replyInclude,
          },
        },
      });
      res.json({ posts: rows.map((row: any) => shapePost(row, req.user?.id)) });
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
          ...postInclude,
        },
      });
      const post = shapePost(row, req.user.id);
      emitDiscussion(req, symbol, 'discussion:new', { post });
      res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async reply(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const symbol = cleanSymbol(req.params.symbol);
      const parentId = String(req.params.id ?? '');
      const body = cleanBody(req.body?.body);
      const parent = await (prisma as any).assetDiscussionPost.findUnique({ where: { id: parentId } });
      if (!parent || parent.deletedAt || parent.hiddenByMod || parent.symbol !== symbol) {
        throw new AppError('Post not found', 404);
      }
      const row = await (prisma as any).assetDiscussionPost.create({
        data: {
          symbol,
          body,
          tag: parent.tag ?? 'WATCH',
          userId: req.user.id,
          parentId,
        },
        include: replyInclude,
      });
      const reply = shapePost(row, req.user.id);
      const parentPost = await loadPostForShape(parentId, req.user.id);
      emitDiscussion(req, symbol, 'discussion:new', { post: reply });
      if (parentPost) emitDiscussion(req, symbol, 'discussion:updated', { post: parentPost });
      res.status(201).json({ reply, post: parentPost });
    } catch (err) {
      next(err);
    }
  }

  static async toggleLike(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Authentication required', 401);
      const symbol = cleanSymbol(req.params.symbol);
      const id = String(req.params.id ?? '');
      const post = await (prisma as any).assetDiscussionPost.findUnique({ where: { id } });
      if (!post || post.deletedAt || post.hiddenByMod || post.symbol !== symbol) {
        throw new AppError('Post not found', 404);
      }
      const likedBy: string[] = Array.isArray(post.likedBy) ? post.likedBy : [];
      const liked = likedBy.includes(req.user.id);
      const nextLikedBy = liked ? likedBy.filter((uid) => uid !== req.user!.id) : [...likedBy, req.user.id];
      await (prisma as any).assetDiscussionPost.update({
        where: { id },
        data: {
          likedBy: nextLikedBy,
          likeCount: nextLikedBy.length,
        },
      });
      const shaped = await loadPostForShape(id, req.user.id);
      if (shaped) emitDiscussion(req, symbol, 'discussion:updated', { post: shaped });
      res.json({ post: shaped });
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
      if (post.parentId) {
        const parentPost = await loadPostForShape(post.parentId, req.user.id);
        if (parentPost) emitDiscussion(req, post.symbol, 'discussion:updated', { post: parentPost });
      }
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
      res.json({ posts: rows.map((r: any) => ({ ...shapePost(r, req.user?.id), reportCount: r.reportCount, hiddenByMod: r.hiddenByMod })) });
    } catch (err) {
      next(err);
    }
  }
}
