/**
 * Identity: token, session, socket and rate-limit exploits (Prisma faked in
 * memory, no Redis — so these also prove revocation holds during an outage).
 */
import express from 'express';
import request from 'supertest';

jest.mock('../utils/prisma', () => ({ prisma: require('./helpers/fakePrisma').fakePrisma }));
jest.mock('../services/platform/securityEvents', () => ({ recordSecurityEvent: jest.fn(async () => undefined) }));
jest.mock('../utils/deviceInfo', () => ({ parseUserAgent: () => ({ name: 'Phone', type: 'mobile', os: 'iOS' }), geoLocate: async () => null }));

import { fakePrisma, harness } from './helpers/fakePrisma';
import {
  authenticate, generateTokens, issueSessionTokens, revokeAllUserSessions, revokeRefreshToken, verifyAndConsumeRefreshToken,
} from '../middleware/auth';
import { SecurityController } from '../controllers/security.controller';
import { authLimiter } from '../middleware/rateLimiters';

let n = 0;
const uniq = (p: string) => `${p}${Date.now().toString(36)}${++n}`;
const meta = { ipAddress: '203.0.113.9', userAgent: 'test' };

async function makeUser() {
  const u = await fakePrisma.user.create({ data: { email: `${uniq('t')}@example.com`, passwordHash: 'x' } });
  return { id: u.id as string, email: u.email as string, role: 'USER' };
}

/** Run `authenticate` and report whether the request got through. */
function authStatus(token: string): Promise<'ok' | number> {
  return new Promise((resolve) => {
    const h = harness({ headers: { authorization: `Bearer ${token}` } });
    authenticate(h.req, h.res, (e?: any) => resolve(e ? e.statusCode : 'ok'));
  });
}

/** Rotate a refresh token the way /auth/refresh does. */
async function rotate(user: { id: string; email: string; role: string }, refreshToken: string) {
  const stored = await verifyAndConsumeRefreshToken(refreshToken);
  const next = await issueSessionTokens(user, meta);
  await fakePrisma.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: next.sessionId } });
  return next;
}

describe('tokens', () => {
  it('a refresh token is never accepted as an access token, even if one secret is reused for both', async () => {
    const saved = process.env.JWT_REFRESH_SECRET;
    process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
    try {
      const { refreshToken } = generateTokens(await makeUser());
      expect(await authStatus(refreshToken)).toBe(401);
    } finally {
      process.env.JWT_REFRESH_SECRET = saved;
    }
  });

  it('reusing a rotated refresh token also kills the live access token of whoever rotated first', async () => {
    const user = await makeUser();
    const first = await issueSessionTokens(user, meta);
    const thief = await rotate(user, first.refreshToken);
    expect(await authStatus(thief.accessToken)).toBe('ok');
    await expect(verifyAndConsumeRefreshToken(first.refreshToken)).rejects.toThrow(/already used/);
    expect(await authStatus(thief.accessToken)).toBe(401);
  });

  it('logout stops the access token at once, not 15 minutes later', async () => {
    const user = await makeUser();
    const s = await issueSessionTokens(user, meta);
    expect(await authStatus(s.accessToken)).toBe('ok');
    await revokeRefreshToken(s.refreshToken);
    expect(await authStatus(s.accessToken)).toBe(401);
  });

  it('"sign out everywhere" holds with Redis unavailable', async () => {
    const user = await makeUser();
    const s = await issueSessionTokens(user, meta);
    await new Promise((r) => setTimeout(r, 1100)); // cutoff compares issue time in whole seconds
    await revokeAllUserSessions(user.id);
    expect(await authStatus(s.accessToken)).toBe(401);
    const fresh = await issueSessionTokens(user, meta);
    expect(await authStatus(fresh.accessToken)).toBe('ok');
  });

  it('"sign out other devices" keeps this session and kills the others\' access tokens', async () => {
    const user = await makeUser();
    const mine = await issueSessionTokens(user, meta);
    const other = await issueSessionTokens(user, meta);
    const h = harness({ user: { ...user, sid: mine.sessionId } });
    await SecurityController.revokeAllSessions(h.req, h.res, h.next);
    expect(h.res.body.revoked).toBe(1);
    expect(await authStatus(other.accessToken)).toBe(401);
    expect(await authStatus(mine.accessToken)).toBe('ok');
  });
});

