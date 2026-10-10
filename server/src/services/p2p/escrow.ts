/**
 * P2P escrow — one place for lock, release, refund and dispute clawback.
 *
 * Model (trades opened from 2026-10):
 *   lock    seller spendable −amt (Wallet / altBalances)  +  ledger seller USER → SYSTEM_ESCROW
 *   release ledger SYSTEM_ESCROW → buyer USER              +  buyer balance +amt
 *   refund  ledger SYSTEM_ESCROW → seller USER             +  seller balance +amt
 * Escrowed funds therefore sit in SYSTEM_ESCROW (customer money, reported as
 * such) and are never also held as a `frozen` reservation.
 *
 * The previous model reserved twice (Wallet.frozen AND a ledger debit that
 * the read model synced into Wallet.balance) and, for long-tail assets,
 * never debited the seller at all — release then clamped the seller at zero
 * and still credited the buyer. Trades locked under that model are detected
 * by the absence of a lock entry keyed on the trade id (the old lock was
 * keyed on the listing id) and unwound with the matching legacy steps.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../middleware/errorHandler';
import { postLedger, isLedgerCurrency } from '../ledger/ledger.service';
import { postAssetLedger, normaliseAsset } from '../ledger/assetLedger.service';
import { debitAvailable, lockUserWallets, releaseReserve, settleReserve } from '../wallet/atomicWallet';

type Tx = Prisma.TransactionClient;

export const P2P_ENUM_CURRENCIES = new Set([
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
  'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND',
]);

export interface EscrowTrade {
  id: string;
  sellerId: string;
  buyerId: string;
  currency: string;
  baseAsset: string | null;
  escrowAmount: Decimal | Prisma.Decimal | string;
  cryptoAmount: Decimal | Prisma.Decimal | string;
}

export type EscrowState = 'HELD' | 'HELD_LEGACY' | 'RELEASED' | 'REFUNDED' | 'CLAWED_BACK';

export const tickerOf = (t: Pick<EscrowTrade, 'baseAsset' | 'currency'>): string => (t.baseAsset ?? t.currency) as string;
const isEnum = (ticker: string) => P2P_ENUM_CURRENCIES.has(ticker);
const dec = (v: unknown) => new Decimal(String(v ?? '0'));
const pdec = (d: Decimal) => new Prisma.Decimal(d.toFixed());

type Alts = Record<string, string>;
const altsOf = (v: unknown): Alts => (v && typeof v === 'object' ? { ...(v as Alts) } : {});

async function escrowRefTypes(tx: Tx, trade: EscrowTrade): Promise<Set<string>> {
  const refTypes = ['p2p_escrow_lock', 'p2p_escrow_release', 'p2p_escrow_refund', 'p2p_dispute_clawback'];
  if (isEnum(tickerOf(trade))) {
    const rows = await tx.ledgerEntry.findMany({
      where: { refId: trade.id, refType: { in: refTypes } },
      select: { refType: true },
    });
    return new Set(rows.map((r) => r.refType));
  }
  const rows = await tx.$queryRaw<Array<{ refType: string }>>`
    SELECT DISTINCT "refType" FROM "AssetLedgerEntry"
    WHERE "refId" = ${trade.id} AND "refType" IN (${Prisma.join(refTypes)})
  `;
  return new Set(rows.map((r) => r.refType));
}

/** Where the escrowed funds of a trade currently are. */
export async function escrowState(tx: Tx, trade: EscrowTrade): Promise<EscrowState> {
  const types = await escrowRefTypes(tx, trade);
  if (types.has('p2p_dispute_clawback')) return 'CLAWED_BACK';
  if (types.has('p2p_escrow_release')) return 'RELEASED';
  if (types.has('p2p_escrow_refund')) return 'REFUNDED';
  if (types.has('p2p_escrow_lock')) return 'HELD';
  return 'HELD_LEGACY';
}

