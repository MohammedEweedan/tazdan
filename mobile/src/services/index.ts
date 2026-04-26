/**
 * Service layer.
 *
 * All services accept a `useMock` flag (default true). Once the backend is
 * fully wired and Binance + KYC are live, set `EXPO_PUBLIC_USE_MOCK=false`
 * in `.env` to flip every service to real HTTP calls.
 *
 * Each service returns the same shape regardless of mock vs real, so
 * downstream hooks/screens never need to change.
 */

import { api } from '@/lib/api';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';
import {
  MOCK_CARDS, MOCK_MARKETS, MOCK_P2P_OFFERS, MOCK_TRANSACTIONS, MOCK_USER, MOCK_WALLETS,
} from '@/data/fakeData';
import type {
  CardEntity, MarketTicker, P2POffer, Transaction, User, Wallet,
} from '@/types';

const USE_MOCK = (process.env.EXPO_PUBLIC_USE_MOCK ?? 'true') === 'true';

// Tiny artificial delay so loading states are visible during dev.
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ───────── Auth ─────────
export const authService = {
  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    if (USE_MOCK) {
      await wait(420);
      return { user: MOCK_USER, accessToken: 'mock_at', refreshToken: 'mock_rt' };
    }
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  async register(payload: { email: string; password: string; firstName: string; lastName: string }) {
    if (USE_MOCK) {
      await wait(560);
      return { user: { ...MOCK_USER, email: payload.email }, accessToken: 'mock_at', refreshToken: 'mock_rt' };
    }
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  async logout() {
    const refreshToken = await secureStore.get(STORAGE_KEYS.refreshToken);
    if (!USE_MOCK && refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    await Promise.all([
      secureStore.remove(STORAGE_KEYS.accessToken),
      secureStore.remove(STORAGE_KEYS.refreshToken),
    ]);
  },
  async me(): Promise<User> {
    if (USE_MOCK) { await wait(); return MOCK_USER; }
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};

// ───────── Wallets ─────────
export const walletService = {
  async list(): Promise<Wallet[]> {
    if (USE_MOCK) { await wait(); return MOCK_WALLETS; }
    const { data } = await api.get('/wallets');
    return data.wallets;
  },
};

// ───────── Transactions ─────────
export const transactionService = {
  async list(page = 1, limit = 20): Promise<{ items: Transaction[]; total: number }> {
    if (USE_MOCK) {
      await wait();
      return { items: MOCK_TRANSACTIONS.slice((page - 1) * limit, page * limit), total: MOCK_TRANSACTIONS.length };
    }
    const { data } = await api.get('/wallets/transactions', { params: { page, limit } });
    return data;
  },
};

// ───────── Markets ─────────
export const marketsService = {
  async tickers(): Promise<MarketTicker[]> {
    if (USE_MOCK) { await wait(); return MOCK_MARKETS; }
    const { data } = await api.get('/markets/ticker');
    return data.tickers;
  },
};

// ───────── P2P ─────────
export const p2pService = {
  async offers(filter: 'BUY' | 'SELL' | 'ALL' = 'ALL'): Promise<P2POffer[]> {
    if (USE_MOCK) {
      await wait();
      return filter === 'ALL' ? MOCK_P2P_OFFERS : MOCK_P2P_OFFERS.filter((o) => o.side === filter);
    }
    const { data } = await api.get('/p2p/offers', { params: { side: filter } });
    return data.offers;
  },
};

// ───────── Cards ─────────
export const cardsService = {
  async list(): Promise<CardEntity[]> {
    if (USE_MOCK) { await wait(); return MOCK_CARDS; }
    const { data } = await api.get('/cards');
    return data.cards;
  },
};
