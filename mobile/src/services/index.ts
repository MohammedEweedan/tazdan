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
  BankAccount, CardEntity, MarketTicker, P2POffer, Transaction, User, Wallet,
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
// Login can return one of two shapes:
//   1. { requires2FA: true }       — second call must include twoFactorCode
//   2. { user, accessToken, refreshToken }
export type LoginResponse =
  | { requires2FA: true }
  | { user: User; accessToken: string; refreshToken: string };

export const authService = {
  async login(email: string, password: string, twoFactorCode?: string): Promise<LoginResponse> {
    const { data } = await api.post('/auth/login', { email, password, twoFactorCode });
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
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    return data;
  },
  async enable2FA(): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const { data } = await api.post('/auth/2fa/enable');
    return data;
  },
  async verify2FA(code: string): Promise<void> {
    await api.post('/auth/2fa/verify', { code });
  },
  async disable2FA(code: string): Promise<void> {
    await api.post('/auth/2fa/disable', { code });
  },
};

// ───────── Deposits / on-ramp ─────────
export interface DepositMethod {
  id: string;
  name: string;
  description: string;
  currencies: string[];
  instant: boolean;
  processingTime: string;
  provider?: string;
  enabled?: boolean;
}

export interface GatewayQuote {
  providerRef: string;
  exchangeRate: number;
  cryptoAmount: number;
  feeAmount: number;
  feeCurrency: string;
  expiresAt: string;
}

export const depositService = {
  async methods(country?: string): Promise<DepositMethod[]> {
    const { data } = await api.get('/deposits/info/payment-methods', { params: { country } });
    return data.paymentMethods ?? [];
  },
  async gatewayQuote(input: {
    fiatCurrency: string;
    fiatAmount: number;
    cryptoCurrency?: string;
    paymentMethod?: string;
  }): Promise<{ quote: GatewayQuote; providerName: string }> {
    const { data } = await api.post('/deposits/gateway/quote', {
      cryptoCurrency: 'USDT',
      paymentMethod: 'CARD',
      ...input,
    });
    return data;
  },
  async gatewayConfirm(input: {
    providerRef: string;
    fiatCurrency: string;
    fiatAmount: number;
    cryptoCurrency: string;
    idempotencyKey?: string;
  }): Promise<{ transactionId: string; provider: string; status: string; redirectUrl?: string }> {
    const { data } = await api.post('/deposits/gateway/confirm', input);
    return data;
  },
  async createBankDeposit(input: {
    currency: string;
    amount: number;
    bankName?: string;
    accountNumber?: string;
    senderName?: string;
    notes?: string;
  }): Promise<{ deposit: any }> {
    const { data } = await api.post('/deposits', { ...input, paymentMethod: 'BANK_TRANSFER' });
    return data;
  },
  async list(page = 1, limit = 20): Promise<{ deposits: any[]; total: number }> {
    const { data } = await api.get('/deposits', { params: { page, limit } });
    return data;
  },
};

// ───────── Exchange / FX ─────────
export const exchangeService = {
  async fxRate(base: string, quote: string): Promise<{ buyPrice: string; sellPrice: string; source: string; fetchedAt: string }> {
    const { data } = await api.get(`/exchange/fx/${base}/${quote}`);
    return data;
  },
};

