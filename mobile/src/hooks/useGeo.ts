import { useQuery } from '@tanstack/react-query';
import { geoService, type Country, type Bank, type PlatformBank } from '@/services/geoService';

export const useCountries = () =>
  useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn:  geoService.getCountries,
    staleTime: 24 * 60 * 60 * 1000,
  });

export const useBanksByCountry = (cca2: string | null | undefined) =>
  useQuery<Bank[]>({
    queryKey: ['banks', (cca2 ?? '').toUpperCase()],
    queryFn:  () => geoService.getBanksByCountry((cca2 ?? '').toUpperCase()),
    enabled:  !!cca2 && cca2.length === 2,
    staleTime: 60 * 60 * 1000,
  });

export const usePaymentMethods = (cca2: string | null | undefined) =>
  useQuery<string[]>({
    queryKey: ['payment-methods', (cca2 ?? '').toUpperCase()],
    queryFn:  () => geoService.getPaymentMethods((cca2 ?? '').toUpperCase()),
    enabled:  !!cca2 && cca2.length === 2,
    staleTime: 60 * 60 * 1000,
  });

export const usePlatformBanks = (currency?: string) =>
  useQuery<PlatformBank[]>({
    queryKey: ['platform-banks', currency ?? 'ALL'],
    queryFn:  () => geoService.getPlatformBanks(currency),
    staleTime: 5 * 60 * 1000,
  });
