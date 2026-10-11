/**
 * Atomic balance guards and state-transition helpers.
 *
 * Every balance helper here is ONE conditional UPDATE: the sufficiency check
 * and the write happen in the same statement, so two concurrent requests can
 * never both pass a stale balance read. When another transaction holds the
 * row, Postgres waits and re-evaluates the WHERE clause against the newly
 * committed row, which is what makes this safe under the default READ
 * COMMITTED isolation.
 *
 * Call them inside the caller's prisma.$transaction so the guarded write
 * commits or rolls back together with the rest of the operation.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../middleware/errorHandler';

type Tx = Prisma.TransactionClient;
type Amount = Decimal | Prisma.Decimal | string | number;

const MAX_DECIMALS = 18;

/**
 * Parse a client-supplied money amount. Rejects non-numbers, NaN, Infinity,
 * zero, negatives and more than 18 decimal places.
 */
export function parsePositiveAmount(value: unknown, field = 'amount'): Decimal {
  if (Decimal.isDecimal(value)) value = (value as Decimal).toString();
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new AppError(`${field} must be a number`, 400);
  }
  let parsed: Decimal;
  try {
    parsed = new Decimal(String(value).trim());
  } catch {
    throw new AppError(`${field} must be a number`, 400);
  }
  if (!parsed.isFinite() || parsed.lte(0)) {
    throw new AppError(`${field} must be greater than zero`, 400);
  }
  if (parsed.decimalPlaces() > MAX_DECIMALS) {
    throw new AppError(`${field} has too many decimal places`, 400);
  }
  return parsed;
}

function amountParam(amount: Amount): string {
  return parsePositiveAmount(amount.toString()).toFixed();
}

/** Move `amount` from spendable into `frozen`, only if spendable covers it. */
export async function reserveFunds(tx: Tx, userId: string, currency: string, amount: Amount): Promise<void> {
  const amt = amountParam(amount);
  const updated = await tx.$executeRaw`
    UPDATE "Wallet"
    SET "frozen" = "frozen" + ${amt}::numeric, "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "currency" = CAST(${currency} AS "Currency")
      AND "balance" - "frozen" >= ${amt}::numeric
  `;
  if (updated !== 1) throw new AppError(`Insufficient ${currency} balance`, 400);
}

/** Return `amount` from `frozen` to spendable. Refuses if less is reserved. */
export async function releaseReserve(tx: Tx, userId: string, currency: string, amount: Amount): Promise<void> {
  const amt = amountParam(amount);
  const updated = await tx.$executeRaw`
    UPDATE "Wallet"
    SET "frozen" = "frozen" - ${amt}::numeric, "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "currency" = CAST(${currency} AS "Currency")
      AND "frozen" >= ${amt}::numeric
  `;
  if (updated !== 1) {
    throw new AppError(`Reserved ${currency} funds do not cover this release — contact support`, 409);
  }
}

/** Spend a reservation: remove `amount` from both `balance` and `frozen`. */
export async function settleReserve(tx: Tx, userId: string, currency: string, amount: Amount): Promise<void> {
  const amt = amountParam(amount);
  const updated = await tx.$executeRaw`
    UPDATE "Wallet"
    SET "balance" = "balance" - ${amt}::numeric,
        "frozen"  = "frozen"  - ${amt}::numeric,
        "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "currency" = CAST(${currency} AS "Currency")
      AND "frozen"  >= ${amt}::numeric
      AND "balance" >= ${amt}::numeric
  `;
  if (updated !== 1) {
    throw new AppError(`Reserved ${currency} funds do not cover this settlement — contact support`, 409);
  }
}

/** Debit spendable funds (balance − frozen) directly, only if they cover it. */
export async function debitAvailable(tx: Tx, userId: string, currency: string, amount: Amount): Promise<void> {
  const amt = amountParam(amount);
  const updated = await tx.$executeRaw`
    UPDATE "Wallet"
    SET "balance" = "balance" - ${amt}::numeric, "updatedAt" = NOW()
    WHERE "userId" = ${userId}
      AND "currency" = CAST(${currency} AS "Currency")
      AND "balance" - "frozen" >= ${amt}::numeric
  `;
  if (updated !== 1) throw new AppError(`Insufficient ${currency} balance`, 400);
}

/**
 * Take row locks on the given users' UserWallet rows (crypto columns and
 * altBalances JSON). Locks are taken in a fixed order so two transfers
 * between the same pair of users cannot deadlock. Anything read from those
 * rows AFTER this call reflects the latest committed state.
 */
export async function lockUserWallets(tx: Tx, userIds: string[]): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  if (!ids.length) return;
  await tx.$queryRaw`
    SELECT "id" FROM "UserWallet"
    WHERE "userId" IN (${Prisma.join(ids)})
    ORDER BY "userId"
    FOR UPDATE
  `;
}

/** Same as lockUserWallets, for Wallet rows of one currency. */
export async function lockWallets(tx: Tx, userIds: string[], currency: string): Promise<void> {
  const ids = [...new Set(userIds)].sort();
  if (!ids.length) return;
  await tx.$queryRaw`
    SELECT "id" FROM "Wallet"
    WHERE "userId" IN (${Prisma.join(ids)})
      AND "currency" = CAST(${currency} AS "Currency")
    ORDER BY "userId"
    FOR UPDATE
  `;
}

/** Lock one budget row so its balance can be read and written safely. */
export async function lockBudget(tx: Tx, budgetId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "BudgetWallet" WHERE "id" = ${budgetId} FOR UPDATE`;
}

/**
 * Guard for status-machine transitions done with
 * `updateMany({ where: { id, status: expected }, ... })`. Exactly one row
 * must have moved; zero means another request already moved it, so the
 * caller must not move any money.
 */
export function assertTransitioned(result: { count: number }, message: string): void {
  if (result.count !== 1) throw new AppError(message, 409);
}
