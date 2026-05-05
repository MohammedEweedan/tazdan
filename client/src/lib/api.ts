import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register') && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token: string) => api.get(`/auth/verify-email?token=${token}`),
  verifyEmailCode: (code: string) => api.post('/auth/verify-email-code', { code }),
  resendVerification: () => api.post('/auth/resend-verification'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  enable2FA: () => api.post('/auth/2fa/enable'),
  verify2FA: (code: string) => api.post('/auth/2fa/verify', { code }),
  disable2FA: (code?: string) => api.post('/auth/2fa/disable', code ? { code } : {}),
};

// Wallets
export const walletAPI = {
  getAll: () => api.get('/wallets'),
  getByCurrency: (currency: string) => api.get(`/wallets/${currency}`),
  getTransactions: (currency: string, page = 1) => api.get(`/wallets/${currency}/transactions?page=${page}`),
  getPortfolio: () => api.get('/wallets/summary/portfolio'),
};

// Deposits
export const depositAPI = {
  create: (data: FormData) => api.post('/deposits', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: (page = 1, status?: string) => api.get(`/deposits?page=${page}${status ? `&status=${status}` : ''}`),
  getById: (id: string) => api.get(`/deposits/${id}`),
  cancel: (id: string) => api.put(`/deposits/${id}/cancel`),
  getPaymentMethods: () => api.get('/deposits/info/payment-methods'),
};

// Withdrawals
export const withdrawalAPI = {
  create: (data: any) => api.post('/withdrawals', data),
  getAll: (page = 1) => api.get(`/withdrawals?page=${page}`),
  cancel: (id: string) => api.put(`/withdrawals/${id}/cancel`),
};

// Orders
export const orderAPI = {
  create: (data: any) => api.post('/orders', data),
  getAll: (page = 1, side?: string) => api.get(`/orders?page=${page}${side ? `&side=${side}` : ''}`),
};

// Exchange
export const exchangeAPI = {
  getRates: () => api.get('/exchange/rates'),
  getSettings: () => api.get('/exchange/settings'),
  getPairs: () => api.get('/exchange/pairs'),
};

// Bank Accounts
export const bankAccountAPI = {
  getAll: () => api.get('/bank-accounts'),
  create: (data: any) => api.post('/bank-accounts', data),
  update: (id: string, data: any) => api.put(`/bank-accounts/${id}`, data),
  delete: (id: string) => api.delete(`/bank-accounts/${id}`),
};

// Linked Wallets
export const linkedWalletAPI = {
  getAll: () => api.get('/linked-wallets'),
  create: (data: any) => api.post('/linked-wallets', data),
  update: (id: string, data: any) => api.put(`/linked-wallets/${id}`, data),
  delete: (id: string) => api.delete(`/linked-wallets/${id}`),
};

// Agents
export const agentAPI = {
  getNearby: (city?: string, region?: string) => api.get('/agents/nearby', { params: { city, region } }),
  requestDeposit: (data: any) => api.post('/agents/deposit', data),
  requestWithdrawal: (data: any) => api.post('/agents/withdraw', data),
  getMyTransactions: (page = 1, status?: string) =>
    api.get(`/agents/my-transactions?page=${page}${status ? `&status=${status}` : ''}`),
  // Agent-role endpoints
  getQueue: (status = 'PENDING', page = 1) =>
    api.get(`/agents/queue?status=${status}&page=${page}`),
  getStats: () => api.get('/agents/stats'),
  confirmDeposit: (id: string) => api.put(`/agents/confirm-deposit/${id}`),
  confirmWithdrawal: (id: string) => api.put(`/agents/confirm-withdrawal/${id}`),
  rejectTransaction: (id: string, reason?: string) =>
    api.put(`/agents/reject/${id}`, { reason }),
};

// Transfers
export const transferAPI = {
  send: (data: {
    recipientEmail?: string;
    recipientPhone?: string;
    recipientUsername?: string;
    currency?: string;
    amount: number;
    note?: string;
  }) => api.post('/transfers/send', data),
  getHistory: (page = 1) => api.get(`/transfers/history?page=${page}`),
};

// Cards (virtual Visa)
export const cardAPI = {
  tiers: () => api.get('/cards/tiers'),
  list: () => api.get('/cards'),
  get: (id: string) => api.get(`/cards/${id}`),
  create: (data: { tier?: 'STARTER' | 'MASTER' | 'PRO'; nickname?: string; currency?: string }) => api.post('/cards', data),
  update: (id: string, data: any) => api.patch(`/cards/${id}`, data),
  cancel: (id: string) => api.delete(`/cards/${id}`),
  freeze: (id: string) => api.post(`/cards/${id}/freeze`),
  unfreeze: (id: string) => api.post(`/cards/${id}/unfreeze`),
  transactions: (id: string, page = 1, pageSize = 25) => api.get(`/cards/${id}/transactions`, { params: { page, pageSize } }),
  recordTransaction: (id: string, data: any) => api.post(`/cards/${id}/transactions`, data),
};

// User
export const userAPI = {
  updateProfile: (data: any) => api.put('/users/profile', data),
  changePassword: (data: any) => api.put('/users/password', data),
  submitKYC: (data: FormData) => api.post('/users/kyc', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getKYCStatus: () => api.get('/users/kyc'),
  getNotifications: (page = 1) => api.get(`/users/notifications?page=${page}`),
  markNotificationRead: (id: string) => api.put(`/users/notifications/${id}/read`),
  getReferrals: () => api.get('/users/referrals'),
  getBankAccounts: () => api.get('/users/bank-accounts'),
  addBankAccount: (data: any) => api.post('/users/bank-accounts', data),
  linkWallet: (data: { address: string; network: string; label?: string }) => api.post('/users/linked-wallets', data),
  getLinkedWallets: () => api.get('/users/linked-wallets'),
  deleteLinkedWallet: (id: string) => api.delete(`/users/linked-wallets/${id}`),
  generateStatement: (format = 'pdf') => api.get(`/users/statement?format=${format}`, { responseType: 'blob' }),
};

// Profile
export const profileAPI = {
  getMyProfile: () => api.get('/profile/me'),
  updateProfile: (data: any) => api.put('/profile/me', data),
  getPublicProfile: (username: string) => api.get(`/profile/${username}`),
};

// P2P Marketplace
export const p2pAPI = {
  getListings: (page = 1, side?: string, currency?: string) =>
    api.get(`/p2p/listings?page=${page}${side ? `&side=${side}` : ''}${currency ? `&currency=${currency}` : ''}`),
  getMyListings: () => api.get('/p2p/listings/mine'),
  createListing: (data: any) => api.post('/p2p/listings', data),
  cancelListing: (id: string) => api.put(`/p2p/listings/${id}/cancel`),
  getMyTrades: (page = 1) => api.get(`/p2p/trades?page=${page}`),
  initiateTrade: (data: any) => api.post('/p2p/trades', data),
  markPaymentSent: (id: string) => api.put(`/p2p/trades/${id}/payment-sent`),
  confirmPayment: (id: string) => api.put(`/p2p/trades/${id}/confirm`),
  cancelTrade: (id: string) => api.put(`/p2p/trades/${id}/cancel`),
  raiseDispute: (id: string, reason: string) => api.post(`/p2p/trades/${id}/dispute`, { reason }),
};

// Messages
export const messageAPI = {
  send: (data: { receiverId?: string; receiverUsername?: string; content: string; type?: string; metadata?: any }) =>
    api.post('/messages', data),
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId: string, page = 1) => api.get(`/messages/${userId}?page=${page}`),
};

// Meme Tokens
export const memeTokenAPI = {
  getFees: () => api.get('/tokens/fees'),
  create: (data: any) => api.post('/tokens', data),
  getMyTokens: () => api.get('/tokens/mine'),
  getAll: (page = 1, chain?: string) => api.get(`/tokens?page=${page}${chain ? `&chain=${chain}` : ''}`),
};

// Smart Contracts
export const smartContractAPI = {
  getFees: () => api.get('/contracts/fees'),
  create: (data: any) => api.post('/contracts', data),
  getMyContracts: () => api.get('/contracts/mine'),
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  updateRates: (base: string, quote: string, data: any) => api.put(`/admin/rates/${base}/${quote}`, data),
  getDeposits: (page = 1, status?: string) => api.get(`/admin/deposits?page=${page}${status ? `&status=${status}` : ''}`),
  confirmDeposit: (id: string, notes?: string) => api.put(`/admin/deposits/${id}/confirm`, { notes }),
  rejectDeposit: (id: string, reason = 'Rejected by admin') => api.put(`/admin/deposits/${id}/reject`, { reason }),
  getWithdrawals: (page = 1, status?: string) => api.get(`/admin/withdrawals?page=${page}${status ? `&status=${status}` : ''}`),
  processWithdrawal: (id: string, notes?: string) => api.put(`/admin/withdrawals/${id}/process`, { notes }),
  rejectWithdrawal: (id: string, reason = 'Rejected by admin') => api.put(`/admin/withdrawals/${id}/reject`, { reason }),
  getKYC: (page = 1, status?: string) => api.get(`/admin/kyc?page=${page}${status ? `&status=${status}` : ''}`),
  approveKYC: (userId: string) => api.put(`/admin/kyc/${userId}/approve`),
  rejectKYC: (userId: string, reason = 'Rejected by admin') => api.put(`/admin/kyc/${userId}/reject`, { reason }),
  getUsers: (page = 1, search?: string) => api.get(`/admin/users?page=${page}${search ? `&search=${search}` : ''}`),
  updateUserStatus: (id: string, status: string) => api.put(`/admin/users/${id}/status`, { status }),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (settings: any) => api.put('/admin/settings', { settings }),
  getOrders: (page = 1) => api.get(`/admin/orders?page=${page}`),
  getAuditLog: (page = 1) => api.get(`/admin/audit-log?page=${page}`),
  getOnChainTxs: (page = 1) => api.get(`/admin/on-chain-txs?page=${page}`),
  markOnChainTxSent: (id: string, txHash: string) => api.put(`/admin/on-chain-txs/${id}/sent`, { txHash }),
  getAMLFlags: (page = 1, status?: string, severity?: string) =>
    api.get(`/admin/aml-flags?page=${page}${status ? `&status=${status}` : ''}${severity ? `&severity=${severity}` : ''}`),
  resolveAMLFlag: (id: string, data: { status: string; resolution: string }) => api.put(`/admin/aml-flags/${id}/resolve`, data),
};

// Referrals
export const referralAPI = {
  getDashboard: () => api.get('/referrals/dashboard'),
  claimRewards: () => api.post('/referrals/claim'),
};

// Notifications
export const notificationAPI = {
  getAll: (page = 1, type?: string) => api.get(`/notifications?page=${page}${type ? `&type=${type}` : ''}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// Security
export const securityAPI = {
  getOverview: () => api.get('/security/overview'),
  getLoginHistory: (page = 1) => api.get(`/security/login-history?page=${page}`),
  getSessions: () => api.get('/security/sessions'),
  revokeSession: (id: string) => api.delete(`/security/sessions/${id}`),
  revokeAllSessions: () => api.delete('/security/sessions'),
};

// API Keys
export const apiKeyAPI = {
  getAll: () => api.get('/api-keys'),
  create: (data: { name: string; permissions?: string[]; expiresInDays?: number }) => api.post('/api-keys', data),
  revoke: (id: string) => api.put(`/api-keys/${id}/revoke`),
  delete: (id: string) => api.delete(`/api-keys/${id}`),
};

// ── Crypto custody (Phase 1–3) ─────────────────────────────────────
export type CryptoChain = 'ETH' | 'BTC' | 'SOL' | 'TRON';
export type CryptoAsset = 'ETH' | 'BTC' | 'SOL' | 'USDT';

export interface CryptoQuote {
  id: string;
  side: 'BUY' | 'SELL';
  asset: CryptoAsset;
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
  addresses: () => api.get<{ eth: string; btc: string; sol: string; tron: string }>('/wallet/addresses'),
  balances: () => api.get<Record<'ETH' | 'BTC' | 'SOL' | 'USDT_ERC20' | 'USDT_TRC20', string>>('/wallet/balances'),
  depositAddress: (asset: string, network: string) =>
    api.get<{ asset: string; network: string; address: string; qr: string }>(`/wallet/deposit-address/${asset}/${network}`),
  export: (data: { chain: CryptoChain; password: string; twoFactorCode: string; confirmUnderstood: true }) =>
    api.post<{ chain: CryptoChain; address: string; privateKey: string; importInstructions: string; exportedAt: string }>('/wallet/export', data),
};

export const cryptoExchangeAPI = {
  quote: (data: { asset: CryptoAsset; network: string; side: 'BUY' | 'SELL'; fiatAmount?: string; cryptoAmount?: string }) =>
    api.post<{ quote: CryptoQuote }>('/exchange/quote', data),
  execute: (data: { quoteId: string; confirmedByUser: true; idempotencyKey?: string }) =>
    api.post<{ order: any }>('/exchange/execute', data),
  orders: (page = 1, limit = 20) => api.get(`/exchange/orders?page=${page}&limit=${limit}`),
  order: (id: string) => api.get(`/exchange/orders/${id}`),
};

export const cryptoWithdrawalAPI = {
  initiate: (data: { asset: CryptoAsset; network: string; amount: string; toAddress: string; twoFactorCode?: string }) =>
    api.post('/withdrawal/initiate', data),
  estimateFee: (asset: string, network: string) =>
    api.get<{ asset: string; estimate: string }>(`/withdrawal/estimate-fee?asset=${asset}&network=${network}`),
  history: (page = 1, limit = 20) => api.get(`/withdrawal/history?page=${page}&limit=${limit}`),
};

// Export
export const exportAPI = {
  csv: (from?: string, to?: string, type?: string) =>
    api.get(`/export/csv?${from ? `from=${from}&` : ''}${to ? `to=${to}&` : ''}${type ? `type=${type}` : ''}`, { responseType: 'blob' }),
  json: (from?: string, to?: string) =>
    api.get(`/export/json?${from ? `from=${from}&` : ''}${to ? `to=${to}` : ''}`),
  portfolioHistory: (days = 30) => api.get(`/export/portfolio-history?days=${days}`),
};
