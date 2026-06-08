/**
 * Live asset-discussion feed. Joins the `discussion:<SYMBOL>` socket room while
 * the Discussions tab is open and patches the React Query cache in place when
 * other users post or a post is removed — no refetch needed.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

export interface RealtimeDiscussionPost {
  id: string;
  author: { id?: string; displayName: string; username?: string | null; avatarUrl?: string | null };
  tag: 'BULLISH' | 'BEARISH' | 'WATCH';
  body: string;
  createdAt: string | number | Date;
}

export function useDiscussionRealtime(symbol: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!symbol) return;
    const sym = symbol.toUpperCase();
    const key = ['asset-discussions', sym];
    let socket: Socket | null = null;
    let cancelled = false;

    const onNew = (payload: { post?: RealtimeDiscussionPost }) => {
      const post = payload?.post;
      if (!post) return;
      qc.setQueryData<RealtimeDiscussionPost[]>(key, (cur = []) =>
        cur.some((x) => x.id === post.id) ? cur : [post, ...cur],
      );
    };
    const onRemoved = (payload: { id?: string }) => {
      if (!payload?.id) return;
      qc.setQueryData<RealtimeDiscussionPost[]>(key, (cur = []) => cur.filter((x) => x.id !== payload.id));
    };

    (async () => {
      socket = await getSocket();
      if (cancelled) return;
      socket.emit('discussion:join', sym);
      socket.on('discussion:new', onNew);
      socket.on('discussion:removed', onRemoved);
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('discussion:leave', sym);
        socket.off('discussion:new', onNew);
        socket.off('discussion:removed', onRemoved);
      }
    };
  }, [symbol, qc]);
}
