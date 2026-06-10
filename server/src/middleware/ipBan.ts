// IP ban list — Redis-backed when REDIS_URL is configured, so strikes and
// bans are shared across cluster workers and survive deploys. A local
// in-memory mirror keeps the per-request check synchronous (no Redis
// round-trip on the hot path); the mirror is refreshed in the background.
// Without Redis, behaviour degrades to the previous per-process store.
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

const bannedIPs = new Set<string>();
const strikeMap = new Map<string, { count: number; firstStrike: number }>();

const STRIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_STRIKES = 5;
const BAN_TTL_SECONDS = 24 * 60 * 60;    // bans auto-expire after 24h
const REFRESH_INTERVAL_MS = 30 * 1000;

const BAN_SET_KEY = 'ipban:banned';
const strikeKey = (ip: string) => `ipban:strikes:${ip}`;

// ── Background mirror refresh ────────────────────────────────────────
let refreshTimer: NodeJS.Timeout | null = null;

async function refreshBanMirror(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const members = await client.sMembers(BAN_SET_KEY);
    bannedIPs.clear();
    for (const ip of members) bannedIPs.add(ip);
  } catch (err) {
    logger.warn('[ipBan] mirror refresh failed', { err });
  }
}

function ensureRefreshLoop(): void {
  if (refreshTimer || !process.env.REDIS_URL?.trim()) return;
  refreshTimer = setInterval(refreshBanMirror, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
}

// ── Strike / ban API (sync signatures, Redis writes fire-and-forget) ─

export function recordStrike(ip: string): void {
  if (!ip) return;
  ensureRefreshLoop();

  const client = getRedisClient();
  if (client) {
    (async () => {
      try {
        const count = await client.incr(strikeKey(ip));
        if (count === 1) await client.expire(strikeKey(ip), STRIKE_WINDOW_MS / 1000);
        if (count >= MAX_STRIKES) {
          await client.sAdd(BAN_SET_KEY, ip);
          await client.expire(BAN_SET_KEY, BAN_TTL_SECONDS);
          bannedIPs.add(ip);
          logger.warn('[ipBan] banned IP after repeated strikes', { ip, count });
        }
      } catch (err) {
        logger.warn('[ipBan] redis strike failed — falling back to local', { err });
        recordStrikeLocal(ip);
      }
    })();
    return;
  }
  recordStrikeLocal(ip);
}

function recordStrikeLocal(ip: string): void {
  const now = Date.now();
  const existing = strikeMap.get(ip);
  if (!existing || now - existing.firstStrike > STRIKE_WINDOW_MS) {
    strikeMap.set(ip, { count: 1, firstStrike: now });
  } else {
    existing.count += 1;
    if (existing.count >= MAX_STRIKES) {
      bannedIPs.add(ip);
    }
  }
}

export function banIP(ip: string): void {
  bannedIPs.add(ip);
  const client = getRedisClient();
  if (client) {
    client.sAdd(BAN_SET_KEY, ip).catch((err) =>
      logger.warn('[ipBan] redis ban failed', { ip, err }));
  }
}

export function unbanIP(ip: string): void {
  bannedIPs.delete(ip);
  strikeMap.delete(ip);
  const client = getRedisClient();
  if (client) {
    Promise.all([client.sRem(BAN_SET_KEY, ip), client.del(strikeKey(ip))])
      .catch((err) => logger.warn('[ipBan] redis unban failed', { ip, err }));
  }
}

export function ipBanMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow simulator/load-test traffic through in non-production environments.
  if (process.env.NODE_ENV !== 'production' && req.headers['x-simulator'] === 'true') {
    next();
    return;
  }
  ensureRefreshLoop();
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (bannedIPs.has(ip)) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
}