/** Lock the seller's funds for a newly created trade. */
export async function lockEscrow(tx: Tx, trade: EscrowTrade): Promise<void> {
  const ticker = tickerOf(trade);
  const amt = dec(trade.escrowAmount);
  if (isEnum(ticker)) {
    // One conditional statement: spendable (balance − frozen) must cover it.
    await debitAvailable(tx, trade.sellerId, ticker, amt);
    if (isLedgerCurrency(ticker)) {
      await postLedger(tx, {
        refType: 'p2p_escrow_lock', refId: trade.id, memo: `P2P escrow lock ${ticker}`,
        legs: [
          { type: 'USER', userId: trade.sellerId, currency: ticker as any, amount: amt.neg() },
          { type: 'SYSTEM_ESCROW', currency: ticker as any, amount: amt },
        ],
      });
    }
    return;
  }
  await lockUserWallets(tx, [trade.sellerId]);
  const uw = await tx.userWallet.findUnique({ where: { userId: trade.sellerId } });
  if (!uw) throw new AppError('Seller crypto wallet not provisioned', 404);
  const alts = altsOf(uw.altBalances);
  const available = dec(alts[ticker]);
  if (available.lt(amt)) throw new AppError('Seller has insufficient balance for escrow', 400, 'INSUFFICIENT_FUNDS');
  alts[ticker] = available.minus(amt).toFixed();
  await tx.userWallet.update({ where: { userId: trade.sellerId }, data: { altBalances: alts } });
  await postAssetLedger(tx as any, {
    refType: 'p2p_escrow_lock', refId: trade.id, memo: `P2P escrow lock ${ticker}`,
    legs: [
      { type: 'USER', userId: trade.sellerId, asset: normaliseAsset(ticker), amount: amt.neg() },
      { type: 'SYSTEM_ESCROW', asset: normaliseAsset(ticker), amount: amt },
    ],
  }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
}

async function creditEnum(tx: Tx, userId: string, ticker: string, amt: Decimal) {
  await tx.wallet.upsert({
    where: { userId_currency: { userId, currency: ticker as any } },
    update: { balance: { increment: pdec(amt) } },
    create: { userId, currency: ticker as any, balance: pdec(amt) },
  });
}

async function creditAlt(tx: Tx, userId: string, ticker: string, amt: Decimal) {
  await lockUserWallets(tx, [userId]);
  const uw = await tx.userWallet.findUnique({ where: { userId } });
  if (!uw) throw new AppError('Crypto wallet not provisioned', 404);
  const alts = altsOf(uw.altBalances);
  alts[ticker] = dec(alts[ticker]).plus(amt).toFixed();
  await tx.userWallet.update({ where: { userId }, data: { altBalances: alts } });
}

/** Legacy enum lock left a `frozen` reservation; drop it without double-debiting. */
async function finishLegacyEnumReservation(tx: Tx, trade: EscrowTrade, ticker: string, amt: Decimal) {
  // The legacy lock's ledger debit was synced into Wallet.balance (the
  // default), so only the reservation remains. If that sync was disabled the
  // balance still includes the funds and both must come off.
  if (process.env.LEDGER_SYNC_WALLET_READ_MODEL === '0') await settleReserve(tx, trade.sellerId, ticker, amt);
  else await releaseReserve(tx, trade.sellerId, ticker, amt);
}

/** Pay the escrowed funds to the buyer. */
export async function releaseEscrowToBuyer(tx: Tx, trade: EscrowTrade): Promise<EscrowState> {
  const state = await escrowState(tx, trade);
  if (state !== 'HELD' && state !== 'HELD_LEGACY') throw new AppError(`Escrow is not held (${state.toLowerCase()})`, 409);
  const ticker = tickerOf(trade);
  const escrow = dec(trade.escrowAmount);
  const crypto = dec(trade.cryptoAmount);

  if (isEnum(ticker)) {
    if (state === 'HELD_LEGACY') await finishLegacyEnumReservation(tx, trade, ticker, escrow);
    await creditEnum(tx, trade.buyerId, ticker, crypto);
    if (isLedgerCurrency(ticker)) {
      await postLedger(tx, {
        refType: 'p2p_escrow_release', refId: trade.id, memo: `P2P escrow release ${ticker}`,
        legs: [
          { type: 'SYSTEM_ESCROW', currency: ticker as any, amount: escrow.neg() },
          { type: 'USER', userId: trade.buyerId, currency: ticker as any, amount: crypto },
        ],
      }, { allowNegativeUser: true });
    }
    return state;
  }

  if (state === 'HELD_LEGACY') {
    // Legacy alt lock never debited the seller. Debit now — strictly. If the
    // seller no longer holds the funds, stop for manual review instead of
    // crediting the buyer with money that does not exist.
    await lockUserWallets(tx, [trade.sellerId, trade.buyerId]);
    const uw = await tx.userWallet.findUnique({ where: { userId: trade.sellerId } });
    if (!uw) throw new AppError('Seller crypto wallet not found', 404);
    const alts = altsOf(uw.altBalances);
    const have = dec(alts[ticker]);
    if (have.lt(escrow)) {
      throw new AppError('Seller no longer holds the escrowed amount — this trade needs manual review by support', 409, 'TRANSACTION_CONFLICT');
    }
    alts[ticker] = have.minus(escrow).toFixed();
    await tx.userWallet.update({ where: { userId: trade.sellerId }, data: { altBalances: alts } });
  }
  await creditAlt(tx, trade.buyerId, ticker, crypto);
  await postAssetLedger(tx as any, {
    refType: 'p2p_escrow_release', refId: trade.id, memo: `P2P escrow release ${ticker}`,
    legs: [
      { type: 'SYSTEM_ESCROW', asset: normaliseAsset(ticker), amount: escrow.neg() },
      { type: 'USER', userId: trade.buyerId, asset: normaliseAsset(ticker), amount: crypto },
    ],
  }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
  return state;
}

/** Return the escrowed funds to the seller. */
export async function refundEscrowToSeller(tx: Tx, trade: EscrowTrade): Promise<EscrowState> {
  const state = await escrowState(tx, trade);
  if (state !== 'HELD' && state !== 'HELD_LEGACY') throw new AppError(`Escrow is not held (${state.toLowerCase()})`, 409);
  const ticker = tickerOf(trade);
  const escrow = dec(trade.escrowAmount);

  if (isEnum(ticker)) {
    if (state === 'HELD_LEGACY') {
      // Drop the reservation; the ledger refund below re-syncs the balance.
      await releaseReserve(tx, trade.sellerId, ticker, escrow);
    } else {
      await creditEnum(tx, trade.sellerId, ticker, escrow);
    }
    if (isLedgerCurrency(ticker)) {
      await postLedger(tx, {
        refType: 'p2p_escrow_refund', refId: trade.id, memo: `P2P escrow refund ${ticker}`,
        legs: [
          { type: 'SYSTEM_ESCROW', currency: ticker as any, amount: escrow.neg() },
          { type: 'USER', userId: trade.sellerId, currency: ticker as any, amount: escrow },
        ],
      }, { allowNegativeUser: true });
    }
    return state;
  }

  // Legacy alt lock never debited the seller, so only the ledger unwinds.
  if (state === 'HELD') await creditAlt(tx, trade.sellerId, ticker, escrow);
  else await lockUserWallets(tx, [trade.sellerId]);
  await postAssetLedger(tx as any, {
    refType: 'p2p_escrow_refund', refId: trade.id, memo: `P2P escrow refund ${ticker}`,
    legs: [
      { type: 'SYSTEM_ESCROW', asset: normaliseAsset(ticker), amount: escrow.neg() },
      { type: 'USER', userId: trade.sellerId, asset: normaliseAsset(ticker), amount: escrow },
    ],
  }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
  return state;
}

/**
 * Dispute decided for the seller after escrow was already released to the
 * buyer: take the amount back from the buyer's spendable balance. Fails
 * (409) rather than overdrawing if the buyer no longer holds it.
 */
export async function clawBackFromBuyer(tx: Tx, trade: EscrowTrade): Promise<void> {
  const ticker = tickerOf(trade);
  if (!isEnum(ticker) || !isLedgerCurrency(ticker)) {
    throw new AppError('Clawback is only supported for ledger currencies — escalate to finance for a manual adjustment', 409);
  }
  const amt = dec(trade.cryptoAmount);
  try {
    await debitAvailable(tx, trade.buyerId, ticker, amt);
  } catch {
    throw new AppError('Buyer no longer holds the released funds — open a recovery case with finance', 409, 'INSUFFICIENT_FUNDS');
  }
  await creditEnum(tx, trade.sellerId, ticker, amt);
  await postLedger(tx, {
    refType: 'p2p_dispute_clawback', refId: trade.id, memo: `P2P dispute clawback ${ticker}`,
    legs: [
      { type: 'USER', userId: trade.buyerId, currency: ticker as any, amount: amt.neg() },
      { type: 'USER', userId: trade.sellerId, currency: ticker as any, amount: amt },
    ],
  });
}
