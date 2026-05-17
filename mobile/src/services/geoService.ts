/**
 * Geo + banking service — replaces the hardcoded country/bank lists in
 * the mobile bundle with dynamic lookups against the server.
 *
 *   getCountries()              → every country in the world (cached on
 *                                 the server, 24h TTL).
 *   getBanksByCountry(cca2)     → live bank list via IBAN.com → OpenIban
 *                                 → local cache fallback chain.
 *   getPaymentMethods(cca2)     → derived list of accepted methods.
 *   getPlatformBanks(currency)  → admin-managed beneficiary accounts.
 */
import { api } from '@/lib/api';

export interface Country {
  cca2: string;
  cca3: string;
  name: string;
  flag: string;
  region?: string;
  currencies: string[];
  dialCode?: string;
}

export interface Bank {
  name: string;
  bic?: string;
  swift?: string;
  bankCode?: string;
}

export interface PlatformBank {
  id: string;
  currency: string;
  country: string;
  bankName: string;
  accountName: string;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  sortCode?: string | null;
  routingNumber?: string | null;
  branch?: string | null;
  memo?: string | null;
  isActive: boolean;
}

export const geoService = {
  async getCountries(): Promise<Country[]> {
    try {
      const { data } = await api.get('/countries');
      return data?.countries ?? [];
    } catch {
      return [];
    }
  },

  async getBanksByCountry(cca2: string): Promise<Bank[]> {
    if (!cca2 || cca2.length !== 2) return [];
    try {
      const { data } = await api.get(`/countries/${cca2.toUpperCase()}/banks`);
      const banks = data?.banks;
      if (Array.isArray(banks)) {
        return banks.map((b: any) =>
          typeof b === 'string' ? { name: b } : { name: b?.name ?? String(b), bic: b?.bic, swift: b?.swift, bankCode: b?.bankCode }
        );
      }
      return [];
    } catch {
      return [];
    }
  },

  async getPaymentMethods(cca2: string): Promise<string[]> {
    if (!cca2 || cca2.length !== 2) return [];
    try {
      const { data } = await api.get(`/countries/${cca2.toUpperCase()}/payment-methods`);
      return Array.isArray(data?.methods) ? data.methods : [];
    } catch {
      return [];
    }
  },

  async getPlatformBanks(currency?: string): Promise<PlatformBank[]> {
    try {
      const { data } = await api.get('/platform-banks', currency ? { params: { currency } } : undefined);
      return data?.items ?? [];
    } catch {
      return [];
    }
  },
};
