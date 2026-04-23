import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DepositRequest {
  currency: 'LYD' | 'USD';
  amount: number;
  paymentMethod: string;
  bankName?: string;
  accountNumber?: string;
  senderName?: string;
  notes?: string;
}

export interface WithdrawalRequest {
  currency: 'LYD' | 'USD' | 'USDT';
  amount: number;
  paymentMethod?: string;
  walletAddress?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface OrderRequest {
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quoteCurrency: 'LYD' | 'USD';
  amount: number;
  price?: number;
}

export interface ExchangeRateUpdate {
  baseCurrency: string;
  quoteCurrency: string;
  buyPrice: number;
  sellPrice: number;
}
