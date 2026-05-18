/**
 * Subscribe to the `notification:new` socket event so the bell-icon
 * badge and the in-app notifications list refresh the instant an
 * admin broadcast (or a system-driven alert) is created on the
 * server. Mounted from the home screen — wherever the badge lives.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { QUERY_KEYS } from '@/constants';

export function useNotificationRealtime(currentUserId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!currentUserId) return;
    let socket: Socket | null = null;
    let cancelled = false;

    (async () => {
      socket = await getSocket();
      if (cancelled) return;

      const onNotification = () => {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
      };

      socket.on('notification:new', onNotification);
    })();

    return () => {
      cancelled = true;
      socket?.off('notification:new');
    };
  }, [currentUserId, qc]);
}
