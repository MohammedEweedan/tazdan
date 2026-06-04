/**
 * Messaging hooks — React Query CRUD + Socket.IO live updates.
 *
 *   useConversations()  — list of partners (5s poll + ws push)
 *   useThread(userId)   — full conversation, marks inbound as read
 *   useSendMessage()    — text or PAYMENT receipt (optimistic append)
 *   useEditMessage()    — edit own TEXT within 5 minutes
 *   useDeleteMessage()  — soft delete own message
 *   useBlockUser()      — block / unblock helpers
 *   useReportMessage()  — file a report
 *   useEscalateP2P()    — escalate trade thread to support
 *   useMessageRealtime()— mounts a single ws subscriber per query client
 *
 * Optimistic strategy: the send mutation appends a placeholder bubble
 * with `id: 'local_…'` and `isRead=false`. When the server response or
 * the ws push lands, the real row replaces the placeholder by
 * `txRef`/`createdAt` heuristics. Edit + delete update in place.
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import { QUERY_KEYS } from '@/constants';
import { messageService } from '@/services';
import { getSocket } from '@/lib/socket';
import type {
  ApiMessage, BlockedUser, Conversation,
} from '@/types/messages';

// ── Queries ────────────────────────────────────────────────────────

export const useConversations = () =>
  useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn:  messageService.conversations,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

export const useThread = (userId: string | undefined) =>
  useQuery<ApiMessage[]>({
    queryKey: ['thread', userId ?? '_none'] as const,
    queryFn:  () => messageService.thread(userId!),
    enabled:  !!userId,
    // Websockets deliver messages live (see useMessageRealtime). The poll is
    // just a slow safety net for a missed socket event — an 8s poll fought the
    // socket and clobbered optimistic bubbles (the jank). 30s is plenty.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

export const useBlocks = () =>
  useQuery({
    queryKey: QUERY_KEYS.blocks,
    queryFn:  messageService.blocks,
    staleTime: 30_000,
  });

// ── Mutations ──────────────────────────────────────────────────────

/** Stable-ish unique id for this client's optimistic message. */
function makeClientId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useSendMessage = (partnerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    // Attach a clientId idempotency key so the placeholder, the HTTP response,
    // and the websocket echo all reference the SAME logical message — no more
    // fragile content-matching that double-posts on repeated text.
    mutationFn: (vars: Parameters<typeof messageService.send>[0] & { clientId?: string }) =>
      messageService.send(vars),
    onMutate: async (vars) => {
      const clientId = vars.clientId ?? makeClientId();
      vars.clientId = clientId;   // ensure the network payload carries it
      // Optimistic append — make the bubble appear instantly so the UI
      // never has to wait for the round-trip.
      await qc.cancelQueries({ queryKey: QUERY_KEYS.thread(partnerId) });
      const prev = qc.getQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId)) ?? [];
      const placeholder: ApiMessage = {
        id:         `local_${clientId}`,
        clientId,
        senderId:   'me',
        receiverId: vars.receiverId,
        content:    vars.content,
        type:       vars.type ?? 'TEXT',
        metadata:   vars.metadata ?? null,
        isRead:     false,
        readAt:     null,
        editedAt:   null,
        deletedAt:  null,
        tradeId:    vars.tradeId ?? null,
        createdAt:  new Date().toISOString(),
      };
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), [...prev, placeholder]);
      return { prev, clientId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.thread(partnerId), ctx.prev);
    },
    onSuccess: (real, _vars, ctx) => {
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) => {
        // Drop any row that's already the real one (the ws echo may have
        // landed first), then replace OUR placeholder (matched by clientId)
        // with the server row. Guard against the real id appearing twice.
        const withoutDupes = cur.filter(
          (m) => !(m.id === real.id && m.clientId !== ctx?.clientId),
        );
        const hasReal = withoutDupes.some((m) => m.id === real.id);
        return withoutDupes
          .map((m) => (m.clientId && m.clientId === ctx?.clientId
            ? (hasReal ? null : real)   // if real already present, mark placeholder for removal
            : m))
          .filter(Boolean) as ApiMessage[];
      });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useEditMessage = (partnerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; content: string }) =>
      messageService.edit(vars.id, vars.content),
    onSuccess: (updated) => {
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) =>
        cur.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  });
};

export const useDeleteMessage = (partnerId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messageService.remove(id),
    onSuccess: (updated) => {
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) =>
        cur.map((m) => (m.id === updated.id ? updated : m)),
      );
      qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useBlockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; reason?: string }) =>
      messageService.block(vars.userId, vars.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.blocks });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

export const useUnblockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => messageService.unblock(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.blocks });
    },
  });
};

export const useReportMessage = () =>
  useMutation({ mutationFn: messageService.report });

export const useEscalateP2P = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: messageService.escalate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  });
};

// ── Realtime bridge ────────────────────────────────────────────────

/**
 * Mount once near the auth boundary (e.g. (tabs)/_layout). Subscribes
 * to message:* and block:* events and reconciles the cache so every
 * screen sees fresh data without any explicit refetch.
 */
export function useMessageRealtime(currentUserId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!currentUserId) return;
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      socket = await getSocket();
      if (cancelled) return;

      const onNew = (m: ApiMessage & { clientId?: string | null }) => {
        const partnerId = m.senderId === currentUserId ? m.receiverId : m.senderId;
        qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) => {
          // Already have the real row → no-op (the HTTP onSuccess beat us here).
          if (cur.some((x) => x.id === m.id)) return cur;
          // Our own echo: replace the optimistic placeholder by its clientId —
          // exact, never content-based, so repeated text can't duplicate.
          if (m.clientId) {
            const idx = cur.findIndex((x) => x.clientId === m.clientId);
            if (idx !== -1) return cur.map((x, i) => (i === idx ? m : x));
          }
          // Genuinely new inbound message → append.
          return [...cur, m];
        });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      };
      const onUpdate = (m: ApiMessage) => {
        const partnerId = m.senderId === currentUserId ? m.receiverId : m.senderId;
        qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) =>
          cur.map((x) => (x.id === m.id ? m : x)),
        );
      };
      const onDelete = (m: ApiMessage) => onUpdate(m);  // soft-delete is just an update

      const onRead = (payload: { by: string; ids?: string[]; partnerId?: string }) => {
        // Mark my outbound messages to that partner as read.
        const partnerId = payload.by;
        qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur = []) =>
          cur.map((x) =>
            x.senderId === currentUserId && (!payload.ids || payload.ids.includes(x.id))
              ? { ...x, isRead: true, readAt: new Date().toISOString() }
              : x,
          ),
        );
      };

      const onBlock = () => {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.blocks });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      };

      socket.on('message:new',    onNew);
      socket.on('message:update', onUpdate);
      socket.on('message:delete', onDelete);
      socket.on('message:read',   onRead);
      socket.on('block:new',      onBlock);
      socket.on('block:remove',   onBlock);
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off('message:new');
        socket.off('message:update');
        socket.off('message:delete');
        socket.off('message:read');
        socket.off('block:new');
        socket.off('block:remove');
      }
    };
  }, [currentUserId, qc]);
}
