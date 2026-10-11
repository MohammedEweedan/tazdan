/**
 * Remittance orchestration — sender → beneficiary → quote → KYC → risk →
 * funding → routing → settlement → payout → reconciliation → completion.
 *
 * Ledger (source currency S = principal, F = fee; destination R = payout):
 *   FUNDED  USER(sender, src)  −(S+F)   REMITTANCE_CLEARING(src) +(S+F)     customer money held in transit
 *   PAID    REMITTANCE_CLEARING(src) −(S+F)
 *           TREASURY(src)       +(S − m)   principal at the base rate (m = FX margin)
 *           PLATFORM(src)       +(F + m)   revenue recognised only on payout
 *           TREASURY(dst) or PARTNER_SETTLEMENT(dst)  −R
 *           SYSTEM_OFFRAMP(dst) +R  (external beneficiary)  |  USER(beneficiary, dst) +R  (Tazdan wallet)
 *   REFUND  REMITTANCE_CLEARING(src) −(S+F)  USER(sender, src) +(S+F)       full refund, fee included
 * A payout that was returned after PAID is reversed with the exact inverse
 * of its PAID journal before the refund.
 *
 * Provider calls never run inside a database transaction; state changes are
 * conditional, so a callback racing a poll or a retry cannot apply twice.
 */
import { randomUUID } from 'crypto';
import type { Currency, Prisma, RemittanceState } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { postLedger } from '../ledger/ledger.service';
import { debitAvailable } from '../wallet/atomicWallet';
import { assertMovementAllowed } from '../platform/controls.service';
import { writeAudit } from '../platform/audit';
import { evaluateRisk } from '../risk/engine';
import { screenAndRecord } from '../compliance/screening.service';
import { openCase, transitionCase } from '../compliance/cases.service';
import { callProvider, getPayoutProvider } from '../providers/registry';
import type { PayoutResult } from '../providers/types';
import { consumeLiquidity, releaseLiquidity, reserveLiquidity } from '../treasury/pools.service';
import { usdRate } from '../../utils/kycLimits';
import { corridorDestCountries } from './corridors';
import { decimalsOf } from './pricing';
import { persistRoutes, rankRoutes } from './routing';
import { transition, walk } from './stateMachine';

type Tx = Prisma.TransactionClient;
const D = (v: unknown) => new Decimal(String(v ?? 0));
const pd = (d: Decimal) => d.toFixed();
type Actor = { type: 'USER' | 'STAFF' | 'SYSTEM' | 'PROVIDER'; id?: string | null };

// ── Beneficiaries ───────────────────────────────────────────────────
export interface BeneficiaryInput {
  fullName: string;
  relationship?: string;
  country: string;
  currency: Currency;
  payoutMethod: 'BANK_ACCOUNT' | 'MOBILE_WALLET' | 'CASH_PICKUP' | 'TAZDAN_WALLET';
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  sortCode?: string;
  swift?: string;
  mobileWallet?: string;
  city?: string;
  addressLine?: string;
  tazdanHandle?: string;
}

function validIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export async function createBeneficiary(userId: string, input: BeneficiaryInput) {
  const country = input.country.toUpperCase();
  let tazdanUserId: string | null = null;
  if (input.payoutMethod === 'TAZDAN_WALLET') {
    const handle = input.tazdanHandle?.replace(/^@/, '').toLowerCase();
    if (!handle) throw new AppError('A Tazdan @handle is required for wallet payouts', 400);
    const target = await prisma.user.findFirst({ where: { username: handle }, select: { id: true, status: true } });
    if (!target || target.status !== 'ACTIVE') throw new AppError('No active Tazdan account with that handle', 404);
    if (target.id === userId) throw new AppError('You cannot add yourself as a beneficiary', 400);
    tazdanUserId = target.id;
  } else if (input.payoutMethod === 'BANK_ACCOUNT') {
    if (input.iban) {
      if (!validIban(input.iban)) throw new AppError('IBAN is not valid', 400);
    } else if (country === 'GB') {
      if (!/^\d{6}$/.test((input.sortCode ?? '').replace(/-/g, '')) || !/^\d{8}$/.test(input.accountNumber ?? '')) {
        throw new AppError('UK payouts need a 6-digit sort code and 8-digit account number, or an IBAN', 400);
      }
    } else if (!input.accountNumber || input.accountNumber.length < 6) {
      throw new AppError('Account number or IBAN is required', 400);
    }
  } else if (input.payoutMethod === 'MOBILE_WALLET' && !input.mobileWallet) {
    throw new AppError('Mobile wallet number is required', 400);
  }
  if (input.fullName.trim().split(/\s+/).length < 2) throw new AppError('Enter the beneficiary\'s full name (first and last)', 400);

  const b = await prisma.remittanceBeneficiary.create({
    data: {
      userId, fullName: input.fullName.trim(), relationship: input.relationship ?? null, country, currency: input.currency,
      payoutMethod: input.payoutMethod, bankName: input.bankName ?? null, accountNumber: input.accountNumber ?? null,
      iban: input.iban ? input.iban.replace(/\s+/g, '').toUpperCase() : null, sortCode: input.sortCode?.replace(/-/g, '') ?? null,
      swift: input.swift ?? null, mobileWallet: input.mobileWallet ?? null, city: input.city ?? null, addressLine: input.addressLine ?? null,
      tazdanUserId,
    },
  });
  const screening = await screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: b.id, userId, subject: { name: b.fullName, country } });
  return prisma.remittanceBeneficiary.update({
    where: { id: b.id },
    data: { screeningStatus: screening.status === 'POTENTIAL_MATCH' ? 'POTENTIAL_MATCH' : 'CLEAR', screenedAt: new Date() },
  });
}

