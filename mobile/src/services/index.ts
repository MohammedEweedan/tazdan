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
import type {
  ApiMessage, Conversation, BlockedUser,
} from '@/types/messages';

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
  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
    country: string;
    phoneCountryCode: string;
    phone: string;
    dateOfBirth: string;
    avatarUrl?: string;
    referralCode?: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const { data } = await api.post('/auth/register', payload);
    return data;
  },
  async verifyEmailCode(code: string): Promise<void> {
    await api.post('/auth/verify-email-code', { code });
  },
  async resendVerification(): Promise<void> {
    await api.post('/auth/resend-verification');
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
    async () => {
      const { data } = await api.get('/wallets');
      const wallets = data.wallets || [];

      // Also fetch crypto wallet balances from UserWallet
      try {
        const { data: cryptoData } = await api.get('/wallet/balances');
        // Merge crypto balances into the wallets array
        const cryptoMap: Record<string, number> = {
          ETH: cryptoData.ETH ? parseFloat(cryptoData.ETH) : 0,
          BTC: cryptoData.BTC ? parseFloat(cryptoData.BTC) : 0,
          SOL: cryptoData.SOL ? parseFloat(cryptoData.SOL) : 0,
          USDT_ERC20: cryptoData.USDT_ERC20 ? parseFloat(cryptoData.USDT_ERC20) : 0,
          USDT_TRC20: cryptoData.USDT_TRC20 ? parseFloat(cryptoData.USDT_TRC20) : 0,
        };

        // Simple USD price map for fiat value calculation
        const USD_PRICE: Record<string, number> = {
          USDT: 1, USD: 1,
          BTC: 65_240, ETH: 3_215, SOL: 150,
        };

        // Add or update crypto wallets
        Object.entries(cryptoMap).forEach(([currency, balance]) => {
          const existingIndex = wallets.findIndex((w: Wallet) => w.currency === currency);
          if (existingIndex >= 0) {
            wallets[existingIndex].balance = balance.toString();
          } else if (balance > 0) {
            wallets.push({
              id: `crypto-${currency}`,
              currency,
              balance: balance.toString(),
              frozen: '0',
              fiatValueUsd: (balance * (USD_PRICE[currency] || 0)).toString(),
            });
          }
        });
      } catch (e) {
        console.warn('Failed to fetch crypto balances:', e);
      }

      return wallets;
    },
    MOCK_WALLETS,
  ),
};

