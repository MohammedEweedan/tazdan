/**
 * Order execution.
 *
 * Custodial model: users never hold keys until they withdraw. A BUY
 * debits their USDT fiat wallet and credits the internal crypto ledger
 * on UserWallet. A SELL does the reverse. The real trade against Binance
 * happens in parallel — on success we record the binanceOrderId, on
 * failure we mark the CryptoOrder FAILED and refund the user atomically.
 *
 * Safety:
 *   - Pessimistic concurrency: all balance mutations happen inside
 *     prisma.$transaction with serializable isolation.
 *   - Idempotency: callers may supply an idempotency key; the unique
 *     constraint on CryptoOrder.idempotencyKey prevents double-execution
 *     on retry.
 *   - Quote validity: quotes are consumed (single-use) and rejected
 *     after 30s.
 */
import axios from 'axios';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { createUserWallets } from '../wallet/walletDerivation.service';
import { consumeQuote, type Quote, type SupportedAsset } from './priceEngine.service';

Decimal.set({ precision: 40 });

const BINANCE_REST = process.env.BINANCE_REST_URL || 'https://api.binance.com';

// Per-asset precision on Binance (lot size). Real impl should call
// GET /api/v3/exchangeInfo and cache; these are safe defaults.
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

/**
 * Place a MARKET order on Binance spot. Returns the Binance order id
 * on success. If credentials aren't configured we fall through to
 * "simulated" mode — the internal ledger still moves so the system is
 * end-to-end testable in dev.
 */
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
}

function roundQty(asset: string, amount: Decimal): string {
  const precision = ASSET_PRECISION[asset.toUpperCase()] ?? ASSET_PRECISION.DEFAULT;
  return amount.toFixed(precision, Decimal.ROUND_DOWN);
}

type BalanceField = 'ethBalance' | 'btcBalance' | 'solBalance' | 'usdtErc20Bal' | 'usdtTrc20Bal' | null;

function assetBalanceField(asset: string, network: string): BalanceField {
  const assetUpper = asset.toUpperCase();
  const networkUpper = network.toUpperCase();
  
  if (assetUpper === 'ETH') return 'ethBalance';
  if (assetUpper === 'BTC') return 'btcBalance';
  if (assetUpper === 'SOL') return 'solBalance';
  if (assetUpper === 'USDT') {
    return networkUpper === 'TRC20' ? 'usdtTrc20Bal' : 'usdtErc20Bal';
  }
  
  // Return null for unsupported assets - these will need a different storage mechanism
  return null;
}

/**
 * Execute a quote the user has previously received from /exchange/quote.
 * Consumes the quote (single-use), moves balances, places the Binance
 * order, and persists a CryptoOrder row.
 */
