/**
 * LYDT — tazdan's dinar token (sandbox until the Central Bank of Libya
 * authorises it).
 *
 * One LYDT is one Libyan dinar. Issuing moves the customer's dinars from
 * their LYD balance into the TOKEN_RESERVE ledger account (customer money,
 * held at the CBL) and credits the same amount of LYDT; redeeming reverses
 * it. Token balances live on the asset ledger (asset 'LYDT'), where the
 * TOKEN_ISSUER account carries minus the outstanding supply, so at every
 * commit:
 *
 *   supply  =  −TOKEN_ISSUER(LYDT)  =  Σ holders  =  TOKEN_RESERVE(LYD)
 *
 * and supply never exceeds the dinar balance the CBL last attested for the
 * reserve account (issuance is pre-funded: dinars reach the CBL first).
 *
 * Supervisor powers (CBL / compliance): pause new issuance and transfers
 * (the 'lydt' control switch), freeze a holder, cap any one holder's
 * balance. Redemption is never paused by a switch — only a frozen holder
 * cannot redeem — so dinars are always one step away.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { postLedger } from '../ledger/ledger.service';
import { postAssetLedger } from '../ledger/assetLedger.service';
import { debitAvailable, parsePositiveAmount } from '../wallet/atomicWallet';
import { assertMovementAllowed } from '../platform/controls.service';
import { assertFeatureEnabled } from '../../utils/features';
import { enforceKycLimit, valueInUsd } from '../../utils/kycLimits';
import { enforceRiskBasedStepUp } from '../security/stepUp.service';
import { assertRecipientCanReceive } from '../wallet/recipientEligibility';
import { writeAudit } from '../platform/audit';

type Tx = Prisma.TransactionClient;
export type LydtKind = 'ISSUE' | 'REDEEM' | 'TRANSFER';

export const LYDT = 'LYDT';
const SCALE = 3; // dinar millimes

const holdingCap = () => new Decimal(process.env.LYDT_HOLDING_CAP ?? '10000');
const maxAttestationAgeMs = () => Number(process.env.LYDT_ATTESTATION_MAX_AGE_HOURS ?? 48) * 3_600_000;
const D = (v: unknown) => new Decimal(v == null ? 0 : String(v));
const fmt = (v: Decimal) => v.toFixed(SCALE);

function parseAmount(value: unknown): Decimal {
  const amt = parsePositiveAmount(value);
  if (amt.decimalPlaces() > SCALE) throw new AppError(`LYDT amounts support at most ${SCALE} decimal places`, 400);
  return amt;
}

// ── Reads ────────────────────────────────────────────────────────────
type Reader = Tx | typeof prisma;

export async function balanceOf(userId: string, db: Reader = prisma): Promise<Decimal> {
  const rows = await db.$queryRaw<Array<{ balance: unknown }>>`
    SELECT "balance" FROM "AssetLedgerAccount" WHERE "type" = 'USER' AND "userId" = ${userId} AND "asset" = ${LYDT} LIMIT 1`;
  return D(rows[0]?.balance);
}

export async function supply(db: Reader = prisma): Promise<Decimal> {
  const rows = await db.$queryRaw<Array<{ balance: unknown }>>`
    SELECT "balance" FROM "AssetLedgerAccount" WHERE "type" = 'TOKEN_ISSUER' AND "userId" IS NULL AND "asset" = ${LYDT} LIMIT 1`;
  return D(rows[0]?.balance).neg();
}

export async function reserveLedger(db: Reader = prisma): Promise<Decimal> {
  const acct = await db.ledgerAccount.findFirst({ where: { type: 'TOKEN_RESERVE', currency: 'LYD', userId: null } });
  return D(acct?.balance);
}

export const latestAttestation = (db: Reader = prisma) => db.lydtAttestation.findFirst({ orderBy: { createdAt: 'desc' } });

async function assertNotFrozen(db: Reader, userId: string, who: 'sender' | 'recipient' = 'sender') {
  if (await db.lydtFreeze.findUnique({ where: { userId } })) {
    throw new AppError(who === 'sender' ? 'This LYDT balance is frozen.' : 'This account can\'t receive LYDT right now.', 403, 'COMPLIANCE_HOLD');
  }
}

async function assertUnderCap(tx: Tx, userId: string, incoming: Decimal) {
  const after = (await balanceOf(userId, tx)).plus(incoming);
  if (after.gt(holdingCap())) {
    throw new AppError(`One account can hold at most ${fmt(holdingCap())} LYDT.`, 400, 'LIMIT_EXCEEDED', { cap: fmt(holdingCap()) });
  }
}

/** Serialises writers on one key for the rest of the transaction. */
const lock = (tx: Tx, key: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;

// ── Idempotent operation record ──────────────────────────────────────
async function replay(userId: string, key: string | null, kind: LydtKind, amount: Decimal, counterpartyId: string | null = null) {
  if (!key) return null;
  const op = await prisma.lydtOperation.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
  if (!op) return null;
  if (op.kind !== kind || !D(op.amount).eq(amount) || (op.counterpartyId ?? null) !== counterpartyId) {
    throw new AppError('This idempotency key was already used for a different LYDT operation', 409, 'TRANSACTION_CONFLICT');
  }
  return { ...view(op), replayed: true };
}

const view = (op: { kind: string; reference: string; amount: unknown; counterpartyId: string | null; note: string | null; createdAt: Date }) => ({
  kind: op.kind as LydtKind, reference: op.reference, amount: fmt(D(op.amount)), counterpartyId: op.counterpartyId, note: op.note, createdAt: op.createdAt,
});

async function run<T extends { reference: string }>(
  userId: string, key: string | null, kind: LydtKind, amount: Decimal, counterpartyId: string | null,
  body: (tx: Tx, reference: string) => Promise<void>, note: string | null = null,
) {
  const earlier = await replay(userId, key, kind, amount, counterpartyId);
  if (earlier) return earlier;
  const reference = `LYDT-${kind[0]}-${randomBytes(5).toString('hex').toUpperCase()}`;
  try {
    const op = await prisma.$transaction(async (tx) => {
      // The record goes first: a concurrent retry with the same key stops on
      // the unique index before any balance moves.
      const created = await tx.lydtOperation.create({
        data: { kind, userId, counterpartyId, amount: new Prisma.Decimal(fmt(amount)), reference, note, idempotencyKey: key },
      });
      await body(tx, reference);
      return created;
    });
    return { ...view(op), replayed: false };
  } catch (err) {
    if (key && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await replay(userId, key, kind, amount, counterpartyId);
      if (winner) return winner;
    }
    throw err;
  }
}

// ── Issue: LYD → LYDT ────────────────────────────────────────────────
export async function issue(userId: string, rawAmount: unknown, key: string | null) {
  assertFeatureEnabled('lydt');
  const amount = parseAmount(rawAmount);
  await assertMovementAllowed({ userId, feature: 'lydt', currency: 'LYD' });
  await assertNotFrozen(prisma, userId);

  return run(userId, key, 'ISSUE', amount, null, async (tx, reference) => {
    await lock(tx, 'lydt:issuance');
    const att = await latestAttestation(tx);
    if (!att || Date.now() - att.statementDate.getTime() > maxAttestationAgeMs()) {
      throw new AppError('LYDT issuance is paused until the reserve statement from the Central Bank of Libya is updated.', 503, 'FEATURE_DISABLED');
    }
    if ((await supply(tx)).plus(amount).gt(D(att.balance))) {
      throw new AppError('LYDT issuance is at the limit of the reserve held at the Central Bank of Libya. Try a smaller amount or try later.', 409, 'LIMIT_EXCEEDED');
    }
    await lock(tx, `lydt:holder:${userId}`);
    await assertUnderCap(tx, userId, amount);

    await debitAvailable(tx, userId, 'LYD', amount);
    await postLedger(tx, {
      refType: 'lydt_issue', refId: reference, memo: `Issue ${fmt(amount)} LYDT`,
      legs: [
        { type: 'USER', userId, currency: 'LYD', amount: amount.neg() },
        { type: 'TOKEN_RESERVE', currency: 'LYD', amount },
      ],
    });
    await postAssetLedger(tx, {
      refType: 'lydt_issue', refId: reference, memo: `Issue ${fmt(amount)} LYDT`,
      legs: [
        { type: 'TOKEN_ISSUER', asset: LYDT, amount: amount.neg() },
        { type: 'USER', userId, asset: LYDT, amount },
      ],
    });
  });
}

// ── Redeem: LYDT → LYD (never paused by a switch) ───────────────────
export async function redeem(userId: string, rawAmount: unknown, key: string | null) {
  const amount = parseAmount(rawAmount);
  await assertNotFrozen(prisma, userId);

  return run(userId, key, 'REDEEM', amount, null, async (tx, reference) => {
    await postAssetLedger(tx, {
      refType: 'lydt_redeem', refId: reference, memo: `Redeem ${fmt(amount)} LYDT`,
      legs: [
        { type: 'USER', userId, asset: LYDT, amount: amount.neg() },
        { type: 'TOKEN_ISSUER', asset: LYDT, amount },
      ],
    });
    // Credit the Wallet row like every other flow; postLedger then makes the
    // ledger balance win if the two ever disagree.
    await tx.wallet.upsert({
      where: { userId_currency: { userId, currency: 'LYD' } },
      create: { userId, currency: 'LYD', balance: new Prisma.Decimal(fmt(amount)), frozen: 0 },
      update: { balance: { increment: new Prisma.Decimal(fmt(amount)) } },
    });
    await postLedger(tx, {
      refType: 'lydt_redeem', refId: reference, memo: `Redeem ${fmt(amount)} LYDT`,
      legs: [
        { type: 'TOKEN_RESERVE', currency: 'LYD', amount: amount.neg() },
        { type: 'USER', userId, currency: 'LYD', amount },
      ],
    });
  });
}

// ── Transfer between tazdan customers ───────────────────────────────
export async function transfer(opts: {
  senderId: string; receiverId: string; amount: unknown; note?: string | null; key: string | null;
  req: { headers: Record<string, any> }; stepUpCode?: string; biometricVerified?: boolean;
}) {
  assertFeatureEnabled('lydt');
  const { senderId, receiverId } = opts;
  if (!receiverId || receiverId === senderId) throw new AppError('Choose someone else to send LYDT to', 400);
  const amount = parseAmount(opts.amount);
  const note = opts.note?.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 140) || null;

  const earlier = await replay(senderId, opts.key, 'TRANSFER', amount, receiverId);
  if (earlier) return earlier;
  await assertMovementAllowed({ userId: senderId, feature: 'lydt', currency: 'LYD' });
  await assertRecipientCanReceive(senderId, receiverId, { currency: 'LYD' });
  await assertNotFrozen(prisma, senderId);
  await assertNotFrozen(prisma, receiverId, 'recipient');
  // Same limits and step-up policy as any other send, valued as dinars.
  await enforceKycLimit(senderId, 'SEND', amount, 'LYD');
  await enforceRiskBasedStepUp({
    userId: senderId, action: 'transfer', valueUsd: await valueInUsd(amount.toString(), 'LYD'),
    req: opts.req, code: opts.stepUpCode, biometricVerified: opts.biometricVerified === true,
  });

  return run(senderId, opts.key, 'TRANSFER', amount, receiverId, async (tx, reference) => {
    await enforceKycLimit(senderId, 'SEND', amount, 'LYD', tx);
    await lock(tx, `lydt:holder:${receiverId}`);
    await assertUnderCap(tx, receiverId, amount);
    await postAssetLedger(tx, {
      refType: 'lydt_transfer', refId: reference, memo: note ?? `Send ${fmt(amount)} LYDT`,
      legs: [
        { type: 'USER', userId: senderId, asset: LYDT, amount: amount.neg() },
        { type: 'USER', userId: receiverId, asset: LYDT, amount },
      ],
    });
  }, note);
}