// ───────── Transactions ─────────
export const transactionService = {
  list: (page = 1, limit = 20, type?: string, currency?: string) => withFallback<{ items: Transaction[]; total: number }>(
    async () => (await api.get('/transactions', { params: { page, limit, type, currency } })).data,
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
export interface P2PTrade {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  price: string;
  totalFiat: string;
  status: 'PENDING' | 'PAYMENT_SENT' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
  listing?: { currency: string; fiatCurrency: string; side: 'BUY' | 'SELL' };
  counterparty?: { username?: string; firstName?: string; lastName?: string };
}

export interface P2PListing {
  id: string;
  side: 'BUY' | 'SELL';
  currency: string;
  fiatCurrency: string;
  price: string;
  amount: string;
  remainingAmount: string;
  minLimit: string;
  maxLimit: string;
  paymentMethods: string[];
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export const p2pService = {
  offers: (filter: 'BUY' | 'SELL' | 'ALL' = 'ALL') => withFallback<P2POffer[]>(
    async () => (await api.get('/p2p/offers', { params: { side: filter } })).data.offers,
    filter === 'ALL' ? MOCK_P2P_OFFERS : MOCK_P2P_OFFERS.filter((o) => o.side === filter),
  ),
  myListings: (): Promise<P2PListing[]> =>
    withFallback<P2PListing[]>(
      async () => (await api.get('/p2p/listings/mine')).data.listings,
      [],
    ),
  myTrades: (): Promise<P2PTrade[]> =>
    withFallback<P2PTrade[]>(
      async () => (await api.get('/p2p/trades')).data.trades,
      [],
    ),
  createListing: async (payload: {
    side: 'BUY' | 'SELL';
    currency: string;
    fiatCurrency: string;
    price: number;
    amount: number;
    minLimit: number;
    maxLimit: number;
    paymentMethods: string[];
    terms?: string;
  }): Promise<P2PListing> => {
    const { data } = await api.post('/p2p/listings', payload);
    return data.listing;
  },
  cancelListing: (id: string) => api.put(`/p2p/listings/${id}/cancel`),
  initiateTrade: async (payload: { listingId: string; amount: number; paymentMethod?: string }) => {
    const { data } = await api.post('/p2p/trades', payload);
    return data.trade;
  },
  markPaymentSent: (id: string) => api.put(`/p2p/trades/${id}/payment-sent`),
  confirmPayment:  (id: string) => api.put(`/p2p/trades/${id}/confirm`),
  cancelTrade:     (id: string) => api.put(`/p2p/trades/${id}/cancel`),
};

// ───────── Wallet swap ─────────
export const swapService = {
  swap: async (payload: { from: string; to: string; amount: number }) => {
    const { data } = await api.post('/wallets/swap', payload);
    return data.swap as { from: string; to: string; amount: number; credited: number; rate: number };
  },
};

// ───────── Public profile (for /u/[handle]) ─────────
export interface PublicProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatarUrl?: string;
  acceptedCurrencies: string[];
  kycVerified: boolean;
  kycStatus: string;
  totalTrades: number;
  completedTrades: number;
  completionRate: number;
  createdAt: string;
}
export const profileService = {
  byHandle: async (handle: string): Promise<PublicProfile> => {
    const { data } = await api.get(`/profile/${handle}`);
    return data.profile;
  },
  /** Authenticated PUT for current user's public profile settings. */
  updateMe: async (payload: { username?: string; bio?: string; profilePublic?: boolean; acceptedCurrencies?: string[] }) => {
    const { data } = await api.put('/profile/me', payload);
    return data.profile as { id: string; username: string; profilePublic: boolean; bio?: string };
  },
  me: async () => {
    const { data } = await api.get('/profile/me');
    return data.profile;
  },
  /** Look up a user by id (auth-gated). Used by Messages thread header. */
  byId: async (id: string): Promise<{
    id: string; firstName?: string; lastName?: string;
    username?: string | null; avatarUrl?: string | null;
    role?: string; kycStatus?: string;
  } | null> => {
    try {
      const { data } = await api.get(`/profile/by-id/${id}`);
      return data.user ?? null;
    } catch {
      return null;
    }
  },

  /** Type-ahead search by @handle prefix. Used by the Send screen. */
  search: async (q: string): Promise<Array<{ id: string; username: string; firstName: string; lastName: string; avatarUrl?: string; kycTier?: string }>> => {
    if (!q || q.trim().length === 0) return [];
    try {
      const { data } = await api.get('/profile/search', { params: { q } });
      return data.profiles ?? [];
    } catch {
      return [];
    }
  },
};

// ───────── Notifications ─────────
export const notificationService = {
  list: async (page = 1): Promise<{ notifications: any[]; total: number; unreadCount: number; page: number; pages: number }> => {
    const { data } = await api.get('/notifications', { params: { page } });
    return data;
  },
  unreadCount: async (): Promise<number> => {
    const { data } = await api.get('/notifications/unread-count');
    return data.count ?? 0;
  },
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ───────── Messages ─────────

export const messageService = {
  conversations: async (): Promise<Conversation[]> => {
    const { data } = await api.get('/messages/conversations');
    return data.conversations ?? [];
  },

  // ───────── Transfers ─────────

  /** Internal wallet-to-wallet transfer (used by /send page) */
  transfer: async (payload: {
    receiverId: string;
    currency: string;
    amount: number;
    note?: string;
  }) => {
    const { data } = await api.post('/transactions/transfer', payload);
    return data;
  },
  thread: async (userId: string): Promise<ApiMessage[]> => {
    const { data } = await api.get(`/messages/${userId}`);
    return data.messages ?? [];
  },
  send: async (payload: {
    receiverId: string;
    content: string;
    type?: 'TEXT' | 'PAYMENT' | 'P2P_NOTE';
    metadata?: Record<string, any>;
    tradeId?: string;
  }): Promise<ApiMessage> => {
    const { data } = await api.post('/messages', payload);
    return data.message;
  },
  edit: async (id: string, content: string): Promise<ApiMessage> => {
    const { data } = await api.patch(`/messages/${id}`, { content });
    return data.message;
  },
  remove: async (id: string): Promise<ApiMessage> => {
    const { data } = await api.delete(`/messages/${id}`);
    return data.message;
  },
  markRead: (userId: string) => api.post(`/messages/read/${userId}`),

  // Block / unblock / list
  block:   (userId: string, reason?: string) => api.post('/messages/block', { userId, reason }),
  unblock: (userId: string) => api.delete(`/messages/block/${userId}`),
  blocks:  async (): Promise<BlockedUser[]> => {
    const { data } = await api.get('/messages/blocks');
    return data.blocks ?? [];
  },

  // Report
  report: (payload: {
    reportedUserId: string;
    messageId?: string;
    reason: string;
    details?: string;
  }) => api.post('/messages/report', payload),

  // Escalate to support
  escalate: async (payload: {
    counterpartyId: string;
    tradeId?: string;
    reason: string;
    details?: string;
  }): Promise<{ escalation: any; supportThreadWith: string }> => {
    const { data } = await api.post('/messages/escalate', payload);
    return data;
  },
};

// ───────── Cards ─────────
export interface CardTransaction {
  id: string;
  cardId: string;
  amount: string;
  currency: string;
  merchant?: string;
  category?: string;
  status: 'PENDING' | 'COMPLETED' | 'DECLINED' | 'REFUNDED';
  createdAt: string;
}
export const cardsService = {
  list: () => withFallback<CardEntity[]>(
    async () => (await api.get('/cards')).data.cards,
    MOCK_CARDS,
  ),
  issue: async (payload: { tier: 'STARTER' | 'PRO' | 'MASTER'; colorway: CardEntity['colorway'] }): Promise<CardEntity> => {
    const { data } = await api.post('/cards/issue', payload);
    return data.card;
  },
  freeze:   (id: string) => api.post(`/cards/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/cards/${id}/unfreeze`),
  transactions: (id: string): Promise<CardTransaction[]> =>
    withFallback<CardTransaction[]>(
      async () => (await api.get(`/cards/${id}/transactions`)).data.transactions,
      [],
    ),
};
