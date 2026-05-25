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
  }): Promise<{ batchId: string; payouts: BusinessPayout[] }> => {
    const { data } = await api.post('/business/bulk-pay', payload);
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