// ───────── Wallets ─────────
export const walletService = {
  list: () => withFallback<Wallet[]>(
    async () => {
      const { data } = await api.get('/wallets');
      const wallets = data.wallets || [];

      // Also fetch crypto wallet balances from UserWallet (includes altBalances for any token)
      try {
        const { data: cryptoData } = await api.get('/wallet/balances');
        // Every key in cryptoData is a currency symbol → balance string
        Object.entries(cryptoData as Record<string, string>).forEach(([currency, rawBal]) => {
          const balance = parseFloat(rawBal) || 0;
          const existingIndex = wallets.findIndex((w: Wallet) => w.currency === currency);
          if (existingIndex >= 0) {
            wallets[existingIndex].balance = balance.toString();
          } else if (balance > 0) {
            wallets.push({
              id: `crypto-${currency}`,
              currency,
              balance: balance.toString(),
              frozen: '0',
              fiatValueUsd: '0',
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

// ───────── Activities (unified timeline) ─────────
export interface Activity {
  id: string;
  kind: 'transaction' | 'p2p_trade' | 'card' | 'deposit' | 'withdrawal' | 'onramp' | 'offramp' | 'crypto_order';
  type: string;
  currency: string;
  amount: string;
  fee?: string;
  status?: string;
  reference?: string | null;
  counterparty?: { id?: string; username?: string | null; name?: string | null } | null;
  description?: string | null;
  metadata?: any;
  createdAt: string;
}

export const activityService = {
  list: (page = 1, limit = 20, type: string = 'ALL') => withFallback<{ items: Activity[]; total: number; hasMore: boolean }>(
    async () => (await api.get('/activities', { params: { page, limit, type } })).data,
    { items: [], total: 0, hasMore: false },
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
  status:
    | 'PENDING' | 'ESCROW_FUNDED'                          // waiting for buyer payment
    | 'PAYMENT_SENT' | 'PAYMENT_CONFIRMED'                 // buyer paid, awaiting seller confirm
    | 'COMPLETED' | 'ESCROW_RELEASED'                      // done
    | 'CANCELLED' | 'EXPIRED'                              // dead
    | 'DISPUTED';                                           // support
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
  listing?: { currency: string; fiatCurrency: string; side: 'BUY' | 'SELL' };
  counterparty?: { username?: string; handle?: string; name?: string; firstName?: string; lastName?: string };
  buyer?: { id: string; firstName?: string; lastName?: string; username?: string | null };
  seller?: { id: string; firstName?: string; lastName?: string; username?: string | null };
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
  anonymous?: boolean;
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
    anonymous?: boolean;
    city?: string;
    timeframeMins?: number;
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
  buyerConfirm:    (id: string) => api.put(`/p2p/trades/${id}/buyer-confirm`),
  denyPayment:     (id: string, reason?: string) => api.put(`/p2p/trades/${id}/deny`, { reason }),
  cancelTrade:     (id: string) => api.put(`/p2p/trades/${id}/cancel`),
  raiseDispute:    (id: string, reason: string) => api.post(`/p2p/trades/${id}/dispute`, { reason }),
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
    async () => {
      const cards: CardEntity[] = (await api.get('/cards')).data.cards ?? [];
      // Server returning an empty array means no real cards yet — use demo data
      return FALLBACK && cards.length === 0 ? MOCK_CARDS : cards;
    },
    MOCK_CARDS,
  ),
  issue: async (payload: { tier: 'STARTER' | 'PRO' | 'MASTER'; colorway: CardEntity['colorway'] }): Promise<CardEntity> => {
    const { data } = await api.post('/cards', payload);
    return data.card;
  },
  freeze:   (id: string) => api.post(`/cards/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/cards/${id}/unfreeze`),
  topup: async (id: string, payload: { amount: number; currency: string }): Promise<CardTransaction> => {
    const { data } = await api.post(`/cards/${id}/topup`, payload);
    return data.transaction;
  },
  transactions: (id: string): Promise<CardTransaction[]> =>
    withFallback<CardTransaction[]>(
      async () => (await api.get(`/cards/${id}/transactions`)).data.transactions,
      [],
    ),
  simulatePurchase: async (id: string, payload: { amount: number; merchant: string; currency: string }): Promise<CardTransaction> => {
    const { data } = await api.post(`/cards/${id}/transactions`, { ...payload, type: 'PURCHASE' });
    return data.transaction;
  },
};

export const bankAccountService = {
  list: () => withFallback<BankAccount[]>(
    async () => {
      const { data } = await api.get<{ bankAccounts: BankAccount[] }>('/users/bank-accounts');
      return data.bankAccounts;
    },
    [],
  ),
  add: (account: {
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
  }) => withFallback<BankAccount>(
    async () => {
      const { data } = await api.post<{ bankAccount: BankAccount }>('/users/bank-accounts', account);
      return data.bankAccount;
    },
    {} as BankAccount,
  ),
  setDefault: (id: string) => withFallback<void>(
    async () => {
      await api.patch(`/users/bank-accounts/${id}/default`);
    },
    undefined,
  ),
  getBanksByCountry: (countryCode: string) => withFallback<string[]>(
    async () => {
      const { data } = await api.get<{ banks: string[] }>(`/bank-accounts/banks/${countryCode}`);
      return data.banks;
    },
    [],
  ),
  update: async (id: string, payload: {
    bankName?: string; accountNumber?: string; accountName?: string;
    branch?: string; country?: string; currency?: string;
    sortCode?: string; routingNumber?: string; iban?: string; swift?: string;
    isDefault?: boolean;
  }) => {
    const { data } = await api.put<{ bankAccount: BankAccount }>(`/bank-accounts/${id}`, payload);
    return data.bankAccount;
  },
  delete: async (id: string) => {
    await api.delete(`/bank-accounts/${id}`);
  },
};

export const withdrawalService = {
  create: async (payload: {
    currency: string;
    amount: number;
    paymentMethod?: 'BANK_TRANSFER';
    bankAccountId?: string;
    walletAddress?: string;
    network?: 'TRC20' | 'ERC20';
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  }) => {
    const { data } = await api.post<{ withdrawal: any }>('/withdrawals', payload);
    return data.withdrawal;
  },
  list: async (page = 1, limit = 20) => {
    const { data } = await api.get<{ withdrawals: any[]; total: number }>('/withdrawals', { params: { page, limit } });
    return data;
  },
  cancel: async (id: string) => {
    await api.put(`/withdrawals/${id}/cancel`);
  },
};

/* ───────────── Admin ─────────────────────────────────────────── */

export interface PeriodStats {
  fees: number;
  prevFees: number;
  feesDelta: number;
  volume: number;
  prevVolume: number;
  volumeDelta: number;
  txCount: number;
  prevTxCount: number;
  txDelta: number;
}

export interface AdminDashboard {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  frozenUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  newUsersMonth: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingKYC: number;
  totalOrders: number;
  buyOrders: number;
  sellOrders: number;

  today: PeriodStats;
  week:  PeriodStats;
  month: PeriodStats;
  year:  PeriodStats;

  totalFees: number;
  totalVolume: number;
  totalTransactions: number;
  totalOrdersCount: number;
  totalDepositsCount: number;
  totalWithdrawalsCount: number;

  totalDepositsUSD: number;
  totalDepositsUSDT: number;
  totalWithdrawalsUSD: number;
  totalWithdrawalsUSDT: number;

  ordersByPair: Array<{ pair: string; count: number; volume: number }>;
  userGrowth:   Array<{ date: string; count: number }>;
  recentOrders: any[];
  recentDeposits: any[];
  recentWithdrawals: any[];

  // Legacy aliases
  todayFees: number;
  todayOrderVolume: number;
  monthOrderVolume: number;
  todayOrders: number;
  totalOrdersMonth: number;
}

export const adminService = {
  dashboard: () => withFallback<AdminDashboard>(
    async () => {
      const { data } = await api.get<AdminDashboard>('/admin/dashboard');
      return data;
    },
    {} as AdminDashboard,
  ),
  users: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    withFallback<{ users: any[]; total: number; page: number; totalPages: number }>(
      async () => {
        const { data } = await api.get('/admin/users', { params });
        return data;
      },
      { users: [], total: 0, page: 1, totalPages: 1 },
    ),
  updateUserStatus: async (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    const { data } = await api.put(`/admin/users/${id}/status`, { status });
    return data;
  },
  deposits: (params?: { status?: string; page?: number }) =>
    withFallback<{ deposits: any[]; total: number }>(
      async () => {
        const { data } = await api.get('/admin/deposits', { params });
        return data;
      },
      { deposits: [], total: 0 },
    ),
  confirmDeposit: async (id: string) => {
    const { data } = await api.put(`/admin/deposits/${id}/confirm`);
    return data;
  },
  rejectDeposit: async (id: string, reason: string) => {
    const { data } = await api.put(`/admin/deposits/${id}/reject`, { reason });
    return data;
  },
  withdrawals: (params?: { status?: string; page?: number }) =>
    withFallback<{ withdrawals: any[]; total: number }>(
      async () => {
        const { data } = await api.get('/admin/withdrawals', { params });
        return data;
      },
      { withdrawals: [], total: 0 },
    ),
  processWithdrawal: async (id: string) => {
    const { data } = await api.put(`/admin/withdrawals/${id}/process`);
    return data;
  },
  rejectWithdrawal: async (id: string, reason: string) => {
    const { data } = await api.put(`/admin/withdrawals/${id}/reject`, { reason });
    return data;
  },
  kyc: () => withFallback<{ pendingKyc: any[]; total: number }>(
    async () => {
      const { data } = await api.get('/admin/kyc');
      return data;
    },
    { pendingKyc: [], total: 0 },
  ),
  approveKYC: async (userId: string) => {
    const { data } = await api.put(`/admin/kyc/${userId}/approve`);
    return data;
  },
  rejectKYC: async (userId: string, reason: string) => {
    const { data } = await api.put(`/admin/kyc/${userId}/reject`, { reason });
    return data;
  },
  amlFlags: (params?: { status?: string }) =>
    withFallback<{ flags: any[]; summary: any }>(
      async () => {
        const { data } = await api.get('/admin/aml-flags', { params });
        return data;
      },
      { flags: [], summary: { open: 0, reviewing: 0, escalated: 0, critical: 0 } },
    ),
  resolveAMLFlag: async (id: string, payload: { status: string; resolution?: string }) => {
    const { data } = await api.put(`/admin/aml-flags/${id}/resolve`, payload);
    return data;
  },
  // Escalations — server may expose these under /admin/escalations or /messages
  escalations: () => withFallback<{ escalations: any[] }>(
    async () => {
      const { data } = await api.get('/admin/escalations');
      return data;
    },
    { escalations: [] },
  ),
  resolveEscalation: async (id: string, payload: { resolutionNote: string }) => {
    const { data } = await api.put(`/admin/escalations/${id}/resolve`, payload);
    return data;
  },

  // Rates — full CRUD list/create/update/clear/refresh
  rates: () => withFallback<{ rates: any[] }>(
    async () => {
      const { data } = await api.get('/admin/rates');
      return data;
    },
    { rates: [] },
  ),
  createRate: async (payload: { baseCurrency: string; quoteCurrency: string; buyPrice: number; sellPrice: number }) => {
    const { data } = await api.post('/admin/rates', payload);
    return data.rate;
  },
  updateRate: async (base: string, quote: string, payload: { buyPrice: number; sellPrice: number }) => {
    const { data } = await api.put(`/admin/rates/${base}/${quote}`, payload);
    return data.rate;
  },
  clearRateOverride: async (base: string, quote: string) => {
    await api.delete(`/admin/rates/${base}/${quote}/override`);
  },
  refreshRate: async (base: string, quote: string) => {
    const { data } = await api.post(`/admin/rates/${base}/${quote}/refresh`);
    return data.rate;
  },

  // User freeze / unfreeze
  freezeUser: async (id: string, reason?: string) => {
    const { data } = await api.put(`/admin/users/${id}/freeze`, { reason });
    return data;
  },
  unfreezeUser: async (id: string) => {
    const { data } = await api.put(`/admin/users/${id}/unfreeze`);
    return data;
  },

  // Transaction freeze
  freezeTransaction: async (kind: 'order' | 'withdrawal' | 'deposit', id: string, reason: string) => {
    const { data } = await api.put(`/admin/transactions/${kind}/${id}/freeze`, { reason });
    return data;
  },

  // Reply as support — sends a message from @support to a user
  replyAsSupport: async (payload: { userId: string; content: string; escalationId?: string; tradeId?: string }) => {
    const { data } = await api.post('/admin/support/reply', payload);
    return data.message;
  },

  // Backfill historical fees into the PlatformFee ledger
  backfillFees: async () => {
    const { data } = await api.post('/admin/backfill-fees');
    return data as { message: string; imported: { orders: number; withdrawals: number; cryptoOrders: number; p2pTrades: number }; total: number };
  },

  // Raw data browsers — paginated reads
  rawTransactions: (params?: { page?: number; limit?: number; search?: string; type?: string; currency?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/data/transactions', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawP2PTrades: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/data/p2p-trades', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawWallets: (params?: { page?: number; limit?: number; currency?: string; userId?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/data/wallets', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawCards: (params?: { page?: number; limit?: number }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/data/cards', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawBankAccounts: (params?: { page?: number; limit?: number }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/data/bank-accounts', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  platformFees: (params?: { page?: number; limit?: number; source?: string; currency?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number; totalsByCurrency: any[] }>(
      async () => (await api.get('/admin/data/platform-fees', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1, totalsByCurrency: [] },
    ),

  // Extended data browsers for new admin models
  rawP2PListings: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/p2p/listings', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawP2PDisputes: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/p2p/disputes', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawCardTransactions: (params?: { page?: number; limit?: number; cardId?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/card-transactions', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawMessages: (params?: { page?: number; limit?: number; search?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/messages', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawMessageReports: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/message-reports', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawReferrals: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/referrals', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawSessions: (params?: { page?: number; limit?: number; userId?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/sessions', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawLoginHistory: (params?: { page?: number; limit?: number; userId?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/login-history', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawApiKeys: (params?: { page?: number; limit?: number }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/api-keys', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawWhatsApp: (params?: { page?: number; limit?: number; direction?: string }) =>
    withFallback<{ messages: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/whatsapp/messages', { params })).data,
      { messages: [], total: 0, page: 1, totalPages: 1 },
    ),
  whatsappStats: () =>
    withFallback<any>(
      async () => (await api.get('/admin/whatsapp/stats')).data,
      {},
    ),
  rawOnRamps: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/onramps', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawOffRamps: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/offramps', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawMarkets: (params?: { page?: number; limit?: number }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/markets', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawOnchain: (params?: { page?: number; limit?: number; status?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/onchain-transactions', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawTransfers: (params?: { page?: number; limit?: number }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/transfers', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawNotifications: (params?: { page?: number; limit?: number; userId?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/notifications', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  rawPlatformBanks: (params?: { page?: number; limit?: number; currency?: string }) =>
    withFallback<{ items: any[]; total: number; page: number; totalPages: number }>(
      async () => (await api.get('/admin/platform-banks', { params })).data,
      { items: [], total: 0, page: 1, totalPages: 1 },
    ),
  revokeSession: async (id: string) => {
    const { data } = await api.delete(`/admin/sessions/${id}`);
    return data;
  },
  sendWhatsApp: async (payload: { phoneNumber: string; message: string; userId?: string }) => {
    const { data } = await api.post('/admin/whatsapp/send', payload);
    return data;
  },
  broadcastNotification: async (payload: { userIds?: string[]; title: string; body: string; data?: any }) => {
    const { data } = await api.post('/admin/notifications/broadcast', payload);
    return data;
  },
};
