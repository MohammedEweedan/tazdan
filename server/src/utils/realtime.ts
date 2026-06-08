/**
 * Tiny socket helper — emit a `activity:new` event to every user whose
 * activity feed should refresh. Mobile invalidates its `activities`
 * React Query cache on receipt and the home tab updates.
 *
 * The Express request carries the socket.io Server instance under
 * `app.get('io')`. When called outside a request context (e.g. from a
 * service that doesn't accept `req`), pass the io instance directly.
 */
import type { Server as IOServer } from 'socket.io';
import type { AuthRequest } from '../types';

type IOSource = AuthRequest | IOServer | undefined | null;

function resolveIo(source: IOSource): IOServer | null {
  if (!source) return null;
  // AuthRequest exposes the Express app, which carries the io instance.
  if ((source as any).app?.get) {
    return (source as any).app.get('io') ?? null;
  }
  return source as IOServer;
}

/**
 * Notify the given users that their activity feed has new entries.
 * Pass `req` from the controller or the bare `io` instance.
 */
export function emitActivity(
  source: IOSource,
  userIds: Array<string | null | undefined>,
  payload?: Record<string, any>,
) {
  const io = resolveIo(source);
  if (!io) return;
  const unique = new Set(userIds.filter((u): u is string => Boolean(u)));
  for (const uid of unique) {
    io.to(`user:${uid}`).emit('activity:new', payload ?? {});
  }
}

/**
 * Notify the given users that a new in-app notification has been
 * inserted (admin broadcast, system alert, etc.). Mobile listens for
 * `notification:new` and refetches the bell-icon list + unread badge.
 */
export function emitNotification(
  source: IOSource,
  userIds: Array<string | null | undefined>,
  payload?: Record<string, any>,
) {
  const io = resolveIo(source);
  if (!io) return;
  const unique = new Set(userIds.filter((u): u is string => Boolean(u)));
  for (const uid of unique) {
    io.to(`user:${uid}`).emit('notification:new', payload ?? {});
  }
}

/**
 * Broadcast a discussion event to everyone viewing an asset's discussion feed.
 * Clients join the `discussion:<SYMBOL>` room when the tab is open and leave it
 * when they close it. `event` is e.g. 'discussion:new' | 'discussion:updated' |
 * 'discussion:removed'.
 */
export function emitDiscussion(
  source: IOSource,
  symbol: string,
  event: 'discussion:new' | 'discussion:updated' | 'discussion:removed',
  payload?: Record<string, any>,
) {
  const io = resolveIo(source);
  if (!io) return;
  const room = `discussion:${symbol.toUpperCase()}`;
  io.to(room).emit(event, payload ?? {});
}
