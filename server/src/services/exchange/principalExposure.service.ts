/**
 * Principal crypto exposure — a hard limit on the market risk Tazdan carries
 * when customer crypto orders fill against Tazdan itself.
 *
 * Orders are meant to be hedged on an exchange. When no venue is configured,
 * or the venue is unreachable (the production host is geo-blocked by
 * Binance), the order still fills for the customer (a "principal" fill) and
 * Tazdan holds the opposite position: customers' net buying leaves Tazdan
 * short the asset. Without a limit that position can grow without bound.
 *
 *   position(asset) = Σ customer principal BUY qty − Σ customer principal SELL qty
 *                   − Σ hedge BUY qty + Σ hedge SELL qty
 *   exposure        = |position| × last price
 *
 * Before a principal fill, inside the order transaction (serialised per asset
 * with an advisory lock), an order that would increase exposure beyond the
 * per-asset or total limit is refused. Orders that reduce exposure are always
 * allowed. Limits are PlatformSettings (USD):
 *   principal_max_net_usd.<ASSET> | principal_max_net_usd.default  (default 2,000)
 *   principal_max_total_usd                                         (default 10,000)
 * Set a limit to 0 to stop principal fills for that asset (or all assets).
 */
import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';

type Client = Prisma.TransactionClient | typeof prisma;
const D = (v: unknown) => new Decimal(v == null ? 0 : String(v));

const DEFAULT_ASSET_LIMIT_USD = '2000';
const DEFAULT_TOTAL_LIMIT_USD = '10000';

// ── Venue health ────────────────────────────────────────────────────
// The last placement attempt tells us whether the next order is likely to
// reach the venue. Without credentials every fill is principal.
let venueReachable: boolean | null = null;

export function markVenueResult(simulated: boolean): void {
  venueReachable = !simulated;
}

export function executionMode(): 'VENUE' | 'PRINCIPAL' {
  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) return 'PRINCIPAL';
  return venueReachable === false ? 'PRINCIPAL' : 'VENUE';
}

