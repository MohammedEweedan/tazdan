#!/usr/bin/env ts-node
/**
 * Backfill PlatformFee.amountUsd for rows where the value is 0 but
 * `amount > 0`. Runs the same toUsd cascade the fee collector uses so
 * older rows show up correctly on the admin dashboard.
 *
 * Idempotent — safe to re-run. Updates in chunks of 500.
 *
 * Usage:
 *   npx ts-node scripts/backfill-platform-fee-usd.ts
 */

/// <reference types="node" />
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { getRate } from '../src/services/exchange/fxRateProvider.service';

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

async function toUsd(amount: Decimal, currency: string): Promise<Decimal> {
  const cur = currency.toUpperCase();
  if (cur === 'USD' || cur === 'USDT') return amount;
  try {
    const pair = await getRate(cur, 'USD');
    const sellPrice = parseFloat(pair?.sellPrice ?? '0');
    if (sellPrice > 0 && Number.isFinite(sellPrice)) return amount.mul(sellPrice);
  } catch {}
  try {
    const pair = await getRate(cur, 'USDT');
    const sellPrice = parseFloat(pair?.sellPrice ?? '0');
    if (sellPrice > 0 && Number.isFinite(sellPrice)) return amount.mul(sellPrice);
  } catch {}
  try {
    const pair = await getRate('USD', cur);
    const buyPrice = parseFloat(pair?.buyPrice ?? '0');
    if (buyPrice > 0 && Number.isFinite(buyPrice)) return amount.div(buyPrice);
  } catch {}
  const floor = FIAT_USD_FLOOR[cur];
  if (floor && floor > 0) return amount.mul(floor);
  return amount;
}

async function main() {
  const CHUNK = 500;
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const rows = await prisma.platformFee.findMany({
      where: { amountUsd: { lte: 0 }, amount: { gt: 0 } },
      take: CHUNK,
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const amount = new Decimal(row.amount.toString());
      const usd = await toUsd(amount, row.currency);
      processed++;
      if (usd.gt(0)) {
        await prisma.platformFee.update({
          where: { id: row.id },
          data:  { amountUsd: usd },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`[backfill] chunk done — processed=${processed} updated=${updated} skipped=${skipped}`);
    if (rows.length < CHUNK) break;
  }

  console.log(`[backfill] DONE — processed=${processed} updated=${updated} skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill] FAILED', err);
    process.exit(1);
  });
