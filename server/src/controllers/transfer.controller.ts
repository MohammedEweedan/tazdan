import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { sendTransferSent, sendTransferReceived } from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';

// Internal-transfer accepts the same set as wallet creation, including
// the USDT on-chain variants. We normalise them to a single logical
// "USDT" before touching wallets — internal transfers don't move
// anything on-chain, so the user's TRC20/ERC20 split is irrelevant
// for chat payments. Without this normalisation, "send 10 USDT" from
// a sender who only holds USDT_TRC20 would fail with "USDT wallet
// not found" even though the funds exist.
const SUPPORTED_CURRENCIES = [
  'USDT', 'USDT_ERC20', 'USDT_TRC20',
  'USD', 'LYD', 'BTC', 'ETH', 'BNB', 'SOL',
  'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
] as const;

/** Returns the base symbol of any chained currency. e.g.
 *    USDT_TRC20 → USDT
 *    ETH_ERC20  → ETH
 *    BTC        → BTC
 *  The base is what we collapse to when we want the user-facing
 *  "logical asset" — the part of the symbol *before* the chain
 *  qualifier. Chain variants share a base and are treated as
 *  fungible for internal transfers. */
function baseOf(currency: string): string {
  const i = currency.indexOf('_');
  return i >= 0 ? currency.slice(0, i) : currency;
}

/** Returns all wallet-currency values that share a base with the
 *  requested currency.  Generalises the old USDT-only carveout so
 *  ANY base/chain pair (USDC + USDC_ERC20, ETH + ETH_ERC20, etc.)
 *  rolls up into a single logical balance. */
function variantsOf(currency: string): readonly string[] {
  const base = baseOf(currency);
  return SUPPORTED_CURRENCIES.filter((c) => baseOf(c) === base);
}

const transferSchema = z.object({
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  recipientUsername: z.string().min(3).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).default('USDT'),
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
}).refine(data => data.recipientEmail || data.recipientPhone || data.recipientUsername, {
  message: 'Recipient email, phone, or username is required',
});

export class TransferController {
  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = transferSchema.parse(req.body);
      // The currency the user is logically sending — collapse any
      // BASE_CHAIN variant to its BASE for fees, labels, and emails,
      // while looking up the actual wallet across every variant
      // below.
      const logicalCurrency = baseOf(data.currency);
      const variants = variantsOf(data.currency);

      // Find recipient by any of email / phone / profile username
      let recipient: any = null;
      if (data.recipientEmail) {
        recipient = await prisma.user.findFirst({ where: { email: data.recipientEmail } });
      } else if (data.recipientPhone) {
        recipient = await prisma.user.findFirst({ where: { phone: data.recipientPhone } });
      } else if (data.recipientUsername) {
        recipient = await prisma.user.findFirst({
          where: { username: data.recipientUsername.toLowerCase() },
        });
      }

      if (!recipient) throw new AppError('Recipient not found', 404);
      if (recipient.id === req.user!.id) throw new AppError('Cannot transfer to yourself', 400);
      if (recipient.status !== 'ACTIVE') throw new AppError('Recipient account is not active', 400);

