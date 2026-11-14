/**
 * Business payouts: pay many Tazdan customers from a business wallet.
 *
 * Lifecycle of a batch
 *   create → funds for every payable line are RESERVED (wallet.frozen) at once,
 *            so a batch either fits in the balance or is refused up front.
 *          → PENDING_APPROVAL   value ≥ the business's approval threshold and
 *                               another OWNER/ADMIN exists (maker-checker);
 *          → COMPLIANCE_REVIEW  the risk engine asked for review on a line;
 *          → EXECUTING          otherwise.
 *   execute → each line in its own transaction: claim (PENDING→PROCESSING),
 *            settle its slice of the reservation, credit the recipient, post a
 *            balanced journal (USER business −(amount+fee), USER recipient
 *            +amount, PLATFORM +fee) and mark COMPLETED. A line that fails is
 *            rolled back, marked FAILED and its reservation released.
 *   → EXECUTED / PARTIAL / FAILED, with webhooks for every outcome.
 *
 * Recipients are Tazdan wallets (by @handle or email). Paying external bank
 * accounts goes through the remittance engine, not here.
 */
import crypto from 'crypto';
import { Prisma, type BusinessProfile } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { usdRate } from '../../utils/kycLimits';
import { postLedger, isLedgerCurrency } from '../ledger/ledger.service';
import { collectFee } from '../fee/feeCollector.service';
import { reserveFunds, releaseReserve, settleReserve } from '../wallet/atomicWallet';
import { assertMovementAllowed } from '../platform/controls.service';
import { writeAudit } from '../platform/audit';
import { evaluateRisk } from '../risk/engine';
import { screenAndRecord } from '../compliance/screening.service';
import { openCase, transitionCase } from '../compliance/cases.service';
import { enforceStepUp } from '../security/stepUp.service';
import { assertCan, assertKybApproved, otherApprovers, type BusinessContext } from './access';
import { enqueueEvent } from './webhooks.service';

type Tx = Prisma.TransactionClient;
const D = (v: unknown) => new Decimal(String(v ?? 0));

export const MAX_BATCH_ROWS = 500;
const maxPayoutUsd = () => Number(process.env.BUSINESS_PAYOUT_MAX_USD ?? 25_000);
const defaultThresholdUsd = () => Number(process.env.BUSINESS_APPROVAL_THRESHOLD_USD ?? 10_000);
const BLOCKING = ['REJECT', 'BLOCK', 'FREEZE'];
const REVIEW = ['REVIEW', 'REQUEST_INFORMATION'];

export interface RecipientInput { handle?: string; email?: string; amount: number | string; currency?: string; note?: string }

interface ResolvedLine {
  row: number;
  input: RecipientInput;
  recipient: { id: string; firstName: string; lastName: string; country: string | null; dateOfBirth?: Date | null; username: string | null; email: string };
  amount: Decimal;
  fee: Decimal;
}

async function feeFor(currency: string): Promise<Decimal> {
  const rows = await prisma.platformSettings.findMany({ where: { key: { in: [`business_payout_fee_${currency.toLowerCase()}`, `transfer_fee_${currency.toLowerCase()}`] } } });
  const specific = rows.find((r) => r.key.startsWith('business_payout_fee_'));
  const fallback = rows.find((r) => r.key.startsWith('transfer_fee_'));
  const fee = D(specific?.value ?? fallback?.value ?? '0');
  if (!fee.isFinite() || fee.lt(0)) throw new AppError('Business payout fee is misconfigured', 500);
  return fee;
}

