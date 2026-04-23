import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'USDT' ? 8 : 2,
  }).format(amount) + ` ${currency}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'FILLED':
    case 'APPROVED':
    case 'ACTIVE':
      return 'text-green-400 bg-green-400/10';
    case 'PENDING':
    case 'PROCESSING':
      return 'text-yellow-400 bg-yellow-400/10';
    case 'REJECTED':
    case 'CANCELLED':
    case 'BANNED':
    case 'SUSPENDED':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
}
