/**
 * Messaging hooks — React Query CRUD + Socket.IO live updates.
 *
 *   useConversations()  — list of partners (ws push + 30s safety poll)
 *   useThread(userId)   — latest page of a conversation, merged with what
 *                         is already on screen; marks inbound as read
 *   useLoadEarlier()    — pages older history in ("load earlier")
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
 *
 * Delivery on bad networks: the server is idempotent on `clientId`, so a send
 * that got no reply is kept as a "failed" bubble and resent with the SAME id
 * (tap to retry, or automatically on reconnect/foreground) — it can never
 * duplicate. Payments are never auto-resent; the screen offers the retry.
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { create } from 'zustand';

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

// ── Thread cache helpers ───────────────────────────────────────────

/** Messages per page; the server caps it at 200. */
const THREAD_PAGE = 60;

/** An optimistic bubble the server has not confirmed yet. */
export const isLocalMessage = (m: ApiMessage) => m.id.startsWith('local_');

/**
 * Could the message have reached the server? No reply, a timeout, 5xx or 429
 * — keep it and resend with the same clientId. A 4xx is a definite refusal.
 */
export function isTransientSendError(e: any): boolean {
  const status = e?.response?.status;
  return !status || status >= 500 || status === 408 || status === 429;
}

/** Whether older history exists beyond what each loaded thread holds. */
const useThreadMeta = create<{ hasEarlier: Record<string, boolean>; setHasEarlier: (id: string, v: boolean) => void }>((set) => ({
  hasEarlier: {},
  setHasEarlier: (id, v) => set((s) => (s.hasEarlier[id] === v ? s : { hasEarlier: { ...s.hasEarlier, [id]: v } })),
}));

const setLocalStatus = (qc: QueryClient, partnerId: string, clientId: string, localStatus: ApiMessage['localStatus']) =>
  qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) =>
    cur?.map((m) => (isLocalMessage(m) && m.clientId === clientId ? { ...m, localStatus } : m)));

/** Drop a local bubble (a refused send, or "Delete" on a failed one). */
export const removeLocalMessage = (qc: QueryClient, partnerId: string, clientId: string) =>
  qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) =>
    cur?.filter((m) => !(isLocalMessage(m) && m.clientId === clientId)));

/**
 * The server confirmed a send. The ws echo usually lands first (the server
 * emits before it responds) and has already swapped the placeholder for the
 * real row — keep exactly one row, at the placeholder's position.
 */
function reconcileSent(qc: QueryClient, partnerId: string, clientId: string | undefined, real: ApiMessage) {
  qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) => {
    if (!cur) return cur;
    const isThis = (m: ApiMessage) => m.id === real.id || (!!clientId && m.clientId === clientId);
    const at = cur.findIndex(isThis);
    if (at === -1) return [...cur, real];
    const keep = cur.find((m) => m.id === real.id) ?? real;
    return cur.flatMap((m, i) => (i === at ? [keep] : isThis(m) ? [] : [m]));
  });
}

/**
 * Fold the latest page into what the thread already shows: pages loaded with
 * "load earlier" stay (unless a gap opened while offline — then start over
 * from the latest page), server rows replace their cached copies, and
 * unconfirmed/failed bubbles stay at the end until their real row arrives.
 */
function mergeLatestPage(prev: ApiMessage[] | undefined, page: ApiMessage[]): { messages: ApiMessage[]; reset: boolean } {
  const server = (prev ?? []).filter((m) => !isLocalMessage(m));
  const pageIds = new Set(page.map((m) => m.id));
  const pageClientIds = new Set(page.map((m) => m.clientId).filter((c): c is string => !!c));
  const pending = (prev ?? []).filter((m) => isLocalMessage(m) && !(m.clientId && pageClientIds.has(m.clientId)));
  const first = page[0];
  if (!first) return { messages: pending, reset: true };
  const newestCached = server[server.length - 1];
  const connected = !newestCached || pageIds.has(newestCached.id)
    || +new Date(newestCached.createdAt) >= +new Date(first.createdAt);
  if (!server.length || !connected) return { messages: [...page, ...pending], reset: true };
  const older = server.filter((m) => !pageIds.has(m.id) && +new Date(m.createdAt) < +new Date(first.createdAt));
  return { messages: [...older, ...page, ...pending], reset: false };
}

/** The payload that recreates a local bubble's send (same clientId). */
export const resendVars = (m: ApiMessage) => ({
  receiverId: m.receiverId,
  content: m.content,
  type: m.type as 'TEXT' | 'PAYMENT' | 'REQUEST' | 'STICKER' | 'P2P_NOTE',
  metadata: m.metadata ?? undefined,
  tradeId: m.tradeId ?? undefined,
  clientId: m.clientId ?? undefined,
});

/** Resend every failed non-payment bubble in the loaded threads. */
async function resendFailed(qc: QueryClient) {
  for (const [key, data] of qc.getQueriesData<ApiMessage[]>({ queryKey: ['thread'] })) {
    const partnerId = key[1] as string;
    for (const m of data ?? []) {
      if (!isLocalMessage(m) || m.localStatus !== 'failed' || !m.clientId || m.type === 'PAYMENT') continue;
      setLocalStatus(qc, partnerId, m.clientId, 'sending');
      try {
        reconcileSent(qc, partnerId, m.clientId, await messageService.send(resendVars(m)));
      } catch {
        setLocalStatus(qc, partnerId, m.clientId, 'failed');
      }
    }
  }
}

