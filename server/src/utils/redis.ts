import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL?.trim();

let client: RedisClientType | null = null;
let ready = false;

function getClient() {
  return client && ready ? client : null;
}

export function getRedisClient() {
  return getClient();
}

export async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    logger.info('[redis] disabled: no REDIS_URL configured');
    return;
  }
  if (client) return;

  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        return Math.min(Math.max(retries, 1) * 100, 5000);
      },
    },
  });

  client.on('error', (error) => {
    logger.error('[redis] error', { err: error });
    ready = false;
  });
  client.on('ready', () => {
    ready = true;
    logger.info('[redis] ready');
  });
  client.on('end', () => {
    ready = false;
    logger.warn('[redis] connection closed');
  });
  client.on('reconnecting', () => {
    ready = false;
    logger.warn('[redis] reconnecting');
  });

  try {
    await client.connect();
  } catch (error) {
    logger.error('[redis] connection failed', { err: error });
    await client.disconnect().catch(() => undefined);
    client = null;
    ready = false;
  }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const cache = getClient();
  if (!cache) return null;
  try {
    const raw = await cache.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    logger.error(`[redis] GET ${key} failed`, { err: error });
    return null;
  }
}

export async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const cache = getClient();
  if (!cache) return;
  try {
    await cache.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.error(`[redis] SET ${key} failed`, { err: error });
  }
}

/**
 * Read and delete a key in one atomic step (GETDEL). Of several concurrent
 * callers, exactly one receives the value — used to make one-time tokens
 * such as price quotes single-use.
 */
export async function redisGetDel<T>(key: string): Promise<T | null> {
  const cache = getClient();
  if (!cache) return null;
  try {
    const raw = await cache.getDel(key);
    return raw ? (JSON.parse(String(raw)) as T) : null;
  } catch (error) {
    logger.error(`[redis] GETDEL ${key} failed`, { err: error });
    return null;
  }
}

export async function redisDel(key: string): Promise<void> {
  const cache = getClient();
  if (!cache) return;
  try {
    await cache.del(key);
  } catch (error) {
    logger.error(`[redis] DEL ${key} failed`, { err: error });
  }
}

// ── Failed-attempt counters (OTP brute-force guard) ──────────────────
// Redis when connected; an in-process fallback otherwise, so a Redis blip
// never turns the guard off.
const localAttempts = new Map<string, { n: number; exp: number }>();
const localMarks = new Map<string, number>(); // key → expiry (ms)
const LOCAL_MAX_KEYS = 100_000;

/** Keep the in-process fallbacks bounded: an attacker spraying random
 *  identifiers while Redis is down must not be able to grow them forever. */
function pruneLocal<T>(map: Map<string, T>, expOf: (v: T) => number): void {
  if (map.size < LOCAL_MAX_KEYS) return;
  const now = Date.now();
  for (const [k, v] of map) if (expOf(v) <= now) map.delete(k);
  // Still full of live keys: drop the oldest insertions (Map keeps order).
  for (const k of map.keys()) {
    if (map.size < LOCAL_MAX_KEYS * 0.9) break;
    map.delete(k);
  }
}

/**
 * Increment a counter that expires `ttlSeconds` after the FIRST hit (fixed
 * window). Returns the new count. The create-with-TTL and the increment run
 * in one MULTI, so a crash can never leave a counter without an expiry.
 */
export async function incrAttempts(key: string, ttlSeconds: number): Promise<number> {
  const client = getRedisClient();
  if (client) {
    try {
      const replies = await client
        .multi()
        .set(key, '0', { expiration: { type: 'EX', value: ttlSeconds }, condition: 'NX' })
        .incr(key)
        .exec();
      const n = Number(replies?.[1]);
      if (Number.isFinite(n) && n > 0) return n;
    } catch { /* fall through to local */ }
  }
  const now = Date.now();
  const cur = localAttempts.get(key);
  const next = cur && cur.exp > now ? { n: cur.n + 1, exp: cur.exp } : { n: 1, exp: now + ttlSeconds * 1000 };
  pruneLocal(localAttempts, (v) => v.exp);
  localAttempts.set(key, next);
  return next.n;
}

/**
 * Reserve one attempt against `limit` BEFORE doing the guarded check. The
 * increment is atomic, so N parallel requests consume N attempts: a burst
 * cannot all read "0 used" and slip past the cap (check-then-act race).
 * Clear the key on success.
 */
export async function reserveAttempt(
  key: string, limit: number, ttlSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const count = await incrAttempts(key, ttlSeconds);
  return { allowed: count <= limit, count };
}

export async function getAttempts(key: string): Promise<number> {
  const client = getRedisClient();
  if (client) {
    try { return Number(await client.get(key)) || 0; } catch { /* fall through */ }
  }
  const cur = localAttempts.get(key);
  return cur && cur.exp > Date.now() ? cur.n : 0;
}

export async function clearAttempts(key: string): Promise<void> {
  localAttempts.delete(key);
  const client = getRedisClient();
  if (client) await client.del(key).catch(() => {});
}

/**
 * Set a marker only if it is not already set (SET NX EX). Returns true for
 * the FIRST caller and false for every later one until it expires — used to
 * make one-time values (a TOTP time step) single-use. The in-process mirror
 * is always written too, so a replay is caught in this process even if Redis
 * drops between the two uses.
 */
export async function markOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const now = Date.now();
  const localExp = localMarks.get(key);
  if (localExp && localExp > now) return false;
  pruneLocal(localMarks, (exp) => exp);
  localMarks.set(key, now + ttlSeconds * 1000);
  const client = getRedisClient();
  if (client) {
    try {
      const reply = await client.set(key, '1', { expiration: { type: 'EX', value: ttlSeconds }, condition: 'NX' });
      return reply !== null;
    } catch { /* local marker already guards this process */ }
  }
  return true;
}

/** Set (or extend) a flag for `ttlSeconds` — e.g. "this identifier is locked out". */
export async function setFlag(key: string, ttlSeconds: number): Promise<void> {
  pruneLocal(localMarks, (exp) => exp);
  localMarks.set(key, Date.now() + ttlSeconds * 1000);
  const client = getRedisClient();
  if (client) await client.set(key, '1', { expiration: { type: 'EX', value: ttlSeconds } }).catch(() => {});
}

/** Is the flag set (in this process or in Redis)? */
export async function hasFlag(key: string): Promise<boolean> {
  const localExp = localMarks.get(key);
  if (localExp && localExp > Date.now()) return true;
  const client = getRedisClient();
  if (!client) return false;
  try { return (await client.exists(key)) === 1; } catch { return false; }
}