/** Validate rows and resolve recipients. Never moves money. */
export async function resolveLines(business: BusinessProfile, recipients: RecipientInput[], currency: string) {
  const ccy = currency.toUpperCase();
  if (!isLedgerCurrency(ccy)) throw new AppError(`${ccy} is not supported for business payouts`, 400);
  if (!recipients.length) throw new AppError('Add at least one recipient', 400);
  if (recipients.length > MAX_BATCH_ROWS) throw new AppError(`A batch can have at most ${MAX_BATCH_ROWS} recipients`, 400, 'LIMIT_EXCEEDED');
  const fee = await feeFor(ccy);
  const rate = await usdRate(ccy).catch(() => 0);
  const valid: ResolvedLine[] = [];
  const invalid: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const row = i + 1;
    const handle = r.handle?.trim().replace(/^@/, '');
    const email = r.email?.trim().toLowerCase();
    if (!handle && !email) { invalid.push({ row, reason: 'Recipient @handle or email is required' }); continue; }
    if (r.currency && r.currency.toUpperCase() !== ccy) { invalid.push({ row, reason: `Currency must be ${ccy} for this batch` }); continue; }
    let amount: Decimal;
    try { amount = D(r.amount); } catch { invalid.push({ row, reason: 'Amount is not a number' }); continue; }
    if (!amount.isFinite() || amount.lte(0)) { invalid.push({ row, reason: 'Amount must be greater than zero' }); continue; }
    if (amount.decimalPlaces() > 8) { invalid.push({ row, reason: 'Amount has too many decimal places' }); continue; }
    if (rate > 0 && amount.toNumber() * rate > maxPayoutUsd()) { invalid.push({ row, reason: `Above the per-payout limit (${maxPayoutUsd().toLocaleString('en-US')} USD)` }); continue; }
    const recipient = await prisma.user.findFirst({
      where: handle ? { username: { equals: handle, mode: 'insensitive' } } : { email: { equals: email!, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true, country: true, dateOfBirth: true, username: true, email: true, status: true, role: true },
    });
    if (!recipient || recipient.role !== 'USER') { invalid.push({ row, reason: 'No Tazdan customer with that handle or email' }); continue; }
    if (recipient.status !== 'ACTIVE') { invalid.push({ row, reason: 'Recipient account cannot receive payments' }); continue; }
    if (recipient.id === business.userId) { invalid.push({ row, reason: 'A business cannot pay itself' }); continue; }
    valid.push({ row, input: r, recipient, amount, fee });
  }
  const totalAmount = valid.reduce((n, l) => n.plus(l.amount), new Decimal(0));
  const totalFee = valid.reduce((n, l) => n.plus(l.fee), new Decimal(0));
  return { currency: ccy, valid, invalid, totalAmount, totalFee, usdValue: rate > 0 ? totalAmount.toNumber() * rate : null };
}

export async function previewBulkPay(ctx: BusinessContext, input: { recipients: RecipientInput[]; currency: string }) {
  assertCan(ctx, 'read');
  const r = await resolveLines(ctx.business, input.recipients, input.currency);
  const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId: ctx.business.userId, currency: r.currency as any } } });
  const available = wallet ? D(wallet.balance).minus(wallet.frozen) : new Decimal(0);
  const threshold = Number(ctx.business.approvalThresholdUsd ?? defaultThresholdUsd());
  return {
    recipients: r.valid.length,
    totalAmount: r.totalAmount.toFixed(),
    totalFee: r.totalFee.toFixed(),
    currency: r.currency,
    valid: r.valid.map((l) => ({ ...l.input, handle: l.recipient.username ?? undefined, name: `${l.recipient.firstName} ${l.recipient.lastName.slice(0, 1)}.`, amount: l.amount.toNumber(), currency: r.currency })),
    invalid: r.invalid,
    available: available.toFixed(),
    sufficientFunds: available.gte(r.totalAmount.plus(r.totalFee)),
    approvalRequired: r.usdValue !== null && r.usdValue >= threshold,
    kybApproved: ctx.business.kybStatus === 'APPROVED',
  };
}

