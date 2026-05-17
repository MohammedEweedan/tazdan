import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL?.trim();

let client: RedisClientType | null = null;
let ready = false;

function getClient() {
  return client && ready ? client : null;
}

export async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    console.log('[redis] disabled: no REDIS_URL configured');
    return;
  }
  if (client) return;

  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries >= 10) return new Error('Redis reconnect attempts exhausted');
        return Math.min(retries * 100, 1000);
      },
    },
  });

  client.on('error', (error) => {
    console.error('[redis] error', error);
    ready = false;
  });
  client.on('ready', () => {
    ready = true;
    console.log('[redis] ready');
  });

  try {
    await client.connect();
  } catch (error) {
    console.error('[redis] connection failed', error);
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
    console.error(`[redis] GET ${key} failed`, error);
    return null;
  }
}

export async function redisSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const cache = getClient();
  if (!cache) return;
  try {
    await cache.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.error(`[redis] SET ${key} failed`, error);
  }
}

export async function redisDel(key: string): Promise<void> {
  const cache = getClient();
  if (!cache) return;
  try {
    await cache.del(key);
  } catch (error) {
    console.error(`[redis] DEL ${key} failed`, error);
  }
}
