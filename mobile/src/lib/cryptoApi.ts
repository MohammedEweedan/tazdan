/**
 * Crypto custody API helpers for the mobile app. Wraps the shared axios
 * instance in `./api.ts` with typed endpoints matching the server:
 *
 *   /api/wallet/*        custodial addresses + balances + export
 *   /api/exchange/*      quote + execute + orders
 *   /api/withdrawal/*    initiate + history + fee estimate
 */
import { api } from './api';

export type CryptoChain = 'ETH' | 'BTC' | 'SOL' | 'TRON';
export type CryptoAsset = string; // Any cryptocurrency symbol supported by the backend

export interface CryptoQuote {
  id: string;
  side: 'BUY' | 'SELL';
  asset: string;
  network: string;
  marketPrice: string;
  quotedPrice: string;
  spreadPct: string;       // disclosed spread fraction, e.g. "0.025" = 2.5%
  settlementCurrency: string; // wallet the trade settles into/from
  fiatAmount: string;

  cryptoAmount: string;
  platformFee: string;
  networkFee: string;
  spreadCapture: string;
  settlementAmount: string;
  platformFeeSettlement: string;
  networkFeeSettlement: string;
  totalUserPays: string;
  expiresAt: number;
}

export const cryptoWalletAPI = {
  addresses: () =>
    api.get<{ eth: string; btc: string; sol: string; tron: string }>('/wallet/addresses'),
  balances: () =>
    api.get<Record<'ETH' | 'BTC' | 'SOL' | 'USDT_ERC20' | 'USDT_TRC20', string>>(
      '/wallet/balances',
    ),
  depositAddress: (asset: string, network: string) =>
    api.get<{ asset: string; network: string; address: string; qr: string }>(
      `/wallet/deposit-address/${asset}/${network}`,
    ),
  export: (data: {
    chain: CryptoChain;
    password: string;
    twoFactorCode: string;
    confirmUnderstood: true;
  }) =>
    api.post<{
      chain: CryptoChain;
      address: string;
      privateKey: string;
      importInstructions: string;
      exportedAt: string;
    }>('/wallet/export', data),
};

export interface AssetSearchResult {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export const cryptoExchangeAPI = {
  quote: (data: {
    asset: string;
    network: string;
    side: 'BUY' | 'SELL';
    fiatAmount?: string;
    cryptoAmount?: string;
    receiveCurrency?: string;   // SELL: wallet to receive proceeds into
    fundingCurrency?: string;   // BUY: wallet to fund the purchase from
  }) => api.post<{ quote: CryptoQuote }>('/exchange/quote', data),
  execute: (data: { quoteId: string; confirmedByUser: true; idempotencyKey?: string; stepUpCode?: string; twoFactorCode?: string; recipientAddress?: string }) =>
    api.post<{ order: any }>('/exchange/execute', data),
  orders: (page = 1, limit = 20) =>
    api.get(`/exchange/orders?page=${page}&limit=${limit}`),
  search: (q: string) =>
    api.get<{ results: AssetSearchResult[] }>(`/exchange/search?q=${encodeURIComponent(q)}`),
};

/**
 * Crypto withdrawal API.
 *
 * Server-side contract (kept in sync — break this and the call will 403/401):
 *  - 2FA is REQUIRED. User must have 2FA enabled AND submit a TOTP code.
 *  - Email must be verified.
 *  - First-time destination address → server creates a 24h email-confirmed
 *    whitelist entry and rejects the withdrawal until the user has
 *    confirmed AND the cooldown has elapsed.
 *  - Address is validated against chain rules (length/checksum). Typo →
 *    400 "Invalid {CHAIN} address".
 */
export const cryptoWithdrawalAPI = {
  initiate: (data: {
    asset: string;
    network: string;
    amount: string;
    toAddress: string;
    twoFactorCode: string;
  }) => api.post('/withdrawal/initiate', data),
  estimateFee: (asset: string, network: string) =>
    api.get<{ asset: string; estimate: string }>(
      `/withdrawal/estimate-fee?asset=${asset}&network=${network}`,
    ),
  history: (page = 1, limit = 20) =>
    api.get(`/withdrawal/history?page=${page}&limit=${limit}`),
};

// ── Recurring (automated) buy ───────────────────────────────────────
export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type RecurringSourceType = 'WALLET' | 'CARD';
export type RecurringBuyStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface RecurringBuy {
  id: string;
  asset: string;
  network: string;
  fiatCurrency: string;
  fiatAmount: string;
  frequency: RecurringFrequency;
  sourceType: RecurringSourceType;
  sourceId: string | null;
  status: RecurringBuyStatus;
  nextRunAt: string;
  lastRunAt: string | null;
  lastError: string | null;
  runCount: number;
  createdAt: string;
}

export interface CreateRecurringBuyInput {
  asset: string;
  network?: string;
  fiatCurrency: string;
  fiatAmount: number;
  frequency: RecurringFrequency;
  sourceType: RecurringSourceType;
  sourceId?: string;
  startAt?: string;
}

export const recurringBuyAPI = {
  list: () => api.get<{ recurringBuys: RecurringBuy[] }>('/recurring-buys'),
  create: (data: CreateRecurringBuyInput) =>
    api.post<{ recurringBuy: RecurringBuy }>('/recurring-buys', data),
  update: (
    id: string,
    data: Partial<Pick<CreateRecurringBuyInput, 'fiatAmount' | 'frequency' | 'sourceType' | 'sourceId'>> & {
      status?: 'ACTIVE' | 'PAUSED';
    },
  ) => api.put<{ recurringBuy: RecurringBuy }>(`/recurring-buys/${id}`, data),
  remove: (id: string) => api.delete<{ success: boolean }>(`/recurring-buys/${id}`),
  runNow: (id: string) => api.post<{ order: any }>(`/recurring-buys/${id}/run`, {}),
};

/**
 * Classify a withdrawal API error so the UI can show the right message
 * without leaking server internals.
 */
export type WithdrawalErrorKind =
  | 'needs-2fa-setup'
  | 'needs-email-verified'
  | 'invalid-2fa-code'
  | 'invalid-address'
  | 'new-address-confirm-email'
  | 'address-cooldown'
  | 'insufficient-balance'
  | 'rate-limited'
  | 'unknown';

export function classifyWithdrawalError(e: unknown): { kind: WithdrawalErrorKind; message: string } {
  const ax = e as { response?: { status?: number; data?: { error?: string } } };
  const status = ax?.response?.status;
  const msg = ax?.response?.data?.error ?? '';
  if (status === 429) return { kind: 'rate-limited', message: msg || 'Slow down and try again later.' };
  if (msg.startsWith('Enable 2FA'))          return { kind: 'needs-2fa-setup', message: msg };
  if (msg.startsWith('Verify your email'))   return { kind: 'needs-email-verified', message: msg };
  if (msg === 'Invalid 2FA code')            return { kind: 'invalid-2fa-code', message: msg };
  if (msg.startsWith('Invalid '))            return { kind: 'invalid-address', message: msg };
  if (msg.startsWith('New withdrawal address')) return { kind: 'new-address-confirm-email', message: msg };
  if (msg.includes('24h cooldown'))          return { kind: 'address-cooldown', message: msg };
  if (msg.startsWith('Insufficient '))       return { kind: 'insufficient-balance', message: msg };
  return { kind: 'unknown', message: msg || 'Withdrawal failed.' };
}
