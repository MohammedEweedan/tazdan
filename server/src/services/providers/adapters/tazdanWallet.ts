/**
 * TAZDAN_WALLET — internal payout rail (PRODUCTION mode).
 *
 * When the beneficiary holds a Tazdan account the payout is an internal
 * ledger movement: treasury (destination currency) → beneficiary USER. No
 * external party is involved, so this rail is real, not sandbox. The ledger
 * posting itself is done by the remittance service, which owns the journal;
 * this adapter only validates and acknowledges.
 */
import type { Currency } from '@prisma/client';
import { prisma } from '../../../utils/prisma';
import type { PayoutProvider, PayoutRequest, PayoutResult, ProviderDescriptor } from '../types';

export class TazdanWalletPayoutProvider implements PayoutProvider {
  readonly descriptor: ProviderDescriptor = {
    code: 'TAZDAN_WALLET',
    name: 'Tazdan wallet (internal)',
    category: 'PAYOUT',
    mode: 'PRODUCTION',
    countries: ['*'],
    currencies: ['LYD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'TRY', 'TND', 'USDT'],
    payoutMethods: ['TAZDAN_WALLET'],
    terms: { feeFixed: 0, feePercent: 0, minAmount: 0.01, maxAmount: 1_000_000, slaMinutes: 0, settlementModel: 'INTERNAL', cutoff: null },
  };

  async health() { return { ok: true, latencyMs: 0, detail: 'Internal ledger rail' }; }
  async quoteFee(_amount: string, currency: Currency) { return { fee: '0.00', currency }; }

  async execute(req: PayoutRequest): Promise<PayoutResult> {
    const id = req.beneficiary.tazdanUserId;
    if (!id) return { providerRef: `TZW-${req.reference}`, status: 'FAILED', failureReason: 'Beneficiary has no Tazdan account' };
    const user = await prisma.user.findUnique({ where: { id }, select: { status: true } });
    if (!user || user.status !== 'ACTIVE') {
      return { providerRef: `TZW-${req.reference}`, status: 'FAILED', failureReason: 'Beneficiary account is not active' };
    }
    return { providerRef: `TZW-${req.reference}`, status: 'PAID' };
  }

  async status(providerRef: string): Promise<PayoutResult> { return { providerRef, status: 'PAID' }; }
  async cancel() { return { cancelled: false, reason: 'Internal payouts settle instantly' }; }
  async statement() { return []; }
}
