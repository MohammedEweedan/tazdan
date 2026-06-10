import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { getOnRampProvider } from '../services/onramp';
import { processDeposit } from '../services/wallet/onchainSettlement.service';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { postLedger, isLedgerCurrency } from '../services/ledger/ledger.service';
import { Currency } from '@prisma/client';
import type { RampPaymentMethod, RampProvider } from '@prisma/client';
import { sendDepositConfirmed } from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';

const depositSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'USDT', 'LYD', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']),
  amount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER']),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  senderName: z.string().optional(),
  notes: z.string().optional(),
});

const FIAT_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD']);

export class DepositController {
  /**
   * Create a new deposit.
   * USD/USDT deposits via bank transfer or cash deposit
   * remain pending for admin review.
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body, amount: parseFloat(req.body.amount) };
      const data = depositSchema.parse(body);

      // KYC gate: fiat deposits require APPROVED KYC status
      if (FIAT_CURRENCIES.has(data.currency)) {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true } });
        if (user?.kycStatus !== 'APPROVED') {
          res.status(403).json({ error: 'KYC verification required for fiat deposits' });
          return;
        }
      }

      const settings = await prisma.platformSettings.findUnique({
        where: { key: data.currency === 'USDT' ? 'min_deposit_usdt' : 'min_deposit_usd' },
      });
      const minDeposit = parseFloat(settings?.value || '0');
      if (data.amount < minDeposit) throw new AppError(`Minimum deposit is ${minDeposit} ${data.currency}`, 400);

      const reference = generateReference('DEP');
      const file = req.file as Express.Multer.File | undefined;

      // Create deposit with WAITING_CONFIRMATION status for manual confirmation
      const deposit = await prisma.deposit.create({
        data: {
          userId: req.user!.id,
          currency: data.currency as Currency,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reference,
          proofImageUrl: file ? `/uploads/${file.filename}` : undefined,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          senderName: data.senderName,
          notes: data.notes,
          status: 'WAITING_CONFIRMATION' as any,
        },
      });

      res.status(201).json({ deposit });
    } catch (error) {
      next(error);
    }
  }

  // Admin-only — see routes/deposit.ts. The depositor must NEVER call
  // this themselves; an admin verifies the wire actually landed in our
  // bank account before releasing the credit.
  static async confirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      // Look up by id alone; the admin is confirming someone else's
      // pending deposit.  Scoping to req.user.id (the old behaviour)
      // was the original bug — it made the route safe ONLY for the
      // depositor, who was also the attacker.
      const deposit = await prisma.deposit.findUnique({ where: { id } });

      if (!deposit) throw new AppError('Deposit not found', 404);
      if (deposit.status !== 'WAITING_CONFIRMATION') {
        throw new AppError('Deposit is not waiting for confirmation', 400);
      }

      const depositorId = deposit.userId;
      const adminId     = req.user!.id;

      await prisma.$transaction(async (tx) => {
        // Idempotency guard inside the tx — re-check status under the
        // row lock so two admins clicking confirm at the same time
        // can't double-credit.
        const fresh = await tx.deposit.findUnique({ where: { id: deposit.id } });
        if (!fresh || fresh.status !== 'WAITING_CONFIRMATION') {
          throw new AppError('Deposit already processed', 409);
        }

        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            adminNotes: fresh.adminNotes
              ? `${fresh.adminNotes}\nConfirmed by admin ${adminId} at ${new Date().toISOString()}`
              : `Confirmed by admin ${adminId} at ${new Date().toISOString()}`,
          },
        });

        // Credit the DEPOSITOR's wallet, not the admin's.
        const wallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: depositorId, currency: deposit.currency } },
        });
        const balanceBefore = parseFloat(wallet?.balance.toString() || '0');

        await tx.wallet.upsert({
          where:  { userId_currency: { userId: depositorId, currency: deposit.currency } },
          update: { balance: { increment: deposit.amount } },
          create: { userId: depositorId, currency: deposit.currency, balance: deposit.amount },
        });

        // Ledger mirror: money enters from the external on-ramp into the user.
        if (isLedgerCurrency(deposit.currency)) {
          await postLedger(tx, {
            refType: 'deposit', refId: deposit.id, memo: `Deposit ${deposit.currency}`,
            legs: [
              { type: 'SYSTEM_ONRAMP', currency: deposit.currency as any, amount: new Decimal(deposit.amount.toString()).neg() },
              { type: 'USER', userId: depositorId, currency: deposit.currency as any, amount: new Decimal(deposit.amount.toString()) },
            ],
          });
        }

        await tx.transaction.create({
          data: {
            userId: depositorId,
            type: 'DEPOSIT',
            currency: deposit.currency,
            amount: deposit.amount,
            balanceBefore,
            balanceAfter: new (require('decimal.js'))(balanceBefore.toString()).add(deposit.amount).toString(),
            reference: deposit.reference,
            description: `Bank transfer deposit confirmed`,
          },
        });

        await tx.notification.create({
          data: {
            userId: depositorId,
            title: 'Deposit Confirmed',
            message: `Your deposit of ${deposit.amount} ${deposit.currency} has been confirmed and credited to your account.`,
            type: 'deposit',
          },
        });
      });

      res.json({ message: 'Deposit confirmed and credited' });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const currency = req.query.currency as string | undefined;

      const where: any = { userId: req.user!.id };
      if (status) where.status = status;
      if (currency) where.currency = currency.toUpperCase();

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.deposit.count({ where }),
      ]);
      res.json({ deposits, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!deposit) throw new AppError('Deposit not found', 404);
      res.json({ deposit });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!deposit) throw new AppError('Deposit not found', 404);
      if (deposit.status !== 'PENDING') throw new AppError('Only pending deposits can be cancelled', 400);

      await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'CANCELLED' } });
      res.json({ message: 'Deposit cancelled' });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMethods(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const provider = (process.env.ONRAMP_PROVIDER || 'MOCK').toUpperCase();
      const paymentMethods = [
        {
          id: 'BANK_TRANSFER',
          name: 'Bank Transfer',
          description: 'Direct bank wire transfer',
          currencies: ['USD', 'USDT', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'],
          instant: false,
          processingTime: '1-3 business days',
          provider: 'MANUAL',
        },
        {
          id: 'CARD',
          name: 'Debit / Credit Card',
          description: 'Pay with Visa, Mastercard, Apple Pay, Google Pay',
          currencies: ['USD', 'EUR', 'GBP', 'AED'],
          instant: true,
          processingTime: 'Instant',
          provider,
          enabled: provider !== 'MOCK' || process.env.NODE_ENV !== 'production',
        },
      ];
      res.json({ paymentMethods });
    } catch (error) {
      next(error);
    }
  }

  // ── Gateway-driven (card / Apple Pay / Google Pay via Stripe) ──────
  //
  // Flow:
  //   1. POST /api/deposits/gateway/quote  → returns a quote.
  //   2. POST /api/deposits/gateway/confirm → creates a PaymentIntent
  //      at the provider, returns client_secret for the mobile SDK.
  //   3. POST /api/deposits/webhook/:provider → provider POSTs final
  //      status. We verify signature and credit the wallet.
  //
  // Funds are NEVER credited from the confirm step — only from the
  // signed webhook. A user who hits "back" mid-payment cannot trick
  // us into crediting them.

  static async gatewayQuote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        fiatCurrency: z.string().min(3).max(4),
        fiatAmount: z.number().positive(),
        cryptoCurrency: z.string().min(3).max(8).default('USDT'),
        paymentMethod: z.string().default('CARD'),
      }).parse(req.body);

      const provider = getOnRampProvider();
      const quote = await provider.quote({
        fiatCurrency: body.fiatCurrency.toUpperCase() as Currency,
        fiatAmount: body.fiatAmount,
        cryptoCurrency: body.cryptoCurrency.toUpperCase() as Currency,
        paymentMethod: body.paymentMethod.toUpperCase() as RampPaymentMethod,
        userId: req.user!.id,
        userIp: req.ip,
      });
      res.json({ quote, providerName: provider.name });
    } catch (e) { next(e); }
  }

  static async gatewayConfirm(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        providerRef: z.string().min(1),
        fiatCurrency: z.string().min(3).max(4),
        fiatAmount: z.number().positive(),
        cryptoCurrency: z.string().min(3).max(8),
        idempotencyKey: z.string().min(8).max(128).optional(),
      }).parse(req.body);

      const provider = getOnRampProvider();
      const reference = generateReference('ONR');

      // Persist the intent BEFORE calling the provider so we can
      // correlate the webhook even if the response is lost in flight.
      const txn = await prisma.onRampTransaction.create({
        data: {
          userId: req.user!.id,
          provider: provider.name as RampProvider,
          providerRef: body.providerRef,
          reference,
          fiatCurrency: body.fiatCurrency.toUpperCase() as Currency,
          fiatAmount: body.fiatAmount,
          cryptoCurrency: body.cryptoCurrency.toUpperCase() as Currency,
          cryptoAmount: 0,                 // updated by webhook
          exchangeRate: 0,                 // updated when quote refreshed
          feeCurrency: body.fiatCurrency.toUpperCase() as Currency,
          paymentMethod: 'CARD',
          status: 'PENDING',
        },
      });

      const result = await provider.confirm({
        providerRef: body.providerRef,
        // For Stripe we tunnel the amount + currency here.
        paymentToken: JSON.stringify({
          amountCents: Math.round(body.fiatAmount * 100),
          currency: body.fiatCurrency,
          idempotencyKey: body.idempotencyKey,
        }),
      });

      await prisma.onRampTransaction.update({
        where: { id: txn.id },
        data: { providerRef: result.providerRef, status: result.status },
      });

      res.json({
        transactionId: txn.id,
        provider: provider.name,
        status: result.status,
        redirectUrl: result.redirectUrl,
      });
    } catch (e) { next(e); }
  }

  /**
   * Webhook entry point. Mounted with express.raw() so we have the
   * exact bytes Stripe signed.
   */
  static async webhookStripe(req: Request, res: Response, next: NextFunction) {
    try {
      const provider = getOnRampProvider();
      if (provider.name !== 'STRIPE') {
        // Always 200 unknown providers — Stripe will mark the endpoint
        // as failing otherwise and disable it.
        return res.status(200).json({ ok: false, reason: 'provider-not-active' });
      }
      const rawBody = (req.body as Buffer).toString('utf8');
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers[k.toLowerCase()] = v;
      }
      const event = await provider.parseWebhook(headers, rawBody);

      // Idempotent: update the on-ramp transaction, and on COMPLETED
      // credit the user wallet exactly once.
      const txn = await prisma.onRampTransaction.findFirst({
        where: { providerRef: event.providerRef },
      });
      if (!txn) {
        // Stripe will retry — return 200 anyway, the txn may not be
        // created yet if confirm() raced the webhook.
        return res.status(200).json({ ok: true, reason: 'unknown-ref' });
      }
      if (txn.status === 'COMPLETED' && event.status === 'COMPLETED') {
        return res.json({ ok: true, idempotent: true });
      }

      await prisma.$transaction(async (tx) => {
        await tx.onRampTransaction.update({
          where: { id: txn.id },
          data: { status: event.status },
        });
        if (event.status === 'COMPLETED' && txn.status !== 'COMPLETED') {
          // Credit the fiat wallet.
          await tx.wallet.upsert({
            where: { userId_currency: { userId: txn.userId, currency: txn.fiatCurrency } },
            create: { userId: txn.userId, currency: txn.fiatCurrency, balance: txn.fiatAmount },
            update: { balance: { increment: txn.fiatAmount } },
          });
          // Ledger mirror: external card/bank on-ramp → user.
          if (isLedgerCurrency(txn.fiatCurrency)) {
            await postLedger(tx, {
              refType: 'deposit', refId: txn.id, memo: `On-ramp ${txn.fiatCurrency}`,
              legs: [
                { type: 'SYSTEM_ONRAMP', currency: txn.fiatCurrency as any, amount: new Decimal(txn.fiatAmount.toString()).neg() },
                { type: 'USER', userId: txn.userId, currency: txn.fiatCurrency as any, amount: new Decimal(txn.fiatAmount.toString()) },
              ],
            });
          }
          const balance = await tx.wallet.findUnique({
            where: { userId_currency: { userId: txn.userId, currency: txn.fiatCurrency } },
          });
          await tx.transaction.create({
            data: {
              userId: txn.userId,
              type: 'DEPOSIT',
              currency: txn.fiatCurrency,
              amount: txn.fiatAmount,
              balanceBefore: balance ? new (require('decimal.js'))(balance.balance.toString()).sub(txn.fiatAmount).toString() : '0',
              balanceAfter:  balance ? balance.balance.toString() : '0',
              reference: txn.providerRef,
              description: `Card deposit via ${provider.name}`,
            },
          });
          await tx.notification.create({
            data: {
              userId: txn.userId,
              title: 'Deposit confirmed',
              message: `${txn.fiatAmount} ${txn.fiatCurrency} credited via card.`,
              type: 'deposit',
            },
          });
        }
      });

      // Transactional email + push (fiat card deposit). Fire-and-forget.
      if (event.status === 'COMPLETED' && txn.status !== 'COMPLETED') {
        (async () => {
          try {
            const u = await prisma.user.findUnique({
              where: { id: txn.userId },
              select: { email: true, firstName: true, notificationPrefs: true as any },
            });
            if (!u) return;
            const prefs = (u as any).notificationPrefs ?? {};
            const amt = txn.fiatAmount.toString().replace(/\.?0+$/, '');
            if (prefs?.email?.deposits !== false) {
              await sendDepositConfirmed({
                to: u.email, firstName: u.firstName || 'there',
                asset: txn.fiatCurrency, amount: amt,
                txHash: txn.providerRef ?? txn.id,
              });
            }
            if (prefs?.push?.deposits !== false) {
              await pushTxEvent(txn.userId, pushCopy.depositOn(amt, txn.fiatCurrency), txn.providerRef ?? txn.id);
            }
          } catch (err) {
            logger.warn('[deposit.webhookStripe] post-fill notify failed', { userId: txn.userId, err });
          }
        })();
      }

      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  /**
   * Alchemy webhook — EVM on-chain deposits (ETH / USDT-ERC20).
   *
   * Alchemy sends an HMAC-SHA256 signature in the X-Alchemy-Signature
   * header, computed over the raw request body using the signing key
   * you configure in the Alchemy dashboard
   * (ALCHEMY_WEBHOOK_SIGNING_KEY env var).
   *
   * Mounted with express.raw() to preserve exact bytes for HMAC.
   */
  static async webhookAlchemy(req: Request, res: Response, next: NextFunction) {
    try {
      const rawBody = (req.body as Buffer).toString('utf8');
      const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;

      // Fail closed: an unsigned deposit webhook in production is an open
      // invitation to credit forged deposits. (Chain verification in
      // processDeposit is the backstop, but defense-in-depth is free here.)
      if (!signingKey && process.env.NODE_ENV === 'production') {
        logger.error('[webhook:alchemy] ALCHEMY_WEBHOOK_SIGNING_KEY not set — rejecting');
        return res.status(503).json({ error: 'Webhook not configured' });
      }

      if (signingKey) {
        const sig = req.headers['x-alchemy-signature'] as string | undefined;
        if (!sig) {
          logger.warn('[webhook:alchemy] missing signature header');
          return res.status(401).json({ error: 'Missing signature' });
        }
        const expected = crypto
          .createHmac('sha256', signingKey)
          .update(rawBody)
          .digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          logger.warn('[webhook:alchemy] invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const payload = JSON.parse(rawBody);
      // Alchemy Activity webhook shape: { event: { activity: [...] } }
      const activities = payload?.event?.activity ?? payload?.activity ?? [];

      for (const act of activities) {
        try {
          const asset: string = act.asset ?? (act.rawContract?.address ? 'USDT' : 'ETH');
          const network = asset === 'ETH' ? 'ETH' : 'ERC20';
          const amount: string = act.value?.toString() ?? '0';
          const toAddress: string = act.toAddress ?? act.to ?? '';
          const fromAddress: string = act.fromAddress ?? act.from ?? '';
          const txHash: string = act.hash ?? act.transactionHash ?? '';
          const confirmations: number = act.confirmations ?? 1;

          if (!txHash || !toAddress || parseFloat(amount) <= 0) continue;

          await processDeposit({ txHash, asset, network, toAddress, fromAddress, amount, confirmations });
        } catch (actErr) {
          logger.warn('[webhook:alchemy] activity error', { err: actErr, act });
        }
      }

      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  /**
   * Trongrid webhook — TRC-20 USDT deposits.
   *
   * Trongrid uses an API-key header (TRON_WEBHOOK_API_KEY) rather than
   * HMAC. The key is configured in your Trongrid event subscription.
   */
  static async webhookTrongrid(req: Request, res: Response, next: NextFunction) {
    try {
      const apiKey = process.env.TRON_WEBHOOK_API_KEY;
      // Fail closed in production — see webhookAlchemy above.
      if (!apiKey && process.env.NODE_ENV === 'production') {
        logger.error('[webhook:trongrid] TRON_WEBHOOK_API_KEY not set — rejecting');
        return res.status(503).json({ error: 'Webhook not configured' });
      }
      if (apiKey) {
        const provided = req.headers['x-api-key'] as string | undefined;
        if (!provided || provided !== apiKey) {
          logger.warn('[webhook:trongrid] invalid API key');
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      const rawBody = (req.body as Buffer).toString('utf8');
      const payload = JSON.parse(rawBody);
      // Trongrid shape: { contractData: { owner_address, to_address, amount }, transaction_id, ... }
      const events = Array.isArray(payload) ? payload : [payload];

      for (const evt of events) {
        try {
          const txHash: string = evt.transaction_id ?? evt.txID ?? '';
          const toAddress: string = evt.contractData?.to_address ?? evt.to_address ?? '';
          const fromAddress: string = evt.contractData?.owner_address ?? evt.from_address ?? '';
          // Trongrid amount is in SUN (1 TRX = 1e6 SUN); for TRC-20 USDT it's in 1e6 units
          const rawAmount: number = evt.contractData?.amount ?? evt.amount ?? 0;
          const amount = (rawAmount / 1_000_000).toFixed(6);

          if (!txHash || !toAddress || parseFloat(amount) <= 0) continue;

          await processDeposit({ txHash, asset: 'USDT', network: 'TRC20', toAddress, fromAddress, amount, confirmations: 20 });
        } catch (evtErr) {
          logger.warn('[webhook:trongrid] event error', { err: evtErr });
        }
      }

      res.json({ ok: true });
    } catch (e) { next(e); }
  }
}
