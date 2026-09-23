/**
 * Order execution — supports every tradeable asset.
 *
 * Native assets (ETH, BTC, SOL, USDT) use dedicated Decimal columns.
 * Every other asset uses the `altBalances` JSON column on UserWallet,
 * stored as { "BNB": "1.2345678", "XRP": "500.000000", ... }.
 *
 * Safety:
 *   - Pessimistic concurrency: the user's UserWallet row is locked (FOR UPDATE)
 *     before balances are read, and debits of enum currencies are gated by the
 *     ledger's conditional update.
 *   - Idempotency: unique constraint on CryptoOrder.idempotencyKey.
 *   - Quote validity: quotes are single-use (atomic consume), bound to the
 *     requesting user, and expire after 90s.
 */
import axios from 'axios';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { createUserWallets } from '../wallet/walletDerivation.service';
import { consumeQuote, getQuote, type Quote, type SupportedAsset } from './priceEngine.service';
import { lockUserWallets } from '../wallet/atomicWallet';
import { enforceKycLimit } from '../../utils/kycLimits';
import { collectFee } from '../fee/feeCollector.service';
import { postLedger, isLedgerCurrency, type Leg } from '../ledger/ledger.service';

// Local alias for the centralized ledger-currency check.
const isLedgerCcy = (c: string) => isLedgerCurrency(c);

/**
 * Mirror a trade into the double-entry ledger, inside the same tx as the
 * Wallet mutations so the two ledgers stay in lockstep. Posts balanced legs:
 * the user's two sides (asset + settlement) against the SYSTEM_CHAIN account
 * (our counterparty that sources crypto / absorbs fiat). Best-effort during
 * the mirror phase — a ledger problem must never break a working trade — but
 * any failure is logged loudly so reconciliation/alerting catches drift.
 *
 * USDC maps onto the USDT enum value (same as the Transaction record), so its
 * legs are tagged USDT to keep the ledger enum-valid.
 */
async function mirrorTradeToLedger(tx: Prisma.TransactionClient, args: {
  userId: string;
  side: 'BUY' | 'SELL';
  asset: string;          // crypto leg currency
  cryptoAmount: Decimal;  // asset quantity
  settlementCurrency: string;
  settlementAmount: Decimal;
  orderId: string;
  /** Forward trades gate on the ledger; reversals/refunds must always apply. */
  gate?: boolean;
}): Promise<void> {
  const asset = args.asset.toUpperCase();
  const settle = args.settlementCurrency.toUpperCase() === 'USDC' ? 'USDT' : args.settlementCurrency.toUpperCase();
  // Only post currencies the ledger enum supports (skip exotic altcoins for now).
  if (!isLedgerCcy(asset) || !isLedgerCcy(settle)) return;

  const c = (s: string) => s as any; // narrow to Currency for the leg type
  const assetAmt = args.cryptoAmount;
  const settleAmt = args.settlementAmount;
  const legs: Leg[] = args.side === 'BUY'
    ? [
        // User pays settlement, receives asset; SYSTEM_CHAIN is the counterparty.
        { type: 'USER', userId: args.userId, currency: c(settle), amount: settleAmt.neg() },
        { type: 'SYSTEM_CHAIN', currency: c(settle), amount: settleAmt },
        { type: 'USER', userId: args.userId, currency: c(asset), amount: assetAmt },
        { type: 'SYSTEM_CHAIN', currency: c(asset), amount: assetAmt.neg() },
      ]
    : [
        // User delivers asset, receives settlement.
        { type: 'USER', userId: args.userId, currency: c(asset), amount: assetAmt.neg() },
        { type: 'SYSTEM_CHAIN', currency: c(asset), amount: assetAmt },
        { type: 'USER', userId: args.userId, currency: c(settle), amount: settleAmt },
        { type: 'SYSTEM_CHAIN', currency: c(settle), amount: settleAmt.neg() },
      ];

  // Forward trades GATE on the ledger (gate=true → allowNegativeUser:false):
  // if the user's ledger balance can't cover the debit, the post throws and
  // the whole tx rolls back — the ledger is authoritative. Reversals/refunds
  // pass gate=false so a correction can always be applied.
  await postLedger(
    tx,
    { refType: args.side.toLowerCase(), refId: args.orderId, memo: `${args.side} ${asset}`, legs },
    { allowNegativeUser: !(args.gate ?? false) },
  );
}