      // Fee lookup (per-currency, with a sensible default)
      const feeKey = `transfer_fee_${logicalCurrency.toLowerCase()}`;
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: feeKey } });
      const fee = parseFloat(feeSetting?.value || '0');
      const totalDeducted = data.amount + fee;

      // Minimum amount sanity check (low dust for crypto, $1 for fiat-like)
      const MIN: Record<string, number> = { USDT: 1, USD: 1, LYD: 1 };
      const min = MIN[logicalCurrency] ?? 0.00001;
      if (data.amount < min) throw new AppError(`Minimum transfer is ${min} ${logicalCurrency}`, 400);

      const reference = generateReference('TRF');

      // Execute atomically — including the balance check.  Doing the
      // check outside the tx (the old behaviour) was a race: two
      // concurrent /transfer/send calls on the same wallet both saw
      // sufficient balance, both decremented, balance went negative.
      // We now re-fetch under the tx with row-locking semantics
      // (SERIALIZABLE isolation gives us that on Postgres) and
      // re-verify before any debit.
      let senderCurrencyOnRow: string = '';
      let senderBalanceBefore: number = 0;
      await prisma.$transaction(async (tx: any) => {
        // Re-read inside the tx; this is the source of truth.
        const senderVariants = await tx.wallet.findMany({
          where: { userId: req.user!.id, currency: { in: variants as any } },
        });
        const senderWallet = senderVariants
          .map((w: any) => ({
            w,
            available: parseFloat(w.balance.toString()) - parseFloat(w.frozen.toString()),
          }))
          .filter((row: any) => row.available >= totalDeducted)
          .sort((a: any, b: any) => b.available - a.available)[0]?.w;

        if (!senderWallet) {
          const aggregate = senderVariants.reduce((sum: number, w: any) => {
            return sum + parseFloat(w.balance.toString()) - parseFloat(w.frozen.toString());
          }, 0);
          if (senderVariants.length === 0) {
            throw new AppError(`${logicalCurrency} wallet not found`, 404);
          }
          throw new AppError(
            `Insufficient ${logicalCurrency} balance (have ${aggregate.toFixed(2)}, need ${totalDeducted.toFixed(2)})`,
            400,
          );
        }
        senderCurrencyOnRow = senderWallet.currency as string;
        senderBalanceBefore = parseFloat(senderWallet.balance.toString());

        await tx.wallet.update({
          where: { userId_currency: { userId: req.user!.id, currency: senderCurrencyOnRow as any } },
          data: { balance: { decrement: new Decimal(totalDeducted) } },
        });

        // Recipient: prefer the variant they already have (so we don't
        // sprout a duplicate empty wallet). Fall back to the first
        // variant in the canonical list if they have none.
        const recipientExisting = await tx.wallet.findMany({
          where: { userId: recipient.id, currency: { in: variants as any } },
          orderBy: { balance: 'desc' },
          take: 1,
        });
        const recipientCurrencyOnRow = recipientExisting[0]?.currency ?? variants[0];
        const recipientBalanceBefore = parseFloat(recipientExisting[0]?.balance.toString() || '0');

        await tx.wallet.upsert({
          where: { userId_currency: { userId: recipient.id, currency: recipientCurrencyOnRow as any } },
          update: { balance: { increment: new Decimal(data.amount) } },
          create: { userId: recipient.id, currency: recipientCurrencyOnRow as any, balance: data.amount },
        });

        await tx.transfer.create({
          data: {
            senderId: req.user!.id,
            receiverId: recipient.id,
            currency: logicalCurrency as any,
            amount: data.amount,
            fee,
            reference,
            note: data.note,
          },
        });

        await tx.transaction.createMany({
          data: [
            {
              userId: req.user!.id,
              type: 'TRANSFER_OUT',
              // Ledger rows record the *physical* wallet that moved —
              // even if the user thinks of it as USDT, the actual
              // balance change happened on USDT_TRC20 (or whichever
              // variant we found above). That keeps per-wallet
              // reconciliation honest.
              currency: senderCurrencyOnRow as any,
              amount: new Decimal(-totalDeducted),
              fee,
              balanceBefore: senderBalanceBefore,
              balanceAfter: senderBalanceBefore - totalDeducted,
              reference,
              // The description is user-facing — collapse to the
              // logical name so the activity feed reads "Sent 10 USDT"
              // not "Sent 10 USDT_TRC20".
              description: `Sent ${data.amount} ${logicalCurrency} to ${recipient.firstName}`,
            },
            {
              userId: recipient.id,
              type: 'TRANSFER_IN',
              currency: recipientCurrencyOnRow as any,
              amount: new Decimal(data.amount),
              fee: 0,
              balanceBefore: recipientBalanceBefore,
              balanceAfter: recipientBalanceBefore + data.amount,
              reference,
              description: `Received ${data.amount} ${logicalCurrency} from transfer`,
            },
          ],
        });

        await tx.notification.create({
          data: {
            userId: recipient.id,
            title: `${logicalCurrency} received`,
            message: `You received ${data.amount} ${logicalCurrency}. Ref: ${reference}`,
            type: 'transfer',
          },
        });
      }, {
        // SERIALIZABLE is the strongest isolation Postgres offers and
        // is what we need here: it forces the balance re-read above
        // to be linearisable so two concurrent transfers on the same
        // wallet can't both observe the pre-debit balance.  Conflicts
        // surface as a P2002/40001 error and the caller can retry.
        isolationLevel: 'Serializable',
      });

      // Fire-and-forget transactional confirmations — never block the
      // response, never throw. Sender gets a "sent" copy, recipient gets
      // a "received" copy. Both go out by email + push in parallel.
      const senderId  = req.user!.id;
      // NEVER fall back to email.split('@')[0] for handles — that text
      // ends up inside emails the counterparty receives, leaking the
      // other side's address local-part. Prefer username, then first
      // name, then a generic label.
      const senderHandle    =
        (req.user as any)?.username
        || (req.user as any)?.firstName
        || 'a tazdan user';
      const recipientHandle =
        recipient.username
        || recipient.firstName
        || 'a tazdan user';
      const fmtAmt = data.amount.toFixed(8).replace(/\.?0+$/, '');
      (async () => {
        try {
          const senderUser = await prisma.user.findUnique({
            where: { id: senderId },
            select: { email: true, firstName: true, notificationPrefs: true as any },
          });
          const senderPrefs = (senderUser as any)?.notificationPrefs ?? {};
          const recipPrefs  = (recipient as any).notificationPrefs ?? {};

          if (senderUser && senderPrefs?.email?.transfers !== false) {
            await sendTransferSent({
              to: senderUser.email,
              firstName: senderUser.firstName || 'there',
              recipientHandle,
              asset: logicalCurrency,
              amount: fmtAmt,
              note: data.note,
              transferId: reference,
            });
          }
          if (senderPrefs?.push?.transfers !== false) {
            await pushTxEvent(senderId, pushCopy.sent(fmtAmt, logicalCurrency, recipientHandle), reference);
          }
          if (recipient.email && recipPrefs?.email?.transfers !== false) {
            await sendTransferReceived({
              to: recipient.email,
              firstName: recipient.firstName || 'there',
              senderHandle,
              asset: logicalCurrency,
              amount: fmtAmt,
              note: data.note,
              transferId: reference,
            });
          }
          if (recipPrefs?.push?.transfers !== false) {
            await pushTxEvent(recipient.id, pushCopy.received(fmtAmt, logicalCurrency, senderHandle), reference);
          }
        } catch (err) {
          logger.warn('[transfer.send] post-commit notify failed', { senderId, recipientId: recipient.id, err });
        }
      })();

      res.status(201).json({
        message: 'Transfer successful',
        transfer: {
          // User-facing — collapse to the logical name.
          currency: logicalCurrency,
          // Surface which on-chain variant we actually debited so the
          // client can refresh the right wallet card. Same logical
          // currency, but tells the UI whether to re-fetch USDT_TRC20
          // or USDT_ERC20 specifically.
          settledFromCurrency: senderCurrencyOnRow,
          amount: data.amount,
          fee,
          total: totalDeducted,
          reference,
          recipient: { firstName: recipient.firstName, lastName: recipient.lastName },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [sent, received, totalSent, totalReceived] = await Promise.all([
        prisma.transfer.findMany({
          where: { senderId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { receiver: { select: { firstName: true, lastName: true, email: true } } },
        }),
        prisma.transfer.findMany({
          where: { receiverId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { sender: { select: { firstName: true, lastName: true, email: true } } },
        }),
        prisma.transfer.count({ where: { senderId: req.user!.id } }),
        prisma.transfer.count({ where: { receiverId: req.user!.id } }),
      ]);

      res.json({ sent, received, totalSent, totalReceived, page });
    } catch (error) {
      next(error);
    }
  }
}
