/**
 * Balance mutation integration tests.
 *
 * These run in CI where Postgres is available. Locally, opt in with
 * RUN_DB_TESTS=1 to avoid surprising developers who do not have the test DB.
 */
import request from 'supertest';
import type { Express } from 'express';
import express from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { generateTokens } from '../middleware/auth';
import { postLedger } from '../services/ledger/ledger.service';
import { prisma } from '../utils/prisma';

jest.mock('../services/wallet/walletDerivation.service', () => ({
  createUserWallets: jest.fn(),
}));

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;

const marker = `bal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emails: string[] = [];
let app: Express;

async function createUser(role: 'USER' | 'ADMIN' = 'USER') {
  const email = `${marker}_${role.toLowerCase()}_${emails.length}@example.com`;
  emails.push(email);
  return prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      firstName: role === 'ADMIN' ? 'Admin' : 'User',
      lastName: 'Balance',
      role,
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      emailVerified: true,
      referralCode: `${marker}_${emails.length}`.slice(0, 32),
    },
  });
}

function auth(user: { id: string; email: string; role: string }) {
  return `Bearer ${generateTokens(user).accessToken}`;
}

async function expectBalanced(refType: string, refId: string) {
  const entries = await prisma.ledgerEntry.findMany({ where: { refType, refId } });
  expect(entries.length).toBeGreaterThanOrEqual(2);
  const byCurrency = new Map<string, Decimal>();
  for (const entry of entries) {
    const current = byCurrency.get(entry.currency) ?? new Decimal(0);
    byCurrency.set(entry.currency, current.add(new Decimal(entry.amount.toString())));
  }
  for (const [, sum] of byCurrency) {
    expect(sum.toString()).toBe('0');
  }
}

describeDb('balance mutations mirror to the double-entry ledger', () => {
  beforeAll(async () => {
    const [{ adminRouter }, { claimLinkRouter }, { errorHandler }] = await Promise.all([
      import('../routes/admin'),
      import('../routes/claimLink'),
      import('../middleware/errorHandler'),
    ]);
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use('/api/claim-links', claimLinkRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('admin deposit confirmation credits Wallet and LedgerAccount', async () => {
    const admin = await createUser('ADMIN');
    const user = await createUser('USER');
    await prisma.wallet.create({ data: { userId: user.id, currency: 'USD', balance: 0, frozen: 0 } });
    const deposit = await prisma.deposit.create({
      data: {
        userId: user.id,
        currency: 'USD',
        amount: new Decimal('125.50'),
        paymentMethod: 'BANK_TRANSFER',
        reference: `DEP-${marker}`,
        status: 'WAITING_CONFIRMATION',
      },
    });

    const res = await request(app)
      .put(`/api/admin/deposits/${deposit.id}/confirm`)
      .set('Authorization', auth(admin))
      .send({ notes: 'wire landed' });

    expect(res.status).toBe(200);
    const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: user.id, currency: 'USD' } } });
    expect(wallet?.balance.toString()).toBe('125.5');
    const ledger = await prisma.ledgerAccount.findFirst({ where: { type: 'USER', userId: user.id, currency: 'USD' } });
    expect(ledger?.balance.toString()).toBe('125.5');
    await expectBalanced('deposit', deposit.id);
  });

  it('admin manual credit records the external source in the ledger', async () => {
    const admin = await createUser('ADMIN');
    const user = await createUser('USER');

    const res = await request(app)
      .post('/api/admin/manual-credit')
      .set('Authorization', auth(admin))
      .send({ userId: user.id, currency: 'USDT', amount: 42, note: 'opening balance' });

    expect(res.status).toBe(200);
    const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: user.id, currency: 'USDT' } } });
    expect(wallet?.balance.toString()).toBe('42');
    const ledger = await prisma.ledgerAccount.findFirst({ where: { type: 'USER', userId: user.id, currency: 'USDT' } });
    expect(ledger?.balance.toString()).toBe('42');
    const tx = await prisma.transaction.findFirst({ where: { userId: user.id, reference: { startsWith: 'ADMIN-' } }, orderBy: { createdAt: 'desc' } });
    expect(tx).toBeTruthy();
    expect(tx!.reference).toBeTruthy();
    await expectBalanced('admin_credit', tx!.reference!);
  });

  it('claim-link redemption moves sender and recipient balances in the ledger', async () => {
    const sender = await createUser('USER');
    const recipient = await createUser('USER');
    await prisma.$transaction(async (tx) => {
      await tx.wallet.create({ data: { userId: sender.id, currency: 'USDT', balance: 50, frozen: 0 } });
      await postLedger(tx, {
        refType: 'test_seed',
        refId: `${marker}-claim`,
        legs: [
          { type: 'SYSTEM_ONRAMP', currency: 'USDT', amount: '-50' },
          { type: 'USER', userId: sender.id, currency: 'USDT', amount: '50' },
        ],
      });
    });

    const create = await request(app)
      .post('/api/claim-links')
      .set('Authorization', auth(sender))
      .send({ asset: 'USDT', amount: 12.5, recipientEmail: recipient.email });
    expect(create.status).toBe(201);

    const token = create.body.link.claimToken;
    const claim = await request(app)
      .post(`/api/claim-links/by-token/${token}/claim`)
      .set('Authorization', auth(recipient))
      .send({});
    expect(claim.status).toBe(200);

    const [senderWallet, recipientWallet] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId_currency: { userId: sender.id, currency: 'USDT' } } }),
      prisma.wallet.findUnique({ where: { userId_currency: { userId: recipient.id, currency: 'USDT' } } }),
    ]);
    expect(senderWallet?.balance.toString()).toBe('37.5');
    expect(senderWallet?.frozen.toString()).toBe('0');
    expect(recipientWallet?.balance.toString()).toBe('12.5');

    const linkId = create.body.link.id;
    await expectBalanced('claim_link', linkId);
    const senderLedger = await prisma.ledgerAccount.findFirst({ where: { type: 'USER', userId: sender.id, currency: 'USDT' } });
    const recipientLedger = await prisma.ledgerAccount.findFirst({ where: { type: 'USER', userId: recipient.id, currency: 'USDT' } });
    expect(senderLedger?.balance.toString()).toBe('37.5');
    expect(recipientLedger?.balance.toString()).toBe('12.5');
  });
});
