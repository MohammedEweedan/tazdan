/**
 * Group chat hooks — React Query + Socket.IO realtime.
 *
 *   useGroups()             — list of my groups (poll + ws)
 *   useGroup(id)            — single group detail
 *   useGroupMessages(id)    — paginated message history
 *   useSendGroupMessage(id) — text or image, optimistic for text
 *   useGroupRealtime()      — single ws subscriber that fans out cache updates
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { groupService, type CreateGroupInput } from '@/services/groups';
import type { GroupChat, GroupMessage, LiquidityPool } from '@/types/groups';

const QK = {
  list: ['groups'] as const,
  one:  (id: string) => ['group', id] as const,
  msgs: (id: string) => ['group-messages', id] as const,
};

// ── Queries ────────────────────────────────────────────────────────

export const useGroups = () =>
  useQuery({
    queryKey: QK.list,
    queryFn:  groupService.list,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

export const useGroup = (id: string | undefined) =>
  useQuery({
    queryKey: id ? QK.one(id) : ['group', '_none'],
    queryFn:  () => groupService.get(id!),
    enabled:  !!id,
  });

export const useGroupMessages = (id: string | undefined) =>
  useQuery<GroupMessage[]>({
    queryKey: id ? QK.msgs(id) : ['group-messages', '_none'],
    queryFn:  async () => {
      const { messages } = await groupService.messages(id!, { limit: 50 });
      // Server returns newest-first; the chat view prefers oldest-first.
      return messages.slice().reverse();
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });

// ── Mutations ──────────────────────────────────────────────────────

export const useCreateGroup = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => groupService.create(input),
    onSuccess: (g) => {
      qc.setQueryData<GroupChat[]>(QK.list, (prev) => prev ? [g, ...prev.filter((x) => x.id !== g.id)] : [g]);
      qc.setQueryData(QK.one(g.id), g);
    },
  });
};

export const useSendGroupMessage = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content?: string; image?: { uri: string; name: string; type: string } }) => {
      if (payload.image) return groupService.sendImage(id, payload.image, payload.content);
      return groupService.sendText(id, { content: payload.content ?? '' });
    },
    onSuccess: (msg) => {
      qc.setQueryData<GroupMessage[]>(QK.msgs(id), (prev) => {
        const next = prev ? [...prev] : [];
        if (!next.find((m) => m.id === msg.id)) next.push(msg);
        return next;
      });
    },
  });
};

export const useAddGroupMembers = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => groupService.addMembers(id, userIds),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.one(id) }); },
  });
};

export const useRemoveGroupMember = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => groupService.removeMember(id, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.one(id) }); },
  });
};

export const useDissolveGroup = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => groupService.dissolve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.list }); },
  });
};

// ── Liquidity pool mutations ───────────────────────────────────────

export const usePoolDeposit = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { currency: string; amount: number; note?: string }) => groupService.poolDeposit(id, payload),
    onSuccess: (pool) => {
      qc.setQueryData<GroupChat | undefined>(QK.one(id), (g) => g ? { ...g, pool } : g);
    },
  });
};

export const usePoolWithdraw = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { amountUsd: number; note?: string }) => groupService.poolWithdraw(id, payload),
    onSuccess: (pool) => {
      qc.setQueryData<GroupChat | undefined>(QK.one(id), (g) => g ? { ...g, pool } : g);
    },
  });
};

export const usePoolClose = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => groupService.poolClose(id),
    onSuccess: (pool) => {
      qc.setQueryData<GroupChat | undefined>(QK.one(id), (g) => g ? { ...g, pool } : g);
    },
  });
};

// ── Realtime ───────────────────────────────────────────────────────

export function useGroupRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let sock: Socket | null = null;
    let cancelled = false;

    const onMessage = (msg: GroupMessage) => {
      qc.setQueryData<GroupMessage[]>(QK.msgs(msg.groupId), (prev) => {
        const next = prev ? [...prev] : [];
        if (!next.find((m) => m.id === msg.id)) next.push(msg);
        return next;
      });
      qc.invalidateQueries({ queryKey: QK.list });
    };
    const onEdited = (msg: GroupMessage) => {
      qc.setQueryData<GroupMessage[]>(QK.msgs(msg.groupId), (prev) =>
        prev ? prev.map((m) => m.id === msg.id ? msg : m) : prev,
      );
    };
    const onDeleted = ({ id, groupId }: { id: string; groupId: string }) => {
      qc.setQueryData<GroupMessage[]>(QK.msgs(groupId), (prev) =>
        prev ? prev.map((m) => m.id === id ? { ...m, content: '', attachmentUrl: null, deletedAt: new Date().toISOString() } : m) : prev,
      );
    };
    const onPoolUpdated = (pool: LiquidityPool) => {
      qc.setQueryData<GroupChat | undefined>(QK.one(pool.groupId), (g) => g ? { ...g, pool } : g);
      qc.invalidateQueries({ queryKey: QK.list });
    };
    const onGroupChanged = () => { qc.invalidateQueries({ queryKey: QK.list }); };

    (async () => {
      sock = await getSocket();
      if (cancelled) return;

      sock.on('group:message',         onMessage);
      sock.on('group:message-edited',  onEdited);
      sock.on('group:message-deleted', onDeleted);
      sock.on('group:pool-updated',    onPoolUpdated);
      sock.on('group:created',         onGroupChanged);
      sock.on('group:updated',         onGroupChanged);
      sock.on('group:member-added',    onGroupChanged);
      sock.on('group:member-removed',  onGroupChanged);
      sock.on('group:dissolved',       onGroupChanged);
    })();

    return () => {
      cancelled = true;
      if (sock) {
        sock.off('group:message',         onMessage);
        sock.off('group:message-edited',  onEdited);
        sock.off('group:message-deleted', onDeleted);
        sock.off('group:pool-updated',    onPoolUpdated);
        sock.off('group:created',         onGroupChanged);
        sock.off('group:updated',         onGroupChanged);
        sock.off('group:member-added',    onGroupChanged);
        sock.off('group:member-removed',  onGroupChanged);
        sock.off('group:dissolved',       onGroupChanged);
      }
    };
  }, [qc]);
}
