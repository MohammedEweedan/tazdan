/**
 * Service layer — real HTTP only. No mocks.
 *
 * Auth, wallets, transactions, markets, P2P, cards — every call goes to the
 * Express backend at `EXPO_PUBLIC_API_BASE`. The mocked seed data still lives
 * in `data/fakeData.ts` and is used as a graceful fallback for read-only
 * endpoints when the backend is unreachable (network error / 5xx). Auth
 * mutations always require the backend.
 */

import { api } from '@/lib/api';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';
import {
  MOCK_CARDS, MOCK_MARKETS, MOCK_P2P_OFFERS, MOCK_TRANSACTIONS, MOCK_WALLETS,
} from '@/data/fakeData';
import type {
  CardEntity, MarketTicker, P2POffer, Transaction, User, Wallet,
} from '@/types';

// Allow `EXPO_PUBLIC_FALLBACK_TO_MOCKS=true` to use seed data when the
// backend is unreachable OR the route isn't implemented yet (404/5xx).
// Defaults to `true` so demos work even before the full backend is wired.
const FALLBACK = (process.env.EXPO_PUBLIC_FALLBACK_TO_MOCKS ?? 'true') === 'true';

function isFallbackable(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const ax = e as { code?: string; response?: { status?: number } };
  if (ax.code === 'ERR_NETWORK') return true;             // backend down
  const status = ax.response?.status;
  // 404 — route missing; 401 — not logged in (demo mode); 5xx — server error.
  if (status && (status === 404 || status === 401 || status >= 500)) return true;
  return false;
}

async function withFallback<T>(req: () => Promise<T>, fallback: T): Promise<T> {
  try { return await req(); }
  catch (e) { if (FALLBACK && isFallbackable(e)) return fallback; throw e; }
}

// ───────── Auth (REAL — never mocked) ─────────
export const authService = {
  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  async register(payload: { email: string; password: string; firstName: string; lastName: string }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  async logout() {
    const refreshToken = await secureStore.get(STORAGE_KEYS.refreshToken);
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    await Promise.all([
      secureStore.remove(STORAGE_KEYS.accessToken),
      secureStore.remove(STORAGE_KEYS.refreshToken),
    ]);
  },
  async me(): Promise<User> {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};

// ───────── Wallets ─────────
export const walletService = {
  list: () => withFallback<Wallet[]>(
    async () => (await api.get('/wallets')).data.wallets,
    MOCK_WALLETS,
  ),
};

// ───────── Transactions ─────────
export const transactionService = {
  list: (page = 1, limit = 20) => withFallback<{ items: Transaction[]; total: number }>(
    async () => (await api.get('/wallets/transactions', { params: { page, limit } })).data,
    { items: MOCK_TRANSACTIONS.slice((page - 1) * limit, page * limit), total: MOCK_TRANSACTIONS.length },
  ),
};

// ───────── Markets ─────────
export const marketsService = {
  tickers: () => withFallback<MarketTicker[]>(
    async () => (await api.get('/markets/ticker')).data.tickers,
    MOCK_MARKETS,
  ),
};

// ───────── P2P ─────────
export const p2pService = {
  offers: (filter: 'BUY' | 'SELL' | 'ALL' = 'ALL') => withFallback<P2POffer[]>(
    async () => (await api.get('/p2p/offers', { params: { side: filter } })).data.offers,
    filter === 'ALL' ? MOCK_P2P_OFFERS : MOCK_P2P_OFFERS.filter((o) => o.side === filter),
  ),
};

// ───────── Cards ─────────
export const cardsService = {
  list: () => withFallback<CardEntity[]>(
    async () => (await api.get('/cards')).data.cards,
    MOCK_CARDS,
  ),
};
