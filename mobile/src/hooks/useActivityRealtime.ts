/**
 * Subscribe to the `activity:new` socket event and invalidate the
 * unified activities cache so the home screen updates live whenever a
 * trade, transfer, withdrawal, P2P release, card spend, etc. lands.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

export function useActivityRealtime(currentUserId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!currentUserId) return;
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      socket = await getSocket();
      if (cancelled) return;

      const onActivity = () => {
        qc.invalidateQueries({ queryKey: ['activities'] });
        qc.invalidateQueries({ queryKey: ['transactions'] });
        qc.invalidateQueries({ queryKey: ['wallets'] });
      };

      socket.on('activity:new', onActivity);
      // Server emits these to user:{id} on on-chain settlement events.
      // A confirmed deposit is the single moment a user most wants to see
      // their balance move — refresh instantly instead of waiting out the
      // 15s wallet poll.
      socket.on('deposit:update', onActivity);
      socket.on('withdrawal:submitted', onActivity);
    })();

    return () => {
      cancelled = true;
      socket?.off('activity:new');
      socket?.off('deposit:update');
      socket?.off('withdrawal:submitted');
    };
  }, [currentUserId, qc]);
}
