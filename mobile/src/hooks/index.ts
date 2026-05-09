/**
 * Domain hooks built on React Query. Each hook owns its query key, its
 * service call, and the cache shape — screens just consume the hook.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import {
  walletService, transactionService, marketsService, p2pService, cardsService,
  swapService, profileService, notificationService,
} from '@/services';
import { useBinanceLive } from './useLivePrice';

export { useHaptics } from './useHaptics';
export {
  useConversations, useThread, useBlocks,
  useSendMessage, useEditMessage, useDeleteMessage,
  useBlockUser, useUnblockUser, useReportMessage, useEscalateP2P,
  useMessageRealtime,
} from './useMessages';

export const useWallets = () =>
  useQuery({
    queryKey: QUERY_KEYS.wallets,
    queryFn: walletService.list,
    // Auto-refresh every 5s so the home dashboard always reflects the
    // latest balances even if a transaction lands while the user is
    // looking at the screen. The query stays "fresh" between refetches
    // so we don't double-fire on focus.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    staleTime: 4_000,
  });

export const useTransactions = (page = 1) =>
  useQuery({
    queryKey: QUERY_KEYS.transactions(page),
    queryFn: () => transactionService.list(page),
  });

export const useMarkets = () => {
  const live = useBinanceLive();
  const query = useQuery({
    queryKey: QUERY_KEYS.markets,
    queryFn: marketsService.tickers,
    refetchInterval: 30_000,
  });

  return {
    ...query,
    data: query.data?.map((ticker) => {
      const lp = live[ticker.base];
      if (!lp) return ticker;
      return {
        ...ticker,
        price: lp.price,
        changePct24h: lp.changePct24h,
        volume24h: lp.volume24h,
      };
    }),
  };
};

export const useP2POffers = (filter: 'BUY' | 'SELL' | 'ALL' = 'ALL') =>
  useQuery({
    queryKey: QUERY_KEYS.p2pOffers(filter),
    queryFn: () => p2pService.offers(filter),
  });

export const useMyP2PListings = () =>
  useQuery({ queryKey: QUERY_KEYS.p2pMyListings, queryFn: p2pService.myListings });

export const useMyP2PTrades = () =>
  useQuery({
    queryKey: QUERY_KEYS.p2pMyTrades,
    queryFn: p2pService.myTrades,
    refetchInterval: 15_000, // poll while user is on the trades screen
  });

export const useCards = () =>
  useQuery({ queryKey: QUERY_KEYS.cards, queryFn: cardsService.list });

export const usePublicProfile = (handle: string | undefined) =>
  useQuery({
    queryKey: QUERY_KEYS.publicProfile(handle ?? ''),
    queryFn: () => profileService.byHandle(handle!),
    enabled: !!handle,
  });

/* ── Mutations ───────────────────────────────────── */

/** Pull a clean error message out of an axios-shaped error. */
export function extractErrorMessage(e: unknown, fallback = 'Please try again.'): string {
  const ax = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
  return ax?.response?.data?.error ?? ax?.response?.data?.message ?? ax?.message ?? fallback;
}

/** Atomic wallet swap. Used by the Buy + Sell screens. */
export function useSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: swapService.swap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCreateP2PListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: p2pService.createListing,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyListings });
      qc.invalidateQueries({ queryKey: ['p2p-offers'] });
    },
  });
}

export function useCancelP2PListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: p2pService.cancelListing,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyListings });
      qc.invalidateQueries({ queryKey: ['p2p-offers'] });
    },
  });
}

export function useUpdateMyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileService.updateMe,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-profile'] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.me });
    },
  });
}

export function useInitiateP2PTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: p2pService.initiateTrade,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
    },
  });
}

/* ── Notifications ──────────────────────────────────── */

export const useNotifications = () =>
  useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => notificationService.list(),
    refetchInterval: 15_000,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: QUERY_KEYS.unreadCount,
    queryFn: () => notificationService.unreadCount(),
    refetchInterval: 15_000,
  });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.unreadCount });
    },
  });
}
