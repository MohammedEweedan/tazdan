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
  parentId?: string | null;
  author: { id?: string; displayName: string; username?: string | null; avatarUrl?: string | null; avatarEmoji?: string | null };
  tag: 'BULLISH' | 'BEARISH' | 'WATCH';
  body: string;
  createdAt: string | number | Date;
  likeCount?: number;
  likedByMe?: boolean;
  replyCount?: number;
  replies?: RealtimeDiscussionPost[];
}

function upsertDiscussionPost(list: RealtimeDiscussionPost[], post: RealtimeDiscussionPost): RealtimeDiscussionPost[] {
  if (post.parentId) {
    return list.map((item) => {
      if (item.id !== post.parentId) return item;
      const replies = item.replies ?? [];
      const nextReplies = replies.some((reply) => reply.id === post.id)
        ? replies.map((reply) => reply.id === post.id ? { ...reply, ...post } : reply)
        : [...replies, post];
      return {
        ...item,
        replyCount: Math.max(item.replyCount ?? 0, nextReplies.length),
        replies: nextReplies,
      };
    });
  }
  return list.some((x) => x.id === post.id)
    ? list.map((x) => x.id === post.id ? { ...x, ...post } : x)
    : [post, ...list];
}

function removeDiscussionPost(list: RealtimeDiscussionPost[], id: string): RealtimeDiscussionPost[] {
  return list
    .filter((x) => x.id !== id)
    .map((x) => {
      const replies = (x.replies ?? []).filter((reply) => reply.id !== id);
      return replies.length === (x.replies ?? []).length
        ? x
        : { ...x, replies, replyCount: Math.max(0, (x.replyCount ?? 1) - 1) };
    });
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
      qc.setQueryData<RealtimeDiscussionPost[]>(key, (cur = []) => upsertDiscussionPost(cur, post));
    };
    const onUpdated = (payload: { post?: RealtimeDiscussionPost }) => {
      const post = payload?.post;
      if (!post) return;
      qc.setQueryData<RealtimeDiscussionPost[]>(key, (cur = []) => upsertDiscussionPost(cur, post));
    };
    const onRemoved = (payload: { id?: string }) => {
      if (!payload?.id) return;
      qc.setQueryData<RealtimeDiscussionPost[]>(key, (cur = []) => removeDiscussionPost(cur, payload.id!));
    };

    (async () => {
      socket = await getSocket();
      if (cancelled) return;
      socket.emit('discussion:join', sym);
      socket.on('discussion:new', onNew);
      socket.on('discussion:updated', onUpdated);
      socket.on('discussion:removed', onRemoved);
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('discussion:leave', sym);
        socket.off('discussion:new', onNew);
        socket.off('discussion:updated', onUpdated);
        socket.off('discussion:removed', onRemoved);
      }
    };
  }, [symbol, qc]);
}
