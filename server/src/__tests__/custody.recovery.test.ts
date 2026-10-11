/** Actual HTTP/auth/MFA and PostgreSQL journals; provider, screening and
 * valuation boundaries use fixtures. No signing key is available to the API. */
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import speakeasy from 'speakeasy';
import type { Server } from 'http';
const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const schema = `custody_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
if (RUN_DB) { const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('schema', schema); process.env.DATABASE_URL = url.toString(); }
jest.mock('../services/wallet/walletDerivation.service', () => ({ deriveKeyForChain: jest.fn(() => { throw new Error('API must never access a signing key'); }) }));
jest.mock('../services/risk/withdrawalRisk', () => ({ assessWithdrawal: jest.fn().mockResolvedValue({ blocked: false, review: false }) }));
jest.mock('../utils/kycLimits', () => ({ enforceKycLimit: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/email', () => ({ sendWithdrawalConfirmed: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/push.service', () => ({ pushCopy: jest.fn(), pushTxEvent: jest.fn() }));
describeDb('durable custody withdrawal recovery', () => {
  let prisma: any; let app: express.Express; let gateway: Server; let user: any; let token: string;
  let initiate: typeof import('../services/wallet/onchainSettlement.service').initiateWithdrawal;
  let reconcile: typeof import('../services/wallet/custodyReconciliation.service').reconcileCustodyWithdrawals;
  let postLedger: typeof import('../services/ledger/ledger.service').postLedger;
  let submissions = 0; let rejectSubmit = false; const outcomes = new Map<string, any>();
  const address = '0x000000000000000000000000000000000000dEaD';
  const secret = 'JBSWY3DPEHPK3PXP'; // Public test TOTP fixture.
  const payload = (key: string, amount = '0.1') => ({ asset: 'ETH', network: 'ERC20', amount, toAddress: address, idempotencyKey: key, twoFactorCode: speakeasy.totp({ secret, encoding: 'base32' }) });
  const http = (key: string, amount?: string) => request(app).post('/api/withdrawal/initiate').set('Authorization', token).send(payload(key, amount));
  const balance = async () => (await prisma.userWallet.findUnique({ where: { userId: user.id } })).ethBalance.toString();
  beforeAll(async () => {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env: process.env });
    ({ prisma } = await import('../utils/prisma'));
    ({ postLedger } = await import('../services/ledger/ledger.service'));
    ({ initiateWithdrawal: initiate } = await import('../services/wallet/onchainSettlement.service'));
    ({ reconcileCustodyWithdrawals: reconcile } = await import('../services/wallet/custodyReconciliation.service'));
    const { cryptoWithdrawalRouter } = await import('../routes/cryptoWithdrawal');
    const { errorHandler } = await import('../middleware/errorHandler');
    app = express(); app.use(express.json()); app.use('/api/withdrawal', cryptoWithdrawalRouter); app.use(errorHandler);
    const remote = express(); remote.use(express.json());
    remote.post('/v1/withdrawals', (req, res) => {
      expect(req.get('Idempotency-Key')).toBe(req.body.operationId);
      expect(req.get('Authorization')).toBe(`Bearer ${'test'.repeat(10)}`);
      submissions++; outcomes.set(req.body.operationId, { operationId: req.body.operationId, status: 'UNKNOWN', txHash: null });
      if (rejectSubmit) { res.status(503).json({ error: 'provider response lost' }); return; }
      const result = { operationId: req.body.operationId, status: 'PENDING', txHash: `0x${crypto.createHash('sha256').update(req.body.operationId).digest('hex')}` };
      outcomes.set(req.body.operationId, result); res.json(result);
    });
    remote.get('/v1/withdrawals/:id', (req, res) => res.json(outcomes.get(req.params.id) ?? { operationId: req.params.id, status: 'UNKNOWN', txHash: null }));
    gateway = await new Promise<Server>(resolve => { const s = remote.listen(0, '127.0.0.1', () => resolve(s)); });
    process.env.CUSTODY_MODE = 'remote'; process.env.CUSTODY_PROVIDER_TOKEN = 'test'.repeat(10);
    process.env.CUSTODY_PROVIDER_URL = `http://127.0.0.1:${(gateway.address() as any).port}`;
    user = await prisma.user.create({ data: { email: `${schema}@example.com`, passwordHash: 'x', firstName: 'Custody', lastName: 'Test', username: schema, status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2', emailVerified: true, twoFactorEnabled: true, twoFactorSecret: secret, referralCode: schema.slice(-16) } });
    await prisma.userWallet.create({ data: { userId: user.id, ethAddress: address, btcAddress: 'test-btc', solAddress: 'test-sol', tronAddress: 'test-tron', ethBalance: '10' } });
    await prisma.$transaction((tx: any) => postLedger(tx, { refType: 'test_fixture', legs: [{ type: 'SYSTEM_CHAIN', currency: 'ETH', amount: '-10' }, { type: 'USER', userId: user.id, currency: 'ETH', amount: '10' }] }));
    await prisma.withdrawalAddressWhitelist.create({ data: { userId: user.id, key: `ETH:${address.toLowerCase()}`, asset: 'ETH', network: 'ERC20', toAddress: address, confirmToken: 'test-only', confirmedAt: new Date(0), activeAt: new Date(0) } });
    const { generateTokens } = await import('../middleware/auth'); token = `Bearer ${generateTokens(user).accessToken}`;
  }, 120_000);
  afterAll(async () => {
    if (gateway) await new Promise<void>(resolve => gateway.close(() => resolve()));
    if (prisma) { await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await prisma.$disconnect(); }
  });
  it('requires MFA and produces one debit/journal/broadcast for concurrent retries', async () => {
    const denied = await request(app).post('/api/withdrawal/initiate').set('Authorization', token).send({ ...payload('mfa-test-key'), twoFactorCode: '000000' });
    expect(denied.status).toBe(401); expect(submissions).toBe(0);
    const results = await Promise.all(Array.from({ length: 4 }, () => http('concurrent-key')));
    expect(results.map(r => r.status).every(s => [201, 202].includes(s))).toBe(true);
    expect(new Set(results.map(r => r.body.transaction.id)).size).toBe(1);
    expect(submissions).toBe(1); expect(await balance()).toBe('9.9');
    expect(await prisma.ledgerEntry.count({ where: { refType: 'onchain_withdrawal' } })).toBe(2);
    expect((await http('concurrent-key', '0.2')).status).toBe(409);
  });
  it('holds funds after lost replies and refunds once only on definitive proof of no broadcast', async () => {
    rejectSubmit = true; const response = await http('lost-reply-key', '0.2'); expect(response.status).toBe(202);
    const id = response.body.transaction.id; expect(await balance()).toBe('9.7');
    await http('lost-reply-key', '0.2'); expect(submissions).toBe(2);
    await reconcile(); expect(await balance()).toBe('9.7');
    outcomes.set(id, { operationId: id, status: 'REJECTED', txHash: null, definitiveNoBroadcast: false });
    await reconcile(); expect(await balance()).toBe('9.7');
    outcomes.set(id, { operationId: id, status: 'REJECTED', txHash: null, definitiveNoBroadcast: true });
    await Promise.all([reconcile(), reconcile()]); await reconcile();
    expect(await balance()).toBe('9.9'); expect((await prisma.onChainTransaction.findUnique({ where: { id } })).status).toBe('FAILED');
    expect(await prisma.ledgerEntry.count({ where: { refType: 'onchain_withdrawal_refund', refId: id } })).toBe(2);
  });
  it('recovers unknown operations by status reference without another broadcast', async () => {
    const r = await http('restart-key', '0.3'); expect(r.status).toBe(202);
    const id = r.body.transaction.id; const count = submissions;
    outcomes.set(id, { operationId: id, status: 'CONFIRMED', txHash: `0x${'b'.repeat(64)}` });
    await reconcile(); await reconcile();
    expect((await prisma.onChainTransaction.findUnique({ where: { id } })).status).toBe('CONFIRMED');
    expect(await balance()).toBe('9.6'); expect(submissions).toBe(count);
    const mismatch = await initiate({ userId: user.id, ...payload('restart-key'), amount: '0.3', network: 'BTC' }).catch(e => e);
    expect(mismatch.statusCode).toBe(409);
    const { deriveKeyForChain } = await import('../services/wallet/walletDerivation.service'); expect(deriveKeyForChain).not.toHaveBeenCalled();
  });
  it('rejects non-finite and sub-unit amounts before changing the database', async () => {
    for (const [asset, amount] of [['ETH', 'NaN'], ['ETH', 'Infinity'], ['BTC', '0.000000001'], ['SOL', '0.0000000001'], ['USDT', '0.0000001']]) {
      await expect(initiate({ userId: user.id, asset, network: 'NATIVE', amount, toAddress: address, idempotencyKey: 'invalid-key' })).rejects.toThrow();
    }
    expect(await balance()).toBe('9.6');
  });
});