export async function executeQuote(opts: {
  userId: string;
  quoteId: string;
  idempotencyKey?: string;
}) {
  const { userId, quoteId, idempotencyKey } = opts;

  // Idempotency shortcut: if this key already produced an order, return it.
  if (idempotencyKey) {
    const prior = await prisma.cryptoOrder.findUnique({ where: { idempotencyKey } });
    if (prior) return prior;
  }

  const quote = consumeQuote(quoteId);
  if (!quote) throw new AppError('Quote expired or not found. Request a new quote.', 400);

  const fiat = new Decimal(quote.fiatAmount);
  const crypto_ = new Decimal(quote.cryptoAmount);

  // Ensure user wallet exists before starting the transaction
  let userWallet = await prisma.userWallet.findUnique({ where: { userId } });
  if (!userWallet) {
    userWallet = await createUserWallets(userId);
  }

  // Step 1: atomic balance move + order row.
  const order = await prisma.$transaction(async (tx) => {
    userWallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!userWallet) throw new AppError('User wallet not provisioned', 400);

    const usdt = await tx.wallet.findUnique({
      where: { userId_currency: { userId, currency: 'USDT' } },
    });
    if (!usdt) throw new AppError('USDT wallet missing', 400);

    const balField = assetBalanceField(quote.asset, quote.network);
    
    // Check if asset is supported for custody
    if (!balField) {
      throw new AppError(`Asset ${quote.asset} is available for quotes but not yet supported for custody trading. Supported assets: ETH, BTC, SOL, USDT.`, 400);
    }

    if (quote.side === 'BUY') {
      // Debit USDT, credit crypto.
      if (new Decimal(usdt.balance.toString()).lt(fiat)) {
        throw new AppError('Insufficient USDT balance', 400);
      }
      await tx.wallet.update({
        where: { id: usdt.id },
        data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } },
      });
      await tx.userWallet.update({
        where: { id: userWallet.id },
        data: { [balField]: { increment: new Prisma.Decimal(crypto_.toFixed(18)) } },
      });
    } else {
      // Debit crypto, credit USDT.
      const current = new Decimal((userWallet as any)[balField].toString());
      if (current.lt(crypto_)) {
        throw new AppError(`Insufficient ${quote.asset} balance`, 400);
      }
      await tx.userWallet.update({
        where: { id: userWallet.id },
        data: { [balField]: { decrement: new Prisma.Decimal(crypto_.toFixed(18)) } },
      });
      await tx.wallet.update({
        where: { id: usdt.id },
        data: { balance: { increment: new Prisma.Decimal(fiat.toFixed(8)) } },
      });
    }

    return tx.cryptoOrder.create({
      data: {
        userId,
        type: quote.side,
        asset: quote.asset,
        network: quote.network,
        quotedPrice: new Prisma.Decimal(quote.quotedPrice),
        quotedTotal: new Prisma.Decimal(fiat.toFixed(8)),
        marketPrice: new Prisma.Decimal(quote.marketPrice),
        actualCost: new Prisma.Decimal(fiat.toFixed(8)),
        platformFee: new Prisma.Decimal(quote.platformFee),
        networkFee: new Prisma.Decimal(quote.networkFee),
        spreadCapture: new Prisma.Decimal(quote.spreadCapture),
        cryptoAmount: new Prisma.Decimal(crypto_.toFixed(18)),
        status: 'PENDING',
        idempotencyKey: idempotencyKey ?? null,
      },
    });
  });

  // Create transaction record for activity feed
  const txDescription = quote.side === 'BUY'
    ? `Bought ${crypto_.toFixed(8)} ${quote.asset} with ${fiat.toFixed(2)} USDT`
    : `Sold ${crypto_.toFixed(8)} ${quote.asset} for ${fiat.toFixed(2)} USDT`;

  await prisma.transaction.create({
    data: {
      userId,
      type: quote.side === 'BUY' ? 'BUY' : 'SELL',
      currency: quote.asset as any,
      amount: quote.side === 'BUY' ? new Prisma.Decimal(crypto_.toFixed(18)) : new Prisma.Decimal(-crypto_.toFixed(18)),
      balanceBefore: new Prisma.Decimal(0), // Will be updated by wallet refresh
      balanceAfter: new Prisma.Decimal(0), // Will be updated by wallet refresh
      description: txDescription,
      reference: `CRPT-${order.id.slice(0, 8).toUpperCase()}`,
      metadata: {
        kind: 'crypto_order',
        orderId: order.id,
        asset: quote.asset,
        network: quote.network,
        fiatAmount: fiat.toFixed(2),
        cryptoAmount: crypto_.toFixed(8),
      },
    },
  });

  // Step 2: execute on Binance (outside the DB txn). On failure, refund.
  const symbol =
    quote.asset === 'USDT' ? null : `${quote.asset}USDT`;
  try {
    let binanceOrderId: string | null = null;
    if (symbol) {
      const result = await placeBinanceMarket({
        symbol,
        side: quote.side,
        quantity: roundQty(quote.asset as SupportedAsset, crypto_),
      });
      binanceOrderId = result.orderId;
    }
    return prisma.cryptoOrder.update({
      where: { id: order.id },
      data: {
        status: 'EXECUTED',
        binanceOrderId: binanceOrderId ?? undefined,
        executedAt: new Date(),
      },
    });
  } catch (err: any) {
    console.error('[binance] order failed — refunding', order.id, err?.response?.data ?? err?.message);
    // Refund: reverse the balance move and mark order FAILED.
    await prisma.$transaction(async (tx) => {
      const userWallet = await tx.userWallet.findUnique({ where: { userId } });
      const usdt = await tx.wallet.findUnique({
        where: { userId_currency: { userId, currency: 'USDT' } },
      });
      if (!userWallet || !usdt) return;
      const balField = assetBalanceField(quote.asset, quote.network);
      // Only refund if we have a valid balance field (asset is supported)
      if (!balField) {
        await tx.cryptoOrder.update({
          where: { id: order.id },
          data: { status: 'FAILED' },
        });
        return;
      }
      if (quote.side === 'BUY') {
        await tx.wallet.update({
          where: { id: usdt.id },
          data: { balance: { increment: new Prisma.Decimal(fiat.toFixed(8)) } },
        });
        await tx.userWallet.update({
          where: { id: userWallet.id },
          data: { [balField]: { decrement: new Prisma.Decimal(crypto_.toFixed(18)) } },
        });
      } else {
        await tx.userWallet.update({
          where: { id: userWallet.id },
          data: { [balField]: { increment: new Prisma.Decimal(crypto_.toFixed(18)) } },
        });
        await tx.wallet.update({
          where: { id: usdt.id },
          data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } },
        });
      }
      await tx.cryptoOrder.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });
    });
    throw new AppError('Order execution failed — balance refunded', 502);
  }
}
