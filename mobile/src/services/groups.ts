/**
 * groupService — HTTP wrapper for /api/groups (multi-party chats +
 * liquidity pools). Mirrors the server's GroupController +
 * LiquidityPoolController surface.
 */

import { api } from '@/lib/api';
import type {
  GroupChat, GroupMember, GroupMessage, LiquidityPool,
  PoolContribution, PoolKind,
} from '@/types/groups';

export interface CreateGroupInput {
  name:        string;
  description?: string;
  avatarUrl?:  string;
  memberIds:   string[];
  pool?: {
    name:            string;
    kind:            PoolKind;
    targetAmountUsd?: number;
    deadline?:       string;
  };
}

export const groupService = {
  list: async (): Promise<GroupChat[]> => {
    const { data } = await api.get('/groups');
    return data.groups ?? [];
  },

  get: async (id: string): Promise<GroupChat> => {
    const { data } = await api.get(`/groups/${id}`);
    return data.group;
  },

  create: async (payload: CreateGroupInput): Promise<GroupChat> => {
    const { data } = await api.post('/groups', payload);
    return data.group;
  },

  update: async (id: string, patch: { name?: string; description?: string; avatarUrl?: string | null }) => {
    const { data } = await api.patch(`/groups/${id}`, patch);
    return data.group as GroupChat;
  },

  dissolve: (id: string) => api.delete(`/groups/${id}`),

  addMembers: async (id: string, userIds: string[]): Promise<GroupMember[]> => {
    const { data } = await api.post(`/groups/${id}/members`, { userIds });
    return data.added ?? [];
  },

  removeMember: (id: string, userId: string) => api.delete(`/groups/${id}/members/${userId}`),

  updateMemberRole: (id: string, userId: string, payload: { role: 'ADMIN' | 'MEMBER'; permissions?: Record<string, boolean> | null }) =>
    api.patch(`/groups/${id}/members/${userId}`, payload),

  messages: async (id: string, opts?: { before?: string; limit?: number }): Promise<{ messages: GroupMessage[]; nextBefore: string | null }> => {
    const params = new URLSearchParams();
    if (opts?.before) params.set('before', opts.before);
    if (opts?.limit)  params.set('limit', String(opts.limit));
    const { data } = await api.get(`/groups/${id}/messages?${params}`);
    return data;
  },

  /** Plain text — JSON body. */
  sendText: async (id: string, payload: { content: string; replyToId?: string }): Promise<GroupMessage> => {
    const { data } = await api.post(`/groups/${id}/messages`, payload);
    return data.message;
  },

  /** Image upload — multipart with field "image". */
  sendImage: async (
    id: string,
    image: { uri: string; name: string; type: string },
    content?: string,
  ): Promise<GroupMessage> => {
    const form = new FormData();
    form.append('image', { uri: image.uri, name: image.name, type: image.type } as any);
    if (content) form.append('content', content);
    const { data } = await api.post(`/groups/${id}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    });
    return data.message;
  },

  editMessage: async (id: string, msgId: string, content: string): Promise<GroupMessage> => {
    const { data } = await api.patch(`/groups/${id}/messages/${msgId}`, { content });
    return data.message;
  },

  deleteMessage: (id: string, msgId: string) => api.delete(`/groups/${id}/messages/${msgId}`),

  markRead: (id: string) => api.post(`/groups/${id}/read`),

  // ── Liquidity pool ────────────────────────────────────────────────

  poolDeposit: async (id: string, payload: { currency: string; amount: number; note?: string }): Promise<LiquidityPool> => {
    const { data } = await api.post(`/groups/${id}/pool/deposit`, payload);
    return data.pool;
  },

  poolWithdraw: async (id: string, payload: { amountUsd: number; note?: string }): Promise<LiquidityPool> => {
    const { data } = await api.post(`/groups/${id}/pool/withdraw`, payload);
    return data.pool;
  },

  poolClose: async (id: string): Promise<LiquidityPool> => {
    const { data } = await api.post(`/groups/${id}/pool/close`);
    return data.pool;
  },

  poolContributions: async (id: string): Promise<PoolContribution[]> => {
    const { data } = await api.get(`/groups/${id}/pool/contributions`);
    return data.contributions ?? [];
  },
};
