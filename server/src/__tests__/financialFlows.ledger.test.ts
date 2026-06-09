import { Decimal } from '@prisma/client/runtime/library';
import { postLedger, type Tx } from '../services/ledger/ledger.service';

function makeFakeTx() {
  const accounts: any[] = [];
  const entries: any[] = [];
  let seq = 0;

  const dec = (value: any) => new Decimal(value.toString());
  const findAccount = (type: string, userId: string | null, currency: string) =>
    accounts.find((a) => a.type === type && a.userId === userId && a.currency === currency);
  const applyBalanceUpdate = (account: any, balanceUpdate: any) => {
    if (balanceUpdate && typeof balanceUpdate === 'object' && 'increment' in balanceUpdate) {
      account.balance = dec(account.balance).plus(dec(balanceUpdate.increment));
    } else {
      account.balance = dec(balanceUpdate);
    }
  };

  const tx = {
    ledgerAccount: {
      findFirst: async ({ where }: any) =>
        findAccount(where.type, where.userId ?? null, where.currency) ?? null,
      create: async ({ data }: any) => {
        const account = {
          id: `acct_${seq++}`,
          balance: new Decimal(0),
          ...data,
          userId: data.userId ?? null,
        };
        accounts.push(account);
        return account;
      },
      update: async ({ where, data }: any) => {
        const account = accounts.find((a) => a.id === where.id);
        applyBalanceUpdate(account, data.balance);
        return account;
      },
      updateMany: async ({ where, data }: any) => {
        const account = accounts.find((a) => a.id === where.id);
        if (!account) return { count: 0 };
        if (where.balance?.gte !== undefined && dec(account.balance).lt(dec(where.balance.gte))) {
          return { count: 0 };
        }
        applyBalanceUpdate(account, data.balance);
        return { count: 1 };
      },
    },
    ledgerEntry: {
      create: async ({ data }: any) => {
        const entry = { id: `entry_${seq++}`, ...data };
        entries.push(entry);
        return entry;
      },
    },
    bal: (type: string, userId: string | null, currency: string) =>
      dec(findAccount(type, userId, currency)?.balance ?? 0),
    byRef: (refType: string, refId: string) =>
      entries.filter((entry) => entry.refType === refType && entry.refId === refId),
  };

  return tx as unknown as Tx & {
    bal: (type: string, userId: string | null, currency: string) => Decimal;
    byRef: (refType: string, refId: string) => any[];
  };
}

async function seed(tx: Tx, userId: string, currency: any, amount: string) {
  await postLedger(tx, {
    refType: 'test_seed',
    refId: `${userId}_${currency}`,
    legs: [
      { type: 'SYSTEM_ONRAMP', currency, amount: new Decimal(amount).neg() },
      { type: 'USER', userId, currency, amount },
    ],
  });
}

