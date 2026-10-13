/**
 * Socket.IO authentication.
 *
 * The old handshake checked only the JWT signature: a revoked token (signed
 * out, password reset, banned) still opened a socket, and an open socket
 * stayed authenticated for as long as it lived — a stolen 15-minute access
 * token became an indefinite feed of the victim's private events (messages,
 * transfers, order fills). Now:
 *
 *  - the handshake verifies the token TYPE (never a refresh token) and the
 *    revocation state (session denylist + per-user cutoff);
 *  - each authenticated socket joins `user:<id>` and `sid:<session>`; every
 *    revocation disconnects the matching sockets at once;
 *  - a sweep re-checks open sockets (revocations made by other workers) and
 *    expires them: clients that re-authenticate in-band (`auth.v >= 2`, via
 *    `auth:refresh`) are held to their token's expiry plus a short grace,
 *    legacy clients to a hard ceiling from the token's issue time;
 *  - a socket can never switch to a different user.
 *
 * Invalid or missing tokens still get an anonymous socket (public price and
 * discussion feeds), exactly as before.
 */
import type { Server, Socket } from 'socket.io';
import { isAccessRevoked, onSessionRevocation, verifyAccessToken, type AccessClaims } from '../../middleware/auth';
import { logger } from '../../utils/logger';

type SocketAuth = AccessClaims & { v: number };

const SWEEP_MS = 60_000;
const GRACE_SECONDS = Number(process.env.SOCKET_AUTH_GRACE_SECONDS ?? 120);
const LEGACY_MAX_AGE_SECONDS = Number(process.env.SOCKET_LEGACY_MAX_AGE_SECONDS ?? 12 * 60 * 60);
const REAUTH_PER_MINUTE = 10;

function protocolVersion(socket: Socket): number {
  const v = Number((socket.handshake.auth as Record<string, unknown> | undefined)?.v);
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 1;
}

/** Has this socket's authentication lapsed (ignoring revocation)? */
export function socketAuthExpired(auth: SocketAuth, nowSeconds = Date.now() / 1000): boolean {
  if (auth.v >= 2) return (auth.exp ?? 0) + GRACE_SECONDS < nowSeconds;
  return (auth.iat ?? 0) + LEGACY_MAX_AGE_SECONDS < nowSeconds;
}

async function revoked(auth: SocketAuth): Promise<boolean> {
  try { return await isAccessRevoked(auth.id, auth.iat, auth.sid); } catch { return false; }
}

function expire(socket: Socket, reason: string): void {
  socket.emit('session:expired', { reason });
  socket.disconnect(true);
}

export async function sweepSockets(io: Server): Promise<number> {
  let dropped = 0;
  const now = Date.now() / 1000;
  for (const socket of io.of('/').sockets.values()) {
    const auth = socket.data?.auth as SocketAuth | undefined;
    if (!auth) continue;
    if (socketAuthExpired(auth, now)) { expire(socket, 'expired'); dropped++; continue; }
    if (await revoked(auth)) { expire(socket, 'revoked'); dropped++; }
  }
  return dropped;
}

let sweepTimer: NodeJS.Timeout | null = null;

export function attachSocketAuth(io: Server): void {
  // Only accept tokens via the handshake `auth` object — never via the query
  // string (URL-borne tokens leak through proxy logs, history and Referer).
  io.use((socket, next) => {
    const raw = (socket.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof raw !== 'string' || !raw) return next(); // anonymous: public events only
    const claims = verifyAccessToken(raw);
    if (!claims) return next();
    const auth: SocketAuth = { ...claims, v: protocolVersion(socket) };
    if (socketAuthExpired(auth)) return next();
    revoked(auth).then((isRevoked) => {
      if (!isRevoked) {
        socket.data.user = { id: claims.id, email: claims.email, role: claims.role };
        socket.data.auth = auth;
      }
      next();
    }, () => next());
  });

  io.on('connection', (socket) => {
    const auth = socket.data?.auth as SocketAuth | undefined;
    if (!auth) return;
    if (auth.sid) socket.join(`sid:${auth.sid}`);

    // In-band re-authentication after the client rotates its access token,
    // so the socket keeps its rooms instead of reconnecting.
    let budget = { at: 0, n: 0 };
    socket.on('auth:refresh', async (payload: unknown, ack?: unknown) => {
      const reply = typeof ack === 'function' ? (ack as (r: { ok: boolean }) => void) : () => {};
      const now = Date.now();
      if (now - budget.at > 60_000) budget = { at: now, n: 0 };
      if (++budget.n > REAUTH_PER_MINUTE) return reply({ ok: false });
      const current = socket.data?.auth as SocketAuth | undefined;
      const token = (payload as { token?: unknown } | null)?.token;
      const claims = typeof token === 'string' ? verifyAccessToken(token) : null;
      if (!current || !claims || claims.id !== current.id) return reply({ ok: false });
      const next: SocketAuth = { ...claims, v: Math.max(2, current.v) };
      if (socketAuthExpired(next) || await revoked(next)) return reply({ ok: false });
      if (current.sid && current.sid !== next.sid) socket.leave(`sid:${current.sid}`);
      if (next.sid) socket.join(`sid:${next.sid}`);
      socket.data.auth = next;
      reply({ ok: true });
    });
  });

  onSessionRevocation({
    user: (userId) => { io.in(`user:${userId}`).disconnectSockets(true); },
    session: (sid) => { io.in(`sid:${sid}`).disconnectSockets(true); },
  });

  if (!sweepTimer) {
    sweepTimer = setInterval(() => {
      sweepSockets(io).catch((err) => logger.warn('[socket] auth sweep failed', { err }));
    }, SWEEP_MS);
    sweepTimer.unref();
  }
}
