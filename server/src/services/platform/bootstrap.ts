/**
 * Start-up for the operating platform: reference data that must exist
 * (risk rules, corridors, provider registry, treasury pools) and the
 * background workers (remittance status polling, provider health,
 * reconciliation). Idempotent; never overwrites operator changes.
 *
 * Treasury pools are created EMPTY. Liquidity only appears when treasury
 * records a prefund (cockpit → Treasury), which posts a ledger journal.
 */
import type { Currency } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { ensureDefaultRules } from '../risk/engine';
import { ensureDefaultCorridors } from '../remittance/corridors';
import { checkProviderHealth, listPayoutAdapters, syncProviders } from '../providers/registry';
import { startRemittanceWorker } from '../remittance/remittance.service';
import { startWebhookWorker } from '../business/webhooks.service';
import { startReconciliationScheduler } from '../reconciliation/recon.service';
// Approval handlers register on import.
import '../ledger/adjustments.service';
import '../remittance/refunds.service';
import '../exchange/fxOverride.service';

/** Default pool thresholds (target, minimum, max exposure). Set real values per treasury policy. */
const THRESHOLDS: Partial<Record<Currency, [number, number, number]>> = {
  GBP: [40_000, 8_000, 200_000], EUR: [45_000, 9_000, 230_000], USD: [50_000, 10_000, 250_000], USDT: [50_000, 10_000, 250_000],
  EGP: [2_400_000, 500_000, 12_000_000], TRY: [1_700_000, 350_000, 8_500_000], AED: [180_000, 36_000, 900_000],
  SAR: [190_000, 38_000, 950_000], TND: [150_000, 30_000, 750_000], LYD: [300_000, 60_000, 1_500_000],
};

export async function ensureDefaultPools(): Promise<void> {
  for (const a of listPayoutAdapters()) {
    const model = a.descriptor.terms?.settlementModel;
    if (model !== 'PREFUNDED' && model !== 'INTERNAL') continue;
    const currencies = a.descriptor.code === 'TAZDAN_WALLET'
      ? (['LYD', 'GBP', 'EUR', 'EGP', 'TRY', 'AED', 'TND'] as Currency[])
      : a.descriptor.currencies;
    for (const currency of currencies) {
      const [target, minimum, maxExposure] = THRESHOLDS[currency] ?? [50_000, 10_000, 250_000];
      const code = `${a.descriptor.code}-${currency}`;
      await prisma.treasuryPool.upsert({
        where: { code },
        create: {
          code, name: `${a.descriptor.name} · ${currency}`, currency, providerCode: a.descriptor.code,
          entity: a.descriptor.code === 'TAZDAN_WALLET' ? 'Tazdan (house liquidity)' : `${a.descriptor.name} (${a.descriptor.mode.toLowerCase()})`,
          location: a.descriptor.code === 'TAZDAN_WALLET' ? 'WALLET' : 'PROVIDER', fundClass: 'SETTLEMENT',
          target, minimum, maxExposure,
        },
        update: {},
      });
    }
  }
}

export async function bootstrapPlatform(opts: { workers: boolean }): Promise<void> {
  try {
    await ensureDefaultRules();
    await ensureDefaultCorridors();
    await syncProviders();
    await ensureDefaultPools();
    await checkProviderHealth();
  } catch (err) {
    logger.error('[bootstrap] reference data setup failed', { err: (err as Error).message });
  }
  if (!opts.workers) return;
  startRemittanceWorker();
  startReconciliationScheduler();
  startWebhookWorker();
  setInterval(() => { void checkProviderHealth().catch(() => undefined); }, 60_000).unref?.();
}