async function screeningFor(subjectType: 'USER' | 'BUSINESS', subjectId: string, userId: string, subject: { name: string; country?: string | null; dateOfBirth?: Date | null }) {
  const recent = await prisma.screeningResult.findFirst({ where: { subjectType, subjectId, screenedAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { screenedAt: 'desc' } });
  if (recent && recent.status !== 'POTENTIAL_MATCH') return { status: recent.status, coverage: recent.listsChecked.length > 0 };
  const r = await screenAndRecord({ subjectType, subjectId, userId, subject: { name: subject.name, country: subject.country ?? undefined, dateOfBirth: subject.dateOfBirth?.toISOString().slice(0, 10) } });
  return { status: r.status, coverage: r.listsChecked.length > 0 };
}

export interface CreateBatchInput {
  recipients: RecipientInput[];
  currency: string;
  note?: string;
  idempotencyKey?: string;
  source?: 'APP' | 'API';
  apiKeyId?: string;
  /** App submissions only: step-up proof when no second approver exists. */
  stepUp?: { req: { headers: Record<string, any> }; code?: string; biometricVerified?: boolean };
}

const batchInclude = { payouts: { orderBy: { createdAt: 'asc' as const } } };

/** USD value of the business's live batches in the last 24 hours (structuring guard). */
async function recentBatchUsd(client: Tx | typeof prisma, businessId: string): Promise<number> {
  const rows = await client.businessPayoutBatch.findMany({
    where: { businessId, createdAt: { gte: new Date(Date.now() - 86400_000) }, status: { notIn: ['FAILED', 'REJECTED', 'CANCELLED'] } },
    select: { totalAmount: true, currency: true },
  });
  let usd = 0;
  for (const r of rows) {
    const rate = await usdRate(r.currency).catch(() => 0);
    // An unpriceable batch counts as large rather than as nothing.
    usd += rate > 0 ? Number(r.totalAmount) * rate : maxPayoutUsd() * MAX_BATCH_ROWS;
  }
  return usd;
}

/**
 * An Idempotency-Key replays the batch it first created — only for the same
 * request. Reusing a key for different recipients, amounts or currency is a
 * client error, never a silent "already done" for a batch that was not sent.
 */
function assertSameBatch(existing: { currency: string; payouts: Array<{ recipientHandle: string | null; recipientEmail: string | null; amount: unknown }> }, input: CreateBatchInput): void {
  const same = existing.currency === input.currency.toUpperCase()
    && existing.payouts.length === input.recipients.length
    && input.recipients.every((r, i) => {
      const p = existing.payouts[i];
      let amountOk = false;
      try { amountOk = D(r.amount).eq(D(p.amount)); } catch { amountOk = false; }
      const handle = r.handle?.trim().replace(/^@/, '').toLowerCase();
      const email = r.email?.trim().toLowerCase();
      const who = handle ? (p.recipientHandle ?? '').toLowerCase() === handle : (p.recipientEmail ?? '') === email;
      return amountOk && who;
    });
  if (!same) throw new AppError('This Idempotency-Key was already used for a different batch', 409, 'DUPLICATE_REQUEST');
}

export async function createBatch(ctx: BusinessContext, input: CreateBatchInput) {
  assertCan(ctx, 'payouts.create');
  assertKybApproved(ctx.business);
  const business = ctx.business;
  const source = input.source ?? 'APP';
  const key = input.idempotencyKey?.trim() || null;
  if (key) {
    if (key.length > 120) throw new AppError('Idempotency-Key is too long', 400);
    const existing = await prisma.businessPayoutBatch.findUnique({ where: { businessId_idempotencyKey: { businessId: business.id, idempotencyKey: key } }, include: batchInclude });
    if (existing) {
      assertSameBatch(existing, input);
      return { batch: existing, replayed: true };
    }
  }
  const lines = await resolveLines(business, input.recipients, input.currency);
  if (lines.invalid.length) throw new AppError(`${lines.invalid.length} recipient row(s) are invalid — preview the batch first`, 400, 'VALIDATION', { invalid: lines.invalid });
  await assertMovementAllowed({ userId: business.userId, feature: 'business_payouts', currency: lines.currency });

  const usdValue = lines.usdValue ?? Number.POSITIVE_INFINITY; // unknown value → treat as large
  const threshold = Number(business.approvalThresholdUsd ?? defaultThresholdUsd());
  // The threshold applies to what the business sends in a rolling 24 hours,
  // not per batch: ten 9,000 USD batches are one 90,000 USD decision.
  const recentUsd = await recentBatchUsd(prisma, business.id);
  let approvalReason: string | null = null;
  if (usdValue + recentUsd >= threshold) {
    const approvers = await otherApprovers(business.id, ctx.userId);
    if (approvers > 0 || source === 'API') {
      approvalReason = `Batch value ${Number.isFinite(usdValue) ? `≈ ${Math.round(usdValue).toLocaleString('en-US')} USD` : 'could not be valued'}${recentUsd > 0 ? ` (≈ ${Math.round(recentUsd).toLocaleString('en-US')} USD already sent in the last 24 hours)` : ''} is at or above the approval threshold of ${threshold.toLocaleString('en-US')} USD`;
    } else {
      // Single-signatory business: the second control is a fresh step-up from the maker.
      if (!input.stepUp) throw new AppError('Confirm this batch with your security code', 403, 'STEP_UP_REQUIRED');
      await enforceStepUp({ userId: ctx.userId, action: 'transfer', valueUsd: usdValue, req: input.stepUp.req, code: input.stepUp.code, biometricVerified: false });
    }
  }

  // Screening and risk run before anything is written; results are attached to each line.
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: business.userId }, select: { country: true } });
  const bizScreen = await screeningFor('BUSINESS', business.id, business.userId, { name: business.legalName ?? business.companyName, country: business.country });
  const assessed: Array<ResolvedLine & { id: string; reference: string; risk: { decisionId: string; outcome: string; explanation: string } }> = [];
  for (const l of lines.valid) {
    const id = `bpo_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const recScreen = await screeningFor('USER', l.recipient.id, business.userId, { name: `${l.recipient.firstName} ${l.recipient.lastName}`, country: l.recipient.country, dateOfBirth: l.recipient.dateOfBirth });
    const rate = await usdRate(lines.currency).catch(() => 0);
    const risk = await evaluateRisk({
      subjectType: 'BUSINESS_PAYOUT', subjectId: id, userId: business.userId, amountUsd: rate > 0 ? l.amount.toNumber() * rate : maxPayoutUsd(),
      sourceCountry: business.country ?? owner.country, destCountry: l.recipient.country,
      screening: { sender: bizScreen.status, beneficiary: recScreen.status, coverage: bizScreen.coverage && recScreen.coverage ? 'LISTS_LOADED' : 'NO_LISTS_LOADED' },
    });
    assessed.push({ ...l, id, reference: `BPO-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, risk });
  }
  const blocked = assessed.filter((a) => BLOCKING.includes(a.risk.outcome));
  const review = assessed.filter((a) => REVIEW.includes(a.risk.outcome));
  const payable = assessed.filter((a) => !BLOCKING.includes(a.risk.outcome));
  const reserve = payable.reduce((n, a) => n.plus(a.amount).plus(a.fee), new Decimal(0));
  const steppedUp = Boolean(input.stepUp) && approvalReason === null && usdValue + recentUsd >= threshold;
  let status: string = !payable.length ? 'FAILED' : approvalReason ? 'PENDING_APPROVAL' : review.length ? 'COMPLIANCE_REVIEW' : 'EXECUTING';

  let batch;
  try {
    batch = await prisma.$transaction(async (tx) => {
      // One batch decision at a time per business: parallel submissions can't
      // each see the other's volume as "not yet sent" and slip under the
      // threshold together. Re-checked here with the lock held.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`business-payouts:${business.id}`}))`;
      if (status === 'EXECUTING' || status === 'COMPLIANCE_REVIEW') {
        const lockedRecent = await recentBatchUsd(tx, business.id);
        if (usdValue + lockedRecent >= threshold && !steppedUp) {
          if (source === 'API' || (await otherApprovers(business.id, ctx.userId)) > 0) {
            status = 'PENDING_APPROVAL';
            approvalReason = `Batch value with the last 24 hours (≈ ${Math.round(usdValue + lockedRecent).toLocaleString('en-US')} USD) is at or above the approval threshold of ${threshold.toLocaleString('en-US')} USD`;
          } else {
            throw new AppError('Confirm this batch with your security code', 403, 'STEP_UP_REQUIRED');
          }
        }
      }
      const b = await tx.businessPayoutBatch.create({
        data: {
          businessId: business.id, reference: `BPB-${crypto.randomBytes(6).toString('hex').toUpperCase()}`, currency: lines.currency as any,
          totalAmount: lines.totalAmount.toFixed(), totalFee: lines.totalFee.toFixed(), count: assessed.length, status, note: input.note?.slice(0, 500) ?? null,
          source, idempotencyKey: key, apiKeyId: input.apiKeyId ?? null, approvalReason, createdById: ctx.userId,
        },
      });
      // One statement gives every row the same now(); stagger createdAt by a
      // millisecond per line so the batch reads back in upload order.
      const base = Date.now();
      await tx.businessPayout.createMany({
        data: assessed.map((a, i) => ({
          createdAt: new Date(base + i),
          id: a.id, businessId: business.id, batchId: b.id, reference: a.reference, recipientUserId: a.recipient.id,
          recipientHandle: a.recipient.username, recipientEmail: a.input.email?.toLowerCase() ?? null,
          amount: a.amount.toFixed(), currency: lines.currency as any, feeAmount: a.fee.toFixed(), netAmount: a.amount.toFixed(),
          status: BLOCKING.includes(a.risk.outcome) ? 'FAILED' : 'PENDING', note: a.input.note?.slice(0, 200) ?? null,
          // Neutral wording: never tell a payer that a recipient matched a sanctions list.
          failureReason: BLOCKING.includes(a.risk.outcome) ? 'This payment cannot be processed' : null,
          riskOutcome: a.risk.outcome, riskDecisionId: a.risk.decisionId, createdById: ctx.userId,
        })),
      });
      if (reserve.gt(0)) await reserveFunds(tx, business.userId, lines.currency, reserve);
      if (blocked.length || review.length) {
        const c = await openCase({
          type: 'AML', priority: blocked.length ? 'HIGH' : 'MEDIUM',
          title: `Business payout batch ${b.reference}: ${blocked.length} blocked, ${review.length} for review`,
          summary: [...blocked, ...review].map((a) => `${a.reference} → ${a.recipient.username ?? a.recipient.id}: ${a.risk.outcome} — ${a.risk.explanation}`).join('\n'),
          subjectUserId: business.userId, subjectBusinessId: business.id, subjectType: 'BUSINESS_PAYOUT_BATCH', subjectId: b.id,
          riskDecisionId: (blocked[0] ?? review[0]).risk.decisionId,
        }, tx);
        await tx.businessPayoutBatch.update({ where: { id: b.id }, data: { complianceCaseId: c.id } });
      }
      await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_BATCH_CREATED', entity: 'BusinessPayoutBatch', entityId: b.id, after: { status, count: assessed.length, currency: lines.currency, total: lines.totalAmount.toFixed(), source, blocked: blocked.length, review: review.length } });
      if (status === 'PENDING_APPROVAL') await enqueueEvent(tx, business.id, 'batch.pending_approval', { batchId: b.id, reference: b.reference, total: lines.totalAmount.toFixed(), currency: lines.currency, reason: approvalReason });
      if (status === 'COMPLIANCE_REVIEW') await enqueueEvent(tx, business.id, 'batch.compliance_review', { batchId: b.id, reference: b.reference });
      return b;
    });
  } catch (err) {
    if (key && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.businessPayoutBatch.findUnique({ where: { businessId_idempotencyKey: { businessId: business.id, idempotencyKey: key } }, include: batchInclude });
      if (existing) return { batch: existing, replayed: true };
    }
    throw err;
  }
  if (status === 'EXECUTING') await executeBatch(batch.id);
  return { batch: await prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batch.id }, include: batchInclude }), replayed: false };
}