Decimal.set({ precision: 40 });

const BINANCE_REST = process.env.BINANCE_REST_URL || 'https://api.binance.com';

const ASSET_PRECISION: Record<string, number> = {
  ETH: 4, BTC: 6, SOL: 3, USDT: 2,
  BNB: 4, XRP: 2, ADA: 2, DOGE: 2,
  MATIC: 2, DOT: 4, AVAX: 4,
  LINK: 4, UNI: 4, AAVE: 4, LTC: 4,
  ATOM: 4, ALGO: 2, NEAR: 4, FTM: 2,
  VET: 2, TRX: 2, ETC: 4, XLM: 2,
  XMR: 6, FIL: 4, EOS: 4, THETA: 2,
  DEFAULT: 6,
};

function sign(query: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(query).digest('hex');
}

async function placeBinanceMarket(opts: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
}): Promise<{ orderId: string | null; simulated: boolean }> {
  const key = process.env.BINANCE_API_KEY;
  const secret = process.env.BINANCE_API_SECRET;
  if (!key || !secret) {
    console.warn('[binance] API creds missing — simulating order:', opts);
    return { orderId: null, simulated: true };
  }
  const params = new URLSearchParams({
    symbol: opts.symbol,
    side: opts.side,
    type: 'MARKET',
    quantity: opts.quantity,
    timestamp: Date.now().toString(),
    recvWindow: '5000',
  });
  const signature = sign(params.toString(), secret);
  params.append('signature', signature);

  try {
    const { data } = await axios.post(
      `${BINANCE_REST}/api/v3/order`,
      params.toString(),
      {
        headers: {
          'X-MBX-APIKEY': key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10_000,
      },
    );
    return { orderId: String(data?.orderId ?? ''), simulated: false };
  } catch (err: any) {
    // Distinguish INFRASTRUCTURE failures from real order REJECTIONS.
    //  - Infra (Binance unreachable): HTTP 451 geo-block — Binance blocks many
    //    data-center IPs — plus timeouts / DNS / 5xx. The exchange leg simply
    //    can't be placed; we fall back to a SIMULATED fill so the user's order
    //    still settles against our custodial book (broker model). Self-heals to
    //    real fills the moment Binance is reachable again.
    //  - Rejection (4xx from Binance's matching engine, e.g. -2010 insufficient
    //    balance, -1013 LOT_SIZE/filter, bad symbol): a genuine problem — must
    //    NOT be silently "filled". Rethrow so the caller refunds and surfaces it.
    const status = err?.response?.status as number | undefined;
    const code = err?.code as string | undefined; // ETIMEDOUT/ECONNREFUSED/ENOTFOUND…
    const isGeoBlock = status === 451;
    const isNetwork = !status || ['ETIMEDOUT', 'ECONNABORTED', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code ?? '');
    const isUpstream5xx = typeof status === 'number' && status >= 500;

    if (isGeoBlock || isNetwork || isUpstream5xx) {
      console.warn('[binance] unreachable — simulating fill (custodial book):', {
        symbol: opts.symbol, side: opts.side, status: status ?? code,
      });
      return { orderId: null, simulated: true };
    }
    // Real rejection from Binance — let it bubble up to the refund path.
    throw err;
  }
}

function roundQty(asset: string, amount: Decimal): string {
  const precision = ASSET_PRECISION[asset.toUpperCase()] ?? ASSET_PRECISION.DEFAULT;
  return amount.toFixed(precision, Decimal.ROUND_DOWN);
}

// Native-column assets have a dedicated Decimal field on UserWallet.
type NativeField = 'ethBalance' | 'btcBalance' | 'solBalance' | 'usdtErc20Bal' | 'usdtTrc20Bal';

// Stablecoins the user holds in the fiat-style `Wallet` table (USD/USDT/LYD…),
// NOT the on-chain UserWallet columns. When one of these is the *traded asset*,
// the asset leg must move the Wallet row the user actually sees and holds —
// otherwise selling USDT decrements an unrelated on-chain column and the
// displayed balance never changes (the bug behind the phantom credits).
const WALLET_ASSETS = new Set(['USDT', 'USDC', 'USD']);
function isWalletAsset(asset: string): boolean {
  return WALLET_ASSETS.has(asset.toUpperCase());
}

function nativeField(asset: string, network: string): NativeField | null {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH')  return 'ethBalance';
  if (a === 'BTC')  return 'btcBalance';
  if (a === 'SOL')  return 'solBalance';
  // USDT/USDC as a traded asset are handled via the Wallet table (see
  // isWalletAsset), so they intentionally do NOT map to a native column here.
  return null;
}

function getAltBalance(altBalances: unknown, asset: string): Decimal {
  if (!altBalances || typeof altBalances !== 'object') return new Decimal(0);
  const raw = (altBalances as Record<string, string>)[asset.toUpperCase()];
  return raw ? new Decimal(raw) : new Decimal(0);
}

function setAltBalance(altBalances: unknown, asset: string, value: Decimal): Record<string, string> {
  const obj: Record<string, string> = (altBalances && typeof altBalances === 'object')
    ? { ...(altBalances as Record<string, string>) }
    : {};
  obj[asset.toUpperCase()] = value.toFixed(18);
  return obj;
}

/**
 * Resolve how much of `fundingCurrency` equals the USDT-denominated
 * `usdtAmount`. USDT/USD/USDC are treated 1:1; other fiats route through
 * the FX provider. Returns the amount to debit from the funding wallet.
 */
async function usdtToFunding(fundingCurrency: string, usdtAmount: Decimal): Promise<Decimal> {
  const fc = fundingCurrency.toUpperCase();
  if (fc === 'USDT' || fc === 'USD' || fc === 'USDC') return usdtAmount;
  const { getRate } = await import('./fxRateProvider.service');
  // getRate(fc, 'USD') → USD per 1 unit of fc. To convert USD→fc we divide.
  const pair = await getRate(fc, 'USD');
  const usdPerUnit = new Decimal(pair.sellPrice || pair.buyPrice);
  if (usdPerUnit.lte(0)) throw new AppError(`No FX rate for ${fc}`, 400);
  return usdtAmount.div(usdPerUnit);
}

export async function executeQuote(opts: {
  userId: string;
  quoteId: string;
  idempotencyKey?: string;
  /**
   * Fiat wallet currency to fund a BUY from. When omitted (or USDT), the
   * legacy behaviour applies: debit the USDT wallet. When a different fiat
   * is given, that wallet is debited (FX-converted) instead. Ignored on SELL.
   */
  fundingCurrency?: string;
}) {
  const { userId, quoteId, idempotencyKey } = opts;

  // Treasury safety: refuse to execute while a ledger/fund-integrity breach
  // has halted trading. Better to block orders than compound a discrepancy.
  const { isTradingHalted } = await import('./../ledger/reconcile.service');
  if (await isTradingHalted()) {
    throw new AppError('Trading is temporarily halted for a treasury integrity check. Please try again shortly.', 503);
  }

  if (idempotencyKey) {
    const prior = await prisma.cryptoOrder.findUnique({ where: { idempotencyKey } });
    if (prior) return prior;
  }

  // Check tier limits before taking the quote, so a limit refusal doesn't
  // burn it. `fiatAmount` is USD-denominated.
  const pending = await getQuote(quoteId);
  if (pending && (!pending.userId || pending.userId === userId)) {
    await enforceKycLimit(userId, pending.side === 'BUY' ? 'ONRAMP_BUY' : 'OFFRAMP_SELL', pending.fiatAmount, 'USD');
  }

  const quote = await consumeQuote(quoteId, userId);
  if (!quote) throw new AppError('Quote expired or not found. Request a new quote.', 400);

  const fiat    = new Decimal(quote.fiatAmount);
  const crypto_ = new Decimal(quote.cryptoAmount);
  const assetUpper = quote.asset.toUpperCase();

  // Settlement wallet: BUY debits it, SELL credits it. This MUST come from the
  // quote (validated at quote time). No silent default — defaulting to USDT is
  // exactly what credited/debited the wrong wallet and corrupted balances.
  const settlementCurrency = (quote.settlementCurrency || '').toUpperCase();
  if (!settlementCurrency || !isLedgerCurrency(settlementCurrency)) {
    throw new AppError('Quote is missing a valid settlement currency. Request a new quote.', 400);
  }
  if (settlementCurrency === assetUpper) {
    throw new AppError(`Settlement currency must differ from the asset (${assetUpper})`, 400);
  }
  // Two distinct facts that must NOT be conflated:
  //  - settleIsOneToOne: no FX needed — USDT/USD/USDC all equal the USDT amount.
  //  - creditsUsdtWallet: hits the dedicated USDT wallet. ONLY true USDT does.
  //    USD and USDC are their own Wallet rows (1:1 amount), like GBP/EUR — they
  //    must never be credited to the USDT balance.
  const settleIsOneToOne = settlementCurrency === 'USDT' || settlementCurrency === 'USD' || settlementCurrency === 'USDC';
  const creditsUsdtWallet = settlementCurrency === 'USDT';

  // Guard against a no-op self-trade (e.g. USDT→USDT) which would credit and
  // debit the same wallet and corrupt the balance.
  if (assetUpper === settlementCurrency) {
    throw new AppError(`Cannot ${quote.side.toLowerCase()} ${assetUpper} into ${settlementCurrency}`, 400);
  }

  let userWallet = await prisma.userWallet.findUnique({ where: { userId } });
  if (!userWallet) userWallet = await createUserWallets(userId);

  const native = nativeField(quote.asset, quote.network);

  // Resolve the settlement amount in the target fiat up front (outside the tx —
  // the FX lookup may hit the network). For USDT/USD/USDC this is 1:1.
  const settlementAmount = quote.settlementAmount
    ? new Decimal(quote.settlementAmount)
    : settleIsOneToOne
      ? fiat
      : await usdtToFunding(settlementCurrency, fiat);

  const order = await prisma.$transaction(async (tx) => {
    // Lock the user's crypto row first: the altBalances JSON is read, changed
    // and written back below, which is only safe while no other trade or
    // transfer can touch the same row.
    await lockUserWallets(tx, [userId]);
    const uw = await tx.userWallet.findUnique({ where: { userId } });
    if (!uw) throw new AppError('User wallet not provisioned', 400);

    const usdt = await tx.wallet.findUnique({
      where: { userId_currency: { userId, currency: 'USDT' } },
    });
    if (!usdt) throw new AppError('USDT wallet missing', 400);

    if (quote.side === 'BUY') {
      // Debit the funding wallet the user chose. USDT debits the dedicated USDT
      // wallet; every other currency (USD, USDC, GBP, …) debits its own Wallet
      // row at the resolved amount.
      if (creditsUsdtWallet) {
        if (new Decimal(usdt.balance.toString()).lt(fiat)) {
          throw new AppError('Insufficient USDT balance', 400);
        }
        await tx.wallet.update({
          where: { id: usdt.id },
          data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } },
        });
      } else {
        const fundWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId, currency: settlementCurrency as any } },
        });
        if (!fundWallet) throw new AppError(`${settlementCurrency} wallet missing`, 400);
        if (new Decimal(fundWallet.balance.toString()).lt(settlementAmount)) {
          throw new AppError(`Insufficient ${settlementCurrency} balance`, 400);
        }
        await tx.wallet.update({
          where: { id: fundWallet.id },
          data: { balance: { decrement: new Prisma.Decimal(settlementAmount.toFixed(8)) } },
        });
      }

      // Credit the bought asset. USDT/USDC live in the Wallet table (the
      // balance the user actually sees), everything else in UserWallet.
      if (isWalletAsset(assetUpper)) {
        await tx.wallet.upsert({
          where: { userId_currency: { userId, currency: assetUpper as any } },
          update: { balance: { increment: new Prisma.Decimal(crypto_.toFixed(8)) } },
          create: { userId, currency: assetUpper as any, balance: new Prisma.Decimal(crypto_.toFixed(8)) },
        });
      } else if (native) {
        await tx.userWallet.update({
          where: { id: uw.id },
          data: { [native]: { increment: new Prisma.Decimal(crypto_.toFixed(18)) } },
        });
      } else {
        const current = getAltBalance(uw.altBalances, assetUpper);
        const next    = setAltBalance(uw.altBalances, assetUpper, current.plus(crypto_));
        await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
      }
    } else {
      // SELL — debit the sold asset from where the user actually holds it.
      if (isWalletAsset(assetUpper)) {
        const assetWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId, currency: assetUpper as any } },
        });
        const current = new Decimal(assetWallet?.balance.toString() ?? '0');
        if (current.lt(crypto_)) throw new AppError(`Insufficient ${quote.asset} balance`, 400);
        await tx.wallet.update({
          where: { id: assetWallet!.id },
          data: { balance: { decrement: new Prisma.Decimal(crypto_.toFixed(8)) } },
        });
      } else if (native) {
        const current = new Decimal((uw as any)[native].toString());
        if (current.lt(crypto_)) throw new AppError(`Insufficient ${quote.asset} balance`, 400);
        await tx.userWallet.update({
          where: { id: uw.id },
          data: { [native]: { decrement: new Prisma.Decimal(crypto_.toFixed(18)) } },
        });
      } else {
        const current = getAltBalance(uw.altBalances, assetUpper);
        if (current.lt(crypto_)) throw new AppError(`Insufficient ${quote.asset} balance`, 400);
        const next = setAltBalance(uw.altBalances, assetUpper, current.minus(crypto_));
        await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
      }
      // Credit the proceeds into the wallet the user chose to receive into.
      // Only true USDT lands in the dedicated USDT wallet; USD/USDC/GBP/… each
      // get their own Wallet row (USD/USDC at the 1:1 amount, others FX'd).
      if (creditsUsdtWallet) {
        await tx.wallet.update({
          where: { id: usdt.id },
          data: { balance: { increment: new Prisma.Decimal(fiat.toFixed(8)) } },
        });
      } else {
        // Credit the receiving fiat wallet, creating it on the fly if the
        // user doesn't have one yet (e.g. first time receiving USD or GBP).
        await tx.wallet.upsert({
          where: { userId_currency: { userId, currency: settlementCurrency as any } },
          update: { balance: { increment: new Prisma.Decimal(settlementAmount.toFixed(8)) } },
          create: { userId, currency: settlementCurrency as any, balance: new Prisma.Decimal(settlementAmount.toFixed(8)) },
        });
      }
    }

    const created = await tx.cryptoOrder.create({
      data: {
        userId,
        type: quote.side,
        asset: quote.asset,
        network: quote.network,
        quotedPrice:   new Prisma.Decimal(quote.quotedPrice),
        quotedTotal:   new Prisma.Decimal(fiat.toFixed(8)),
        marketPrice:   new Prisma.Decimal(quote.marketPrice),
        actualCost:    new Prisma.Decimal(fiat.toFixed(8)),
        platformFee:   new Prisma.Decimal(quote.platformFee),
        networkFee:    new Prisma.Decimal(quote.networkFee),
        spreadCapture: new Prisma.Decimal(quote.spreadCapture),
        cryptoAmount:  new Prisma.Decimal(crypto_.toFixed(18)),
        status: 'PENDING',
        idempotencyKey: idempotencyKey ?? null,
      },
    });

    // Mirror the settled balances into the double-entry ledger, ATOMICALLY
    // with the Wallet mutations (same tx). postLedger checks the conservation
    // invariant before writing, so the only failure mode is a DB error — in
    // which case rolling the whole trade back is the safe outcome (we never
    // want a committed trade with a half-written or imbalanced ledger). The
    // settlement leg uses the resolved amount (1:1 for USDT/USD/USDC,
    // FX-converted otherwise) so both ledgers move identically.
    await mirrorTradeToLedger(tx, {
      userId,
      side: quote.side,
      asset: quote.asset,
      cryptoAmount: crypto_,
      settlementCurrency,
      settlementAmount,
      orderId: created.id,
      gate: true, // forward trade: ledger is authoritative for the debit
    });

    return created;
  });

  // Record the transaction in the currency the trade actually settled into.
  // `settlementAmount` is denominated in `settlementCurrency`. USDC isn't a
  // Currency enum value so it maps to USDT; USD/EUR/GBP/… are recorded as-is.
  const VALID_CURRENCIES = new Set(['USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX','USD','EUR','GBP','AED','SAR','EGP','LYD']);
  const txCurrency = (settlementCurrency === 'USDC' || !VALID_CURRENCIES.has(settlementCurrency))
    ? 'USDT'
    : settlementCurrency;
  const settleStr = settlementAmount.toFixed(2);
  await prisma.transaction.create({
    data: {
      userId,
      type: quote.side === 'BUY' ? 'BUY' : 'SELL',
      currency: txCurrency as any,
      amount: quote.side === 'BUY'
        ? new Prisma.Decimal(`-${settleStr}`)        // settlement currency out
        : new Prisma.Decimal(settleStr),             // settlement currency in
      balanceBefore: new Prisma.Decimal(0),
      balanceAfter:  new Prisma.Decimal(0),
      description: quote.side === 'BUY'
        ? `Bought ${crypto_.toFixed(8)} ${quote.asset} with ${settleStr} ${settlementCurrency}`
        : `Sold ${crypto_.toFixed(8)} ${quote.asset} for ${settleStr} ${settlementCurrency}`,
      reference: `CRPT-${order.id.slice(0, 8).toUpperCase()}`,
      metadata: {
        kind: 'crypto_order',
        orderId: order.id,
        asset: quote.asset,
        network: quote.network,
        settlementCurrency,
        settlementAmount: settleStr,
        fiatAmount: fiat.toFixed(2),   // USDT-denominated, for reference
        cryptoAmount: crypto_.toFixed(8),
      },
    },
  });

  // Feed the USD/LYD soft order book. A crypto BUY funded from LYD means the
  // user bought USD-equivalent from us (drains USD → upward skew); a SELL into
  // LYD means they sold USD to us (relaxes skew). `fiat` is USD-denominated.
  if (settlementCurrency === 'LYD') {
    try {
      const { recordLydFlow } = await import('./lydOrderBook.service');
      recordLydFlow(quote.side, fiat.toNumber());
    } catch { /* non-critical */ }
  }

  // Pour platform fee + spread capture into the platform wallet
  const totalFee = new Decimal(quote.platformFee || 0).add(quote.spreadCapture || 0);
  if (totalFee.gt(0)) {
    await collectFee({
      source:   'crypto_order',
      sourceId: order.id,
      payerId:  userId,
      amount:   totalFee.toString(),
      currency: 'USDT',
      description: `${quote.side} ${quote.asset} fee + spread`,
      metadata: { asset: quote.asset, network: quote.network, platformFee: quote.platformFee, spreadCapture: quote.spreadCapture },
    });
  }

  const symbol = quote.asset.toUpperCase() === 'USDT' ? null : `${quote.asset.toUpperCase()}USDT`;
  try {
    let binanceOrderId: string | null = null;
    if (symbol) {
      const result = await placeBinanceMarket({
        symbol,
        side: quote.side,
        quantity: roundQty(quote.asset, crypto_),
      });
      binanceOrderId = result.orderId;
    }
    return prisma.cryptoOrder.update({
      where: { id: order.id },
      data: { status: 'EXECUTED', binanceOrderId: binanceOrderId ?? undefined, executedAt: new Date() },
    });
  } catch (err: any) {
    console.error('[binance] order failed — refunding', order.id, err?.response?.data ?? err?.message);
    await prisma.$transaction(async (tx) => {
      await lockUserWallets(tx, [userId]);
      const uw   = await tx.userWallet.findUnique({ where: { userId } });
      const usdt = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USDT' } } });
      if (!uw || !usdt) return;

      if (quote.side === 'BUY') {
        // Refund the same wallet we debited.
        if (creditsUsdtWallet) {
          await tx.wallet.update({ where: { id: usdt.id }, data: { balance: { increment: new Prisma.Decimal(fiat.toFixed(8)) } } });
        } else {
          const fundWallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: settlementCurrency as any } } });
          if (fundWallet) {
            await tx.wallet.update({ where: { id: fundWallet.id }, data: { balance: { increment: new Prisma.Decimal(settlementAmount.toFixed(8)) } } });
          }
        }
        // Remove the credited asset (reverse the BUY's asset leg).
        if (isWalletAsset(assetUpper)) {
          const aw = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: assetUpper as any } } });
          if (aw) {
            const next = Decimal.max(0, new Decimal(aw.balance.toString()).minus(crypto_));
            await tx.wallet.update({ where: { id: aw.id }, data: { balance: new Prisma.Decimal(next.toFixed(8)) } });
          }
        } else if (native) {
          await tx.userWallet.update({ where: { id: uw.id }, data: { [native]: { decrement: new Prisma.Decimal(crypto_.toFixed(18)) } } });
        } else {
          const current = getAltBalance(uw.altBalances, assetUpper);
          const next    = setAltBalance(uw.altBalances, assetUpper, Decimal.max(0, current.minus(crypto_)));
          await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
        }
      } else {
        // Reverse the SELL: return the sold asset and claw back the proceeds.
        if (isWalletAsset(assetUpper)) {
          await tx.wallet.upsert({
            where: { userId_currency: { userId, currency: assetUpper as any } },
            update: { balance: { increment: new Prisma.Decimal(crypto_.toFixed(8)) } },
            create: { userId, currency: assetUpper as any, balance: new Prisma.Decimal(crypto_.toFixed(8)) },
          });
        } else if (native) {
          await tx.userWallet.update({ where: { id: uw.id }, data: { [native]: { increment: new Prisma.Decimal(crypto_.toFixed(18)) } } });
        } else {
          const current = getAltBalance(uw.altBalances, assetUpper);
          const next    = setAltBalance(uw.altBalances, assetUpper, current.plus(crypto_));
          await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
        }
        if (creditsUsdtWallet) {
          await tx.wallet.update({ where: { id: usdt.id }, data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } } });
        } else {
          const recvWallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: settlementCurrency as any } } });
          if (recvWallet) {
            await tx.wallet.update({ where: { id: recvWallet.id }, data: { balance: { decrement: new Prisma.Decimal(settlementAmount.toFixed(8)) } } });
          }
        }
      }
      // Reverse the ledger mirror too — a refund is the trade run backwards,
      // so post the opposite side. Keeps the ledger in lockstep with Wallet.
      await mirrorTradeToLedger(tx, {
        userId,
        side: quote.side === 'BUY' ? 'SELL' : 'BUY',
        asset: quote.asset,
        cryptoAmount: crypto_,
        settlementCurrency,
        settlementAmount,
        orderId: order.id,
      });
      await tx.cryptoOrder.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    });
    throw new AppError('Order execution failed — balance refunded', 502);
  }
}
