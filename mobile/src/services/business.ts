/**
 * businessService — HTTP wrapper for /api/business/* endpoints.
 *
 * All endpoints require the caller to have a business account
 * (user.businessAccountId != null). The server enforces this.
 */

import { api } from '@/lib/api';
import type {
  BusinessApiKey,
  ApiKeyCreateResponse,
  ApiKeyPermission,
  TeamMember,
  TeamRole,
  BusinessPayout,
  BulkPayRecipient,
  BulkPayPreview,
  BusinessStats,
  BusinessProfile,
  WebhookEndpoint,
  PayoutBatch,
} from '@/types/business';

/** The business's one payment QR (a permanent link to its account id). */
export type BusinessPayCode = {
  payUrl: string;
  payeeId: string;
  name: string;
  handle: string | null;
  /** KYB approved — customers see the trading name; Wallet cards available. */
  verified: boolean;
  wallet: { apple: boolean; google: boolean };
  /** Brand for the printed QR and plaque; nulls mean tazdan navy / no logo. */
  brand: { primary: string | null; secondary: string | null; logoUrl: string | null };
};

export const businessService = {
  /* ── Payment QR ───────────────────────────────────────────────── */

  payCode: async (): Promise<BusinessPayCode> => {
    const { data } = await api.get('/business/pay-code');
    return data.payCode;
  },

  /** Full URL Safari can open to add the Apple Wallet card (valid 10 minutes). */
  appleWalletUrl: async (): Promise<string> => {
    const { data } = await api.post('/business/pay-code/apple-wallet');
    return `${String(api.defaults.baseURL ?? '').replace(/\/+$/, '')}${data.path}`;
  },

  googleWalletUrl: async (): Promise<string> => {
    const { data } = await api.post('/business/pay-code/google-wallet');
    return data.url;
  },

  /* ── Profile ──────────────────────────────────────────────────── */

  profile: async (): Promise<BusinessProfile> => {
    const { data } = await api.get('/business/profile');
    return data.profile;
  },

  updateProfile: async (patch: {
    tradingName?: string;
    website?: string;
    logoUrl?: string | null;
    brandPrimary?: string | null;
    brandSecondary?: string | null;
  }): Promise<BusinessProfile> => {
    const { data } = await api.patch('/business/profile', patch);
    return data.profile;
  },

  /** Owner sends the business for KYB review. */
  submitKyb: async (): Promise<{ kybStatus: string }> => {
    const { data } = await api.post('/business/kyb/submit');
    return data;
  },

  /** Team invitations addressed to the signed-in user. */
  myInvitations: async (): Promise<Array<{ id: string; role: string; invitedAt: string; business: { companyName: string; tradingName: string | null; country: string } }>> => {
    const { data } = await api.get('/business/invitations');
    return data.invitations ?? [];
  },

  acceptInvitation: async (id: string): Promise<void> => {
    await api.post(`/business/invitations/${id}/accept`);
  },

  /* ── Dashboard stats ──────────────────────────────────────────── */

  /** Upload the business logo (PNG/JPEG base64); returns its public URL. */
  uploadLogo: async (base64: string): Promise<string> => (await api.post('/business/logo', { data: base64 }, { timeout: 30_000 })).data.logoUrl,

  /* ── Posts: offers, deals and news on the public profile ── */
  posts: async (): Promise<BusinessPost[]> => (await api.get('/business/posts')).data.posts,
  createPost: async (post: PostDraft): Promise<BusinessPost> => (await api.post('/business/posts', post)).data.post,
  updatePost: async (id: string, patch: Partial<PostDraft>): Promise<BusinessPost> => (await api.patch(`/business/posts/${id}`, patch)).data.post,
  deletePost: async (id: string) => { await api.delete(`/business/posts/${id}`); },

  /* ── Till plaques ── */
  plaqueOrders: async (): Promise<PlaqueOrder[]> => (await api.get('/business/plaques')).data.orders,
  orderPlaques: async (order: PlaqueOrderDraft): Promise<PlaqueOrder> => (await api.post('/business/plaques', order)).data.order,
  cancelPlaque: async (id: string) => { await api.post(`/business/plaques/${id}/cancel`); },

  /* ── Kiosk manager PIN ── */
  kioskPin: async (): Promise<{ set: boolean; setAt: string | null; lockedUntil: string | null }> => (await api.get('/business/kiosk-pin')).data,
  setKioskPin: async (pin: string) => { await api.put('/business/kiosk-pin', { pin }); },
  verifyKioskPin: async (pin: string) => { await api.post('/business/kiosk-pin/verify', { pin }); },

  /* ── Tills (checkout points with their own QR, kiosk and metrics) ── */

  tills: async (): Promise<BusinessTill[]> => (await api.get('/business/tills')).data.tills,
  createTill: async (name: string): Promise<BusinessTill> => (await api.post('/business/tills', { name })).data.till,
  updateTill: async (id: string, changes: { name?: string; active?: boolean }) => (await api.patch(`/business/tills/${id}`, changes)).data.till,
  tillPayments: async (id: string, since?: string): Promise<TillPayment[]> =>
    (await api.get(`/business/tills/${id}/payments`, { params: since ? { since, limit: 10 } : { limit: 30 } })).data.payments,
  tillCode: async (id: string, amount?: string, currency?: string): Promise<{ url: string; till: { id: string; name: string } }> =>
    (await api.get(`/business/tills/${id}/code`, { params: amount && currency ? { amount, currency } : {} })).data,

  stats: async (): Promise<BusinessStats> => {
    const { data } = await api.get('/business/stats');
    return data.stats;
  },

  /* ── API Keys ─────────────────────────────────────────────────── */

  listApiKeys: async (): Promise<BusinessApiKey[]> => {
    const { data } = await api.get('/business/api-keys');
    return data.keys ?? [];
  },

  createApiKey: async (payload: {
    name:        string;
    permissions: ApiKeyPermission[];
    expiresInDays?: number;
  }): Promise<ApiKeyCreateResponse> => {
    const { data } = await api.post('/business/api-keys', payload);
    return data.key;
  },

  revokeApiKey: async (id: string): Promise<void> => {
    await api.delete(`/business/api-keys/${id}`);
  },

  /* ── Team ─────────────────────────────────────────────────────── */

  listTeam: async (): Promise<TeamMember[]> => {
    const { data } = await api.get('/business/team');
    return data.members ?? [];
  },

  inviteMember: async (payload: {
    email: string;
    role:  TeamRole;
  }): Promise<TeamMember> => {
    const { data } = await api.post('/business/team/invite', payload);
    return data.member;
  },

  updateMemberRole: async (id: string, role: TeamRole): Promise<TeamMember> => {
    const { data } = await api.patch(`/business/team/${id}/role`, { role });
    return data.member;
  },

  removeMember: async (id: string): Promise<void> => {
    await api.delete(`/business/team/${id}`);
  },

  /* ── Bulk Pay ─────────────────────────────────────────────────── */

  /** Dry-run: validates recipients without executing */
  previewBulkPay: async (payload: {
    recipients: BulkPayRecipient[];
    currency:   string;
  }): Promise<BulkPayPreview> => {
    const { data } = await api.post('/business/bulk-pay/preview', payload);
    return data.preview;
  },

  /** Execute bulk payout — returns a batchId */
  submitBulkPay: async (payload: {
    recipients: BulkPayRecipient[];
    currency:   string;
    note?:      string;
    /** 6-digit code when the server asks for step-up (single-signatory, large batch). */
    stepUpCode?: string;
  }, idempotencyKey?: string): Promise<{
    batchId: string; payouts: BusinessPayout[];
    status?: string; pendingApproval?: boolean; complianceReview?: boolean; approvalReason?: string | null;
  }> => {
    // The key makes a retried or double-tapped submit return the same batch instead of paying twice.
    const { data } = await api.post('/business/bulk-pay', payload, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined);
    return data;
  },

  /* ── Payouts / Invoices ───────────────────────────────────────── */

  listPayouts: async (params?: {
    page?:     number;
    limit?:    number;
    status?:   string;
    batchId?:  string;
    currency?: string;
  }): Promise<{ payouts: BusinessPayout[]; total: number; page: number; pages: number }> => {
    const { data } = await api.get('/business/payouts', { params });
    return data;
  },

  getPayout: async (id: string): Promise<BusinessPayout> => {
    const { data } = await api.get(`/business/payouts/${id}`);
    return data.payout;
  },

  /** Batches, e.g. status=PENDING_APPROVAL for the approvals queue. */
  listBatches: async (status?: string): Promise<PayoutBatch[]> => {
    const { data } = await api.get('/business/batches', { params: status ? { status } : undefined });
    return data.batches ?? [];
  },

  /** Second owner/admin approves (the server refuses the person who created it). */
  approveBatch: async (id: string): Promise<PayoutBatch> => {
    const { data } = await api.post(`/business/batches/${id}/approve`);
    return data.batch;
  },

  rejectBatch: async (id: string, reason: string): Promise<PayoutBatch> => {
    const { data } = await api.post(`/business/batches/${id}/reject`, { reason });
    return data.batch;
  },

  cancelPayout: async (id: string): Promise<BusinessPayout> => {
    const { data } = await api.post(`/business/payouts/${id}/cancel`);
    return data.payout;
  },

  /* ── Webhooks ─────────────────────────────────────────────────── */

  listWebhooks: async (): Promise<WebhookEndpoint[]> => {
    const { data } = await api.get('/business/webhooks');
    return data.webhooks ?? [];
  },

  createWebhook: async (payload: {
    url:    string;
    events: string[];
  }): Promise<WebhookEndpoint> => {
    const { data } = await api.post('/business/webhooks', payload);
    return data.webhook;
  },

  deleteWebhook: async (id: string): Promise<void> => {
    await api.delete(`/business/webhooks/${id}`);
  },
};

export type TillTotals = Record<string, { count: number; total: string; average: string }>;
export interface BusinessTill {
  id: string; name: string; active: boolean; createdAt: string; lastPaymentAt: string | null;
  today: TillTotals; week: TillTotals; month: TillTotals;
}
export interface TillPayment { id: string; amount: string; currency: string; reference: string; note: string | null; createdAt: string; payer: string }

export type PostKind = 'OFFER' | 'DEAL' | 'NEWS';
export interface PostDraft { kind: PostKind; title: string; body: string; startsAt?: string | null; endsAt?: string | null; published?: boolean }
export interface BusinessPost extends PostDraft { id: string; hiddenByStaff?: boolean; createdAt: string }
export type PlaqueSize = 'A6' | 'A5' | 'STAND';
export interface PlaqueOrderDraft {
  tillId?: string | null; quantity: number; size: PlaqueSize; locale: string;
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; notes?: string | null;
}
export interface PlaqueOrder extends PlaqueOrderDraft {
  id: string; status: 'REQUESTED' | 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'; statusNote: string | null; createdAt: string;
}
