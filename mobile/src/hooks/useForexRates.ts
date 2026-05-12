import { useQuery } from '@tanstack/react-query';

const FOREX_URL = 'https://open.er-api.com/v6/latest/USD';

export function useForexRates() {
  return useQuery({
    queryKey: ['forex-rates'],
    queryFn: async () => {
      const res = await fetch(FOREX_URL);
      if (!res.ok) throw new Error('Forex fetch failed');
      const json = await res.json();
      return (json.rates ?? {}) as Record<string, number>;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: 2,
    retryDelay: 5000,
  });
}