/** Run every PENDING line of an EXECUTING batch. Safe to call more than once. */
export async function executeBatch(batchId: string) {
  const batch = await prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId }, include: { business: true } });
  if (batch.status !== 'EXECUTING') return batch;
  const ownerId = batch.business.userId;
  const lines = await prisma.businessPayout.findMany({ where: { batchId, status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  for (const p of lines) {
    const total = D(p.amount).plus(p.feeAmount);
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.businessPayout.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'PROCESSING' } });
        if (claimed.count !== 1) return;
        const recipient = await tx.user.findUnique({ where: { id: p.recipientUserId! }, select: { id: true, status: true } });
        if (!recipient || recipient.status !== 'ACTIVE') throw new AppError('Recipient account cannot receive payments', 409);
        const ownerBefore = await tx.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: ownerId, currency: p.currency } } });
        await settleReserve(tx, ownerId, p.currency, total);
        const before = await tx.wallet.findUnique({ where: { userId_currency: { userId: recipient.id, currency: p.currency } } });
        await tx.wallet.upsert({
          where: { userId_currency: { userId: recipient.id, currency: p.currency } },
          create: { userId: recipient.id, currency: p.currency, balance: D(p.amount).toFixed() },
          update: { balance: { increment: D(p.amount).toFixed() } },
        });
        const { groupId } = await postLedger(tx, {
          refType: 'business_payout', refId: p.reference, memo: `Business payout ${p.reference}`,
          legs: [
            { type: 'USER', userId: ownerId, currency: p.currency as any, amount: total.neg() },
            { type: 'USER', userId: recipient.id, currency: p.currency as any, amount: D(p.amount) },
            ...(D(p.feeAmount).gt(0) ? [{ type: 'PLATFORM' as const, currency: p.currency as any, amount: D(p.feeAmount) }] : []),
          ],
        }, { allowNegativeUser: true });
        if (D(p.feeAmount).gt(0)) {
          await collectFee({ tx, source: 'manual', sourceId: p.reference, payerId: ownerId, amount: D(p.feeAmount), currency: p.currency, description: `Business payout fee · ${p.currency}`, metadata: { batchId, payoutId: p.id } });
        }
        const recBefore = D(before?.balance ?? 0);
        await tx.transaction.createMany({
          data: [
            { userId: ownerId, type: 'TRANSFER_OUT', currency: p.currency, amount: total.neg().toFixed(), fee: D(p.feeAmount).toFixed(), balanceBefore: D(ownerBefore.balance).toFixed(), balanceAfter: D(ownerBefore.balance).minus(total).toFixed(), reference: p.reference, description: `Business payout to @${p.recipientHandle ?? 'customer'}` },
            { userId: recipient.id, type: 'TRANSFER_IN', currency: p.currency, amount: D(p.amount).toFixed(), fee: 0, balanceBefore: recBefore.toFixed(), balanceAfter: recBefore.plus(p.amount).toFixed(), reference: p.reference, description: `Payment from ${batch.business.tradingName ?? batch.business.companyName}` },
          ],
        });
        await tx.notification.create({ data: { userId: recipient.id, title: `${p.currency} received`, message: `${batch.business.tradingName ?? batch.business.companyName} sent you ${D(p.amount).toFixed()} ${p.currency}${p.note ? ` — ${p.note}` : ''}`, type: 'transfer' } });
        await tx.businessPayout.update({ where: { id: p.id }, data: { status: 'COMPLETED', completedAt: new Date(), ledgerGroupId: groupId } });
        await enqueueEvent(tx, batch.businessId, 'payout.completed', { payoutId: p.id, reference: p.reference, batchId, amount: D(p.amount).toFixed(), currency: p.currency, recipient: p.recipientHandle });
      });
    } catch (err) {
      const reason = err instanceof AppError ? err.message : 'Payment could not be completed';
      logger.warn('[business] payout failed', { payoutId: p.id, err: (err as Error).message });
      await prisma.$transaction(async (tx) => {
        const failed = await tx.businessPayout.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason } });
        if (failed.count === 1) {
          await releaseReserve(tx, ownerId, p.currency, total);
          await enqueueEvent(tx, batch.businessId, 'payout.failed', { payoutId: p.id, reference: p.reference, batchId, reason });
        }
      });
    }
  }
  return finalizeBatch(batchId);
}

