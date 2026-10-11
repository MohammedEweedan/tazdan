/**
 * Remittance corridor catalogue.
 *
 * Every corridor starts SANDBOX_ONLY: the internal lifecycle is complete but
 * no regulated payout partner is connected. A corridor can only be set LIVE
 * when at least one PRODUCTION payout rail serves it and is ENABLED (see
 * setCorridorStatus). The commercial terms below are configurable sandbox
 * defaults — set real terms per partner contract before activation.
 */
import type { Currency, RemittanceDirection, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { listPayoutAdapters } from '../providers/registry';

export const EU_COUNTRIES = ['DE', 'FR', 'IT', 'ES', 'NL', 'MT', 'IE', 'BE', 'AT', 'PT', 'GR', 'FI', 'LU', 'CY'];
export const PURPOSES = ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'SAVINGS', 'GOODS_AND_SERVICES', 'SALARY', 'RENT', 'GIFT', 'OTHER'];

interface CorridorSeed {
  code: string; name: string; sourceCountry: string; destCountry: string; sourceCurrency: Currency; destCurrency: Currency;
  direction: RemittanceDirection; minAmount: number; maxAmount: number; daily: number; monthly: number;
  feeFixed: number; feePercent: number; spreadPercent: number; sofThreshold: number; payoutMethods: string[];
}

const OUT = 'OUTBOUND' as const;
const IN = 'INBOUND' as const;

