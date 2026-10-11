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
 * with `id: 'local_…'` and `isRead=false`. Whichever of the HTTP response
 * or the ws echo lands first replaces it — matched by id, then by the
 * client-generated `clientId` (never by content). Edit + delete update in place.
 */

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import type { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { messageService, profileService } from '@/services';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import type {
  ApiMessage, BlockedUser, Conversation,
} from '@/types/messages';

/**
 * Reserved system handles that may appear in a `/messages/<x>` route instead of
 * a user id (e.g. the "Message tazdan Support" tile). The messaging API only
 * accepts user ids, so these must be resolved before a thread is opened.
 */
const SYSTEM_HANDLES = new Set(['support']);
export const isHandleParam = (raw: string): boolean =>
  raw.startsWith('@') || SYSTEM_HANDLES.has(raw.toLowerCase());

/** Resolve an @handle to a user id: conversation cache first, then the public profile. */
export async function resolveUserIdByHandle(qc: QueryClient, raw: string): Promise<string | null> {
  const handle = raw.replace(/^@/, '').toLowerCase();
  if (!handle) return null;
  const convs = qc.getQueryData<Conversation[]>(QUERY_KEYS.conversations) ?? [];
  const hit = convs.find((c) => c.partner.username?.toLowerCase() === handle);
  if (hit) return hit.partner.id;
  try {
    const profile = await profileService.byHandle(handle);
    return profile?.id ?? null;
  } catch {
    return null;
  }
}

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
        // Must be the real id: bubbles decide sides by `senderId === me.id`, so a
        // literal 'me' drew the pending bubble on the partner's side, then it jumped.
        senderId:   useAuthStore.getState().user?.id ?? 'me',
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
      // Remove only our placeholder — restoring the pre-send snapshot would also
      // wipe any message that arrived over the socket while the request was in flight.
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) =>
        cur?.filter((m) => !(m.id.startsWith('local_') && m.clientId === ctx?.clientId)),
      );
    },
    onSuccess: (real, _vars, ctx) => {
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) => {
        if (!cur) return cur;
        // Rows that are this message: the real id, or our placeholder by clientId.
        // The ws echo usually lands first (the server emits before it responds) and
        // has already swapped the placeholder for the real row — keep exactly one
        // row, at the placeholder's position. (Previously the echoed row was matched
        // by clientId and dropped, so the sent message vanished until the next poll.)
        const cid = ctx?.clientId;
        const isThis = (m: ApiMessage) => m.id === real.id || (!!cid && m.clientId === cid);
        const at = cur.findIndex(isThis);
        if (at === -1) return [...cur, real];
        const keep = cur.find((m) => m.id === real.id) ?? real;
        return cur.flatMap((m, i) => (i === at ? [keep] : isThis(m) ? [] : [m]));
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
    const handlers: Array<[string, (...args: any[]) => void]> = [];
    let cancelled = false;

    (async () => {
      socket = await getSocket();
      if (cancelled) return;

      // Thread caches are only patched once loaded. Seeding an unloaded thread
      // with just the pushed row made it look "fresh" (30s staleTime), so opening
      // it showed only that row — e.g. a support reply with the history missing.
      const onNew = (m: ApiMessage & { clientId?: string | null }) => {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
        // Not a party (e.g. an escalation notice addressed to the counterparty):
        // never file it under our thread with its sender.
        if (m.senderId !== currentUserId && m.receiverId !== currentUserId) return;
        const partnerId = m.senderId === currentUserId ? m.receiverId : m.senderId;
        const key = QUERY_KEYS.thread(partnerId);
        if (qc.getQueryData(key) === undefined) {
          qc.invalidateQueries({ queryKey: key });   // refetches only if it's on screen / loading
          return;
        }
        qc.setQueryData<ApiMessage[]>(key, (cur) => {
          if (!cur) return cur;
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
      };
      const onUpdate = (m: ApiMessage) => {
        const partnerId = m.senderId === currentUserId ? m.receiverId : m.senderId;
        qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) =>
          cur?.map((x) => (x.id === m.id ? m : x)),
        );
      };
      const onDelete = (m: ApiMessage) => onUpdate(m);  // soft-delete is just an update

      const onRead = (payload: { by: string; ids?: string[]; partnerId?: string }) => {
        // Mark my outbound messages to that partner as read.
        const partnerId = payload.by;
        // (cur) not (cur = []): a read receipt must never create an empty cache
        // for an unopened thread — it rendered as a blank conversation.
        qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) =>
          cur?.map((x) =>
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

      handlers.push(
        ['message:new',    onNew],
        ['message:update', onUpdate],
        ['message:delete', onDelete],
        ['message:read',   onRead],
        ['block:new',      onBlock],
        ['block:remove',   onBlock],
      );
      for (const [event, fn] of handlers) socket.on(event, fn);
    })();

    return () => {
      cancelled = true;
      // Detach only OUR handlers. `off(event)` with no handler removed every
      // listener — so leaving a P2P trade chat (which mounts its own bridge)
      // silently killed the app-wide bridge and live replies stopped arriving.
      if (socket) for (const [event, fn] of handlers) socket.off(event, fn);
    };
  }, [currentUserId, qc]);
}