describe('socket handshake', () => {
  // A tiny stand-in for the socket.io server: records middleware, connection
  // handlers, room membership and disconnects.
  function fakeIo() {
    const sockets = new Map<string, any>();
    const mw: Array<(s: any, next: (e?: any) => void) => void> = [];
    const onConn: Array<(s: any) => void> = [];
    const io: any = {
      use: (fn: any) => mw.push(fn),
      on: (ev: string, fn: any) => { if (ev === 'connection') onConn.push(fn); },
      in: (room: string) => ({ disconnectSockets: () => { for (const s of sockets.values()) if (s.rooms.has(room)) s.disconnect(); } }),
      of: () => ({ sockets }),
    };
    async function connect(auth: Record<string, unknown>) {
      const handlers: Record<string, any> = {};
      const s: any = {
        id: uniq('sock'), handshake: { auth }, data: {}, rooms: new Set<string>(), connected: true,
        join: (r: string) => s.rooms.add(r), leave: (r: string) => s.rooms.delete(r),
        on: (ev: string, fn: any) => { handlers[ev] = fn; }, emit: jest.fn(),
        disconnect: () => { s.connected = false; sockets.delete(s.id); },
        handlers,
      };
      for (const fn of mw) await new Promise<void>((resolve) => fn(s, () => resolve()));
      if (s.data.user) s.join(`user:${s.data.user.id}`);
      sockets.set(s.id, s);
      for (const fn of onConn) fn(s);
      return s;
    }
    return { io, connect };
  }

  it('refuses a revoked token, and drops an open socket the moment its session is revoked', async () => {
    const { attachSocketAuth } = await import('../services/security/socketAuth');
    const { io, connect } = fakeIo();
    attachSocketAuth(io);
    const user = await makeUser();

    const dead = await issueSessionTokens(user, meta);
    await revokeRefreshToken(dead.refreshToken);
    expect((await connect({ token: dead.accessToken })).data.user).toBeUndefined();

    const refresh = generateTokens(user).refreshToken;
    expect((await connect({ token: refresh })).data.user).toBeUndefined();

    const live = await issueSessionTokens(user, meta);
    const s = await connect({ token: live.accessToken, v: 2 });
    expect(s.data.user?.id).toBe(user.id);
    expect(s.rooms.has(`sid:${live.sessionId}`)).toBe(true);
    await revokeRefreshToken(live.refreshToken);
    expect(s.connected).toBe(false);
  });

  it('re-authenticates in band but never switches to another user', async () => {
    const { attachSocketAuth } = await import('../services/security/socketAuth');
    const { io, connect } = fakeIo();
    attachSocketAuth(io);
    const user = await makeUser();
    const other = await makeUser();
    const s = await connect({ token: (await issueSessionTokens(user, meta)).accessToken, v: 2 });
    const ack = jest.fn();
    await s.handlers['auth:refresh']({ token: (await issueSessionTokens(other, meta)).accessToken }, ack);
    expect(ack).toHaveBeenLastCalledWith({ ok: false });
    const rotated = await issueSessionTokens(user, meta);
    await s.handlers['auth:refresh']({ token: rotated.accessToken }, ack);
    expect(ack).toHaveBeenLastCalledWith({ ok: true });
    expect(s.rooms.has(`sid:${rotated.sessionId}`)).toBe(true);
  });
});

describe('per-IP auth limits', () => {
  it('rotating IPv6 addresses inside one /64 does not reset the limit', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use('/login', authLimiter, (_req, res) => { res.json({ ok: true }); });
    const statuses: number[] = [];
    for (let i = 1; i <= 11; i++) {
      const r = await request(app).post('/login').set('X-Forwarded-For', `2001:db8:5:7::${i.toString(16)}`);
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