export const DEFAULT_CORRIDORS: CorridorSeed[] = [
  { code: 'LY-GB', name: 'Libya → United Kingdom', sourceCountry: 'LY', destCountry: 'GB', sourceCurrency: 'LYD', destCurrency: 'GBP', direction: OUT, minAmount: 10, maxAmount: 10_000, daily: 10_000, monthly: 30_000, feeFixed: 10, feePercent: 0.005, spreadPercent: 0.015, sofThreshold: 2_500, payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'] },
  { code: 'GB-LY', name: 'United Kingdom → Libya', sourceCountry: 'GB', destCountry: 'LY', sourceCurrency: 'GBP', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 2, feePercent: 0.005, spreadPercent: 0.015, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT', 'CASH_PICKUP'] },
  { code: 'LY-EG', name: 'Libya → Egypt', sourceCountry: 'LY', destCountry: 'EG', sourceCurrency: 'LYD', destCurrency: 'EGP', direction: OUT, minAmount: 500, maxAmount: 500_000, daily: 500_000, monthly: 1_500_000, feeFixed: 5, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 120_000, payoutMethods: ['BANK_ACCOUNT', 'MOBILE_WALLET', 'TAZDAN_WALLET'] },
  { code: 'EG-LY', name: 'Egypt → Libya', sourceCountry: 'EG', destCountry: 'LY', sourceCurrency: 'EGP', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 50, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT'] },
  { code: 'LY-TR', name: 'Libya → Turkey', sourceCountry: 'LY', destCountry: 'TR', sourceCurrency: 'LYD', destCurrency: 'TRY', direction: OUT, minAmount: 300, maxAmount: 400_000, daily: 400_000, monthly: 1_200_000, feeFixed: 8, feePercent: 0.004, spreadPercent: 0.013, sofThreshold: 100_000, payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'] },
  { code: 'TR-LY', name: 'Turkey → Libya', sourceCountry: 'TR', destCountry: 'LY', sourceCurrency: 'TRY', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 30, feePercent: 0.004, spreadPercent: 0.013, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT'] },
  { code: 'LY-AE', name: 'Libya → UAE', sourceCountry: 'LY', destCountry: 'AE', sourceCurrency: 'LYD', destCurrency: 'AED', direction: OUT, minAmount: 50, maxAmount: 50_000, daily: 50_000, monthly: 150_000, feeFixed: 8, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 10_000, payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'] },
  { code: 'AE-LY', name: 'UAE → Libya', sourceCountry: 'AE', destCountry: 'LY', sourceCurrency: 'AED', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 10, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT'] },
  { code: 'LY-EU', name: 'Libya → Euro area', sourceCountry: 'LY', destCountry: 'EU', sourceCurrency: 'LYD', destCurrency: 'EUR', direction: OUT, minAmount: 10, maxAmount: 12_000, daily: 12_000, monthly: 36_000, feeFixed: 10, feePercent: 0.005, spreadPercent: 0.015, sofThreshold: 3_000, payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'] },
  { code: 'EU-LY', name: 'Euro area → Libya', sourceCountry: 'EU', destCountry: 'LY', sourceCurrency: 'EUR', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 2, feePercent: 0.005, spreadPercent: 0.015, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT'] },
  { code: 'LY-TN', name: 'Libya → Tunisia', sourceCountry: 'LY', destCountry: 'TN', sourceCurrency: 'LYD', destCurrency: 'TND', direction: OUT, minAmount: 30, maxAmount: 30_000, daily: 30_000, monthly: 90_000, feeFixed: 5, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 8_000, payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'] },
  { code: 'TN-LY', name: 'Tunisia → Libya', sourceCountry: 'TN', destCountry: 'LY', sourceCurrency: 'TND', destCurrency: 'LYD', direction: IN, minAmount: 50, maxAmount: 75_000, daily: 75_000, monthly: 200_000, feeFixed: 3, feePercent: 0.004, spreadPercent: 0.012, sofThreshold: 15_000, payoutMethods: ['TAZDAN_WALLET', 'BANK_ACCOUNT'] },
];

/** Create missing corridors (never overwrites operator changes). */
export async function ensureDefaultCorridors(): Promise<void> {
  for (const c of DEFAULT_CORRIDORS) {
    await prisma.remittanceCorridor.upsert({
      where: { code: c.code },
      create: {
        code: c.code, name: c.name, sourceCountry: c.sourceCountry, destCountry: c.destCountry,
        sourceCurrency: c.sourceCurrency, destCurrency: c.destCurrency, direction: c.direction, status: 'SANDBOX_ONLY',
        minAmount: c.minAmount, maxAmount: c.maxAmount, dailyLimitPerCustomer: c.daily, monthlyLimitPerCustomer: c.monthly,
        feeFixed: c.feeFixed, feePercent: c.feePercent, spreadPercent: c.spreadPercent, quoteTtlSeconds: 300,
        sourceOfFundsThreshold: c.sofThreshold, allowedPurposes: PURPOSES, payoutMethods: c.payoutMethods,
        tierSpreadDiscounts: { TIER_3: 0.25, BUSINESS: 0.35 } as Prisma.InputJsonValue,
      },
      update: {},
    });
  }
}

/** Countries a beneficiary may be in for a corridor. */
export function corridorDestCountries(destCountry: string): string[] {
  return destCountry === 'EU' ? EU_COUNTRIES : [destCountry];
}

export async function setCorridorStatus(code: string, status: 'LIVE' | 'SANDBOX_ONLY' | 'PAUSED' | 'DISABLED', actorId: string, reason: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const corridor = await prisma.remittanceCorridor.findUnique({ where: { code } });
  if (!corridor) throw new AppError('Corridor not found', 404);
  if (status === 'LIVE') {
    const countries = corridorDestCountries(corridor.destCountry);
    const liveRails = listPayoutAdapters().filter((a) =>
      a.descriptor.mode === 'PRODUCTION' && a.descriptor.code !== 'TAZDAN_WALLET' &&
      a.descriptor.currencies.includes(corridor.destCurrency) &&
      (a.descriptor.countries.includes('*') || a.descriptor.countries.some((c) => countries.includes(c))));
    const enabled = liveRails.length
      ? await prisma.provider.count({ where: { code: { in: liveRails.map((r) => r.descriptor.code) }, status: 'ENABLED' } })
      : 0;
    const walletOnly = corridor.payoutMethods.every((m) => m === 'TAZDAN_WALLET');
    if (!enabled && !walletOnly) {
      throw new AppError(`${code} cannot go LIVE: no enabled production payout partner serves ${corridor.destCurrency} in ${corridor.destCountry}. External provider activation required.`, 409, 'PROVIDER_NOT_ACTIVATED');
    }
  }
  const updated = await prisma.remittanceCorridor.update({ where: { code }, data: { status } });
  await writeAudit(prisma, { actorId, action: 'CORRIDOR_STATUS', entity: 'RemittanceCorridor', entityId: corridor.id, before: { status: corridor.status }, after: { status }, reason, req });
  return updated;
}
