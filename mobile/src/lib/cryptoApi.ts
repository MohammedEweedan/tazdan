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
  fiatAmount: string;
  cryptoAmount: string;
  platformFee: string;
  networkFee: string;
  spreadCapture: string;
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

export const cryptoExchangeAPI = {
  quote: (data: {
    asset: string;
    network: string;
    side: 'BUY' | 'SELL';
    fiatAmount?: string;
    cryptoAmount?: string;
  }) => api.post<{ quote: CryptoQuote }>('/exchange/quote', data),
  execute: (data: { quoteId: string; confirmedByUser: true; idempotencyKey?: string }) =>
    api.post<{ order: any }>('/exchange/execute', data),
  orders: (page = 1, limit = 20) =>
    api.get(`/exchange/orders?page=${page}&limit=${limit}`),
};

export const cryptoWithdrawalAPI = {
  initiate: (data: {
    asset: string;
    network: string;
    amount: string;
    toAddress: string;
    twoFactorCode?: string;
  }) => api.post('/withdrawal/initiate', data),
  estimateFee: (asset: string, network: string) =>
    api.get<{ asset: string; estimate: string }>(
      `/withdrawal/estimate-fee?asset=${asset}&network=${network}`,
    ),
  history: (page = 1, limit = 20) =>
    api.get(`/withdrawal/history?page=${page}&limit=${limit}`),
};
