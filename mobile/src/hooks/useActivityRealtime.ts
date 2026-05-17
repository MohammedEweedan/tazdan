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
    })();

    return () => {
      cancelled = true;
      socket?.off('activity:new');
    };
  }, [currentUserId, qc]);
}
