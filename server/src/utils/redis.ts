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
