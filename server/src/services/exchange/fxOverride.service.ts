/**
 * Treasury FX override — maker-checker, with a reason and an expiry.
 *
 * The same FX_OVERRIDE approval also carries LYD market-maker configuration
 * changes: payload { kind: 'MARKET_MAKER_CONFIG', changes: { <setting>: <pips|…> } },
 * requested through POST /api/cockpit/approvals and approved by a second
 * holder of `fx.override`. Validation bounds and the application/audit live
 * in lydMarketMaker.service.ts. (LYD pairs are priced from Fulus, so a rate
 * override does not apply to them; the market maker is the control there.)
 *
 * A treasury operator requests a manual rate for a pair (FX_OVERRIDE
 * approval). Once a second authorised person approves, the rate replaces the
 * live feed until `overrideExpiresAt` (max 24h), then the pair falls back to
 * the live provider automatically. Every override is audited with the rate
 * it replaced.
 */
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { registerApprovalHandler } from '../platform/approvals.service';
import { writeAudit } from '../platform/audit';
import { invalidateRate } from './fxRateProvider.service';
import { applyMarketMakerRequest, isMarketMakerRequest, validateMarketMakerRequest } from './lydMarketMaker.service';

const CURRENCIES = new Set(['USD', 'USDT', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND']);

interface OverridePayload { base: string; quote: string; buyPrice: number; sellPrice: number; expiresInMinutes: number }

function check(p: Partial<OverridePayload>): OverridePayload {
  const base = String(p.base ?? '').toUpperCase();
  const quote = String(p.quote ?? '').toUpperCase();
  const buy = Number(p.buyPrice); const sell = Number(p.sellPrice); const mins = Number(p.expiresInMinutes);
  if (!CURRENCIES.has(base) || !CURRENCIES.has(quote) || base === quote) throw new AppError('Choose two different supported currencies', 400);
  if (!(buy > 0 && sell > 0 && buy > sell)) throw new AppError('Buy price must be above sell price, both positive', 400);
  if ((buy - sell) / buy > 0.2) throw new AppError('Spread above 20% — refused as a likely input error', 400);
  if (!(mins >= 5 && mins <= 24 * 60)) throw new AppError('Expiry must be between 5 minutes and 24 hours', 400);
  return { base, quote, buyPrice: buy, sellPrice: sell, expiresInMinutes: mins };
}

registerApprovalHandler('FX_OVERRIDE', {
  requestPermission: 'fx.override',
  approvePermission: 'fx.override',
  validate: async (payload) => {
    if (isMarketMakerRequest(payload)) { await validateMarketMakerRequest(payload); return; }
    check(payload);
  },
  execute: async (payload, ctx) => {
    if (isMarketMakerRequest(payload)) return applyMarketMakerRequest(payload, ctx);
    const p = check(payload);
    const previous = await prisma.exchangeRate.findUnique({ where: { baseCurrency_quoteCurrency: { baseCurrency: p.base as any, quoteCurrency: p.quote as any } } });
    const expiresAt = new Date(Date.now() + p.expiresInMinutes * 60_000);
    const rate = await prisma.exchangeRate.upsert({
      where: { baseCurrency_quoteCurrency: { baseCurrency: p.base as any, quoteCurrency: p.quote as any } },
      create: { baseCurrency: p.base as any, quoteCurrency: p.quote as any, buyPrice: p.buyPrice, sellPrice: p.sellPrice, isActive: true, setBy: ctx.approvedById, overrideReason: ctx.reason, overrideExpiresAt: expiresAt },
      update: { buyPrice: p.buyPrice, sellPrice: p.sellPrice, isActive: true, setBy: ctx.approvedById, overrideReason: ctx.reason, overrideExpiresAt: expiresAt },
    });
    invalidateRate(p.base, p.quote);
    invalidateRate(p.quote, p.base);
    await writeAudit(prisma, {
      actorId: ctx.approvedById, action: 'FX_OVERRIDE_APPLIED', entity: 'ExchangeRate', entityId: rate.id,
      before: previous ? { buyPrice: previous.buyPrice, sellPrice: previous.sellPrice, isActive: previous.isActive } : null,
      after: { pair: `${p.base}/${p.quote}`, buyPrice: p.buyPrice, sellPrice: p.sellPrice, expiresAt, requestedById: ctx.requestedById },
      reason: ctx.reason,
    });
    return { pair: `${p.base}/${p.quote}`, expiresAt };
  },
});
