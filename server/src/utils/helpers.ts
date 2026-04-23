import { v4 as uuidv4 } from 'uuid';

export function generateReference(prefix: string = 'TXN'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().slice(0, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateReferralCode(): string {
  return uuidv4().slice(0, 8).toUpperCase();
}

export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'USDT' ? 8 : 2,
  });
  return `${formatter.format(amount)} ${currency}`;
}

export function calculateFee(amount: number, feePercent: number): number {
  return parseFloat((amount * feePercent / 100).toFixed(8));
}