// ── Queries ────────────────────────────────────────────────────────

export const useConversations = () =>
  useQuery({
    queryKey: QUERY_KEYS.conversations,
    queryFn:  messageService.conversations,
    // Sockets push changes and every reconnect/foreground refetches; the
    // poll is only a safety net.
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

export const useThread = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useQuery<ApiMessage[]>({
    queryKey: QUERY_KEYS.thread(userId ?? '_none'),
    queryFn: async () => {
      const page = await messageService.thread(userId!, { limit: THREAD_PAGE });
      const { messages, reset } = mergeLatestPage(qc.getQueryData<ApiMessage[]>(QUERY_KEYS.thread(userId!)), page.messages);
      // Only a fresh start decides whether older history exists; later polls
      // keep what "load earlier" found.
      if (reset) useThreadMeta.getState().setHasEarlier(userId!, page.hasMore);
      return messages;
    },
    enabled:  !!userId,
    // Websockets deliver messages live (see useMessageRealtime). The poll is
    // just a slow safety net for a missed socket event — an 8s poll fought the
    // socket and clobbered optimistic bubbles (the jank). 30s is plenty.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
};

/** Page older history into a loaded thread. Resolves to the number of rows added. */
export function useLoadEarlier(partnerId: string) {
  const qc = useQueryClient();
  const hasEarlier = useThreadMeta((s) => s.hasEarlier[partnerId] ?? false);
  const [loading, setLoading] = useState(false);
  const loadEarlier = useCallback(async (): Promise<number> => {
    const cur = qc.getQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId)) ?? [];
    const oldest = cur.find((m) => !isLocalMessage(m));
    if (!oldest || loading) return 0;
    setLoading(true);
    try {
      const page = await messageService.thread(partnerId, { limit: THREAD_PAGE, before: oldest.id });
      let added = 0;
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (now = []) => {
        const have = new Set(now.map((m) => m.id));
        const fresh = page.messages.filter((m) => !have.has(m.id));
        added = fresh.length;
        return [...fresh, ...now];
      });
      useThreadMeta.getState().setHasEarlier(partnerId, page.hasMore);
      return added;
    } catch {
      return 0;
    } finally {
      setLoading(false);
    }
  }, [qc, partnerId, loading]);
  return { hasEarlier, loading, loadEarlier };
}

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
      // A retry of a failed bubble reuses it in place.
      if (prev.some((m) => isLocalMessage(m) && m.clientId === clientId)) {
        setLocalStatus(qc, partnerId, clientId, 'sending');
        return { prev, clientId };
      }
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
        localStatus: 'sending',
      };
      qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), [...prev, placeholder]);
      return { prev, clientId };
    },
    onError: (err, vars, ctx) => {
      if (!ctx?.clientId) return;
      // Touch only our placeholder — restoring the pre-send snapshot would also
      // wipe any message that arrived over the socket while the request was in flight.
      // A message that may have reached the server stays as "failed" for a
      // same-id retry; a refused one (4xx) and every payment are removed.
      if (vars.type !== 'PAYMENT' && isTransientSendError(err)) setLocalStatus(qc, partnerId, ctx.clientId, 'failed');
      else removeLocalMessage(qc, partnerId, ctx.clientId);
      // A payment whose reply was lost may still have gone through: refetch so
      // its receipt shows if it did.
      if (vars.type === 'PAYMENT' && isTransientSendError(err)) qc.invalidateQueries({ queryKey: QUERY_KEYS.thread(partnerId) });
    },
    onSuccess: (real, _vars, ctx) => {
      // (Previously the echoed row was matched by clientId and dropped, so the
      // sent message vanished until the next poll.)
      reconcileSent(qc, partnerId, ctx?.clientId, real);
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
    const resync = () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      qc.invalidateQueries({ queryKey: ['thread'], refetchType: 'active' });
      void resendFailed(qc);
    };

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

      // I opened a thread on another device: clear the badge here too.
      const onSeen = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });

      handlers.push(
        ['message:new',       onNew],
        ['message:update',    onUpdate],
        ['message:delete',    onDelete],
        ['message:read',      onRead],
        ['conversation:seen', onSeen],
        ['block:new',         onBlock],
        ['block:remove',      onBlock],
        // (Re)connected: fetch what arrived while the socket was down and
        // resend anything that failed meanwhile.
        ['connect',           resync],
      );
      for (const [event, fn] of handlers) socket.on(event, fn);
    })();

    // Back in the foreground: the OS usually dropped the socket — reconnect
    // now instead of waiting out the backoff, and catch up.
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (socket && !socket.connected) socket.connect();
      resync();
    });

    return () => {
      cancelled = true;
      appState.remove();
      // Detach only OUR handlers. `off(event)` with no handler removed every
      // listener — so leaving a P2P trade chat (which mounts its own bridge)
      // silently killed the app-wide bridge and live replies stopped arriving.
      if (socket) for (const [event, fn] of handlers) socket.off(event, fn);
    };
  }, [currentUserId, qc]);
}
