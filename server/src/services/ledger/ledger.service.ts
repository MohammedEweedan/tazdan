/**
 * Double-entry ledger — the single source of truth for money.
 *
 * Every value movement on the platform (buy, sell, deposit, withdrawal,
 * transfer, fee, P2P, claim link, FX conversion, on-chain settlement) is
 * recorded as a balanced set of LedgerEntry rows grouped by `groupId`.
 *
 * THE INVARIANT: within a group, signed amounts sum to exactly ZERO per
 * currency. Money is never created or destroyed — it moves between accounts.
 * External rails (fiat on/off-ramp, the blockchain) have SYSTEM accounts that
 * form the other side of the entry, so even "money entering the system" nets
 * to zero in the books (SYSTEM_ONRAMP goes negative, the user goes positive).
 *
 * `postLedger()` asserts the invariant BEFORE committing and updates each
 * account's cached `balance`. A scheduled reconciliation (reconcile.service)
 * re-derives balances from entries and halts trading on any drift.
 *
 * Multi-currency / multi-corridor by construction: an FX conversion is two
 * single-currency balanced groups joined through the SYSTEM_FX account, so
 * USD→LYD or NGN→USDT all settle with the same primitive. This is the spine
 * for global crypto + remittances, not a Libya-specific hack.
 */
import { Prisma, type Currency, type LedgerAccountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';

export type Tx = Prisma.TransactionClient;

/** Currencies the ledger enum can represent. Exotic altcoins held only in
 *  UserWallet.altBalances are skipped by mirrors until they get enum support. */
export const LEDGER_CURRENCIES = new Set<string>([
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
  'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD',
]);
export function isLedgerCurrency(c: string): boolean {
  return LEDGER_CURRENCIES.has(c.toUpperCase());
}

/** One side of a movement. `amount` is signed: +credit into account, -debit. */
export interface Leg {
  type: LedgerAccountType;
  /** Required for USER accounts; omit for system/platform accounts. */
  userId?: string | null;
  currency: Currency;
  amount: Decimal | string | number;
}

export interface PostInput {
  /** What produced this movement: 'buy','sell','deposit','withdrawal',… */
  refType: string;
  refId?: string | null;
  memo?: string;
  legs: Leg[];
}

// Tolerance for floating-point dust when summing high-precision decimals.
const EPS = new Decimal('0.000000000001'); // 1e-12

function keyFor(leg: Pick<Leg, 'type' | 'userId' | 'currency'>): string {
  return `${leg.type}:${leg.userId ?? 'SYSTEM'}:${leg.currency}`;
}

/**
 * Resolve (find-or-create) a ledger account. System/platform accounts have a
 * null userId and are unique per (type, currency).
 */
export async function resolveAccount(
  tx: Tx,
  type: LedgerAccountType,
  currency: Currency,
  userId: string | null = null,
): Promise<{ id: string; balance: Decimal }> {
  // `findFirst` (not findUnique) because the compound unique key includes a
  // nullable userId, which Prisma's unique-where input can't express for the
  // system-account (userId = null) case.
  const existing = await tx.ledgerAccount.findFirst({ where: { type, userId, currency } });
  if (existing) return { id: existing.id, balance: new Decimal(existing.balance.toString()) };
  const created = await tx.ledgerAccount.create({ data: { type, userId, currency } });
  return { id: created.id, balance: new Decimal(0) };
}

/**
 * Post a balanced set of legs to the ledger. Throws if the legs don't sum to
 * zero per currency (the conservation invariant). Runs inside the caller's
 * transaction so the whole business operation is atomic with the ledger.
 *
 * @param allowNegative accounts allowed to go negative (system rails do; user
 *   wallets must not — passing the user's account here would be a bug, so the
 *   default forbids negative USER balances).
 */
export async function postLedger(
  tx: Tx,
  input: PostInput,
  opts: { allowNegativeUser?: boolean } = {},
): Promise<{ groupId: string }> {
  if (!input.legs.length) throw new Error('postLedger: no legs');

  // 1) Assert conservation: signed sum per currency must be ~0.
  const perCurrency = new Map<string, Decimal>();
  for (const leg of input.legs) {
    const amt = new Decimal(leg.amount.toString());
    perCurrency.set(leg.currency, (perCurrency.get(leg.currency) ?? new Decimal(0)).plus(amt));
  }
  for (const [currency, sum] of perCurrency) {
    if (sum.abs().gt(EPS)) {
      throw new Error(
        `Ledger imbalance for ${currency}: legs sum to ${sum.toString()} (must be 0). ` +
          `refType=${input.refType} refId=${input.refId ?? '-'}`,
      );
    }
  }

  // 2) Resolve/aggregate accounts (collapse duplicate legs to one entry each).
  const groupId = `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const agg = new Map<string, { leg: Leg; amount: Decimal }>();
  for (const leg of input.legs) {
    const k = keyFor(leg);
    const amt = new Decimal(leg.amount.toString());
    const cur = agg.get(k);
    if (cur) cur.amount = cur.amount.plus(amt);
    else agg.set(k, { leg, amount: amt });
  }

  // 3) Apply each leg: write the entry + atomically update the cached balance.
  // Never read-modify-write the balance in application memory. Concurrent
  // debits must compete against the current DB value, otherwise two requests
  // can both pass a stale balance check and overwrite each other's result.
  for (const { leg, amount } of agg.values()) {
    if (amount.isZero()) continue;
    const acct = await resolveAccount(tx, leg.type, leg.currency, leg.userId ?? null);

    if (leg.type === 'USER' && !opts.allowNegativeUser && amount.lt(0)) {
      const updated = await tx.ledgerAccount.updateMany({
        where: {
          id: acct.id,
          balance: { gte: new Prisma.Decimal(amount.abs().toFixed(18)) },
        },
        data: {
          balance: { increment: new Prisma.Decimal(amount.toFixed(18)) },
        },
      });
      if (updated.count !== 1) {
        throw new Error(
          `Insufficient ${leg.currency} balance for user ${leg.userId}: ` +
            `need ${amount.abs().toString()}`,
        );
      }
    } else {
      await tx.ledgerAccount.update({
        where: { id: acct.id },
        data: {
          balance: { increment: new Prisma.Decimal(amount.toFixed(18)) },
        },
      });
    }

    await tx.ledgerEntry.create({
      data: {
        groupId,
        accountId: acct.id,
        currency: leg.currency,
        amount: new Prisma.Decimal(amount.toFixed(18)),
        refType: input.refType,
        refId: input.refId ?? null,
        memo: input.memo,
      },
    });
  }

  return { groupId };
}

/** Convenience: a simple A→B transfer of one currency between two accounts. */
export function transferLegs(params: {
  currency: Currency;
  amount: Decimal | string | number;
  from: { type: LedgerAccountType; userId?: string | null };
  to: { type: LedgerAccountType; userId?: string | null };
}): Leg[] {
  const amt = new Decimal(params.amount.toString());
  return [
    { ...params.from, currency: params.currency, amount: amt.neg() },
    { ...params.to,   currency: params.currency, amount: amt },
  ];
}

/** Read a user's ledger balance for a currency (0 if no account yet). */
export async function getUserBalance(
  client: Tx | typeof prisma,
  userId: string,
  currency: Currency,
): Promise<Decimal> {
  const acct = await client.ledgerAccount.findFirst({
    where: { type: 'USER', userId, currency },
  });
  return acct ? new Decimal(acct.balance.toString()) : new Decimal(0);
}
