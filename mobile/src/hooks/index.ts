/**
 * Domain hooks built on React Query. Each hook owns its query key, its
 * service call, and the cache shape — screens just consume the hook.
 */

import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { walletService, transactionService, marketsService, p2pService, cardsService } from '@/services';

export { useHaptics } from './useHaptics';

export const useWallets = () =>
  useQuery({ queryKey: QUERY_KEYS.wallets, queryFn: walletService.list });

export const useTransactions = (page = 1) =>
  useQuery({
    queryKey: QUERY_KEYS.transactions(page),
    queryFn: () => transactionService.list(page),
  });

export const useMarkets = () =>
  useQuery({
    queryKey: QUERY_KEYS.markets,
    queryFn: marketsService.tickers,
    refetchInterval: 8_000,    // 8s polling per spec
  });

export const useP2POffers = (filter: 'BUY' | 'SELL' | 'ALL' = 'ALL') =>
  useQuery({
    queryKey: QUERY_KEYS.p2pOffers(filter),
    queryFn: () => p2pService.offers(filter),
  });

export const useCards = () =>
  useQuery({ queryKey: QUERY_KEYS.cards, queryFn: cardsService.list });
