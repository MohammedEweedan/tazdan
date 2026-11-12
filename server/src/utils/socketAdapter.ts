/**
 * Socket.IO across workers and replicas.
 *
 * Every live event (chat messages, read receipts, typing, activity) is
 * emitted to a `user:{id}` room. Without a shared adapter a room only spans
 * the process that emits, so with CLUSTER_WORKERS > 1 (or two containers) a
 * message sent through one worker never reached a receiver connected to
 * another. The Redis adapter relays emits between processes.
 *
 * Single-process deployments work without it; a failure to attach is logged
 * and live delivery stays in-process (the app's catch-up fetch on reconnect
 * and its poll still deliver everything).
 */
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as IOServer } from 'socket.io';
import { logger } from './logger';

export async function attachSocketAdapter(io: IOServer): Promise<boolean> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return false;
  const pub = createClient({
    url,
    socket: { reconnectStrategy: (retries) => Math.min(Math.max(retries, 1) * 100, 5000) },
  });
  const sub = pub.duplicate();
  pub.on('error', (err) => logger.error('[socket] adapter pub error', { err }));
  sub.on('error', (err) => logger.error('[socket] adapter sub error', { err }));
  try {
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    logger.info('[socket] redis adapter attached');
    return true;
  } catch (err) {
    logger.error('[socket] redis adapter unavailable — live events stay in this process', { err });
    await Promise.allSettled([pub.disconnect(), sub.disconnect()]);
    return false;
  }
}
