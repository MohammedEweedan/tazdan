import { Decimal } from '@prisma/client/runtime/library';

// DECIMAL(38,18) needs more than Decimal's default 20 significant digits.
// Keep this constructor local: changing global precision would affect pricing.
export const LedgerDecimal = Decimal.clone({ precision: 80 });

export function ledgerAmount(value: Decimal | string | number): Decimal {
  const amount = new LedgerDecimal(value.toString());
  if (!amount.isFinite() || amount.decimalPlaces() > 18 || amount.abs().gte('100000000000000000000')) {
    throw new Error('Ledger amount must be finite and fit DECIMAL(38,18) exactly');
  }
  return amount;
}

export function validateAccountOwner(type: string, userId?: string | null): void {
  if (type === 'USER' ? !userId?.trim() : userId != null) {
    throw new Error('Ledger account owner must be a user for USER accounts and null for system accounts');
  }
}
