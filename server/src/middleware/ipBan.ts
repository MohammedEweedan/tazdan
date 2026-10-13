// IP ban list — Redis-backed when REDIS_URL is configured, so strikes and
// bans are shared across cluster workers and survive deploys. A local
// in-memory mirror keeps the per-request check synchronous (no Redis
// round-trip on the hot path); the mirror is refreshed in the background.
// Without Redis, behaviour degrades to the previous per-process store.
//
// Addresses are keyed like the rate limiters (clientIpKey): IPv4-mapped
// IPv6 folded, IPv6 per /64 — so rotating addresses inside one subscriber
// prefix neither dodges a ban nor gets a fresh strike count. Each ban
// expires on its own (sorted set scored by expiry); the old single SET had
// one TTL that every new ban pushed back, so bans could outlive their 24h.
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { clientIpKey } from '../utils/clientIp';

const bannedIPs = new Map<string, number>(); // key → ban expiry (ms)
const strikeMap = new Map<string, { count: number; firstStrike: number }>();

const STRIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_STRIKES = 5;
const BAN_TTL_SECONDS = 24 * 60 * 60;    // bans auto-expire after 24h
const REFRESH_INTERVAL_MS = 30 * 1000;
const LOCAL_MAX = 100_000;

const BAN_ZSET_KEY = 'ipban:banned:z';
const strikeKey = (key: string) => `ipban:strikes:${key}`;

// ── Background mirror refresh ────────────────────────────────────────
let refreshTimer: NodeJS.Timeout | null = null;

async function refreshBanMirror(): Promise<void> {
  const client = getRedisClient();
  if (!client) return;
  try {
    const now = Date.now();
    await client.zRemRangeByScore(BAN_ZSET_KEY, '-inf', now);
    const members = await client.zRangeWithScores(BAN_ZSET_KEY, 0, -1);
    // Keep local-only bans made while Redis was unreachable; refresh the rest.
    for (const [k, exp] of bannedIPs) if (exp <= now) bannedIPs.delete(k);
    for (const m of members) bannedIPs.set(m.value, m.score);
  } catch (err) {
    logger.warn('[ipBan] mirror refresh failed', { err });
  }
}

function ensureRefreshLoop(): void {
  if (refreshTimer || !process.env.REDIS_URL?.trim()) return;
  refreshTimer = setInterval(refreshBanMirror, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
}

function banLocal(key: string, expiresAt: number): void {
  if (bannedIPs.size >= LOCAL_MAX) {
    const now = Date.now();
    for (const [k, exp] of bannedIPs) if (exp <= now) bannedIPs.delete(k);
  }
  bannedIPs.set(key, expiresAt);
}

// ── Strike / ban API (sync signatures, Redis writes fire-and-forget) ─

export function recordStrike(ip: string): void {
  if (!ip) return;
  ensureRefreshLoop();
  const key = clientIpKey(ip);

  const client = getRedisClient();
  if (client) {
    (async () => {
      try {
        const replies = await client
          .multi()
          .set(strikeKey(key), '0', { expiration: { type: 'EX', value: STRIKE_WINDOW_MS / 1000 }, condition: 'NX' })
          .incr(strikeKey(key))
          .exec();
        const count = Number(replies?.[1]);
        if (count >= MAX_STRIKES) {
          const expiresAt = Date.now() + BAN_TTL_SECONDS * 1000;
          await client.zAdd(BAN_ZSET_KEY, { score: expiresAt, value: key });
          banLocal(key, expiresAt);
          logger.warn('[ipBan] banned IP after repeated strikes', { ip: key, count });
        }
      } catch (err) {
        logger.warn('[ipBan] redis strike failed — falling back to local', { err });
        recordStrikeLocal(key);
      }
    })();
    return;
  }
  recordStrikeLocal(key);
}

function recordStrikeLocal(key: string): void {
  const now = Date.now();
  const existing = strikeMap.get(key);
  if (!existing || now - existing.firstStrike > STRIKE_WINDOW_MS) {
    if (strikeMap.size >= LOCAL_MAX) {
      for (const [k, v] of strikeMap) if (now - v.firstStrike > STRIKE_WINDOW_MS) strikeMap.delete(k);
    }
    strikeMap.set(key, { count: 1, firstStrike: now });
  } else {
    existing.count += 1;
    if (existing.count >= MAX_STRIKES) banLocal(key, now + BAN_TTL_SECONDS * 1000);
  }
}

export function banIP(ip: string): void {
  const key = clientIpKey(ip);
  const expiresAt = Date.now() + BAN_TTL_SECONDS * 1000;
  banLocal(key, expiresAt);
  const client = getRedisClient();
  if (client) {
    client.zAdd(BAN_ZSET_KEY, { score: expiresAt, value: key }).catch((err) =>
      logger.warn('[ipBan] redis ban failed', { ip: key, err }));
  }
}

export function unbanIP(ip: string): void {
  const key = clientIpKey(ip);
  bannedIPs.delete(key);
  strikeMap.delete(key);
  const client = getRedisClient();
  if (client) {
    Promise.all([client.zRem(BAN_ZSET_KEY, key), client.del(strikeKey(key)), client.sRem('ipban:banned', ip)])
      .catch((err) => logger.warn('[ipBan] redis unban failed', { ip: key, err }));
  }
}

export function isIpBanned(ip: string): boolean {
  const key = clientIpKey(ip);
  const exp = bannedIPs.get(key);
  if (!exp) return false;
  if (exp <= Date.now()) { bannedIPs.delete(key); return false; }
  return true;
}

export function ipBanMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow simulator/load-test traffic through in non-production environments.
  if (process.env.NODE_ENV !== 'production' && req.headers['x-simulator'] === 'true') {
    next();
    return;
  }
  ensureRefreshLoop();
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (isIpBanned(ip)) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
}
