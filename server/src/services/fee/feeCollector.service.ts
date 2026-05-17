/**
 * Platform Fee Collector
 * ──────────────────────
 * Every commission or transaction fee the platform takes flows
 * through `collectFee()`. The function:
 *
 *   1. Records a row in the `PlatformFee` ledger so we can audit and
 *      report on every dollar collected.
 *   2. Credits the platform wallet (a designated user with
 *      `username='platform'`) so admins can see and withdraw the
 *      accumulated revenue.
 *
 * Fees from deposits and internal user-to-user transfers are
 * intentionally NOT collected here — the user explicitly asked for
 * those to remain free.
 *
 * Call sites:
 *   - order.controller (BUY / SELL)
 *   - orderExecution.service (crypto orders)
 *   - withdrawal.controller (fiat / crypto withdrawals)
 *   - cryptoWithdrawal.controller (on-chain withdrawals)
 *   - p2p.controller (trade settlement)
 *
 * Designed to be transaction-safe: pass in your `tx` Prisma client
 * when called inside a $transaction, otherwise it falls back to the
 * top-level `prisma` client.
 */

import { Prisma, type Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { getRate } from '../exchange/fxRateProvider.service';

// ── Constants ──────────────────────────────────────────────────────
const PLATFORM_USERNAME = 'platform';
const PLATFORM_EMAIL    = process.env.PLATFORM_EMAIL || 'platform@promrkts.app';

// Memo the platform user id so we're not hitting the DB on every fee
let _platformUserId: string | null = null;

async function getPlatformUserId(client: any): Promise<string> {
  if (_platformUserId) return _platformUserId;
  const user = await client.user.findFirst({ where: { username: PLATFORM_USERNAME }, select: { id: true } });
  if (user) {
    _platformUserId = user.id;
    return user.id;
  }

  // Lazily provision the platform user if missing. Created with role
  // ADMIN so admins can browse the platform wallet via the existing
  // user list endpoints.
  const created = await client.user.create({
    data: {
      email:        PLATFORM_EMAIL,
      username:     PLATFORM_USERNAME,
      firstName:    'Platform',
      lastName:     'Treasury',
      passwordHash: 'PLATFORM_USER_NO_LOGIN',
      role:         'ADMIN',
      status:       'ACTIVE',
      kycStatus:    'APPROVED',
      kycTier:      'TIER_3',
      referralCode: 'PLATFORM',
    },
    select: { id: true },
  });
  _platformUserId = created.id;
  return created.id;
}

// Enum currencies that have a real Wallet row. Anything else (random
// altcoin tickers) is stored as a PlatformFee row only — there's no
// per-altcoin platform wallet yet.
const ENUM_CURRENCIES: Currency[] = [
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
  'USD',  'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD',
];

function isEnumCurrency(c: string): c is Currency {
  return (ENUM_CURRENCIES as readonly string[]).includes(c);
}

// Last-resort fiat conversion floor. Used ONLY when every live source
// fails — better to over-report fees by a few percent than to silently
// record $0 and lose track of revenue. These are rough order-of-magnitude
// rates and are intentionally conservative.
const FIAT_USD_FLOOR: Record<string, number> = {
  USD:  1.0,
  USDT: 1.0,
  EUR:  1.08,
  GBP:  1.27,
  AED:  0.27,
  SAR:  0.27,
  EGP:  0.021,
  LYD:  0.16,
};

/**
 * Best-effort USD conversion for ledger reporting.
 * Never returns 0 when `amount > 0` — that would silently zero out the
 * platform fee. The cascade is:
 *   1. USD/USDT → identity.
 *   2. Live rate `currency → USD`.
 *   3. Live rate `currency → USDT` (treat USDT≈USD).
 *   4. Inverted rate `USD → currency`.
 *   5. Conservative hardcoded floor.
 *   6. If even the floor is unknown, log a warning and fall back to the
 *      raw amount as a placeholder — the admin can reconcile via the
 *      backfill script. NEVER zero.
 */
async function toUsd(amount: Decimal, currency: string): Promise<Decimal> {
  const cur = currency.toUpperCase();
  if (cur === 'USD' || cur === 'USDT') return amount;

  // 1. currency → USD
  try {
    const pair = await getRate(cur, 'USD');
    const sellPrice = parseFloat(pair?.sellPrice ?? '0');
    if (sellPrice > 0 && Number.isFinite(sellPrice)) return amount.mul(sellPrice);
  } catch { /* fall through */ }

  // 2. currency → USDT (USDT pegged ≈ USD)
  try {
    const pair = await getRate(cur, 'USDT');
    const sellPrice = parseFloat(pair?.sellPrice ?? '0');
    if (sellPrice > 0 && Number.isFinite(sellPrice)) return amount.mul(sellPrice);
  } catch { /* fall through */ }

  // 3. USD → currency (invert)
  try {
    const pair = await getRate('USD', cur);
    const buyPrice = parseFloat(pair?.buyPrice ?? '0');
    if (buyPrice > 0 && Number.isFinite(buyPrice)) return amount.div(buyPrice);
  } catch { /* fall through */ }

  // 4. Hardcoded floor table
  const floor = FIAT_USD_FLOOR[cur];
  if (floor && floor > 0) {
    console.warn(`[feeCollector] toUsd: live FX failed for ${cur}, using hardcoded floor ${floor}`);
    return amount.mul(floor);
  }

  // 5. Last resort: log and return the raw amount. Better to over-report
  // than silently lose dollars from the dashboard.
  console.warn(`[feeCollector] toUsd: no USD rate or floor for "${cur}" — recording raw amount as USD placeholder`);
  return amount;
}

export type FeeSource =
  | 'order'
  | 'crypto_order'
  | 'withdrawal'
  | 'crypto_withdrawal'
  | 'p2p_trade'
  | 'swap'
  | 'card_spend'
  | 'manual';

export interface CollectFeeInput {
  /** Where the fee originated. */
  source:      FeeSource;
  /** ID of the source record (orderId, withdrawalId, etc). */
  sourceId?:   string;
  /** User who paid the fee. */
  payerId?:    string;
  /** Fee amount in the fee currency. */
  amount:      Decimal | number | string;
  /** Currency in which the fee was charged. */
  currency:    string;
  description?: string;
  metadata?:   Record<string, any>;
  /** Pass your prisma transaction client when inside a $transaction. */
  tx?:         any;
}

/**
 * Records a fee in the platform ledger and credits the platform wallet.
 * Safe to call from inside a $transaction (pass `tx`). Returns the
 * PlatformFee row id, or null if the amount was zero or invalid.
 */
export async function collectFee(input: CollectFeeInput): Promise<string | null> {
  const client = input.tx ?? prisma;

  const amount = new Decimal(input.amount);
  if (amount.isNaN() || amount.lte(0)) return null;

  const platformUserId = await getPlatformUserId(client);
  const currencyUpper = input.currency.toUpperCase();
  const amountUsd = await toUsd(amount, currencyUpper);

  if (amountUsd.lte(0) && amount.gt(0)) {
    // Should never happen after the toUsd cascade above, but if it
    // somehow does, surface it loudly so the admin dashboard never
    // silently loses revenue.
    console.warn(
      `[feeCollector] amountUsd <= 0 for non-zero amount`,
      { source: input.source, sourceId: input.sourceId, amount: amount.toString(), currency: currencyUpper }
    );
  }

  // Record the fee event
  const fee = await client.platformFee.create({
    data: {
      source:      input.source,
      sourceId:    input.sourceId ?? null,
      payerId:     input.payerId  ?? null,
      amount,
      currency:    isEnumCurrency(currencyUpper) ? currencyUpper : 'USDT',
      amountUsd,
      description: input.description ?? null,
      metadata:    (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  // Credit the platform wallet for enum currencies
  if (isEnumCurrency(currencyUpper)) {
    await client.wallet.upsert({
      where: { userId_currency: { userId: platformUserId, currency: currencyUpper as Currency } },
      update: { balance: { increment: amount } },
      create: { userId: platformUserId, currency: currencyUpper as Currency, balance: amount, frozen: new Decimal(0) },
    });
  } else {
    // For altcoins, store in UserWallet.altBalances
    const uw = await client.userWallet.upsert({
      where:  { userId: platformUserId },
      update: {},
      create: { userId: platformUserId, altBalances: {} as any },
    });
    const balances = (uw.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, string>;
    const next = new Decimal(balances[currencyUpper] ?? '0').add(amount);
    await client.userWallet.update({
      where: { userId: platformUserId },
      data:  { altBalances: { ...balances, [currencyUpper]: next.toFixed(8) } as any },
    });
  }

  return fee.id;
}

/** Reset the cached platform user id — useful in tests. */
export function _resetPlatformUserCache() {
  _platformUserId = null;
}
