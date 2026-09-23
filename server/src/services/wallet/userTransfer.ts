/**
 * User-to-user balance moves for the three places a balance can live:
 *   - the `Wallet` table (fiat, USDT and other enum currencies),
 *   - a dedicated `UserWallet` column (ETH/BTC/SOL/USDT_ERC20/USDT_TRC20),
 *   - the `UserWallet.altBalances` JSON map (long-tail coins).
 *
 * Each move runs inside the caller's transaction and never reads a balance
 * it then overwrites without a lock: the Wallet path checks and debits in one
 * statement, and the UserWallet paths lock both rows (in a fixed order)
 * before reading. Amounts must be positive; there is no fee here — callers
 * that charge one post it separately.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../middleware/errorHandler';
import { debitAvailable, lockUserWallets, lockWallets, parsePositiveAmount } from './atomicWallet';

type Tx = Prisma.TransactionClient;

export interface MoveResult {
  senderBalBefore: Decimal;
  senderBalAfter: Decimal;
  receiverBalBefore: Decimal;
  receiverBalAfter: Decimal;
}

export const USER_WALLET_COLUMNS = {
  ETH: 'ethBalance',
  BTC: 'btcBalance',
  SOL: 'solBalance',
  USDT_ERC20: 'usdtErc20Bal',
  USDT_TRC20: 'usdtTrc20Bal',
} as const;
export type UserWalletColumn = (typeof USER_WALLET_COLUMNS)[keyof typeof USER_WALLET_COLUMNS];

const dec = (v: unknown) => new Decimal((v ?? 0).toString());

/** Move a Wallet-table balance. The receiver's row is created if missing. */
export async function moveWalletBalance(
  tx: Tx, senderId: string, receiverId: string, currency: string, amount: unknown,
): Promise<MoveResult> {
  const amt = parsePositiveAmount(amount);
  const where = (userId: string) => ({ userId_currency: { userId, currency: currency as any } });

  // Lock both existing rows in a fixed order first, so two transfers in
  // opposite directions between the same users cannot deadlock.
  await lockWallets(tx, [senderId, receiverId], currency);
  await debitAvailable(tx, senderId, currency, amt);
  const receiver = await tx.wallet.upsert({
    where: where(receiverId),
    create: { userId: receiverId, currency: currency as any, balance: new Prisma.Decimal(amt.toFixed()), frozen: 0 },
    update: { balance: { increment: new Prisma.Decimal(amt.toFixed()) } },
  });
  const sender = await tx.wallet.findUniqueOrThrow({ where: where(senderId) });

  const senderBalAfter = dec(sender.balance);
  const receiverBalAfter = dec(receiver.balance);
  return {
    senderBalBefore: senderBalAfter.plus(amt),
    senderBalAfter,
    receiverBalBefore: receiverBalAfter.minus(amt),
    receiverBalAfter,
  };
}

/** Move a balance held in one of the dedicated UserWallet crypto columns. */
export async function moveUserWalletColumn(
  tx: Tx, senderId: string, receiverId: string, column: UserWalletColumn, asset: string, amount: unknown,
): Promise<MoveResult> {
  if (!Object.values(USER_WALLET_COLUMNS).includes(column)) {
    throw new AppError('Unsupported balance column', 400);
  }
  const amt = parsePositiveAmount(amount);

  await lockUserWallets(tx, [senderId, receiverId]);
  const [sender, receiver] = await Promise.all([
    tx.userWallet.findUnique({ where: { userId: senderId } }),
    tx.userWallet.findUnique({ where: { userId: receiverId } }),
  ]);
  if (!sender) throw new AppError('Sender crypto wallet not provisioned', 404);
  if (!receiver) throw new AppError('Recipient crypto wallet not provisioned', 404);

  const senderBalBefore = dec((sender as any)[column]);
  const receiverBalBefore = dec((receiver as any)[column]);
  if (senderBalBefore.lt(amt)) {
    throw new AppError(`Insufficient ${asset} balance. Available: ${senderBalBefore.toFixed()}`, 400);
  }

  const delta = new Prisma.Decimal(amt.toFixed());
  await tx.userWallet.update({ where: { userId: senderId }, data: { [column]: { decrement: delta } } as any });
  await tx.userWallet.update({ where: { userId: receiverId }, data: { [column]: { increment: delta } } as any });

  return {
    senderBalBefore,
    senderBalAfter: senderBalBefore.minus(amt),
    receiverBalBefore,
    receiverBalAfter: receiverBalBefore.plus(amt),
  };
}

/** Move a long-tail coin held in UserWallet.altBalances. */
export async function moveAltBalance(
  tx: Tx, senderId: string, receiverId: string, asset: string, amount: unknown,
): Promise<MoveResult> {
  const amt = parsePositiveAmount(amount);

  await lockUserWallets(tx, [senderId, receiverId]);
  const [sender, receiver] = await Promise.all([
    tx.userWallet.findUnique({ where: { userId: senderId } }),
    tx.userWallet.findUnique({ where: { userId: receiverId } }),
  ]);
  if (!sender) throw new AppError('Sender crypto wallet not provisioned', 404);
  if (!receiver) throw new AppError('Recipient crypto wallet not provisioned', 404);

  const alts = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, string>;
  const senderAlts = alts(sender.altBalances);
  const receiverAlts = alts(receiver.altBalances);

  const senderBalBefore = dec(senderAlts[asset] ?? '0');
  const receiverBalBefore = dec(receiverAlts[asset] ?? '0');
  if (senderBalBefore.lt(amt)) {
    throw new AppError(`Insufficient ${asset} balance. Available: ${senderBalBefore.toFixed()}`, 400);
  }
  const senderBalAfter = senderBalBefore.minus(amt);
  const receiverBalAfter = receiverBalBefore.plus(amt);

  // Safe to write the whole map: both rows are locked for this transaction.
  await tx.userWallet.update({
    where: { userId: senderId },
    data: { altBalances: { ...senderAlts, [asset]: senderBalAfter.toFixed() } },
  });
  await tx.userWallet.update({
    where: { userId: receiverId },
    data: { altBalances: { ...receiverAlts, [asset]: receiverBalAfter.toFixed() } },
  });

  return { senderBalBefore, senderBalAfter, receiverBalBefore, receiverBalAfter };
}