async function finalizeBatch(batchId: string) {
  const counts = await prisma.businessPayout.groupBy({ by: ['status'], where: { batchId }, _count: true });
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  if (n('PENDING') + n('PROCESSING') > 0) return prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId } });
  const done = n('COMPLETED');
  const status = done === 0 ? (n('CANCELLED') && !n('FAILED') ? 'CANCELLED' : 'FAILED') : n('FAILED') + n('CANCELLED') > 0 ? 'PARTIAL' : 'EXECUTED';
  const moved = await prisma.businessPayoutBatch.updateMany({ where: { id: batchId, status: { in: ['EXECUTING', 'PENDING_APPROVAL', 'COMPLIANCE_REVIEW'] } }, data: { status } });
  const batch = await prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (moved.count === 1) await enqueueEvent(prisma, batch.businessId, 'batch.completed', { batchId, reference: batch.reference, status, completed: done, failed: n('FAILED'), cancelled: n('CANCELLED') });
  return batch;
}

/**
 * A batch the business stopped before compliance decided: close its review case
 * when nothing was blocked (no money moved, nothing left to decide); when a line
 * was blocked, leave the case open for compliance with a note.
 */
async function settleBatchCase(batchId: string, actorId: string, why: string) {
  const batch = await prisma.businessPayoutBatch.findUnique({ where: { id: batchId } });
  if (!batch?.complianceCaseId) return;
  const c = await prisma.complianceCase.findUnique({ where: { id: batch.complianceCaseId } });
  if (!c || c.status === 'CLOSED') return;
  const blocked = await prisma.businessPayout.count({ where: { batchId, riskOutcome: { in: BLOCKING } } });
  if (blocked) {
    await prisma.caseNote.create({ data: { caseId: c.id, authorType: 'SYSTEM', kind: 'NOTE', body: `${why} No money moved. ${blocked} line(s) were blocked by screening, so this case stays open for review.` } });
    return;
  }
  await transitionCase({ caseId: c.id, to: 'CLOSED', actorId, note: `${why} No money moved.`, resolution: `Not required: ${why.toLowerCase()} before compliance review; no funds were paid.` })
    .catch((err) => logger.warn('[business] could not close batch case', { caseId: c.id, err: (err as Error).message }));
}

