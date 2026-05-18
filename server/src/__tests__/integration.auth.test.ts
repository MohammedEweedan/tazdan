/**
 * Auth route integration tests.
 *
 * Requires a running PostgreSQL database (same URL as DATABASE_URL env).
 * Skipped automatically when DATABASE_URL is not set (CI matrix without DB).
 *
 * Each test creates ephemeral users and cleans up after itself.
 */

import request from 'supertest';
import { app } from '../index';
import { prisma } from '../utils/prisma';

const DB = process.env.DATABASE_URL;
const describeOrSkip = DB ? describe : describe.skip;

const unique = () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

describeOrSkip('POST /api/auth/register', () => {
  let email: string;

  beforeEach(() => {
    email = `${unique()}@example.com`;
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('creates a user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'TestPass123!', fullName: 'Test User', phone: '+218912345678' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user?.email).toBe(email);
  });

  it('rejects duplicate email', async () => {
    const payload = { email, password: 'TestPass123!', fullName: 'Test User', phone: '+218912345678' };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(409);
  });

  it('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: '123', fullName: 'Test User', phone: '+218912345678' });

    expect(res.status).toBe(400);
  });

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'TestPass123!', fullName: 'Test User' });

    expect(res.status).toBe(400);
  });
});

describeOrSkip('POST /api/auth/login', () => {
  const password = 'TestPass123!';
  let email: string;

  beforeAll(async () => {
    email = `${unique()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Login Test', phone: '+218987654321' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('returns tokens on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPass999!' });

    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password });

    expect(res.status).toBe(401);
  });
});

describeOrSkip('POST /api/auth/refresh', () => {
  const password = 'TestPass123!';
  let email: string;
  let refreshToken: string;

  beforeAll(async () => {
    email = `${unique()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Refresh Test', phone: '+218911111111' });
    refreshToken = res.body.refreshToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('issues new tokens from a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects a garbage refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-valid-token' });

    expect([401, 403]).toContain(res.status);
  });
});

describeOrSkip('GET /api/auth/me', () => {
  const password = 'TestPass123!';
  let email: string;
  let accessToken: string;

  beforeAll(async () => {
    email = `${unique()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password, fullName: 'Me Test', phone: '+218922222222' });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('returns current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it('rejects requests without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect([401, 403]).toContain(res.status);
  });
});