// ── Limits ──────────────────────────────────────────────────────────
async function limits(client: Client, asset: string): Promise<{ assetUsd: Decimal; totalUsd: Decimal }> {
  const rows = await client.platformSettings.findMany({
    where: { key: { in: [`principal_max_net_usd.${asset}`, 'principal_max_net_usd.default', 'principal_max_total_usd'] } },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    assetUsd: D(get(`principal_max_net_usd.${asset}`) ?? get('principal_max_net_usd.default') ?? DEFAULT_ASSET_LIMIT_USD),
    totalUsd: D(get('principal_max_total_usd') ?? DEFAULT_TOTAL_LIMIT_USD),
  };
}

// ── Positions ───────────────────────────────────────────────────────
export interface PrincipalPosition {
  asset: string;
  customerNetBought: string;
  hedgedNet: string;
  /** Tazdan's position: negative = short (customers net bought from Tazdan). */
  position: string;
  priceUsd: string;
  exposureUsd: string;
  limitUsd: string;
}

/**
 * Principal fills are executed orders with no venue order id (plus pending
 * ones, which are in flight). USDT orders never touch a venue and are excluded.
 */
async function positionRows(client: Client, asset?: string) {
  return client.$queryRaw<Array<{ asset: string; customer: string; hedged: string; price: string | null }>>`
    WITH c AS (
      SELECT UPPER("asset") AS asset,
             SUM(CASE WHEN "type" = 'BUY' THEN "cryptoAmount" ELSE -"cryptoAmount" END) AS customer
      FROM "CryptoOrder"
      WHERE "binanceOrderId" IS NULL AND "status" IN ('PENDING', 'EXECUTED') AND UPPER("asset") <> 'USDT'
        AND (${asset ?? null}::text IS NULL OR UPPER("asset") = ${asset ?? null}::text)
      GROUP BY 1
    ), h AS (
      SELECT UPPER("asset") AS asset,
             SUM(CASE WHEN "side" = 'BUY' THEN "quantity" ELSE -"quantity" END) AS hedged
      FROM "PrincipalHedge"
      WHERE (${asset ?? null}::text IS NULL OR UPPER("asset") = ${asset ?? null}::text)
      GROUP BY 1
    ), a AS (SELECT asset FROM c UNION SELECT asset FROM h)
    SELECT a.asset,
           COALESCE(c.customer, 0)::text AS customer,
           COALESCE(h.hedged, 0)::text AS hedged,
           (SELECT o."marketPrice" FROM "CryptoOrder" o WHERE UPPER(o."asset") = a.asset AND o."marketPrice" > 0 ORDER BY o."createdAt" DESC LIMIT 1)::text AS price
    FROM a LEFT JOIN c ON c.asset = a.asset LEFT JOIN h ON h.asset = a.asset
  `;
}

export async function principalPositions(client: Client = prisma): Promise<{ positions: PrincipalPosition[]; totalExposureUsd: string; totalLimitUsd: string; mode: 'VENUE' | 'PRINCIPAL' }> {
  const rows = await positionRows(client);
  const out: PrincipalPosition[] = [];
  let total = new Decimal(0);
  let totalLimit = D(DEFAULT_TOTAL_LIMIT_USD);
  for (const r of rows) {
    const position = D(r.hedged).minus(D(r.customer));
    const price = D(r.price);
    const exposure = position.abs().mul(price);
    const l = await limits(client, r.asset);
    totalLimit = l.totalUsd;
    total = total.plus(exposure);
    out.push({
      asset: r.asset, customerNetBought: D(r.customer).toString(), hedgedNet: D(r.hedged).toString(),
      position: position.toString(), priceUsd: price.toString(), exposureUsd: exposure.toFixed(2), limitUsd: l.assetUsd.toFixed(2),
    });
  }
  if (!rows.length) totalLimit = (await limits(client, 'DEFAULT')).totalUsd;
  out.sort((a, b) => Number(b.exposureUsd) - Number(a.exposureUsd));
  return { positions: out, totalExposureUsd: total.toFixed(2), totalLimitUsd: totalLimit.toFixed(2), mode: executionMode() };
}

/**
 * Pre-trade check for a principal fill. Call inside the order transaction,
 * before the order row is written. Serialised per asset so two orders cannot
 * both use the same headroom.
 */
export async function assertPrincipalCapacity(tx: Prisma.TransactionClient, order: { asset: string; side: 'BUY' | 'SELL'; quantity: Decimal; priceUsd: Decimal }): Promise<void> {
  const asset = order.asset.toUpperCase();
  if (asset === 'USDT') return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`principal:${asset}`}))`;

  const [row] = await positionRows(tx, asset);
  const current = D(row?.hedged).minus(D(row?.customer));
  // A customer BUY makes Tazdan shorter; a SELL makes it longer.
  const next = order.side === 'BUY' ? current.minus(order.quantity) : current.plus(order.quantity);
  if (next.abs().lte(current.abs())) return; // reduces (or keeps) exposure

  const l = await limits(tx, asset);
  const nextUsd = next.abs().mul(order.priceUsd);
  if (nextUsd.gt(l.assetUsd)) {
    logger.warn('[principal] order refused: asset limit', { asset, nextUsd: nextUsd.toFixed(2), limit: l.assetUsd.toFixed(2) });
    throw new AppError(`${asset} trading is paused for now. Please try again later.`, 503, 'FEATURE_DISABLED', { reason: 'PRINCIPAL_LIMIT' });
  }
  // Total across assets, valuing the others at their last price.
  const all = await positionRows(tx);
  let total = nextUsd;
  for (const r of all) {
    if (r.asset === asset) continue;
    total = total.plus(D(r.hedged).minus(D(r.customer)).abs().mul(D(r.price)));
  }
  if (total.gt(l.totalUsd)) {
    logger.warn('[principal] order refused: total limit', { asset, totalUsd: total.toFixed(2), limit: l.totalUsd.toFixed(2) });
    throw new AppError('Crypto trading is paused for now. Please try again later.', 503, 'FEATURE_DISABLED', { reason: 'PRINCIPAL_LIMIT' });
  }
}

/** Record a hedge placed outside the platform. */
export async function recordHedge(input: {
  asset: string; side: 'BUY' | 'SELL'; quantity: string | number; priceUsd: string | number;
  venue: string; reference?: string | null; note?: string | null; staffId: string;
  req?: { ip?: string; headers?: Record<string, any> };
}) {
  const quantity = D(input.quantity);
  const price = D(input.priceUsd);
  if (!quantity.isFinite() || quantity.lte(0)) throw new AppError('Quantity must be positive', 400);
  if (!price.isFinite() || price.lte(0)) throw new AppError('Price must be positive', 400);
  return prisma.$transaction(async (tx) => {
    const hedge = await tx.principalHedge.create({
      data: {
        asset: input.asset.toUpperCase(), side: input.side, quantity: quantity.toFixed(), priceUsd: price.toFixed(),
        venue: input.venue.trim().slice(0, 80), reference: input.reference?.trim().slice(0, 120) || null,
        note: input.note?.trim().slice(0, 500) || null, createdById: input.staffId,
      },
    });
    await writeAudit(tx as any, { actorId: input.staffId, action: 'PRINCIPAL_HEDGE_RECORDED', entity: 'PrincipalHedge', entityId: hedge.id, after: hedge, reason: input.note ?? null, req: input.req });
    return hedge;
  });
}
