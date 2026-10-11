/**
 * Treasury liquidity pools.
 *
 * A pool is prefunded money held at a payout partner (or bank / wallet) in
 * one currency. Its history is append-only TreasuryMovement rows:
 *   PREFUND / ADJUST_IN   increase the balance
 *   WITHDRAW / ADJUST_OUT decrease it
 *   RESERVE               earmarks liquidity for a routed transfer
 *   RELEASE               returns an earmark (transfer failed / cancelled)
 *   CONSUME               the payout happened: balance and earmark both drop
 * balance   = PREFUND + ADJUST_IN − WITHDRAW − ADJUST_OUT − CONSUME
 * reserved  = RESERVE − RELEASE − CONSUME   (per transfer)
 * available = balance − reserved
 *
 * Reservation locks the pool row, so two transfers can never both take the
 * last of a pool's liquidity. Prefunds and withdrawals post ledger journals
 * against the TREASURY account so the ledger's treasury position always
 * equals the sum of pool balances (checked by reconciliation).
 */
import { Prisma, type Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { postLedger } from '../ledger/ledger.service';
import { writeAudit } from '../platform/audit';

type Tx = Prisma.TransactionClient;
const D = (v: unknown) => new Decimal(String(v ?? 0));

export interface PoolPosition {
  id: string; code: string; name: string; currency: Currency; entity: string; location: string; providerCode: string | null;
  corridorCodes: string[]; fundClass: string;
  balance: string; reserved: string; available: string; consumed24h: string;
  target: string; minimum: string; maxExposure: string;
  utilisationPct: number;
}

async function totals(client: Tx | typeof prisma, poolId: string) {
  const rows = await client.treasuryMovement.groupBy({ by: ['type'], where: { poolId }, _sum: { amount: true } });
  const sum = (t: string) => D(rows.find((r) => r.type === t)?._sum.amount);
  const balance = sum('PREFUND').plus(sum('ADJUST_IN')).minus(sum('WITHDRAW')).minus(sum('ADJUST_OUT')).minus(sum('CONSUME'));
  const reserved = Decimal.max(0, sum('RESERVE').minus(sum('RELEASE')).minus(sum('CONSUME')));
  return { balance, reserved, available: balance.minus(reserved) };
}

export async function poolPositions(): Promise<PoolPosition[]> {
  const pools = await prisma.treasuryPool.findMany({ orderBy: [{ currency: 'asc' }, { code: 'asc' }] });
  const since = new Date(Date.now() - 86400_000);
  return Promise.all(pools.map(async (p) => {
    const t = await totals(prisma, p.id);
    const consumed = await prisma.treasuryMovement.aggregate({ where: { poolId: p.id, type: 'CONSUME', createdAt: { gte: since } }, _sum: { amount: true } });
    const target = D(p.target);
    return {
      id: p.id, code: p.code, name: p.name, currency: p.currency, entity: p.entity, location: p.location, providerCode: p.providerCode,
      corridorCodes: p.corridorCodes, fundClass: p.fundClass,
      balance: t.balance.toFixed(2), reserved: t.reserved.toFixed(2), available: t.available.toFixed(2), consumed24h: D(consumed._sum.amount).toFixed(2),
      target: target.toFixed(2), minimum: D(p.minimum).toFixed(2), maxExposure: D(p.maxExposure).toFixed(2),
      utilisationPct: t.balance.gt(0) ? Math.round(t.reserved.div(t.balance).toNumber() * 1000) / 10 : 0,
    };
  }));
}

export async function poolFor(providerCode: string, currency: Currency) {
  return prisma.treasuryPool.findFirst({ where: { providerCode, currency } });
}

export async function availableIn(providerCode: string, currency: Currency): Promise<Decimal | null> {
  const pool = await poolFor(providerCode, currency);
  if (!pool) return null;
  return (await totals(prisma, pool.id)).available;
}

/** Earmark liquidity for a transfer (locks the pool row). Throws when short. */
export async function reserveLiquidity(tx: Tx, input: { providerCode: string; currency: Currency; amount: Decimal; transferId: string; reference: string }) {
  const pool = await tx.treasuryPool.findFirst({ where: { providerCode: input.providerCode, currency: input.currency } });
  if (!pool) throw new AppError(`No treasury pool for ${input.providerCode} ${input.currency}`, 409, 'PROVIDER_UNAVAILABLE');
  await tx.$queryRaw`SELECT "id" FROM "TreasuryPool" WHERE "id" = ${pool.id} FOR UPDATE`;
  const t = await totals(tx, pool.id);
  if (t.available.lt(input.amount)) {
    throw new AppError(`Insufficient ${input.currency} liquidity at ${input.providerCode} (available ${t.available.toFixed(2)})`, 409, 'PROVIDER_UNAVAILABLE');
  }
  await tx.treasuryMovement.create({ data: { poolId: pool.id, type: 'RESERVE', amount: new Prisma.Decimal(input.amount.toFixed(8)), transferId: input.transferId, reference: input.reference } });
  return pool.id;
}

async function openReservation(tx: Tx, transferId: string) {
  const rows = await tx.treasuryMovement.groupBy({ by: ['poolId', 'type'], where: { transferId }, _sum: { amount: true } });
  const byPool = new Map<string, Decimal>();
  for (const r of rows) {
    const cur = byPool.get(r.poolId) ?? new Decimal(0);
    const v = D(r._sum.amount);
    byPool.set(r.poolId, r.type === 'RESERVE' ? cur.plus(v) : (r.type === 'RELEASE' || r.type === 'CONSUME') ? cur.minus(v) : cur);
  }
  return [...byPool.entries()].filter(([, v]) => v.gt(0));
}

export async function releaseLiquidity(tx: Tx, transferId: string, note: string) {
  for (const [poolId, amount] of await openReservation(tx, transferId)) {
    await tx.treasuryMovement.create({ data: { poolId, type: 'RELEASE', amount: new Prisma.Decimal(amount.toFixed(8)), transferId, note } });
  }
}

export async function consumeLiquidity(tx: Tx, transferId: string, reference: string) {
  const open = await openReservation(tx, transferId);
  for (const [poolId, amount] of open) {
    await tx.treasuryMovement.create({ data: { poolId, type: 'CONSUME', amount: new Prisma.Decimal(amount.toFixed(8)), transferId, reference } });
  }
  return open.length;
}

/** Record money moved into / out of a pool by treasury, with its ledger journal. */
export async function moveTreasury(input: {
  poolId: string; direction: 'PREFUND' | 'WITHDRAW' | 'ADJUST_IN' | 'ADJUST_OUT'; amount: string; reference: string; note: string; actorId: string;
  req?: { ip?: string; headers?: Record<string, any> };
}) {
  const amount = D(input.amount);
  if (!amount.isFinite() || amount.lte(0)) throw new AppError('Amount must be positive', 400);
  if (input.note.trim().length < 5) throw new AppError('A note of at least 5 characters is required', 400);
  return prisma.$transaction(async (tx) => {
    const pool = await tx.treasuryPool.findUnique({ where: { id: input.poolId } });
    if (!pool) throw new AppError('Pool not found', 404);
    await tx.$queryRaw`SELECT "id" FROM "TreasuryPool" WHERE "id" = ${pool.id} FOR UPDATE`;
    const outgoing = input.direction === 'WITHDRAW' || input.direction === 'ADJUST_OUT';
    if (outgoing) {
      const t = await totals(tx, pool.id);
      if (t.available.lt(amount)) throw new AppError(`Only ${t.available.toFixed(2)} ${pool.currency} is unreserved in this pool`, 409);
    }
    const mv = await tx.treasuryMovement.create({
      data: { poolId: pool.id, type: input.direction, amount: new Prisma.Decimal(amount.toFixed(8)), reference: input.reference, actorId: input.actorId, note: input.note },
    });
    // Ledger: capital entering/leaving the platform's books through the treasury position.
    const signed = outgoing ? amount.neg() : amount;
    const { groupId } = await postLedger(tx, {
      refType: `treasury_${input.direction.toLowerCase()}`, refId: mv.id, memo: `${input.direction} ${pool.code}: ${input.note}`.slice(0, 500),
      legs: [
        { type: 'TREASURY', currency: pool.currency, amount: signed },
        { type: input.direction.startsWith('ADJUST') ? 'ADJUSTMENT' : 'SYSTEM_ONRAMP', currency: pool.currency, amount: signed.neg() },
      ],
    });
    await writeAudit(tx, {
      actorId: input.actorId, action: `TREASURY_${input.direction}`, entity: 'TreasuryPool', entityId: pool.id,
      after: { pool: pool.code, amount: amount.toFixed(2), currency: pool.currency, reference: input.reference, ledgerGroupId: groupId },
      reason: input.note, req: input.req,
    });
    return mv;
  });
}

export interface TreasuryAlert { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; type: string; pool?: string; currency?: string; message: string }

export async function treasuryAlerts(): Promise<TreasuryAlert[]> {
  const positions = await poolPositions();
  const alerts: TreasuryAlert[] = [];
  const byCurrency = new Map<string, number>();
  for (const p of positions) byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + Number(p.balance));
  for (const p of positions) {
    const bal = Number(p.balance); const avail = Number(p.available);
    if (avail < Number(p.minimum)) alerts.push({ severity: avail <= 0 ? 'CRITICAL' : 'HIGH', type: 'LOW_LIQUIDITY', pool: p.code, currency: p.currency, message: `${p.code}: available ${p.available} ${p.currency} is below the minimum ${p.minimum}` });
    else if (bal < Number(p.target)) alerts.push({ severity: 'LOW', type: 'BELOW_TARGET', pool: p.code, currency: p.currency, message: `${p.code}: balance ${p.balance} is below target ${p.target}` });
    if (bal > Number(p.maxExposure)) alerts.push({ severity: 'HIGH', type: 'HIGH_EXPOSURE', pool: p.code, currency: p.currency, message: `${p.code}: balance ${p.balance} exceeds the maximum exposure ${p.maxExposure}` });
    if (bal > 0 && Number(p.consumed24h) > bal * 0.5) alerts.push({ severity: 'MEDIUM', type: 'RAPID_DEPLETION', pool: p.code, currency: p.currency, message: `${p.code}: ${p.consumed24h} paid out in 24h — more than half the remaining balance` });
    const total = byCurrency.get(p.currency) ?? 0;
    const peers = positions.filter((x) => x.currency === p.currency).length;
    if (peers > 1 && total > 0 && bal / total > 0.8) alerts.push({ severity: 'MEDIUM', type: 'CONCENTRATION', pool: p.code, currency: p.currency, message: `${p.code} holds ${Math.round((bal / total) * 100)}% of all ${p.currency} liquidity` });
  }
  const overdue = await prisma.remittanceSettlement.findMany({ where: { status: { in: ['OPEN', 'INSTRUCTED'] }, dueAt: { lt: new Date() } } });
  for (const s of overdue) alerts.push({ severity: 'HIGH', type: 'OVERDUE_SETTLEMENT', currency: s.currency, message: `Settlement ${s.reference} with ${s.providerCode} (${s.amount} ${s.currency}) was due ${s.dueAt.toISOString().slice(0, 16)}` });
  return alerts;
}
