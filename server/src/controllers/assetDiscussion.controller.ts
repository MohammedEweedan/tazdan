import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

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
        where: { symbol, deletedAt: null },
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
      res.status(201).json({ post: shapePost(row) });
    } catch (err) {
      next(err);
    }
  }
}
