/**
 * Ledger invariant tests — the guard rail that makes the money bugs we hit
 * (wrong-ledger credits, settlement-currency conflation, phantom balances)
 * structurally impossible to ship. These exercise postLedger() against an
 * in-memory fake Prisma transaction so they run with no DB.
 *
 * The contract under test: a movement only commits if its legs sum to zero
 * per currency, user balances can't go negative, and balances move exactly
 * as posted.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { postLedger, transferLegs, type Tx } from '../services/ledger/ledger.service';

// ── In-memory fake of the bits of Prisma.TransactionClient the ledger uses ──
function makeFakeTx() {
  const accounts: any[] = [];
  const entries: any[] = [];
  let seq = 0;

  const findAccount = (type: string, userId: string | null, currency: string) =>
    accounts.find((a) => a.type === type && a.userId === userId && a.currency === currency);
  const dec = (value: any) => new Decimal(value.toString());
  const applyBalanceUpdate = (account: any, balanceUpdate: any) => {
    if (balanceUpdate && typeof balanceUpdate === 'object' && 'increment' in balanceUpdate) {
      account.balance = dec(account.balance).plus(dec(balanceUpdate.increment));
    } else {
      account.balance = dec(balanceUpdate);
    }
  };

  const tx = {
    ledgerAccount: {
      findFirst: async ({ where }: any) => {
        const { type, userId, currency } = where;
        return findAccount(type, userId ?? null, currency) ?? null;
      },
      create: async ({ data }: any) => {
        const a = { id: `acct_${seq++}`, balance: new Decimal(0), ...data, userId: data.userId ?? null };
        accounts.push(a);
        return a;
      },
      update: async ({ where, data }: any) => {
        const a = accounts.find((x) => x.id === where.id);
        applyBalanceUpdate(a, data.balance);
        return a;
      },
      updateMany: async ({ where, data }: any) => {
        const a = accounts.find((x) => x.id === where.id);
        if (!a) return { count: 0 };
        if (where.balance?.gte !== undefined && dec(a.balance).lt(dec(where.balance.gte))) {
          return { count: 0 };
        }
        applyBalanceUpdate(a, data.balance);
        return { count: 1 };
      },
    },
    ledgerEntry: {
      create: async ({ data }: any) => { const e = { id: `e_${seq++}`, ...data }; entries.push(e); return e; },
    },
    _accounts: accounts,
    _entries: entries,
    bal: (type: string, userId: string | null, currency: string) =>
      new Decimal((findAccount(type, userId ?? null, currency)?.balance ?? 0).toString()),
  };
  return tx as unknown as Tx & { _accounts: any[]; _entries: any[]; bal: (t: string, u: string | null, c: string) => Decimal };
}

describe('postLedger — conservation invariant', () => {
  it('commits a balanced single-currency transfer and moves balances exactly', async () => {
    const tx = makeFakeTx();
    // Seed alice with 100 USDT by crediting from the on-ramp system account.
    await postLedger(tx, {
      refType: 'deposit',
      legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USDT', amount: '-100' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '100' },
      ],
    });
    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('100');
    expect(tx.bal('SYSTEM_ONRAMP', null, 'USDT').toString()).toBe('-100');

    // alice → bob 40 USDT
    await postLedger(tx, {
      refType: 'transfer',
      legs: transferLegs({
        currency: 'USDT', amount: 40,
        from: { type: 'USER', userId: 'alice' },
        to:   { type: 'USER', userId: 'bob' },
      }),
    });
    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('60');
    expect(tx.bal('USER', 'bob', 'USDT').toString()).toBe('40');
  });

  it('REJECTS an imbalanced group (the class of bug that conjured money)', async () => {
    const tx = makeFakeTx();
    await expect(
      postLedger(tx, {
        refType: 'buy',
        legs: [
          { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-100' },
          { type: 'SYSTEM_CHAIN', currency: 'USDT', amount: '100' },
          { type: 'USER', userId: 'alice', currency: 'BTC', amount: '0.002' }, // BTC leg unbalanced
        ],
      }),
    ).rejects.toThrow(/imbalance for BTC/);
  });

  it('REJECTS a single-currency group that does not net to zero', async () => {
    const tx = makeFakeTx();
    await expect(
      postLedger(tx, {
        refType: 'sell',
        legs: [
          { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-100' },
          { type: 'USER', userId: 'bob', currency: 'USDT', amount: '90' }, // 10 vanished
        ],
      }),
    ).rejects.toThrow(/imbalance for USDT/);
  });

  it('balances a cross-currency FX conversion per-currency via SYSTEM_FX', async () => {
    const tx = makeFakeTx();
    // Seed alice with 100 USD.
    await postLedger(tx, { refType: 'deposit', legs: [
      { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: '-100' },
      { type: 'USER', userId: 'alice', currency: 'USD', amount: '100' },
    ]});
    // FX: alice sells 100 USD, receives 720 LYD (rate 7.2). Each currency
    // balances against SYSTEM_FX — money conserved within each currency.
    await postLedger(tx, { refType: 'fx', legs: [
      { type: 'USER', userId: 'alice', currency: 'USD', amount: '-100' },
      { type: 'SYSTEM_FX', currency: 'USD', amount: '100' },
      { type: 'SYSTEM_FX', currency: 'LYD', amount: '-720' },
      { type: 'USER', userId: 'alice', currency: 'LYD', amount: '720' },
    ]});
    expect(tx.bal('USER', 'alice', 'USD').toString()).toBe('0');
    expect(tx.bal('USER', 'alice', 'LYD').toString()).toBe('720');
    // SYSTEM_FX now holds +100 USD / -720 LYD — the conversion position.
    expect(tx.bal('SYSTEM_FX', null, 'USD').toString()).toBe('100');
    expect(tx.bal('SYSTEM_FX', null, 'LYD').toString()).toBe('-720');
  });

  it('prevents a user balance from going negative', async () => {
    const tx = makeFakeTx();
    await expect(
      postLedger(tx, {
        refType: 'withdrawal',
        legs: transferLegs({
          currency: 'USDT', amount: 50,
          from: { type: 'USER', userId: 'alice' }, // alice has 0
          to:   { type: 'SYSTEM_OFFRAMP' },
        }),
      }),
    ).rejects.toThrow(/Insufficient USDT/);
  });

  it('conserves money across a full buy → sell round trip (no phantom balance)', async () => {
    const tx = makeFakeTx();
    // Fund alice 1000 USDT from on-ramp.
    await postLedger(tx, { refType: 'deposit', legs: [
      { type: 'SYSTEM_ONRAMP', currency: 'USDT', amount: '-1000' },
      { type: 'USER', userId: 'alice', currency: 'USDT', amount: '1000' },
    ]});
    // BUY 0.01 BTC for 500 USDT (+5 USDT fee to platform). USDT side: -500-5
    // from alice, +5 to platform, +500 to chain (crypto sourced). BTC side:
    // +0.01 to alice, -0.01 from chain.
    await postLedger(tx, { refType: 'buy', legs: [
      { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-505' },
      { type: 'PLATFORM', currency: 'USDT', amount: '5' },
      { type: 'SYSTEM_CHAIN', currency: 'USDT', amount: '500' },
      { type: 'USER', userId: 'alice', currency: 'BTC', amount: '0.01' },
      { type: 'SYSTEM_CHAIN', currency: 'BTC', amount: '-0.01' },
    ]});
    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('495');
    expect(tx.bal('USER', 'alice', 'BTC').toString()).toBe('0.01');
    expect(tx.bal('PLATFORM', null, 'USDT').toString()).toBe('5');

    // Global conservation: every currency nets to zero across all accounts.
    const totals = new Map<string, Decimal>();
    for (const e of (tx as any)._entries) {
      totals.set(e.currency, (totals.get(e.currency) ?? new Decimal(0)).plus(new Decimal(e.amount.toString())));
    }
    for (const [, sum] of totals) expect(sum.toString()).toBe('0');
  });
});