async function releaseOpenLines(tx: Tx, batchId: string, ownerId: string, to: 'CANCELLED' | 'FAILED', reason: string) {
  const open = await tx.businessPayout.findMany({ where: { batchId, status: 'PENDING' } });
  for (const p of open) {
    const moved = await tx.businessPayout.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: to, failureReason: reason } });
    if (moved.count === 1) await releaseReserve(tx, ownerId, p.currency, D(p.amount).plus(p.feeAmount));
  }
  return open.length;
}

/** Second OWNER/ADMIN approves (maker-checker). */
export async function approveBatch(
  ctx: BusinessContext,
  batchId: string,
  stepUp?: { req: { headers: Record<string, any> }; code?: string },
) {
  assertCan(ctx, 'payouts.approve');
  const batch = await prisma.businessPayoutBatch.findFirst({ where: { id: batchId, businessId: ctx.business.id } });
  if (!batch) throw new AppError('Batch not found', 404);
  if (batch.status !== 'PENDING_APPROVAL') throw new AppError(`Batch is ${batch.status}, not awaiting approval`, 409);
  // The maker cannot be the checker; an API-created batch is approved by a person in the app.
  if (batch.source !== 'API' && batch.createdById === ctx.userId) throw new AppError('A different owner or admin must approve this batch', 403, 'AUTHORIZATION');
  // When the person approving an API batch is the one whose key created it,
  // the second control is a fresh security code — otherwise a stolen app
  // session plus that person's key could create and approve alone.
  if (batch.source === 'API' && batch.createdById === ctx.userId) {
    if (!stepUp) throw new AppError('Confirm this approval with your security code', 403, 'STEP_UP_REQUIRED');
    const usd = Number(batch.totalAmount) * (await usdRate(batch.currency).catch(() => 0));
    await enforceStepUp({ userId: ctx.userId, action: 'transfer', valueUsd: usd > 0 ? usd : Number.POSITIVE_INFINITY, req: stepUp.req, code: stepUp.code, biometricVerified: false });
  }
  const needsReview = await prisma.businessPayout.count({ where: { batchId, status: 'PENDING', riskOutcome: { in: REVIEW } } });
  const next = needsReview ? 'COMPLIANCE_REVIEW' : 'EXECUTING';
  const moved = await prisma.businessPayoutBatch.updateMany({ where: { id: batchId, status: 'PENDING_APPROVAL' }, data: { status: next, approvedById: ctx.userId, approvedAt: new Date() } });
  if (moved.count !== 1) throw new AppError('Batch changed while you were approving — refresh', 409);
  await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_BATCH_APPROVED', entity: 'BusinessPayoutBatch', entityId: batchId, before: { status: 'PENDING_APPROVAL' }, after: { status: next } });
  if (next === 'EXECUTING') await executeBatch(batchId);
  else await enqueueEvent(prisma, ctx.business.id, 'batch.compliance_review', { batchId, reference: batch.reference });
  return prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId }, include: batchInclude });
}

