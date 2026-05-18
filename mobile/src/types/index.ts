/**
 * Domain types — mirror the server's Prisma schema where possible.
 * All money amounts use `string` (Decimal-safe) instead of `number` to avoid
 * floating-point drift; format helpers convert for display only.
 */

export type Currency =
  // crypto
  | 'BTC' | 'ETH' | 'USDT' | 'SOL' | 'BNB' | 'XRP' | 'ADA' | 'DOGE' | 'MATIC' | 'DOT' | 'AVAX'
  // fiat
  | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR' | 'EGP' | 'LYD';

export type CurrencyKind = 'crypto' | 'fiat';

export interface CurrencyMeta {
  code: Currency;
  kind: CurrencyKind;
  name: string;
  symbol: string;       // "$", "€", "₿"
  decimals: number;     // display precision
  flagOrIcon: string;   // emoji fallback or icon key
}

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username?: string;        // public @handle
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  country?: string;
  status?: string;
  role?: UserRole;
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  kycTier:   'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
  twoFactorEnabled: boolean;
  emailVerified?: boolean;
  referralCode: string;
  /** True when the user's @handle is publicly visible at /u/[handle]. */
  profilePublic?: boolean;
  bio?: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  currency: Currency;
  balance: string;          // Decimal as string
  frozen: string;
  fiatValueUsd: string;     // computed
  changePct24h?: number;    // for crypto wallets
}

export type TxType =
  | 'BUY' | 'SELL' | 'SEND' | 'RECEIVE'
  | 'DEPOSIT' | 'WITHDRAWAL' | 'TOPUP'
  | 'P2P_BUY' | 'P2P_SELL' | 'CARD_SPEND' | 'CASHBACK' | 'FEE';

export type TxStatus =
  | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  currency: Currency;
  amount: string;           // signed: positive in, negative out
  fee?: string;
  counterpartyHandle?: string;   // @username
  counterpartyName?: string;
  counterpartyAvatar?: string;
  note?: string;
  reference: string;
  createdAt: string;
}

export interface MarketTicker {
  symbol: string;           // "BTCUSDT"
  base: string;             // any Binance base asset (BTC, ETH, PEPE, SHIB, …)
  quote: string;
  displayName: string;
  price: number;
  changePct24h: number;
  volume24h: number;
  sparkline: number[];      // last N close prices
  iconUrl?: string;
}

export interface P2POffer {
  id: string;
  side: 'BUY' | 'SELL';
  trader: {
    handle: string;
    name: string;
    rating: number;
    orders: number;
    verified: boolean;
    avatarUrl?: string;
    anonymous: boolean;
  };
  base: Currency;
  quote: Currency;
  price: string;
  available: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  country?: string;
  city?: string;
  timeframeMins?: number;
}

export interface CardEntity {
  id: string;
  tier: 'STARTER' | 'MASTER' | 'PRO';
  status: 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CANCELLED';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardHolder: string;
  currency: Currency;
  spentMonth: string;
  dailyLimit: string;
  monthlyLimit: string;
  spentTotal?: string;
  cashbackRate?: string;
  cashbackBalance: string;
  nickname?: string;
  colorway: 'midnight' | 'ocean' | 'sunset' | 'forest' | 'sapphire' | 'obsidian' | 'emerald';
  frozen: boolean;
  contactlessOn?: boolean;
  onlineOn?: boolean;
  atmOn?: boolean;
  issuedAt?: string;
  activatedAt?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  branch?: string;
  country?: string;
  currency?: string;
  sortCode?: string;
  routingNumber?: string;
  iban?: string;
  swift?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: Record<string, unknown>;
}
