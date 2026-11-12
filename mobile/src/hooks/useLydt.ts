/**
 * LYDT as a wallet. The token lives on its own ledger (server: lydt.service),
 * not in /wallets, so screens that should show or move it — holdings, the
 * exchange, send, pay — add this wallet-shaped entry themselves. Screens that
 * can't move it (withdraw, budgets, cards, P2P, remittance) never see it.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lydtService } from '@/services';
import { useFeatures } from '@/hooks/useFeatures';
import { useUsdValue } from '@/hooks/useForexRates';
import type { Wallet } from '@/types';

export const LYDT = 'LYDT';
export const LYDT_QUERY_KEY = ['lydt-me'] as const;

export function useLydtWallet() {
  const features = useFeatures();
  const usdValue = useUsdValue();
  const q = useQuery({ queryKey: LYDT_QUERY_KEY, queryFn: lydtService.me, enabled: features.lydt, staleTime: 15_000 });
  const balance = Number(q.data?.balance ?? 0);
  const wallet = useMemo<Wallet | null>(() => {
    if (!features.lydt || !q.data) return null;
    return {
      id: 'lydt', currency: LYDT, balance: q.data.balance,
      // A frozen holder can't move any of it.
      frozen: q.data.frozen ? q.data.balance : '0',
      // Valued as dinars (1 LYDT = 1 LYD).
      fiatValueUsd: String(usdValue(balance, 'LYD') ?? 0),
    };
  }, [features.lydt, q.data, balance, usdValue]);
  return { enabled: features.lydt, wallet, balance, frozen: !!q.data?.frozen, refetch: q.refetch, isLoading: q.isLoading };
}
