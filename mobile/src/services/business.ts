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

export const businessService = {
  /* ── Profile ──────────────────────────────────────────────────── */

  profile: async (): Promise<BusinessProfile> => {
    const { data } = await api.get('/business/profile');
    return data.profile;
  },

  updateProfile: async (patch: {
    tradingName?: string;
    website?: string;
    logoUrl?: string | null;
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
