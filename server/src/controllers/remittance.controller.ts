/**
 * Customer remittance API and provider callbacks.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import type { AuthRequest } from '../types';
import { createQuote } from '../services/remittance/pricing';
import { cancelTransfer, createBeneficiary, createTransfer, applyPayoutUpdate } from '../services/remittance/remittance.service';
import { listTransitions } from '../services/platform/lifecycle';
import { deviceFingerprint, enforceRiskBasedStepUp, isKnownDevice } from '../services/security/stepUp.service';
import { getPayoutProvider } from '../services/providers/registry';
import { recordSecurityEvent } from '../services/platform/securityEvents';
import { usdRate } from '../utils/kycLimits';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND', 'USDT'] as const;

const beneficiarySchema = z.object({
  fullName: z.string().trim().min(3).max(140),
  relationship: z.string().trim().max(60).optional(),
  country: z.string().length(2),
  currency: z.enum(CURRENCIES),
  payoutMethod: z.enum(['BANK_ACCOUNT', 'MOBILE_WALLET', 'CASH_PICKUP', 'TAZDAN_WALLET']),
  bankName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(40).optional(),
  iban: z.string().trim().max(40).optional(),
  sortCode: z.string().trim().max(10).optional(),
  swift: z.string().trim().max(11).optional(),
  mobileWallet: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  addressLine: z.string().trim().max(200).optional(),
  tazdanHandle: z.string().trim().max(40).optional(),
});

/**
 * Fixed customer wording per state. Internal reasons (risk rules, compliance
 * decisions, provider error text) never reach the customer: a rejected-then-
 * refunded transfer must not reveal that it was a compliance decision.
 */
function customerReason(state: string): string | null {
  switch (state) {
    case 'REJECTED': return 'This transfer could not be completed. Contact support for details.';
    case 'FAILED': return 'The payout is delayed. We are retrying it, or we will return your money.';
    case 'REFUND_PENDING': return 'Your money is on its way back to your wallet.';
    case 'REFUNDED': return 'The full amount, including the fee, was returned to your wallet.';
    case 'DISPUTED': return 'We are looking into this payment with the payout partner.';
    default: return null;
  }
}

/** Customer label for a state (matches the mobile app's wording). */
function customerStatus(state: string): string {
  if (['PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED'].includes(state)) return 'Delivered';
  const fixed: Record<string, string> = { REFUNDED: 'Refunded', REFUND_PENDING: 'Refund in progress', CANCELLED: 'Cancelled', EXPIRED: 'Expired', REJECTED: 'Not completed', FAILED: 'Delayed', DISPUTED: 'Under investigation' };
  return fixed[state] ?? 'Processing';
}

const publicTransfer = (t: any) => ({
  id: t.id, reference: t.reference, state: t.state, status: customerStatus(t.state), sourceCurrency: t.sourceCurrency, destCurrency: t.destCurrency,
  sendAmount: t.sendAmount, feeAmount: t.feeAmount, totalDebit: t.totalDebit, customerRate: t.customerRate, receiveAmount: t.receiveAmount,
  purpose: t.purpose, createdAt: t.createdAt, paidAt: t.paidAt, completedAt: t.completedAt, refundedAt: t.refundedAt,
  failureReason: customerReason(t.state),
  corridor: t.corridor ? { code: t.corridor.code, name: t.corridor.name, status: t.corridor.status } : undefined,
  beneficiary: t.beneficiary ? { id: t.beneficiary.id, fullName: t.beneficiary.fullName, country: t.beneficiary.country, payoutMethod: t.beneficiary.payoutMethod } : undefined,
  sandbox: t.corridor ? t.corridor.status !== 'LIVE' : undefined,
});