// ── Transfers ───────────────────────────────────────────────────────
export interface CreateTransferInput {
  userId: string;
  quoteId: string;
  beneficiaryId: string;
  purpose: string;
  sourceOfFunds?: string;
  idempotencyKey?: string;
  knownDevice?: boolean;
  deviceFingerprint?: string | null;
}

function reference(): string {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `RMT-${d}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export async function createTransfer(input: CreateTransferInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.remittanceTransfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.userId !== input.userId) throw new AppError('Idempotency key already used', 409, 'DUPLICATE_REQUEST');
      return { transfer: existing, duplicate: true };
    }
  }

  const quote = await prisma.remittanceQuote.findUnique({ where: { id: input.quoteId }, include: { corridor: true } });
  if (!quote || quote.userId !== input.userId) throw new AppError('Quote not found', 404);
  if (quote.consumedAt) throw new AppError('This quote has already been used — request a new one', 409, 'DUPLICATE_REQUEST');
  if (quote.expiresAt.getTime() < Date.now()) throw new AppError('This quote has expired — request a new one', 409);
  const corridor = quote.corridor;
  await assertMovementAllowed({ userId: input.userId, feature: 'remittance', currency: corridor.sourceCurrency, corridor: corridor.code });
  if (corridor.status === 'PAUSED' || corridor.status === 'DISABLED') throw new AppError(`${corridor.name} is paused`, 503, 'FEATURE_DISABLED');
  if (corridor.status === 'SANDBOX_ONLY' && process.env.NODE_ENV === 'production') {
    throw new AppError(`${corridor.name} is not live yet — payout partner activation is required`, 503, 'PROVIDER_NOT_ACTIVATED');
  }
  if (!corridor.allowedPurposes.includes(input.purpose)) throw new AppError('Choose a valid purpose of payment', 400);

  const beneficiary = await prisma.remittanceBeneficiary.findFirst({ where: { id: input.beneficiaryId, userId: input.userId, status: 'ACTIVE' } });
  if (!beneficiary) throw new AppError('Beneficiary not found', 404);
  if (beneficiary.currency !== corridor.destCurrency) throw new AppError(`Beneficiary receives ${beneficiary.currency}, this corridor pays ${corridor.destCurrency}`, 400);
  if (!corridorDestCountries(corridor.destCountry).includes(beneficiary.country) && beneficiary.payoutMethod !== 'TAZDAN_WALLET') {
    throw new AppError(`Beneficiary country ${beneficiary.country} is not served by ${corridor.code}`, 400);
  }
  if (!corridor.payoutMethods.includes(beneficiary.payoutMethod)) throw new AppError(`${beneficiary.payoutMethod} payouts are not offered on ${corridor.code}`, 400);

  const sender = await prisma.user.findUnique({ where: { id: input.userId }, select: { firstName: true, lastName: true, country: true, kycStatus: true, dateOfBirth: true } });
  if (!sender) throw new AppError('User not found', 404);
  if (sender.kycStatus !== 'APPROVED') throw new AppError('Verify your identity before sending money abroad', 403, 'COMPLIANCE_HOLD');

  // Per-customer corridor limits (destination currency).
  const dayAgo = new Date(Date.now() - 86400_000); const monthAgo = new Date(Date.now() - 30 * 86400_000);
  const [day, month] = await Promise.all([
    prisma.remittanceTransfer.aggregate({ where: { userId: input.userId, corridorId: corridor.id, createdAt: { gte: dayAgo }, state: { notIn: ['REJECTED', 'CANCELLED', 'REFUNDED', 'EXPIRED'] } }, _sum: { receiveAmount: true } }),
    prisma.remittanceTransfer.aggregate({ where: { userId: input.userId, corridorId: corridor.id, createdAt: { gte: monthAgo }, state: { notIn: ['REJECTED', 'CANCELLED', 'REFUNDED', 'EXPIRED'] } }, _sum: { receiveAmount: true } }),
  ]);
  const receive = D(quote.receiveAmount);
  if (corridor.dailyLimitPerCustomer && D(day._sum.receiveAmount).plus(receive).gt(corridor.dailyLimitPerCustomer.toString())) {
    throw new AppError(`This would exceed your daily ${corridor.code} limit of ${corridor.dailyLimitPerCustomer} ${corridor.destCurrency}`, 400, 'LIMIT_EXCEEDED');
  }
  if (corridor.monthlyLimitPerCustomer && D(month._sum.receiveAmount).plus(receive).gt(corridor.monthlyLimitPerCustomer.toString())) {
    throw new AppError(`This would exceed your 30-day ${corridor.code} limit of ${corridor.monthlyLimitPerCustomer} ${corridor.destCurrency}`, 400, 'LIMIT_EXCEEDED');
  }
  const amountUsd = Number(quote.totalDebit) * (await usdRate(corridor.sourceCurrency));
  const sofThresholdUsd = corridor.sourceOfFundsThreshold ? Number(corridor.sourceOfFundsThreshold) * (await usdRate(corridor.destCurrency)) : null;
  if (sofThresholdUsd && amountUsd >= sofThresholdUsd && !input.sourceOfFunds?.trim()) {
    throw new AppError('Please declare the source of funds for a transfer of this size', 400, 'COMPLIANCE_HOLD', { requires: 'sourceOfFunds' });
  }

  // Screening: sender now, beneficiary at creation (re-screened if older than 7 days).
  const transferId = randomUUID();
  const senderScreen = await screenAndRecord({
    subjectType: 'USER', subjectId: input.userId, userId: input.userId,
    subject: { name: `${sender.firstName} ${sender.lastName}`, country: sender.country, dateOfBirth: sender.dateOfBirth?.toISOString().slice(0, 10) },
  });
  let beneficiaryScreen = beneficiary.screeningStatus;
  if (!beneficiary.screenedAt || beneficiary.screenedAt < new Date(Date.now() - 7 * 86400_000)) {
    const r = await screenAndRecord({ subjectType: 'BENEFICIARY', subjectId: beneficiary.id, userId: input.userId, subject: { name: beneficiary.fullName, country: beneficiary.country } });
    beneficiaryScreen = r.status === 'POTENTIAL_MATCH' ? 'POTENTIAL_MATCH' : 'CLEAR';
    await prisma.remittanceBeneficiary.update({ where: { id: beneficiary.id }, data: { screeningStatus: beneficiaryScreen, screenedAt: new Date() } });
  }

  const risk = await evaluateRisk({
    subjectType: 'REMITTANCE', subjectId: transferId, userId: input.userId, amountUsd,
    sourceCountry: corridor.sourceCountry === 'EU' ? null : corridor.sourceCountry, destCountry: beneficiary.country,
    beneficiaryId: beneficiary.id, sourceOfFunds: input.sourceOfFunds, sourceOfFundsThresholdUsd: sofThresholdUsd,
    knownDevice: input.knownDevice, deviceFingerprint: input.deviceFingerprint,
    screening: { sender: senderScreen.status, beneficiary: beneficiaryScreen, coverage: senderScreen.listsChecked.length ? 'LISTS_LOADED' : 'NO_LISTS_LOADED' },
  });

  const correlationId = `corr_${randomUUID()}`;
  const actor: Actor = { type: 'USER', id: input.userId };
  const blocked = ['REJECT', 'BLOCK', 'FREEZE'].includes(risk.outcome);
  const review = ['REVIEW', 'REQUEST_INFORMATION'].includes(risk.outcome);

  const result = await prisma.$transaction(async (tx) => {
    const consumed = await tx.remittanceQuote.updateMany({ where: { id: quote.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw new AppError('This quote has already been used — request a new one', 409, 'DUPLICATE_REQUEST');
    const t = await tx.remittanceTransfer.create({
      data: {
        id: transferId, reference: reference(), userId: input.userId, corridorId: corridor.id, quoteId: quote.id, beneficiaryId: beneficiary.id,
        sourceCurrency: quote.sourceCurrency, destCurrency: quote.destCurrency, sendAmount: quote.sendAmount, feeAmount: quote.feeAmount,
        totalDebit: quote.totalDebit, baseRate: quote.baseRate, customerRate: quote.customerRate, receiveAmount: quote.receiveAmount,
        purpose: input.purpose, sourceOfFunds: input.sourceOfFunds ?? null, state: 'CREATED', riskScore: risk.score, riskOutcome: risk.outcome,
        idempotencyKey: input.idempotencyKey ?? null, correlationId,
      },
    });
    const transfer = { id: t.id, state: t.state as RemittanceState, correlationId };
    await walk(tx, transfer, ['QUOTED', 'COMPLIANCE_PENDING'], { actorType: actor.type, actorId: actor.id, reason: `Quote ${quote.id} accepted` });

    if (blocked) {
      await transition(tx, transfer, 'REJECTED', { actorType: 'SYSTEM', reason: `Risk engine: ${risk.explanation}`, riskDecisionId: risk.decisionId, data: { failureReason: 'Compliance rejection' } });
      const c = await openCase({ type: risk.triggered.includes('RESTRICTED_JURISDICTION') ? 'SANCTIONS' : 'AML', priority: 'CRITICAL', title: `Remittance ${t.reference} rejected by risk engine`, summary: risk.explanation, subjectUserId: input.userId, subjectType: 'REMITTANCE', subjectId: t.id, riskDecisionId: risk.decisionId }, tx);
      return { transfer: t, outcome: 'REJECTED' as const, caseId: c.id };
    }

    // Approved or for review: collect the funds into clearing first, so the
    // customer cannot spend them while the transfer is decided.
    if (review) {
      await transition(tx, transfer, 'MANUAL_REVIEW', { actorType: 'SYSTEM', reason: `Risk engine: ${risk.explanation}`, riskDecisionId: risk.decisionId });
      await transition(tx, transfer, 'FUNDING_PENDING', { actorType: 'SYSTEM', reason: 'Funds held while under review' });
    } else {
      await walk(tx, transfer, ['APPROVED', 'FUNDING_PENDING'], { actorType: 'SYSTEM', reason: risk.explanation, riskDecisionId: risk.decisionId });
    }
    const groupId = await fund(tx, t);
    await transition(tx, transfer, 'FUNDED', { actorType: 'SYSTEM', reason: `Debited ${t.totalDebit} ${t.sourceCurrency} into remittance clearing`, ledgerGroupIds: [groupId] });

    if (review) {
      await transition(tx, transfer, 'MANUAL_REVIEW', { actorType: 'SYSTEM', reason: 'Awaiting compliance decision', riskDecisionId: risk.decisionId });
      const c = await openCase({
        type: risk.triggered.some((r) => r.startsWith('SANCTIONS') || r.startsWith('SCREENING')) ? 'SANCTIONS' : risk.outcome === 'REQUEST_INFORMATION' ? 'SOURCE_OF_FUNDS' : 'AML',
        priority: risk.score >= 60 ? 'HIGH' : 'MEDIUM', title: `Remittance ${t.reference} needs review`, summary: risk.explanation,
        subjectUserId: input.userId, subjectType: 'REMITTANCE', subjectId: t.id, riskDecisionId: risk.decisionId,
      }, tx);
      return { transfer: t, outcome: 'MANUAL_REVIEW' as const, caseId: c.id };
    }
    await route(tx, transfer.id, actor);
    return { transfer: t, outcome: 'ROUTED' as const, caseId: null };
  });

  if (result.outcome === 'ROUTED') {
    await submitPayout(result.transfer.id).catch((err) => logger.error('[remittance] payout submission failed', { id: result.transfer.id, err: (err as Error).message }));
  }
  const fresh = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: result.transfer.id } });
  return { transfer: fresh, duplicate: false, outcome: result.outcome, caseId: result.caseId };
}

/** Debit the sender into REMITTANCE_CLEARING; returns the ledger group id. */
async function fund(tx: Tx, t: { id: string; userId: string; sourceCurrency: Currency; totalDebit: Prisma.Decimal; reference: string }): Promise<string> {
  const total = D(t.totalDebit);
  const before = await tx.wallet.findUnique({ where: { userId_currency: { userId: t.userId, currency: t.sourceCurrency } } });
  await debitAvailable(tx, t.userId, t.sourceCurrency, total);
  const { groupId } = await postLedger(tx, {
    refType: 'remittance_funding', refId: t.id, memo: `Remittance ${t.reference} funding`,
    legs: [
      { type: 'USER', userId: t.userId, currency: t.sourceCurrency, amount: total.neg() },
      { type: 'REMITTANCE_CLEARING', currency: t.sourceCurrency, amount: total },
    ],
  }, { allowNegativeUser: true });
  const bal = D(before?.balance);
  await tx.transaction.create({
    data: {
      userId: t.userId, type: 'TRANSFER_OUT', currency: t.sourceCurrency, amount: pd(total.neg()), fee: 0,
      balanceBefore: pd(bal), balanceAfter: pd(bal.minus(total)), reference: t.reference,
      description: 'International transfer', metadata: { kind: 'remittance', remittanceId: t.id, status: 'PROCESSING' },
    },
  });
  return groupId;
}

/** Choose a route and reserve its liquidity (inside the caller's transaction). */
async function route(tx: Tx, transferId: string, actor: Actor, excludeProviders: string[] = []) {
  const t = await tx.remittanceTransfer.findUniqueOrThrow({ where: { id: transferId }, include: { beneficiary: true } });
  const transfer = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
  await transition(tx, transfer, 'ROUTING', { actorType: actor.type, actorId: actor.id });
  const routes = (await rankRoutes({
    destCountry: t.beneficiary.payoutMethod === 'TAZDAN_WALLET' ? '*' : t.beneficiary.country,
    destCurrency: t.destCurrency, payoutMethod: t.beneficiary.payoutMethod, receiveAmount: D(t.receiveAmount), customerRate: D(t.customerRate),
  })).filter((r) => !excludeProviders.includes(r.providerCode) || !r.eligible);
  const best = routes.find((r) => r.eligible) ?? null;
  await persistRoutes(tx, routes, { transferId }, t.destCurrency, best?.providerCode);
  if (!best) {
    await transition(tx, transfer, 'FAILED', { actorType: 'SYSTEM', reason: 'No eligible payout route', data: { failureReason: 'No eligible payout route (provider availability, limits or liquidity)' } });
    return null;
  }
  if (best.settlementModel !== 'POSTFUNDED') {
    await reserveLiquidity(tx, { providerCode: best.providerCode, currency: t.destCurrency, amount: D(t.receiveAmount), transferId, reference: t.reference });
  }
  await transition(tx, transfer, 'ROUTED', {
    actorType: 'SYSTEM', provider: best.providerCode,
    reason: `Route ${best.providerName} (score ${best.score}); fallback ${routes.find((r) => r.eligible && r.rank === 2)?.providerCode ?? 'none'}`,
    data: { providerCode: best.providerCode },
  });
  await transition(tx, transfer, 'SETTLEMENT_PENDING', { actorType: 'SYSTEM', provider: best.providerCode });
  if (best.settlementModel === 'POSTFUNDED') {
    const stl = await addSettlementObligation(tx, best.providerCode, t.destCurrency, D(t.receiveAmount), transferId);
    await transition(tx, transfer, 'SETTLED', { actorType: 'SYSTEM', provider: best.providerCode, reason: `Partner credit; net settlement obligation ${stl}` });
  } else {
    await transition(tx, transfer, 'SETTLED', { actorType: 'SYSTEM', provider: best.providerCode, reason: `Covered by prefunded ${t.destCurrency} pool at ${best.providerCode}` });
  }
  return best;
}

async function addSettlementObligation(tx: Tx, providerCode: string, currency: Currency, amount: Decimal, transferId: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ref = `STL-${providerCode}-${currency}-${day}`;
  const due = new Date(); due.setUTCDate(due.getUTCDate() + 1); due.setUTCHours(12, 0, 0, 0);
  await tx.$executeRaw`
    INSERT INTO "RemittanceSettlement" ("id","reference","providerCode","currency","amount","direction","status","transferIds","dueAt","createdAt","updatedAt")
    VALUES (${randomUUID()}, ${ref}, ${providerCode}, CAST(${currency} AS "Currency"), ${amount.toFixed()}::numeric, 'PAYABLE', 'OPEN', ARRAY[${transferId}]::text[], ${due}, NOW(), NOW())
    ON CONFLICT ("reference") DO UPDATE SET
      "amount" = "RemittanceSettlement"."amount" + EXCLUDED."amount",
      "transferIds" = array_append("RemittanceSettlement"."transferIds", ${transferId}),
      "updatedAt" = NOW()
  `;
  return ref;
}

/** Hand the payout to the routed provider (outside any DB transaction). */
export async function submitPayout(transferId: string, actor: Actor = { type: 'SYSTEM' }) {
  const t = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: transferId }, include: { beneficiary: true, user: { select: { firstName: true, lastName: true, country: true } } } });
  if (t.state !== 'SETTLED') throw new AppError(`Transfer is ${t.state}, not ready for payout`, 409);
  const providerCode = t.providerCode!;
  const provider = getPayoutProvider(providerCode);
  const attempt = (await prisma.remittancePayout.count({ where: { transferId } })) + 1;

  const payout = await prisma.$transaction(async (tx) => {
    const p = await tx.remittancePayout.create({ data: { transferId, providerCode, amount: t.receiveAmount, currency: t.destCurrency, status: 'PENDING', attempt } });
    await transition(tx, { id: t.id, state: 'SETTLED', correlationId: t.correlationId }, 'PAYOUT_PENDING', { actorType: actor.type, actorId: actor.id, provider: providerCode, reason: `Payout attempt ${attempt}` });
    return p;
  });

  let result: PayoutResult;
  try {
    result = await callProvider(providerCode, 'execute', () => provider.execute({
      transferId, reference: `${t.reference}-${attempt}`, amount: D(t.receiveAmount).toFixed(decimalsOf(t.destCurrency)), currency: t.destCurrency,
      beneficiary: {
        fullName: t.beneficiary.fullName, country: t.beneficiary.country, payoutMethod: t.beneficiary.payoutMethod, bankName: t.beneficiary.bankName,
        accountNumber: t.beneficiary.accountNumber, iban: t.beneficiary.iban, sortCode: t.beneficiary.sortCode, swift: t.beneficiary.swift,
        mobileWallet: t.beneficiary.mobileWallet, tazdanUserId: t.beneficiary.tazdanUserId,
      },
      purpose: t.purpose, sender: { fullName: `${t.user.firstName} ${t.user.lastName}`, country: t.user.country },
    }), { entityType: 'REMITTANCE', entityId: transferId, correlationId: t.correlationId, request: { amount: t.receiveAmount, currency: t.destCurrency, method: t.beneficiary.payoutMethod } });
  } catch (err) {
    // Unknown outcome (timeout / transport). Keep PAYOUT_PENDING: the status
    // poll resolves it. Never assume failure and refund while the provider may pay.
    await prisma.remittancePayout.update({ where: { id: payout.id }, data: { status: 'SUBMITTED', failureReason: `Submission outcome unknown: ${(err as Error).message}`, submittedAt: new Date() } });
    logger.warn('[remittance] payout outcome unknown — will poll', { transferId, err: (err as Error).message });
    return;
  }
  // Record the submission only. Terminal outcomes (PAID / FAILED) are applied
  // by applyPayoutUpdate, whose conditional update is the single owner of
  // those transitions — writing FAILED here made it skip the refund.
  await prisma.remittancePayout.update({ where: { id: payout.id }, data: { providerRef: result.providerRef, status: 'SUBMITTED', submittedAt: new Date() } });
  await prisma.remittanceTransfer.update({ where: { id: transferId }, data: { providerRef: result.providerRef } });
  await applyPayoutUpdate(payout.id, result, { type: 'PROVIDER', id: providerCode });
}

/**
 * Apply a provider status (from the submit response, a poll or a callback).
 * Idempotent: a status already applied is ignored.
 */
export async function applyPayoutUpdate(payoutId: string, update: Pick<PayoutResult, 'status' | 'failureReason' | 'raw'>, actor: Actor) {
  const payout = await prisma.remittancePayout.findUniqueOrThrow({ where: { id: payoutId } });
  const t = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: payout.transferId }, include: { beneficiary: true } });
  if (update.status === 'SUBMITTED') return;

  if (update.status === 'PAID') {
    if (payout.status === 'PAID') return;
    await prisma.$transaction(async (tx) => {
      const moved = await tx.remittancePayout.updateMany({ where: { id: payout.id, status: { in: ['PENDING', 'SUBMITTED'] } }, data: { status: 'PAID', paidAt: new Date() } });
      if (moved.count !== 1) return;
      const groupId = await postPayoutJournal(tx, t, payout.providerCode);
      await consumeLiquidity(tx, t.id, t.reference);
      const transfer = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
      await transition(tx, transfer, 'PAID', { actorType: actor.type, actorId: actor.id, provider: payout.providerCode, providerResponse: update.raw ?? null, ledgerGroupIds: [groupId] });
      await transition(tx, transfer, 'RECONCILIATION_PENDING', { actorType: 'SYSTEM', reason: 'Awaiting provider statement match' });
      await tx.transaction.updateMany({ where: { reference: t.reference, userId: t.userId, type: 'TRANSFER_OUT' }, data: { metadata: { kind: 'remittance', remittanceId: t.id, status: 'PAID' } } });
      await tx.notification.create({ data: { userId: t.userId, title: 'Transfer delivered', message: `${t.receiveAmount} ${t.destCurrency} has been paid to ${t.beneficiary.fullName}. Ref ${t.reference}.`, type: 'transfer' } });
    });
    return;
  }

  if (update.status === 'FAILED') {
    if (payout.status === 'FAILED') return;
    const fallback = await prisma.$transaction(async (tx) => {
      const moved = await tx.remittancePayout.updateMany({ where: { id: payout.id, status: { in: ['PENDING', 'SUBMITTED'] } }, data: { status: 'FAILED', failureReason: update.failureReason ?? 'Provider failure' } });
      if (moved.count !== 1) return null;
      await releaseLiquidity(tx, t.id, `Payout failed at ${payout.providerCode}`);
      const transfer = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
      await transition(tx, transfer, 'FAILED', { actorType: actor.type, actorId: actor.id, provider: payout.providerCode, providerResponse: update.raw ?? null, reason: update.failureReason ?? 'Provider failure', data: { failureReason: update.failureReason ?? 'Provider failure' } });
      // One automatic re-route to a different rail, unless the failure is about the beneficiary.
      const beneficiaryIssue = /BENEFICIARY|ACCOUNT_CLOSED|INVALID_ACCOUNT/i.test(update.failureReason ?? '');
      const tried = (await tx.remittancePayout.findMany({ where: { transferId: t.id }, select: { providerCode: true } })).map((p) => p.providerCode);
      if (!beneficiaryIssue && tried.length < 2) {
        const next = await route(tx, t.id, { type: 'SYSTEM' }, tried);
        if (next) return next.providerCode;
      }
      return null;
    });
    if (fallback) {
      await submitPayout(t.id).catch((err) => logger.error('[remittance] fallback payout failed', { id: t.id, err: (err as Error).message }));
    } else {
      const fresh = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
      if (fresh.state === 'FAILED') await refund(t.id, { type: 'SYSTEM' }, `Payout failed: ${update.failureReason ?? 'provider failure'}`);
    }
    return;
  }

  if (update.status === 'RETURNED') {
    if (payout.status === 'RETURNED') return;
    await prisma.$transaction(async (tx) => {
      const moved = await tx.remittancePayout.updateMany({ where: { id: payout.id, status: 'PAID' }, data: { status: 'RETURNED', failureReason: update.failureReason ?? 'Returned by beneficiary bank' } });
      if (moved.count !== 1) return;
      const paidGroup = await tx.ledgerEntry.findMany({ where: { refType: 'remittance_payout', refId: t.id } });
      // Reverse the PAID journal exactly, then put the liquidity back in the pool.
      const { groupId } = await postLedger(tx, {
        refType: 'remittance_payout_reversal', refId: t.id, memo: `Remittance ${t.reference} returned: ${update.failureReason ?? ''}`.slice(0, 500),
        legs: await Promise.all(paidGroup.map(async (e) => {
          const acct = await tx.ledgerAccount.findUniqueOrThrow({ where: { id: e.accountId } });
          return { type: acct.type, userId: acct.userId, currency: e.currency, amount: D(e.amount).neg() };
        })),
      }, { allowNegativeUser: false });
      const pool = await tx.treasuryMovement.findFirst({ where: { transferId: t.id, type: 'CONSUME' } });
      if (pool) await tx.treasuryMovement.create({ data: { poolId: pool.poolId, type: 'ADJUST_IN', amount: pool.amount, transferId: t.id, reference: t.reference, note: 'Payout returned by beneficiary bank' } });
      const transfer = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
      await transition(tx, transfer, 'DISPUTED', { actorType: actor.type, actorId: actor.id, provider: payout.providerCode, reason: update.failureReason ?? 'Payout returned', ledgerGroupIds: [groupId] });
    });
    await refund(t.id, { type: 'SYSTEM' }, `Payout returned: ${update.failureReason ?? ''}`);
  }
}

async function postPayoutJournal(tx: Tx, t: Prisma.RemittanceTransferGetPayload<{ include: { beneficiary: true } }>, providerCode: string): Promise<string> {
  const S = D(t.sendAmount); const F = D(t.feeAmount); const R = D(t.receiveAmount); const base = D(t.baseRate);
  const atBase = R.div(base).toDecimalPlaces(decimalsOf(t.sourceCurrency), Decimal.ROUND_UP);
  const margin = Decimal.max(0, S.minus(atBase));
  const provider = getPayoutProvider(providerCode);
  const postfunded = provider.descriptor.terms?.settlementModel === 'POSTFUNDED';
  const toWallet = t.beneficiary.payoutMethod === 'TAZDAN_WALLET' && t.beneficiary.tazdanUserId;
  if (toWallet) {
    await tx.wallet.upsert({
      where: { userId_currency: { userId: t.beneficiary.tazdanUserId!, currency: t.destCurrency } },
      update: { balance: { increment: pd(R) } },
      create: { userId: t.beneficiary.tazdanUserId!, currency: t.destCurrency, balance: pd(R) },
    });
  }
  const { groupId } = await postLedger(tx, {
    refType: 'remittance_payout', refId: t.id, memo: `Remittance ${t.reference} paid via ${providerCode}`,
    legs: [
      { type: 'REMITTANCE_CLEARING', currency: t.sourceCurrency, amount: S.plus(F).neg() },
      { type: 'TREASURY', currency: t.sourceCurrency, amount: S.minus(margin) },
      { type: 'PLATFORM', currency: t.sourceCurrency, amount: F.plus(margin) },
      { type: postfunded ? 'PARTNER_SETTLEMENT' : 'TREASURY', currency: t.destCurrency, amount: R.neg() },
      toWallet
        ? { type: 'USER', userId: t.beneficiary.tazdanUserId!, currency: t.destCurrency, amount: R }
        : { type: 'SYSTEM_OFFRAMP', currency: t.destCurrency, amount: R },
    ],
  });
  if (toWallet) {
    const w = await tx.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: t.beneficiary.tazdanUserId!, currency: t.destCurrency } } });
    await tx.transaction.create({
      data: {
        userId: t.beneficiary.tazdanUserId!, type: 'TRANSFER_IN', currency: t.destCurrency, amount: pd(R), fee: 0,
        balanceBefore: pd(D(w.balance).minus(R)), balanceAfter: w.balance, reference: t.reference,
        description: 'International transfer received', metadata: { kind: 'remittance', remittanceId: t.id },
      },
    });
  }
  return groupId;
}

/** Return the customer's full debit (fee included) from clearing. */
export async function refund(transferId: string, actor: Actor, reason: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.remittanceTransfer.findUniqueOrThrow({ where: { id: transferId } });
    const transfer = { id: t.id, state: t.state as RemittanceState, correlationId: t.correlationId };
    if (t.state === 'REFUNDED') return t;
    const funded = await tx.ledgerEntry.count({ where: { refType: 'remittance_funding', refId: t.id } });
    const refunded = await tx.ledgerEntry.count({ where: { refType: 'remittance_refund', refId: t.id } });
    await releaseLiquidity(tx, t.id, `Refund: ${reason}`);
    if (transfer.state !== 'REFUND_PENDING') {
      await transition(tx, transfer, 'REFUND_PENDING', { actorType: actor.type, actorId: actor.id, reason });
    }
    const groups: string[] = [];
    if (funded && !refunded) {
      const total = D(t.totalDebit);
      await tx.wallet.upsert({
        where: { userId_currency: { userId: t.userId, currency: t.sourceCurrency } },
        update: { balance: { increment: pd(total) } },
        create: { userId: t.userId, currency: t.sourceCurrency, balance: pd(total) },
      });
      const { groupId } = await postLedger(tx, {
        refType: 'remittance_refund', refId: t.id, memo: `Remittance ${t.reference} refund: ${reason}`.slice(0, 500),
        legs: [
          { type: 'REMITTANCE_CLEARING', currency: t.sourceCurrency, amount: total.neg() },
          { type: 'USER', userId: t.userId, currency: t.sourceCurrency, amount: total },
        ],
      });
      groups.push(groupId);
      await tx.remittanceRefund.create({ data: { transferId: t.id, amount: t.totalDebit, currency: t.sourceCurrency, reason, status: 'COMPLETED', ledgerGroupId: groupId, requestedById: actor.type === 'STAFF' ? actor.id ?? null : null, completedAt: new Date() } });
      await tx.transaction.updateMany({ where: { reference: t.reference, userId: t.userId, type: 'TRANSFER_OUT' }, data: { metadata: { kind: 'remittance', remittanceId: t.id, status: 'REFUNDED' } } });
      await tx.notification.create({ data: { userId: t.userId, title: 'Transfer refunded', message: `${t.totalDebit} ${t.sourceCurrency} has been returned to your wallet (ref ${t.reference}).`, type: 'transfer' } });
    }
    await transition(tx, transfer, 'REFUNDED', { actorType: actor.type, actorId: actor.id, reason, ledgerGroupIds: groups });
    return tx.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
  });
}

/** Customer cancellation — only before the payout reaches the provider. */
export async function cancelTransfer(userId: string, transferId: string) {
  const t = await prisma.remittanceTransfer.findFirst({ where: { id: transferId, userId } });
  if (!t) throw new AppError('Transfer not found', 404);
  const preRoute: RemittanceState[] = ['CREATED', 'QUOTED', 'APPROVED', 'FUNDING_PENDING'];
  if (preRoute.includes(t.state)) {
    await prisma.$transaction(async (tx) => {
      await transition(tx, { id: t.id, state: t.state, correlationId: t.correlationId }, 'CANCELLED', { actorType: 'USER', actorId: userId, reason: 'Cancelled by customer' });
    });
    return prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
  }
  if (['MANUAL_REVIEW', 'FUNDED', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'FAILED'].includes(t.state)) {
    return refund(t.id, { type: 'USER', id: userId }, 'Cancelled by customer');
  }
  if (t.state === 'PAYOUT_PENDING' && t.providerRef && t.providerCode) {
    const res = await callProvider(t.providerCode, 'cancel', () => getPayoutProvider(t.providerCode!).cancel(t.providerRef!), { entityType: 'REMITTANCE', entityId: t.id });
    if (!res.cancelled) throw new AppError(`The payout is already with the payout partner and cannot be cancelled (${res.reason ?? 'in progress'})`, 409);
    const payout = await prisma.remittancePayout.findFirst({ where: { transferId: t.id, status: { in: ['PENDING', 'SUBMITTED'] } } });
    if (payout) await prisma.remittancePayout.update({ where: { id: payout.id }, data: { status: 'FAILED', failureReason: 'Cancelled by customer' } });
    await prisma.$transaction(async (tx) => {
      await releaseLiquidity(tx, t.id, 'Cancelled by customer');
      await transition(tx, { id: t.id, state: t.state, correlationId: t.correlationId }, 'REFUND_PENDING', { actorType: 'USER', actorId: userId, reason: 'Cancelled at provider' });
    });
    return refund(t.id, { type: 'USER', id: userId }, 'Cancelled by customer');
  }
  throw new AppError(`A transfer that is ${t.state.toLowerCase().replace(/_/g, ' ')} cannot be cancelled`, 409);
}

/** Compliance decision on a transfer held in MANUAL_REVIEW. */
export async function decideReview(transferId: string, approve: boolean, staffId: string, note: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const t = await prisma.remittanceTransfer.findUnique({ where: { id: transferId } });
  if (!t) throw new AppError('Transfer not found', 404);
  if (t.state !== 'MANUAL_REVIEW') throw new AppError(`Transfer is ${t.state}, not in review`, 409);
  await writeAudit(prisma, { actorId: staffId, action: approve ? 'REMITTANCE_REVIEW_APPROVE' : 'REMITTANCE_REVIEW_REJECT', entity: 'RemittanceTransfer', entityId: t.id, before: { state: t.state }, after: { approved: approve }, reason: note, req });
  if (!approve) {
    const refunded = await refund(t.id, { type: 'STAFF', id: staffId }, `Rejected in compliance review: ${note}`);
    await closeReviewCases(t.id, t.reference, false, staffId, note, req);
    return refunded;
  }
  await prisma.$transaction(async (tx) => {
    const transfer = { id: t.id, state: t.state, correlationId: t.correlationId };
    await transition(tx, transfer, 'APPROVED', { actorType: 'STAFF', actorId: staffId, reason: `Approved in review: ${note}` });
    // Funds were collected before review; continue from FUNDED.
    await transition(tx, transfer, 'FUNDING_PENDING', { actorType: 'SYSTEM', reason: 'Funds already held in clearing' });
    await transition(tx, transfer, 'FUNDED', { actorType: 'SYSTEM', reason: 'Funds already held in clearing' });
    await route(tx, t.id, { type: 'STAFF', id: staffId });
  });
  await closeReviewCases(t.id, t.reference, true, staffId, note, req);
  const fresh = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
  if (fresh.state === 'SETTLED') await submitPayout(t.id, { type: 'STAFF', id: staffId });
  else if (fresh.state === 'FAILED') await refund(t.id, { type: 'SYSTEM' }, 'No payout route after review');
  return prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
}

/** The review decision is the case outcome: close the case(s) opened for it. */
async function closeReviewCases(transferId: string, reference: string, approved: boolean, staffId: string, note: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const cases = await prisma.complianceCase.findMany({ where: { subjectType: 'REMITTANCE', subjectId: transferId, status: { not: 'CLOSED' } }, select: { id: true } });
  for (const c of cases) {
    await transitionCase({
      caseId: c.id, to: 'CLOSED', actorId: staffId, note: `Decided from the remittance review of ${reference}`,
      resolution: `Transfer ${approved ? 'approved' : 'rejected and refunded'} in review: ${note}`, req,
    }).catch((err) => logger.warn('[remittance] could not close review case', { caseId: c.id, err: (err as Error).message }));
  }
}

/** Operator retry of a failed or stuck payout (new route, new attempt). */
export async function retryPayout(transferId: string, staffId: string) {
  const t = await prisma.remittanceTransfer.findUnique({ where: { id: transferId } });
  if (!t) throw new AppError('Transfer not found', 404);
  if (t.state !== 'FAILED') throw new AppError(`Only failed transfers can be retried (this one is ${t.state})`, 409);
  await prisma.$transaction(async (tx) => { await route(tx, t.id, { type: 'STAFF', id: staffId }); });
  const fresh = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
  if (fresh.state === 'SETTLED') await submitPayout(t.id, { type: 'STAFF', id: staffId });
  return prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: t.id } });
}

/** Poll providers for payouts still in flight (status path; callbacks are the fast path). */
export async function pollPendingPayouts(limit = 100): Promise<number> {
  const pending = await prisma.remittancePayout.findMany({ where: { status: 'SUBMITTED' }, take: limit, orderBy: { submittedAt: 'asc' } });
  let applied = 0;
  for (const p of pending) {
    if (!p.providerRef) continue;
    try {
      const provider = getPayoutProvider(p.providerCode);
      const s = await callProvider(p.providerCode, 'status', () => provider.status(p.providerRef!), { entityType: 'REMITTANCE', entityId: p.transferId });
      if (s.status !== 'SUBMITTED') { await applyPayoutUpdate(p.id, s, { type: 'PROVIDER', id: p.providerCode }); applied++; }
    } catch (err) {
      logger.warn('[remittance] status poll failed', { payout: p.id, err: (err as Error).message });
    }
  }
  // PAID payouts can still be returned later by the beneficiary bank.
  const recentPaid = await prisma.remittancePayout.findMany({ where: { status: 'PAID', paidAt: { gte: new Date(Date.now() - 7 * 86400_000) }, providerCode: { startsWith: 'SANDBOX' } }, take: limit });
  for (const p of recentPaid) {
    try {
      const s = await getPayoutProvider(p.providerCode).status(p.providerRef!);
      if (s.status === 'RETURNED') { await applyPayoutUpdate(p.id, s, { type: 'PROVIDER', id: p.providerCode }); applied++; }
    } catch { /* next poll */ }
  }
  return applied;
}

/** Expire stale, never-funded transfers and expired quotes are simply ignored (immutable). */
export async function expireStale(): Promise<number> {
  const stale = await prisma.remittanceTransfer.findMany({ where: { state: { in: ['CREATED', 'QUOTED'] }, createdAt: { lt: new Date(Date.now() - 3600_000) } }, take: 200 });
  for (const t of stale) {
    await prisma.$transaction(async (tx) => transition(tx, { id: t.id, state: t.state, correlationId: t.correlationId }, 'EXPIRED', { actorType: 'SYSTEM', reason: 'Not completed within an hour' })).catch(() => undefined);
  }
  return stale.length;
}

let worker: NodeJS.Timeout | null = null;
export function startRemittanceWorker(intervalMs = Number(process.env.REMITTANCE_WORKER_MS ?? 15_000)) {
  if (worker) return;
  worker = setInterval(() => {
    void pollPendingPayouts().catch((e) => logger.error('[remittance] poll failed', { err: (e as Error).message }));
    void expireStale().catch(() => undefined);
  }, intervalMs);
  worker.unref?.();
  logger.info('[remittance] worker started');
}
