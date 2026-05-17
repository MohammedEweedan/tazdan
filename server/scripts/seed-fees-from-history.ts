#!/usr/bin/env ts-node
/**
 * For historical Orders / Withdrawals / Transactions whose `fee > 0` but
 * have no corresponding PlatformFee row (matched by `sourceId`), create
 * one so historical revenue is reflected on the admin dashboard.
 *
 * Idempotent — re-running is safe; rows with an existing PlatformFee are
 * skipped. Runs in chunks of 500.
 *
 * Usage:
 *   npx ts-node scripts/seed-fees-from-history.ts
 */

/// <reference types="node" />
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { collectFee } from '../src/services/fee/feeCollector.service';

interface Row {
  id: string;
  userId: string;
  fee: Decimal;
  currency: string;
  source: 'order' | 'withdrawal';
  createdAt: Date;
}

async function backfillModel(source: 'order' | 'withdrawal') {
  const CHUNK = 500;
  let processedTotal = 0;
  let createdTotal = 0;
  let skip = 0;

  while (true) {
    const rows = source === 'order'
      ? await prisma.order.findMany({
          where: { fee: { gt: 0 } },
          select: { id: true, userId: true, fee: true, quoteCurrency: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: CHUNK,
          skip,
        })
      : await prisma.withdrawal.findMany({
          where: { fee: { gt: 0 } },
          select: { id: true, userId: true, fee: true, currency: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: CHUNK,
          skip,
        });

    if (rows.length === 0) break;
    skip += CHUNK;

    for (const row of rows as any[]) {
      processedTotal++;
      // Skip if a PlatformFee row already exists for this source/id.
      const existing = await prisma.platformFee.findFirst({
        where: { source, sourceId: row.id },
        select: { id: true },
      });
      if (existing) continue;

      const fee = new Decimal(row.fee.toString());
      if (fee.lte(0)) continue;

      const currency = source === 'order' ? row.quoteCurrency : row.currency;
      try {
        await collectFee({
          source,
          sourceId: row.id,
          payerId:  row.userId,
          amount:   fee,
          currency,
          description: `Historical backfill (${source})`,
          metadata: { backfilledAt: new Date().toISOString(), originalCreatedAt: row.createdAt.toISOString() },
        });
        createdTotal++;
      } catch (err) {
        console.warn(`[seed-fees] collectFee failed for ${source}:${row.id}`, err);
      }
    }

    console.log(`[seed-fees:${source}] chunk processed=${processedTotal} created=${createdTotal}`);
    if (rows.length < CHUNK) break;
  }

  console.log(`[seed-fees:${source}] DONE — processed=${processedTotal} created=${createdTotal}`);
}

async function main() {
  await backfillModel('order');
  await backfillModel('withdrawal');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed-fees] FAILED', err);
    process.exit(1);
  });