export async function rejectBatch(ctx: BusinessContext, batchId: string, reason: string) {
  assertCan(ctx, 'payouts.approve');
  const batch = await prisma.businessPayoutBatch.findFirst({ where: { id: batchId, businessId: ctx.business.id } });
  if (!batch) throw new AppError('Batch not found', 404);
  await prisma.$transaction(async (tx) => {
    const moved = await tx.businessPayoutBatch.updateMany({ where: { id: batchId, status: 'PENDING_APPROVAL' }, data: { status: 'REJECTED', approvedById: ctx.userId, approvedAt: new Date() } });
    if (moved.count !== 1) throw new AppError(`Batch is ${batch.status}, not awaiting approval`, 409);
    await releaseOpenLines(tx, batchId, ctx.business.userId, 'CANCELLED', `Rejected by approver: ${reason}`.slice(0, 300));
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_BATCH_REJECTED', entity: 'BusinessPayoutBatch', entityId: batchId, before: { status: 'PENDING_APPROVAL' }, after: { status: 'REJECTED' }, reason });
    await enqueueEvent(tx, ctx.business.id, 'batch.rejected', { batchId, reference: batch.reference, reason });
  });
  await settleBatchCase(batchId, ctx.userId, `Batch ${batch.reference} was rejected by the business approver.`);
  return prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId }, include: batchInclude });
}

/** Cancel one line that has not run yet (batch awaiting approval or review). */
export async function cancelPayout(ctx: BusinessContext, payoutId: string) {
  assertCan(ctx, 'payouts.create');
  const p = await prisma.businessPayout.findFirst({ where: { id: payoutId, businessId: ctx.business.id }, include: { batch: true } });
  if (!p) throw new AppError('Payout not found', 404);
  if (p.status !== 'PENDING' || !p.batch || !['PENDING_APPROVAL', 'COMPLIANCE_REVIEW'].includes(p.batch.status)) {
    throw new AppError('Only payouts that have not started can be cancelled', 409);
  }
  await prisma.$transaction(async (tx) => {
    const moved = await tx.businessPayout.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CANCELLED', failureReason: 'Cancelled by the business' } });
    if (moved.count !== 1) throw new AppError('Payout changed — refresh', 409);
    await releaseReserve(tx, ctx.business.userId, p.currency, D(p.amount).plus(p.feeAmount));
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_PAYOUT_CANCELLED', entity: 'BusinessPayout', entityId: p.id, before: { status: 'PENDING' }, after: { status: 'CANCELLED' } });
    await enqueueEvent(tx, ctx.business.id, 'payout.cancelled', { payoutId: p.id, reference: p.reference, batchId: p.batchId });
  });
  if (p.batchId) {
    const after = await finalizeBatch(p.batchId);
    if (after.status === 'CANCELLED') await settleBatchCase(p.batchId, ctx.userId, `Every line of batch ${after.reference} was cancelled by the business.`);
  }
  return prisma.businessPayout.findUniqueOrThrow({ where: { id: p.id } });
}