describe('financial flow ledger scenarios', () => {
  it('covers deposit confirmation, admin credit, and admin debit', async () => {
    const tx = makeFakeTx();
    await postLedger(tx, {
      refType: 'deposit',
      refId: 'dep_1',
      legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USD', amount: '-100' },
        { type: 'USER', userId: 'alice', currency: 'USD', amount: '100' },
      ],
    });
    await postLedger(tx, {
      refType: 'admin_credit',
      refId: 'adm_cr_1',
      legs: [
        { type: 'SYSTEM_ONRAMP', currency: 'USDT', amount: '-25' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '25' },
      ],
    });
    await postLedger(tx, {
      refType: 'admin_debit',
      refId: 'adm_db_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-5' },
        { type: 'SYSTEM_OFFRAMP', currency: 'USDT', amount: '5' },
      ],
    });

    expect(tx.bal('USER', 'alice', 'USD').toString()).toBe('100');
    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('20');
  });

  it('covers withdrawal approve/settle and reject/cancel as no-ledger release-only states', async () => {
    const tx = makeFakeTx();
    await seed(tx, 'alice', 'USDT', '100');
    await postLedger(tx, {
      refType: 'withdrawal',
      refId: 'wdr_approved',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-20' },
        { type: 'SYSTEM_OFFRAMP', currency: 'USDT', amount: '19' },
        { type: 'PLATFORM', currency: 'USDT', amount: '1' },
      ],
    });

    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('80');
    expect(tx.byRef('withdrawal', 'wdr_rejected')).toHaveLength(0);
    expect(tx.byRef('withdrawal', 'wdr_cancelled')).toHaveLength(0);
  });

  it('covers buy, sell, recurring buy, and corporate fee revenue', async () => {
    const tx = makeFakeTx();
    await seed(tx, 'alice', 'USDT', '1000');
    await postLedger(tx, {
      refType: 'buy',
      refId: 'buy_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-101' },
        { type: 'SYSTEM_FX', currency: 'USDT', amount: '101' },
        { type: 'SYSTEM_FX', currency: 'BTC', amount: '-0.001' },
        { type: 'USER', userId: 'alice', currency: 'BTC', amount: '0.001' },
        { type: 'SYSTEM_FX', currency: 'USDT', amount: '-1' },
        { type: 'PLATFORM', currency: 'USDT', amount: '1' },
      ],
    });
    await postLedger(tx, {
      refType: 'sell',
      refId: 'sell_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'BTC', amount: '-0.0005' },
        { type: 'SYSTEM_FX', currency: 'BTC', amount: '0.0005' },
        { type: 'SYSTEM_FX', currency: 'USDT', amount: '-49.5' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '49.5' },
      ],
    });
    await postLedger(tx, {
      refType: 'recurring_buy',
      refId: 'rb_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-10' },
        { type: 'SYSTEM_FX', currency: 'USDT', amount: '10' },
        { type: 'SYSTEM_FX', currency: 'ETH', amount: '-0.003' },
        { type: 'USER', userId: 'alice', currency: 'ETH', amount: '0.003' },
      ],
    });

    expect(tx.bal('PLATFORM', null, 'USDT').toString()).toBe('1');
    expect(tx.bal('USER', 'alice', 'BTC').toString()).toBe('0.0005');
  });

  it('covers P2P escrow lock, release, refund, and dispute resolution', async () => {
    const tx = makeFakeTx();
    await seed(tx, 'seller', 'USDT', '50');
    await postLedger(tx, {
      refType: 'p2p_escrow_lock',
      refId: 'p2p_1',
      legs: [
        { type: 'USER', userId: 'seller', currency: 'USDT', amount: '-10' },
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '10' },
      ],
    });
    await postLedger(tx, {
      refType: 'p2p_release',
      refId: 'p2p_1',
      legs: [
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '-10' },
        { type: 'USER', userId: 'buyer', currency: 'USDT', amount: '9.9' },
        { type: 'PLATFORM', currency: 'USDT', amount: '0.1' },
      ],
    });
    await postLedger(tx, {
      refType: 'p2p_refund',
      refId: 'p2p_2',
      legs: [
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '-5' },
        { type: 'USER', userId: 'seller', currency: 'USDT', amount: '5' },
      ],
    }, { allowNegativeUser: true });
    await postLedger(tx, {
      refType: 'p2p_dispute',
      refId: 'p2p_3',
      legs: [
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '-6' },
        { type: 'USER', userId: 'buyer', currency: 'USDT', amount: '3' },
        { type: 'USER', userId: 'seller', currency: 'USDT', amount: '3' },
      ],
    }, { allowNegativeUser: true });

    expect(tx.bal('USER', 'buyer', 'USDT').toString()).toBe('12.9');
    expect(tx.bal('PLATFORM', null, 'USDT').toString()).toBe('0.1');
  });

  it('covers claim links, card top-up/spend/refund/cashback, and liquidity payouts', async () => {
    const tx = makeFakeTx();
    await seed(tx, 'alice', 'USDT', '100');
    await postLedger(tx, {
      refType: 'claim_link',
      refId: 'cl_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-12' },
        { type: 'USER', userId: 'bob', currency: 'USDT', amount: '12' },
      ],
    });
    await postLedger(tx, {
      refType: 'card_top_up',
      refId: 'card_top_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-20' },
        { type: 'SYSTEM_OFFRAMP', currency: 'USDT', amount: '20' },
      ],
    });
    await postLedger(tx, {
      refType: 'card_spend',
      refId: 'card_spend_1',
      legs: [
        { type: 'SYSTEM_OFFRAMP', currency: 'USDT', amount: '-5.1' },
        { type: 'SYSTEM_CHAIN', currency: 'USDT', amount: '5' },
        { type: 'PLATFORM', currency: 'USDT', amount: '0.1' },
      ],
    });
    await postLedger(tx, {
      refType: 'card_refund_cashback',
      refId: 'card_ref_1',
      legs: [
        { type: 'SYSTEM_CHAIN', currency: 'USDT', amount: '-2.05' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '2' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '0.05' },
      ],
    });
    await postLedger(tx, {
      refType: 'liquidity_pool_deposit',
      refId: 'pool_d_1',
      legs: [
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '-10' },
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '10' },
      ],
    });
    await postLedger(tx, {
      refType: 'liquidity_pool_payout',
      refId: 'pool_p_1',
      legs: [
        { type: 'SYSTEM_ESCROW', currency: 'USDT', amount: '-4' },
        { type: 'USER', userId: 'alice', currency: 'USDT', amount: '4' },
      ],
    });

    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('64.05');
  });

  it('keeps failed webhooks out of the ledger and supports idempotent retry assertions', async () => {
    const tx = makeFakeTx();
    const processed = new Set<string>();
    const applyWebhook = async (id: string, shouldFail = false) => {
      if (shouldFail) throw new Error('provider unavailable');
      if (processed.has(id)) return;
      processed.add(id);
      await postLedger(tx, {
        refType: 'webhook_deposit',
        refId: id,
        legs: [
          { type: 'SYSTEM_ONRAMP', currency: 'USDT', amount: '-15' },
          { type: 'USER', userId: 'alice', currency: 'USDT', amount: '15' },
        ],
      });
    };

    await expect(applyWebhook('evt_1', true)).rejects.toThrow('provider unavailable');
    expect(tx.byRef('webhook_deposit', 'evt_1')).toHaveLength(0);
    await applyWebhook('evt_1');
    await applyWebhook('evt_1');
    expect(tx.byRef('webhook_deposit', 'evt_1')).toHaveLength(2);
    expect(tx.bal('USER', 'alice', 'USDT').toString()).toBe('15');
  });
});