export const RemittanceController = {
  async corridors(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await prisma.remittanceCorridor.findMany({ orderBy: { code: 'asc' } });
      const prod = process.env.NODE_ENV === 'production';
      res.json({
        corridors: rows.map((c) => ({
          code: c.code, name: c.name, sourceCurrency: c.sourceCurrency, destCurrency: c.destCurrency, destCountry: c.destCountry,
          direction: c.direction, status: c.status, available: c.status === 'LIVE' || (!prod && c.status === 'SANDBOX_ONLY'),
          sandbox: c.status !== 'LIVE', minAmount: c.minAmount, maxAmount: c.maxAmount, payoutMethods: c.payoutMethods, purposes: c.allowedPurposes,
          quoteTtlSeconds: c.quoteTtlSeconds,
        })),
      });
    } catch (e) { next(e); }
  },

  async listBeneficiaries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await prisma.remittanceBeneficiary.findMany({ where: { userId: req.user!.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
      res.json({ beneficiaries: rows.map(({ screeningStatus: _s, tazdanUserId: _t, ...b }) => b) });
    } catch (e) { next(e); }
  },

  async addBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = beneficiarySchema.parse(req.body);
      const b = await createBeneficiary(req.user!.id, body);
      const { screeningStatus: _s, tazdanUserId: _t, ...pub } = b;
      res.status(201).json({ beneficiary: pub });
    } catch (e) { next(e); }
  },

  async archiveBeneficiary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const r = await prisma.remittanceBeneficiary.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { status: 'ARCHIVED' } });
      if (!r.count) throw new AppError('Beneficiary not found', 404);
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async quote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        corridorCode: z.string().min(4).max(10),
        sendAmount: z.union([z.number().positive(), z.string()]).optional(),
        receiveAmount: z.union([z.number().positive(), z.string()]).optional(),
        payoutMethod: z.string().optional(),
        beneficiaryId: z.string().optional(),
      }).parse(req.body);
      let beneficiaryCountry: string | undefined;
      let payoutMethod = body.payoutMethod;
      if (body.beneficiaryId) {
        const b = await prisma.remittanceBeneficiary.findFirst({ where: { id: body.beneficiaryId, userId: req.user!.id } });
        if (!b) throw new AppError('Beneficiary not found', 404);
        beneficiaryCountry = b.payoutMethod === 'TAZDAN_WALLET' ? undefined : b.country;
        payoutMethod = b.payoutMethod;
      }
      const q = await createQuote({ userId: req.user!.id, corridorCode: body.corridorCode, sendAmount: body.sendAmount, receiveAmount: body.receiveAmount, payoutMethod, beneficiaryCountry });
      const best = q.routes.find((r) => r.eligible && r.rank === 1);
      res.status(201).json({
        quote: {
          id: q.quote.id, corridor: q.corridor, sendAmount: q.quote.sendAmount, feeAmount: q.quote.feeAmount, totalDebit: q.quote.totalDebit,
          customerRate: q.quote.customerRate, receiveAmount: q.quote.receiveAmount, expiresAt: q.quote.expiresAt,
          estimatedDeliveryMinutes: best?.estimatedDeliveryMins ?? null, payoutAvailable: Boolean(best), sandbox: q.sandbox,
        },
      });
    } catch (e) { next(e); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        quoteId: z.string().min(10),
        beneficiaryId: z.string().min(10),
        purpose: z.string().min(3).max(40),
        sourceOfFunds: z.string().trim().max(300).optional(),
        idempotencyKey: z.string().min(8).max(128).optional(),
        stepUpCode: z.string().regex(/^\d{6}$/).optional(),
        biometricVerified: z.boolean().optional(),
      }).parse(req.body);
      const quote = await prisma.remittanceQuote.findFirst({ where: { id: body.quoteId, userId: req.user!.id } });
      if (!quote) throw new AppError('Quote not found', 404);
      const valueUsd = Number(quote.totalDebit) * (await usdRate(quote.sourceCurrency));
      await enforceRiskBasedStepUp({ userId: req.user!.id, action: 'transfer', valueUsd, req, code: body.stepUpCode, biometricVerified: body.biometricVerified === true });
      const fp = deviceFingerprint(req);
      const result = await createTransfer({
        userId: req.user!.id, quoteId: body.quoteId, beneficiaryId: body.beneficiaryId, purpose: body.purpose,
        sourceOfFunds: body.sourceOfFunds, idempotencyKey: body.idempotencyKey,
        knownDevice: await isKnownDevice(req.user!.id, fp), deviceFingerprint: fp,
      });
      const t = await prisma.remittanceTransfer.findUniqueOrThrow({ where: { id: result.transfer.id }, include: { corridor: true, beneficiary: true } });
      res.status(result.duplicate ? 200 : 201).json({ transfer: publicTransfer(t), duplicate: result.duplicate });
    } catch (e) { next(e); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await prisma.remittanceTransfer.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { corridor: true, beneficiary: true } });
      res.json({ transfers: rows.map(publicTransfer) });
    } catch (e) { next(e); }
  },

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const t = await prisma.remittanceTransfer.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { corridor: true, beneficiary: true } });
      if (!t) throw new AppError('Transfer not found', 404);
      const timeline = (await listTransitions('REMITTANCE', t.id)).map((x) => ({ state: x.toState, at: x.createdAt }));
      res.json({ transfer: publicTransfer(t), timeline });
    } catch (e) { next(e); }
  },

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const t = await cancelTransfer(req.user!.id, req.params.id);
      res.json({ transfer: publicTransfer(t) });
    } catch (e) { next(e); }
  },

  async receipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const t = await prisma.remittanceTransfer.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { corridor: true, beneficiary: true, user: { select: { firstName: true, lastName: true } } } });
      if (!t) throw new AppError('Transfer not found', 404);
      res.json({
        receipt: {
          reference: t.reference, issuedAt: new Date(), status: customerStatus(t.state),
          sender: `${t.user.firstName} ${t.user.lastName}`, beneficiary: t.beneficiary.fullName, beneficiaryCountry: t.beneficiary.country,
          corridor: t.corridor.name, youSent: `${t.sendAmount} ${t.sourceCurrency}`, fee: `${t.feeAmount} ${t.sourceCurrency}`,
          totalPaid: `${t.totalDebit} ${t.sourceCurrency}`, exchangeRate: `1 ${t.sourceCurrency} = ${t.customerRate} ${t.destCurrency}`,
          recipientGets: `${t.receiveAmount} ${t.destCurrency}`, purpose: t.purpose, paidAt: t.paidAt, createdAt: t.createdAt,
          notice: t.corridor.status !== 'LIVE' ? 'SANDBOX — this corridor is not live; no real money was paid out.' : null,
        },
      });
    } catch (e) { next(e); }
  },

  /** Signed provider callback. The adapter verifies the signature over the raw body. */
  async webhook(req: Request & { rawBody?: string }, res: Response, next: NextFunction) {
    try {
      const code = req.params.providerCode.toUpperCase();
      const provider = getPayoutProvider(code);
      if (!provider.parseCallback) throw new AppError('Provider does not send callbacks', 404);
      let parsed;
      try {
        parsed = await provider.parseCallback(req.headers as Record<string, string | undefined>, req.rawBody ?? JSON.stringify(req.body ?? {}));
      } catch (err) {
        void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: 'HIGH', ipAddress: req.ip, path: req.originalUrl, details: { provider: code, reason: (err as Error).message } });
        throw new AppError('Invalid callback signature', 401);
      }
      const payout = await prisma.remittancePayout.findFirst({ where: { providerCode: code, providerRef: parsed.providerRef } });
      if (!payout) return res.status(202).json({ ok: true, matched: false });
      await applyPayoutUpdate(payout.id, { status: parsed.status, failureReason: parsed.failureReason, raw: parsed.raw }, { type: 'PROVIDER', id: code });
      res.json({ ok: true, matched: true });
    } catch (e) { next(e); }
  },
};