/** Compliance staff release or reject a batch held for review (cockpit). */
export async function complianceDecideBatch(batchId: string, approve: boolean, staffId: string, note: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const batch = await prisma.businessPayoutBatch.findUnique({ where: { id: batchId }, include: { business: true } });
  if (!batch) throw new AppError('Batch not found', 404);
  if (batch.status !== 'COMPLIANCE_REVIEW') throw new AppError(`Batch is ${batch.status}, not in compliance review`, 409);
  await prisma.$transaction(async (tx) => {
    const moved = await tx.businessPayoutBatch.updateMany({ where: { id: batchId, status: 'COMPLIANCE_REVIEW' }, data: { status: approve ? 'EXECUTING' : 'REJECTED' } });
    if (moved.count !== 1) throw new AppError('Batch changed — refresh', 409);
    if (!approve) {
      await releaseOpenLines(tx, batchId, batch.business.userId, 'FAILED', 'This payment cannot be processed');
      await enqueueEvent(tx, batch.businessId, 'batch.rejected', { batchId, reference: batch.reference });
    }
    await writeAudit(tx, { actorId: staffId, action: approve ? 'BUSINESS_BATCH_COMPLIANCE_RELEASE' : 'BUSINESS_BATCH_COMPLIANCE_REJECT', entity: 'BusinessPayoutBatch', entityId: batchId, before: { status: 'COMPLIANCE_REVIEW' }, after: { approved: approve }, reason: note, req });
  });
  if (batch.complianceCaseId) {
    await transitionCase({ caseId: batch.complianceCaseId, to: 'CLOSED', actorId: staffId, note: `Decided from the batch review of ${batch.reference}`, resolution: `Batch ${approve ? 'released' : 'rejected'}: ${note}`, req })
      .catch((err) => logger.warn('[business] could not close batch case', { caseId: batch.complianceCaseId, err: (err as Error).message }));
  }
  if (approve) await executeBatch(batchId);
  return prisma.businessPayoutBatch.findUniqueOrThrow({ where: { id: batchId }, include: batchInclude });
}

export async function businessStats(ctx: BusinessContext) {
  const startDay = new Date(); startDay.setUTCHours(0, 0, 0, 0);
  const startMonth = new Date(Date.UTC(startDay.getUTCFullYear(), startDay.getUTCMonth(), 1));
  const where = (from: Date) => ({ businessId: ctx.business.id, createdAt: { gte: from } });
  const [today, month, byStatus, team, keys, keyIds] = await Promise.all([
    prisma.businessPayout.findMany({ where: { ...where(startDay), status: 'COMPLETED' }, select: { amount: true, currency: true } }),
    prisma.businessPayout.findMany({ where: { ...where(startMonth), status: 'COMPLETED' }, select: { amount: true, currency: true } }),
    prisma.businessPayout.groupBy({ by: ['status'], where: where(new Date(Date.now() - 30 * 86400_000)), _count: true }),
    prisma.businessTeamMember.count({ where: { businessId: ctx.business.id, status: 'ACTIVE' } }),
    prisma.aPIKey.count({ where: { businessId: ctx.business.id, isActive: true, revokedAt: null } }),
    prisma.aPIKey.findMany({ where: { businessId: ctx.business.id }, select: { id: true } }),
  ]);
  const usd = async (rows: Array<{ amount: unknown; currency: string }>) => {
    let t = 0;
    for (const r of rows) t += Number(r.amount) * (await usdRate(r.currency).catch(() => 0));
    return t.toFixed(2);
  };
  const calls = keyIds.length ? await prisma.apiKeyUsage.aggregate({ where: { keyId: { in: keyIds.map((k) => k.id) }, day: startDay.toISOString().slice(0, 10) }, _sum: { count: true } }) : null;
  const done = byStatus.find((s) => s.status === 'COMPLETED')?._count ?? 0;
  const failed = byStatus.find((s) => s.status === 'FAILED')?._count ?? 0;
  return {
    payoutsToday: today.length, payoutsThisMonth: month.length, volumeUsdToday: await usd(today), volumeUsdMonth: await usd(month),
    apiCallsToday: calls?._sum.count ?? 0, teamSize: team, activeKeys: keys, successRate: done + failed ? done / (done + failed) : 1,
  };
}
