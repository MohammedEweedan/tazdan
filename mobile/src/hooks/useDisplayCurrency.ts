import { useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useI18n } from '@/store/i18nStore';
import { fiatSymbol } from '@/constants';
import { useForexRates } from './useForexRates';
import { useBackendTickers } from './useBackendTickers';

// English/default fiat symbols (locale-agnostic snapshot). For locale-aware
// display use `fiatSymbol(code, locale)` from constants — the hook below does.
const FIAT_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£',
  AED: 'AED', SAR: 'SAR', EGP: 'E£', LYD: 'LD',
  CHF: 'Fr', JPY: '¥', CAD: 'CA$', AUD: 'A$',
};

const CRYPTO_SYMBOLS: Record<string, string> = {
  USDT: '$', BTC: '₿', ETH: 'Ξ', BNB: 'B', SOL: '◎',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  ...FIAT_SYMBOLS,
  ...CRYPTO_SYMBOLS,
};

const FIAT_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'CHF', 'JPY', 'CAD', 'AUD']);

export function useDisplayCurrency() {
  const baseCurrency: string = useAuthStore((s) => (s.user as any)?.baseCurrency ?? 'USD');
  const locale = useI18n((s) => s.locale);
  const { data: rates } = useForexRates();
  const { data: tickers } = useBackendTickers();

  const rate = useMemo(() => {
    if (baseCurrency === 'USD') return 1;
    if (FIAT_CURRENCIES.has(baseCurrency)) {
      return rates?.[baseCurrency] ?? 1;
    }
    // Crypto base: convert USD → crypto via live price
    const ticker = tickers?.find((t) => t.base === baseCurrency);
    return ticker && ticker.price > 0 ? 1 / ticker.price : 1;
  }, [baseCurrency, rates, tickers]);

  const isCrypto = !FIAT_CURRENCIES.has(baseCurrency);
  // Fiat → locale-aware, font-safe glyph; crypto → its ticker symbol.
  const symbol = isCrypto
    ? (CRYPTO_SYMBOLS[baseCurrency] ?? (baseCurrency + ' '))
    : fiatSymbol(baseCurrency, locale);

  function convert(usdAmount: number): number {
    return usdAmount * rate;
  }

  // Format a USD-denominated number into the display currency string.
  // Always x,xxx,xxx.xx format (2 decimal places for fiat, up to 6 for crypto).
  function fmt(usdAmount: number): string {
    const n = convert(usdAmount);
    const decimals = isCrypto ? (baseCurrency === 'BTC' ? 6 : 4) : 2;
    const formatted = n.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });
    // Prefix symbols that precede the number; suffix for others
    if (symbol === 'د.إ' || symbol === '﷼' || symbol === 'E£') {
      return symbol + ' ' + formatted;
    }
    return symbol + formatted;
  }

  // Format an already-converted number (not USD) in the display currency.
  function fmtDirect(amount: number): string {
    const decimals = isCrypto ? (baseCurrency === 'BTC' ? 6 : 4) : 2;
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });
    if (symbol === 'د.إ' || symbol === '﷼' || symbol === 'E£') {
      return symbol + ' ' + formatted;
    }
    return symbol + formatted;
  }

  return { symbol, rate, convert, fmt, fmtDirect, currency: baseCurrency, isCrypto };
}
