/**
 * Wallet route integration tests.
 *
 * Requires DATABASE_URL — skipped when absent.
 * Tests GET /api/wallet (balance), and verifies the fee-estimation endpoint.
 */

import request from 'supertest';
import { app } from '../index';
import { prisma } from '../utils/prisma';

const DB = process.env.DATABASE_URL;
const describeOrSkip = DB ? describe : describe.skip;

const unique = () => `wallet_${Date.now()}_${Math.random().toString(36).slice(2)}`;

async function registerAndLogin() {
  const email = `${unique()}@example.com`;
  const password = 'TestPass123!';
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, fullName: 'Wallet Test', phone: '+218933333333' });
  return { email, password, accessToken: res.body.accessToken as string };
}

describeOrSkip('GET /api/wallet', () => {
  let email: string;
  let accessToken: string;

  beforeAll(async () => {
    ({ email, accessToken } = await registerAndLogin());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('returns a wallet with zero balances for a new user', async () => {
    const res = await request(app)
      .get('/api/wallet')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ethBalance');
    expect(res.body).toHaveProperty('btcBalance');
    expect(res.body).toHaveProperty('solBalance');
    expect(parseFloat(res.body.ethBalance)).toBe(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/wallet');
    expect([401, 403]).toContain(res.status);
  });
});

describeOrSkip('GET /api/wallet/fee-estimate', () => {
  let accessToken: string;
  let email: string;

  beforeAll(async () => {
    ({ email, accessToken } = await registerAndLogin());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('returns fee estimate for ETH', async () => {
    const res = await request(app)
      .get('/api/wallet/fee-estimate?asset=ETH&network=ETH')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.asset).toBe('ETH');
    expect(parseFloat(res.body.estimate)).toBeGreaterThan(0);
  });

  it('returns fee estimate for BTC', async () => {
    const res = await request(app)
      .get('/api/wallet/fee-estimate?asset=BTC&network=BTC')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.asset).toBe('BTC');
    expect(parseFloat(res.body.estimate)).toBeGreaterThan(0);
  });

  it('returns fee estimate for SOL', async () => {
    const res = await request(app)
      .get('/api/wallet/fee-estimate?asset=SOL&network=SOL')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.asset).toBe('SOL');
  });

  it('rejects unsupported asset', async () => {
    const res = await request(app)
      .get('/api/wallet/fee-estimate?asset=DOGE&network=DOGE')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });
});

describeOrSkip('POST /api/wallet/withdraw — guard rails', () => {
  let accessToken: string;
  let email: string;

  beforeAll(async () => {
    ({ email, accessToken } = await registerAndLogin());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
  });

  it('rejects withdrawal with zero balance', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ asset: 'ETH', network: 'ETH', amount: '0.01', toAddress: '0x742d35Cc6634C0532925a3b8D4C9e7d8c9e7d8c9' });

    // Insufficient balance → 400
    expect(res.status).toBe(400);
  });

  it('rejects zero amount', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ asset: 'ETH', network: 'ETH', amount: '0', toAddress: '0x742d35Cc6634C0532925a3b8D4C9e7d8c9e7d8c9' });

    expect(res.status).toBe(400);
  });

  it('rejects missing toAddress', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ asset: 'ETH', network: 'ETH', amount: '0.01' });

    expect(res.status).toBe(400);
  });
});