// ── Transparency ─────────────────────────────────────────────────────
/** Public reserve report: what the dashboard and the CBL see. */
export async function reserveReport() {
  const [s, r, att, holders] = await Promise.all([
    supply(), reserveLedger(), latestAttestation(),
    prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint AS n FROM "AssetLedgerAccount" WHERE "type" = 'USER' AND "asset" = ${LYDT} AND "balance" > 0`,
  ]);
  const attested = att ? D(att.balance) : null;
  const fresh = !!att && Date.now() - att.statementDate.getTime() <= maxAttestationAgeMs();
  return {
    asset: LYDT,
    peg: '1 LYDT = 1 LYD',
    supply: fmt(s),
    reserveLedger: fmt(r),
    attestation: att ? { balance: fmt(attested!), statementDate: att.statementDate, reference: att.reference, fresh } : null,
    /** Attested dinars per LYDT outstanding; null before the first issue. */
    coverage: attested && s.gt(0) ? attested.div(s).toDecimalPlaces(4).toString() : null,
    /** Supply matches the dinars set aside and is within the attested reserve. */
    fullyBacked: s.eq(r) && (s.isZero() || (!!attested && s.lte(attested))),
    headroom: attested ? fmt(Decimal.max(attested.minus(s), 0)) : '0.000',
    issuanceOpen: fresh,
    holders: Number(holders[0]?.n ?? 0),
    holdingCap: fmt(holdingCap()),
    asOf: new Date(),
  };
}

export async function myLydt(userId: string) {
  const [balance, frozen, ops] = await Promise.all([
    balanceOf(userId),
    prisma.lydtFreeze.findUnique({ where: { userId } }),
    prisma.lydtOperation.findMany({
      where: { OR: [{ userId }, { counterpartyId: userId, kind: 'TRANSFER' }] },
      orderBy: { createdAt: 'desc' }, take: 20,
    }),
  ]);
  return {
    balance: fmt(balance),
    frozen: !!frozen,
    activity: ops.map((op) => ({ ...view(op), direction: op.kind === 'TRANSFER' && op.userId !== userId ? 'IN' : 'OUT' })),
  };
}

// ── Supervisor actions (staff now; the CBL itself in the proposal) ───
export async function recordAttestation(actorId: string, input: { balance: unknown; statementDate: string | Date; reference: string }) {
  const balance = D(input.balance);
  if (balance.isNeg() || balance.decimalPlaces() > SCALE) throw new AppError('Reserve balance must be a non-negative amount with at most 3 decimals', 400);
  const statementDate = new Date(input.statementDate);
  if (Number.isNaN(statementDate.getTime()) || statementDate.getTime() > Date.now() + 60_000) throw new AppError('Statement date must be a past date', 400);
  const reference = String(input.reference ?? '').trim().slice(0, 80);
  if (!reference) throw new AppError('Statement reference is required', 400);
  return prisma.$transaction(async (tx) => {
    const row = await tx.lydtAttestation.create({ data: { balance: new Prisma.Decimal(fmt(balance)), statementDate, reference, recordedById: actorId } });
    await writeAudit(tx, { actorId, action: 'LYDT_RESERVE_ATTESTED', entity: 'LydtAttestation', entityId: row.id, after: { balance: fmt(balance), statementDate, reference } });
    return row;
  });
}

export async function freeze(actorId: string, userId: string, reason: string) {
  const why = String(reason ?? '').trim().slice(0, 300);
  if (!why) throw new AppError('A reason is required', 400);
  await prisma.$transaction(async (tx) => {
    await tx.lydtFreeze.upsert({ where: { userId }, create: { userId, reason: why, frozenById: actorId }, update: { reason: why, frozenById: actorId } });
    await writeAudit(tx, { actorId, action: 'LYDT_HOLDER_FROZEN', entity: 'User', entityId: userId, after: { reason: why } });
  });
}

export async function unfreeze(actorId: string, userId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.lydtFreeze.findUnique({ where: { userId } });
    if (!before) return;
    await tx.lydtFreeze.delete({ where: { userId } });
    await writeAudit(tx, { actorId, action: 'LYDT_HOLDER_UNFROZEN', entity: 'User', entityId: userId, before: { reason: before.reason }, reason: String(reason ?? '').slice(0, 300) || undefined });
  });
}

// ── Wallet integration (history, holdings, trading) ──────────────────
/**
 * Read-only check that an issue of `amount` would go through right now, so a
 * two-step trade (e.g. USD → LYD → LYDT) can refuse before its first leg.
 */
export async function assertCanIssue(userId: string, rawAmount: unknown) {
  assertFeatureEnabled('lydt');
  const amount = parseAmount(rawAmount);
  await assertMovementAllowed({ userId, feature: 'lydt', currency: 'LYD' });
  await assertNotFrozen(prisma, userId);
  const att = await latestAttestation();
  if (!att || Date.now() - att.statementDate.getTime() > maxAttestationAgeMs()) {
    throw new AppError('LYDT issuance is paused until the reserve statement from the Central Bank of Libya is updated.', 503, 'FEATURE_DISABLED');
  }
  if ((await supply()).plus(amount).gt(D(att.balance))) {
    throw new AppError('LYDT issuance is at the limit of the reserve held at the Central Bank of Libya. Try a smaller amount or try later.', 409, 'LIMIT_EXCEEDED');
  }
  if ((await balanceOf(userId)).plus(amount).gt(holdingCap())) {
    throw new AppError(`One account can hold at most ${fmt(holdingCap())} LYDT.`, 400, 'LIMIT_EXCEEDED', { cap: fmt(holdingCap()) });
  }
}

/** Read-only check that `amount` LYDT can be redeemed by this holder now. */
export async function assertCanRedeem(userId: string, rawAmount: unknown) {
  const amount = parseAmount(rawAmount);
  await assertNotFrozen(prisma, userId);
  const bal = await balanceOf(userId);
  if (bal.lt(amount)) throw new AppError(`Insufficient LYDT. Need ${fmt(amount)}, have ${fmt(bal)}`, 400);
}

/** One row of the wallet history, shaped like a Transaction row (amount signed, in `currency`). */
export interface LydtHistoryRow {
  id: string; userId: string; type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  currency: 'LYD' | 'LYDT'; amount: string; fee: string; balanceBefore: null; balanceAfter: null;
  reference: string; description: string; metadata: Record<string, unknown>; createdAt: Date; status: 'COMPLETED';
}

const nameOf = (u?: { firstName: string | null; lastName: string | null; username: string | null } | null) =>
  u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : 'a tazdan customer')) : 'a tazdan customer';

/**
 * LYDT operations as history rows, newest first. An issue or redeem is a
 * conversion and shows as two rows (dinars out / tokens in, or the reverse),
 * like any swap; a transfer is one row for each side.
 */
export async function historyRows(userId: string, opts: { currency?: string; type?: string; take: number }): Promise<LydtHistoryRow[]> {
  const ops = await prisma.lydtOperation.findMany({
    where: { OR: [{ userId }, { counterpartyId: userId, kind: 'TRANSFER' }] },
    orderBy: { createdAt: 'desc' },
    take: opts.take,
  });
  const others = [...new Set(ops.map((o) => (o.userId === userId ? o.counterpartyId : o.userId)).filter((x): x is string => !!x))];
  const people = others.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: others } }, select: { id: true, firstName: true, lastName: true, username: true } })).map((u) => [u.id, u]))
    : new Map();
  const rows: LydtHistoryRow[] = [];
  for (const op of ops) {
    const amt = D(op.amount);
    const base = { userId, fee: '0', balanceBefore: null, balanceAfter: null, reference: op.reference, createdAt: op.createdAt, status: 'COMPLETED' as const };
    if (op.kind === 'ISSUE') {
      const meta = { kind: 'lydt_issue', rate: '1' };
      rows.push({ ...base, id: `${op.id}:lydt`, type: 'BUY', currency: 'LYDT', amount: fmt(amt), description: `Converted ${fmt(amt)} LYD → LYDT`, metadata: { ...meta, counterparty: 'LYD' } });
      rows.push({ ...base, id: `${op.id}:lyd`, type: 'SELL', currency: 'LYD', amount: fmt(amt.neg()), description: `Converted ${fmt(amt)} LYD → LYDT`, metadata: { ...meta, counterparty: 'LYDT' } });
    } else if (op.kind === 'REDEEM') {
      const meta = { kind: 'lydt_redeem', rate: '1' };
      rows.push({ ...base, id: `${op.id}:lyd`, type: 'BUY', currency: 'LYD', amount: fmt(amt), description: `Converted ${fmt(amt)} LYDT → LYD`, metadata: { ...meta, counterparty: 'LYDT' } });
      rows.push({ ...base, id: `${op.id}:lydt`, type: 'SELL', currency: 'LYDT', amount: fmt(amt.neg()), description: `Converted ${fmt(amt)} LYDT → LYD`, metadata: { ...meta, counterparty: 'LYD' } });
    } else if (op.userId === userId) {
      const to = people.get(op.counterpartyId ?? '');
      rows.push({ ...base, id: `${op.id}:out`, type: 'TRANSFER_OUT', currency: 'LYDT', amount: fmt(amt.neg()), description: op.note || `Sent to ${nameOf(to)}`, metadata: { kind: 'lydt_transfer', counterpartyId: op.counterpartyId } });
    } else {
      const from = people.get(op.userId);
      rows.push({ ...base, id: `${op.id}:in`, type: 'TRANSFER_IN', currency: 'LYDT', amount: fmt(amt), description: op.note || `From ${nameOf(from)}`, metadata: { kind: 'lydt_transfer', counterpartyId: op.userId } });
    }
  }
  return rows.filter((r) => (!opts.currency || r.currency === opts.currency) && (!opts.type || r.type === opts.type));
}

/** How many history rows historyRows would give in total for these filters. */
export async function historyCount(userId: string, opts: { currency?: string; type?: string }): Promise<number> {
  const grouped = await prisma.lydtOperation.groupBy({
    by: ['kind'], _count: { _all: true },
    where: { OR: [{ userId }, { counterpartyId: userId, kind: 'TRANSFER' }] },
  });
  const sent = await prisma.lydtOperation.count({ where: { userId, kind: 'TRANSFER' } });
  const n = (k: string) => grouped.find((g) => g.kind === k)?._count._all ?? 0;
  const issue = n('ISSUE'), redeem = n('REDEEM'), received = n('TRANSFER') - sent;
  const c = opts.currency, t = opts.type;
  let total = 0;
  const add = (cur: string, type: string, count: number) => { if ((!c || c === cur) && (!t || t === type)) total += count; };
  add('LYDT', 'BUY', issue); add('LYD', 'SELL', issue);
  add('LYD', 'BUY', redeem); add('LYDT', 'SELL', redeem);
  add('LYDT', 'TRANSFER_OUT', sent); add('LYDT', 'TRANSFER_IN', received);
  return total;
}
