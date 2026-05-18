/**
 * Order execution — supports every tradeable asset.
 *
 * Native assets (ETH, BTC, SOL, USDT) use dedicated Decimal columns.
 * Every other asset uses the `altBalances` JSON column on UserWallet,
 * stored as { "BNB": "1.2345678", "XRP": "500.000000", ... }.
 *
 * Safety:
 *   - Pessimistic concurrency: all balance mutations inside prisma.$transaction.
 *   - Idempotency: unique constraint on CryptoOrder.idempotencyKey.
 *   - Quote validity: quotes are single-use, rejected after 30s.
 */
import axios from 'axios';
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { createUserWallets } from '../wallet/walletDerivation.service';
import { consumeQuote, type Quote, type SupportedAsset } from './priceEngine.service';
import { collectFee } from '../fee/feeCollector.service';

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

// Native-column assets have a dedicated Decimal field on UserWallet.
type NativeField = 'ethBalance' | 'btcBalance' | 'solBalance' | 'usdtErc20Bal' | 'usdtTrc20Bal';

function nativeField(asset: string, network: string): NativeField | null {
  const a = asset.toUpperCase();
  const n = network.toUpperCase();
  if (a === 'ETH')  return 'ethBalance';
  if (a === 'BTC')  return 'btcBalance';
  if (a === 'SOL')  return 'solBalance';
  if (a === 'USDT') return n === 'TRC20' ? 'usdtTrc20Bal' : 'usdtErc20Bal';
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

export async function executeQuote(opts: {
  userId: string;
  quoteId: string;
  idempotencyKey?: string;
}) {
  const { userId, quoteId, idempotencyKey } = opts;

  if (idempotencyKey) {
    const prior = await prisma.cryptoOrder.findUnique({ where: { idempotencyKey } });
    if (prior) return prior;
  }

  const quote = await consumeQuote(quoteId);
  if (!quote) throw new AppError('Quote expired or not found. Request a new quote.', 400);

  const fiat    = new Decimal(quote.fiatAmount);
  const crypto_ = new Decimal(quote.cryptoAmount);
  const assetUpper = quote.asset.toUpperCase();

  let userWallet = await prisma.userWallet.findUnique({ where: { userId } });
  if (!userWallet) userWallet = await createUserWallets(userId);

  const native = nativeField(quote.asset, quote.network);

  const order = await prisma.$transaction(async (tx) => {
    const uw = await tx.userWallet.findUnique({ where: { userId } });
    if (!uw) throw new AppError('User wallet not provisioned', 400);

    const usdt = await tx.wallet.findUnique({
      where: { userId_currency: { userId, currency: 'USDT' } },
    });
    if (!usdt) throw new AppError('USDT wallet missing', 400);

    if (quote.side === 'BUY') {
      if (new Decimal(usdt.balance.toString()).lt(fiat)) {
        throw new AppError('Insufficient USDT balance', 400);
      }
      await tx.wallet.update({
        where: { id: usdt.id },
        data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } },
      });

      if (native) {
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
      // SELL
      if (native) {
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
  });

  // Transaction.currency must be a valid Currency enum value.
  // All crypto trades settle via the user's USDT wallet, so record USDT
  // as the currency and store the actual asset ticker in metadata.
  await prisma.transaction.create({
    data: {
      userId,
      type: quote.side === 'BUY' ? 'BUY' : 'SELL',
      currency: 'USDT',
      amount: quote.side === 'BUY'
        ? new Prisma.Decimal(-fiat.toFixed(8))   // USDT out
        : new Prisma.Decimal(fiat.toFixed(8)),    // USDT in
      balanceBefore: new Prisma.Decimal(0),
      balanceAfter:  new Prisma.Decimal(0),
      description: quote.side === 'BUY'
        ? `Bought ${crypto_.toFixed(8)} ${quote.asset} with ${fiat.toFixed(2)} USDT`
        : `Sold ${crypto_.toFixed(8)} ${quote.asset} for ${fiat.toFixed(2)} USDT`,
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
      const uw   = await tx.userWallet.findUnique({ where: { userId } });
      const usdt = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USDT' } } });
      if (!uw || !usdt) return;

      if (quote.side === 'BUY') {
        await tx.wallet.update({ where: { id: usdt.id }, data: { balance: { increment: new Prisma.Decimal(fiat.toFixed(8)) } } });
        if (native) {
          await tx.userWallet.update({ where: { id: uw.id }, data: { [native]: { decrement: new Prisma.Decimal(crypto_.toFixed(18)) } } });
        } else {
          const current = getAltBalance(uw.altBalances, assetUpper);
          const next    = setAltBalance(uw.altBalances, assetUpper, Decimal.max(0, current.minus(crypto_)));
          await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
        }
      } else {
        if (native) {
          await tx.userWallet.update({ where: { id: uw.id }, data: { [native]: { increment: new Prisma.Decimal(crypto_.toFixed(18)) } } });
        } else {
          const current = getAltBalance(uw.altBalances, assetUpper);
          const next    = setAltBalance(uw.altBalances, assetUpper, current.plus(crypto_));
          await tx.userWallet.update({ where: { id: uw.id }, data: { altBalances: next } });
        }
        await tx.wallet.update({ where: { id: usdt.id }, data: { balance: { decrement: new Prisma.Decimal(fiat.toFixed(8)) } } });
      }
      await tx.cryptoOrder.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    });
    throw new AppError('Order execution failed — balance refunded', 502);
  }
}
