import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useForexRates() {
  return useQuery({
    queryKey: ['forex-rates'],
    queryFn: async () => {
      const { data } = await api.get('/rates');
      return (data.rates ?? {}) as Record<string, number>;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 5000,
  });
}
