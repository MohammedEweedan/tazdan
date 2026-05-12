import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { marketsService } from '@/services';
import { useBinanceLive } from './useLivePrice';

export const useBackendTickers = () => {
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
      return { ...ticker, price: lp.price, changePct24h: lp.changePct24h, volume24h: lp.volume24h };
    }),
  };
};
