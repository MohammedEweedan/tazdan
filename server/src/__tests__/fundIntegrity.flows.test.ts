/**
 * Fund integrity across real money flows.
 *
 * Runs deposits, a transfer with a fee, a swap, a claim link, a chat payment,
 * a P2P trade with its fee, a withdrawal, a manual credit and an onboarding
 * credit through the HTTP routes, then requires the fund-integrity audit to
 * account for every unit: no wallet drift, no unbacked value, every boundary
 * posting matched to its record. It then shows the audit catching unbacked
 * value, a posting without a record and wallet drift.
 *
 * The audit is global, so this suite runs in its own Postgres schema
 * (migrated from scratch) where no other suite can add activity.
 */
import { execSync } from 'child_process';
import request from 'supertest';
import express, { type Express } from 'express';
import { Decimal } from '@prisma/client/runtime/library';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const SCHEMA = `fi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const BASE_URL = process.env.DATABASE_URL ?? '';
if (RUN_DB) {
  const u = new URL(BASE_URL);
  u.searchParams.set('schema', SCHEMA);
  // Must be set before anything imports utils/prisma (all imports below are dynamic).
  process.env.DATABASE_URL = u.toString();
}

jest.mock('../services/wallet/walletDerivation.service', () => ({ createUserWallets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../services/security/stepUp.service', () => ({
  ...jest.requireActual('../services/security/stepUp.service'),
  enforceStepUp: jest.fn().mockResolvedValue(undefined),
  enforceRiskBasedStepUp: jest.fn().mockResolvedValue(undefined),
  issueStepUp: jest.fn(),
  verifyStepUp: jest.fn(),
}));
// Swap pricing is fixed so the test does not depend on live price feeds.
jest.mock('../services/exchange/conversion.service', () => {
  const actual = jest.requireActual('../services/exchange/conversion.service');
  const { Decimal: Dec } = jest.requireActual('@prisma/client/runtime/library');
  return {
    ...actual,
    quoteConversion: jest.fn(async (from: string, to: string, amount: any) => {
      const credited = new Dec(amount.toString()).mul('0.98').toDecimalPlaces(8, Dec.ROUND_DOWN);
      const leg = { usdPerUnit: new Dec(1), source: 'test', live: true };
      return { from, to, amount, credited, rate: credited.div(amount), fromLeg: leg, toLeg: leg };
    }),
  };
});

describeDb('fund integrity across money flows', () => {
  let app: Express;
  let prisma: any;
  let auth: (u: any) => string;
  let audit: typeof import('../services/ledger/fundIntegrity.service');
  let admin: any; let alice: any; let bob: any; let carol: any;
  let seq = 0;

  async function createUser(role: 'USER' | 'ADMIN' = 'USER') {
    seq += 1;
    return prisma.user.create({
      data: {
        email: `${SCHEMA}_${seq}@example.com`, passwordHash: 'x', firstName: 'Fund', lastName: `Test${seq}`,
        username: `${SCHEMA}_${seq}`, role, status: 'ACTIVE', kycStatus: 'APPROVED', kycTier: 'TIER_2',
        emailVerified: true, referralCode: `${SCHEMA}${seq}`.slice(-16),
      },
    });
  }
  const bal = async (userId: string, currency: string) =>
    new Decimal((await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency } } }))?.balance.toString() ?? '0');

  async function deposit(user: any, currency: string, amount: string) {
    const d = await prisma.deposit.create({ data: { userId: user.id, currency, amount: new Decimal(amount), paymentMethod: 'BANK_TRANSFER', status: 'WAITING_CONFIRMATION', reference: `${SCHEMA}_dep_${++seq}` } });
    const r = await request(app).put(`/api/admin/deposits/${d.id}/confirm`).set('Authorization', auth(admin)).send({});
    expect(r.status).toBe(200);
  }

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }, stdio: 'pipe' });
    ({ prisma } = await import('../utils/prisma'));
    const { generateTokens } = await import('../middleware/auth');
    auth = (u: any) => `Bearer ${generateTokens(u).accessToken}`;
    audit = await import('../services/ledger/fundIntegrity.service');
    const [{ adminRouter }, { claimLinkRouter }, { p2pRouter }, { withdrawalRouter }, { messageRouter }, { transferRouter }, { walletRouter }, { errorHandler }] = await Promise.all([
      import('../routes/admin'), import('../routes/claimLink'), import('../routes/p2p'), import('../routes/withdrawal'),
      import('../routes/messages'), import('../routes/transfer'), import('../routes/wallet'), import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api/claim-links', claimLinkRouter);
    app.use('/api/p2p', p2pRouter);
    app.use('/api/withdrawals', withdrawalRouter);
    app.use('/api/messages', messageRouter);
    app.use('/api/transfers', transferRouter);
    app.use('/api/wallets', walletRouter);
    app.use(errorHandler);

    admin = await createUser('ADMIN');
    alice = await createUser(); bob = await createUser(); carol = await createUser();
    await prisma.platformSettings.create({ data: { key: 'transfer_fee_usd', value: '2' } });
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('accounts for every unit after the live money flows', async () => {
    await deposit(alice, 'USD', '1000');
    await deposit(alice, 'USDT', '500');
    await deposit(bob, 'USDT', '300');

    // Transfer with a USD fee: the fee is credited to the platform as USDT.
    const t = await request(app).post('/api/transfers/send').set('Authorization', auth(alice)).send({ recipientEmail: bob.email, currency: 'USD', amount: 100 });
    expect(t.status).toBe(201);

    // Swap USD → USDT with Tazdan as the FX counterparty.
    const s = await request(app).post('/api/wallets/swap').set('Authorization', auth(alice)).send({ from: 'USD', to: 'USDT', amount: 200 });
    expect(s.status).toBe(201);

    // Claim link.
    const link = await request(app).post('/api/claim-links').set('Authorization', auth(alice)).send({ asset: 'USDT', amount: 40, recipientEmail: carol.email });
    expect(link.status).toBe(201);
    expect((await request(app).post(`/api/claim-links/by-token/${link.body.link.claimToken}/claim`).set('Authorization', auth(carol)).send({})).status).toBe(200);

    // Chat payment.
    expect((await request(app).post('/api/messages').set('Authorization', auth(bob)).send({ receiverId: carol.id, content: 'pay', type: 'PAYMENT', metadata: { amount: 10, currency: 'USD' } })).status).toBe(201);

    // P2P trade released with its fee.
    const listing = await request(app).post('/api/p2p/listings').set('Authorization', auth(bob))
      .send({ currency: 'USDT', fiatCurrency: 'USD', side: 'SELL', price: 1, amount: 50, minLimit: 1, maxLimit: 50, paymentMethods: ['BANK_TRANSFER'] });
    expect(listing.status).toBe(201);
    const trade = await request(app).post('/api/p2p/trades').set('Authorization', auth(carol)).send({ listingId: listing.body.listing.id, amount: 50 });
    expect(trade.status).toBe(201);
    expect((await request(app).put(`/api/p2p/trades/${trade.body.trade.id}/payment-sent`).set('Authorization', auth(carol)).send({})).status).toBe(200);
    expect((await request(app).put(`/api/p2p/trades/${trade.body.trade.id}/confirm`).set('Authorization', auth(bob)).send({})).status).toBe(200);

    // Withdrawal requested, then paid by staff.
    const w = await request(app).post('/api/withdrawals').set('Authorization', auth(alice))
      .send({ currency: 'USDT', amount: 100, network: 'TRC20', walletAddress: 'TXYZabcdefghijklmnopqrstuvwxyz1234' });
    expect(w.status).toBe(201);
    const wd = await prisma.withdrawal.findFirst({ where: { userId: alice.id }, orderBy: { createdAt: 'desc' } });
    expect((await request(app).put(`/api/admin/withdrawals/${wd.id}/process`).set('Authorization', auth(admin)).send({ notes: 'paid' })).status).toBe(200);

    // Staff credit and an onboarding credit, both controlled adjustments.
    expect((await request(app).post('/api/admin/manual-credit').set('Authorization', auth(admin)).send({ userId: carol.id, currency: 'USD', amount: 20, note: 'Goodwill for a delayed payout' })).status).toBe(200);
    const onboard = await request(app).post('/api/admin/users').set('Authorization', auth(admin))
      .send({ email: `${SCHEMA}_dave@example.com`, firstName: 'Dave', lastName: 'Onboard', password: 'Str0ng-Passw0rd!', initialBalances: [{ currency: 'USD', amount: 30 }] });
    expect(onboard.status).toBe(201);
    expect(onboard.body.openingBalances).toEqual([expect.objectContaining({ currency: 'USD', pendingApproval: false })]);
    expect((await bal(onboard.body.user.id, 'USD')).toString()).toBe('30');

    // Sanity: the platform earned fees that the old audit misread as new USDT.
    const platform = await prisma.user.findFirst({ where: { username: 'platform' } });
    expect((await bal(platform.id, 'USDT')).gt(0)).toBe(true);

    const report = await audit.auditFundIntegrity();
    for (const c of report.perCurrency) {
      expect({ currency: c.currency, diff: new Decimal(c.diff).abs().lte('0.0001'), unbacked: c.unbacked, rail: c.railExceptions })
        .toEqual({ currency: c.currency, diff: true, unbacked: '0', rail: 0 });
      expect(c.ok).toBe(true);
    }
    expect(report.ok).toBe(true);
    const usd = report.perCurrency.find((c) => c.currency === 'USD')!;
    expect(usd.flows.map((f) => f.refType).sort()).toEqual(['adjustment', 'deposit']);
  });

  it('an onboarding credit above the single-control limit waits for a second approver', async () => {
    const r = await request(app).post('/api/admin/users').set('Authorization', auth(admin))
      .send({ email: `${SCHEMA}_erin@example.com`, firstName: 'Erin', lastName: 'Onboard', password: 'Str0ng-Passw0rd!', initialBalances: [{ currency: 'USD', amount: 5000 }] });
    expect(r.status).toBe(201);
    expect(r.body.openingBalances[0]).toEqual(expect.objectContaining({ pendingApproval: true, approvalId: expect.any(String) }));
    expect((await bal(r.body.user.id, 'USD')).toString()).toBe('0');
    const approval = await prisma.approvalRequest.findUnique({ where: { id: r.body.openingBalances[0].approvalId } });
    expect(approval.type).toBe('LEDGER_ADJUSTMENT');
  });

  it('reports unbacked value until it is acknowledged, then flags anything new and halts', async () => {
    expect((await request(app).post('/api/admin/seed-balance').set('Authorization', auth(admin)).send({ userId: carol.id, currency: 'USDT', amount: 5 })).status).toBe(200);
    let usdt = (await audit.auditFundIntegrity()).perCurrency.find((c) => c.currency === 'USDT')!;
    expect(usdt.ok).toBe(false);
    expect(usdt.unbacked).toBe('5');
    expect(usdt.flows.find((f) => f.refType === 'sim_seed_credit')?.class).toBe('UNBACKED');

    await expect(audit.acknowledgeBaseline({ currency: 'USDT', staffId: admin.id, note: 'short' })).rejects.toThrow(/at least 10/);
    const ack = await audit.acknowledgeBaseline({ currency: 'USDT', staffId: admin.id, note: 'Simulator seed on a test account, confirmed' });
    expect(ack.acknowledgedAmount).toBe('5');
    usdt = (await audit.auditFundIntegrity()).perCurrency.find((c) => c.currency === 'USDT')!;
    expect(usdt.ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: 'FUND_BASELINE_ACKNOWLEDGED', entityId: 'USDT' } })).toBe(1);

    await new Promise((r) => setTimeout(r, 5));
    expect((await request(app).post('/api/admin/seed-balance').set('Authorization', auth(admin)).send({ userId: carol.id, currency: 'USDT', amount: 3 })).status).toBe(200);
    const { isTradingHalted, setTradingHalt } = await import('../services/ledger/reconcile.service');
    usdt = (await audit.auditFundIntegrity({ haltOnBreach: true })).perCurrency.find((c) => c.currency === 'USDT')!;
    expect(usdt.unbackedSinceBaseline).toBe('3');
    expect(await isTradingHalted()).toBe(true);
    await setTradingHalt(false, 'test');
  });

  it('lists a boundary posting that has no record, and queues it for reconciliation', async () => {
    const { postLedger } = await import('../services/ledger/ledger.service');
    const ghost = '00000000-0000-4000-8000-00000000abcd';
    await prisma.$transaction((tx: any) => postLedger(tx, {
      refType: 'deposit', refId: ghost,
      legs: [{ type: 'SYSTEM_ONRAMP', currency: 'EUR', amount: new Decimal('-12') }, { type: 'USER', userId: bob.id, currency: 'EUR', amount: new Decimal('12') }],
    }));
    const report = await audit.auditFundIntegrity();
    expect(report.railExceptions).toEqual([expect.objectContaining({ rail: 'DEPOSIT', refId: ghost, posted: expect.stringMatching(/^12/), recorded: null })]);
    expect(report.perCurrency.find((c) => c.currency === 'EUR')!.ok).toBe(false);

    const { runIntegrityReconciliation } = await import('../services/reconciliation/recon.service');
    await runIntegrityReconciliation();
    const item = await prisma.reconciliationItem.findFirst({ where: { internalType: 'RAIL_DEPOSIT', internalId: ghost } });
    expect(item).toEqual(expect.objectContaining({ status: 'MISSING_EXTERNAL', resolution: 'OPEN', currency: 'EUR' }));
  });

  it('reports wallet drift and refuses to acknowledge history while it exists', async () => {
    await prisma.wallet.update({ where: { userId_currency: { userId: alice.id, currency: 'USD' } }, data: { balance: { increment: 1 } } });
    const usd = (await audit.auditFundIntegrity()).perCurrency.find((c) => c.currency === 'USD')!;
    expect(usd.diff).toBe('1');
    expect(usd.ok).toBe(false);
    await expect(audit.acknowledgeBaseline({ currency: 'USD', staffId: admin.id, note: 'Trying to acknowledge over drift' })).rejects.toThrow(/differ from the ledger/);
  });
});
