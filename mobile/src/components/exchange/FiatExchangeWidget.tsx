import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { ConfirmAction, ltr } from '@/components/ui/ConfirmAction';
import { CTAButton } from '@/components/ui/ScreenShell';
import { useWallets, useHaptics } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useThemedPalette } from '@/store/themeStore';
import { fiatSymbol, getCurrencyMeta } from '@/constants';
import { swapService } from '@/services';

export const FIAT_EXCHANGE_CURRENCIES = ['LYD', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'];
export const isFiatExchangeCurrency = (currency?: string) => FIAT_EXCHANGE_CURRENCIES.includes((currency ?? '').toUpperCase());

/** Fiat pairs use the wallet conversion quote and settlement endpoints.
 *  The exact displayed credit is sent as the minimum acceptable credit. */
export function FiatExchangeWidget({ initialFrom, initialTo }: { initialFrom?: string; initialTo?: string }) {
  const p = useThemedPalette();
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const base = useAuthStore((s) => (s.user as any)?.baseCurrency ?? 'LYD');
  const router = useRouter();
  const h = useHaptics();
  const qc = useQueryClient();
  const { height } = useWindowDimensions();
  const { data: wallets = [] } = useWallets();
  const startFrom = isFiatExchangeCurrency(initialFrom) ? initialFrom!.toUpperCase() : isFiatExchangeCurrency(base) ? base : 'LYD';
  const startTo = isFiatExchangeCurrency(initialTo) && initialTo!.toUpperCase() !== startFrom
    ? initialTo!.toUpperCase() : startFrom === 'USD' ? 'LYD' : 'USD';
  const [from, setFrom] = useState(startFrom);
  const [to, setTo] = useState(startTo);
  const [amount, setAmount] = useState('');
  const [debounced, setDebounced] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof swapService.swap>> | null>(null);
  const submitting = useRef(false);
  const value = Number(amount);
  useEffect(() => {
    setError(null);
    const timer = setTimeout(() => setDebounced(Number(amount)), 300);
    return () => clearTimeout(timer);
  }, [amount]);
  const quote = useQuery({
    queryKey: ['fiat-exchange-quote', from, to, debounced],
    queryFn: () => swapService.quote({ from, to, amount: debounced }),
    enabled: from !== to && Number.isFinite(debounced) && debounced > 0 && !busy && !result,
    refetchInterval: 20_000, staleTime: 15_000, retry: 1,
  });
  const available = (currency: string) => {
    const wallet = wallets.find((w) => w.currency === currency);
    return Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.frozen ?? 0));
  };
  const items = useMemo<CurrencyItem[]>(() => FIAT_EXCHANGE_CURRENCIES.map((currency) => {
    const wallet = wallets.find((w) => w.currency === currency);
    return { currency, balance: Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.frozen ?? 0)),
      label: getCurrencyMeta(currency)?.name ?? currency, icon: fiatSymbol(currency, locale),
      color: p.accent, bg: p.accentSoft, kind: 'fiat' as const };
  }), [wallets, locale, p.accent, p.accentSoft]);
  const currentQuote = quote.data && quote.data.from === from && quote.data.to === to && Number(quote.data.amount) === value
    ? quote.data : undefined;
  const insufficient = value > available(from);
  const valid = value > 0 && Number.isFinite(value) && !insufficient && !!currentQuote && !quote.isFetching && !busy;
  const format = (n: number | string, currency: string) => Number(n).toLocaleString(locale === 'ar' ? 'ar-LY' : locale,
    { minimumFractionDigits: 2, maximumFractionDigits: getCurrencyMeta(currency)?.decimals ?? 2 });
  const changeCurrency = (side: 'from' | 'to', currency: string) => {
    if (busy) return;
    setError(null);
    if (side === 'from') { if (currency === to) setTo(from); setFrom(currency); }
    else { if (currency === from) setFrom(to); setTo(currency); }
  };
  async function exchange() {
    if (!valid || !currentQuote || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      const settled = await swapService.swap({ from, to, amount: value, minCredited: currentQuote.credited });
      setResult(settled); h.success();
      await Promise.all([qc.invalidateQueries({ queryKey: ['wallets'] }), qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['activities'] })]);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? t('fx.failed'));
      if (e?.response?.status === 409) await quote.refetch();
    } finally { submitting.current = false; setBusy(false); }
  }
  if (result) return (
    <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 20 }}>
      <Ionicons name="checkmark-circle" size={48} color={p.greenFg} style={{ alignSelf: 'center' }} />
      <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', textAlign: 'center' }}>{t('fx.complete')}</Text>
      <AmountDisplay value={format(result.credited, result.to)} symbol={fiatSymbol(result.to, locale)} palette={p} maxSize={54} />
      <Text style={{ color: p.fgMuted, fontSize: 15, textAlign: 'center' }}>
        {format(result.amount, result.from)} {result.from} → {format(result.credited, result.to)} {result.to}
      </Text>
      <CTAButton label={t('common.done')} onPress={() => router.back()} />
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>
        <Text accessibilityRole="header" style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -.5, marginBottom: 24 }}>
          {t('fx.title')}
        </Text>
        <View pointerEvents={busy ? 'none' : 'auto'}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{t('fx.youExchange')}</Text>
          <CurrencyPicker items={items} value={from} onChange={(currency) => changeCurrency('from', currency)} palette={p} />
          <View style={{ marginTop: 14 }}><AmountDisplay value={amount} symbol={fiatSymbol(from, locale)} palette={p} maxSize={height < 750 ? 44 : 52} tint={insufficient ? p.redFg : undefined} /></View>
          <Pressable onPress={() => setAmount(String(available(from)))} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <Text style={{ color: insufficient ? p.redFg : p.fgFaint, fontSize: 12 }}>{t('fx.available')}: {format(available(from), from)} {from}</Text>
          </Pressable>
          <Pressable accessibilityLabel={t('fx.reverse')} onPress={() => { h.selection(); setFrom(to); setTo(from); setError(null); }}
            style={{ alignSelf: 'center', width: 36, height: 36, borderRadius: 18, backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }}>
            <Ionicons name="swap-vertical" size={19} color={p.accentText} />
          </Pressable>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{t('fx.youReceive')}</Text>
          <CurrencyPicker items={items} value={to} onChange={(currency) => changeCurrency('to', currency)} palette={p} />
          <View style={{ marginTop: 14, minHeight: 42, alignItems: 'center', justifyContent: 'center' }}>
            {quote.isFetching && !currentQuote ? <ActivityIndicator color={p.fgMuted} /> :
              <Text style={{ color: p.fg, fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                {currentQuote ? `${fiatSymbol(to, locale)} ${format(currentQuote.credited, to)}` : '—'}
              </Text>}
          </View>
          <Text style={{ color: p.fgMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
            {currentQuote ? `1 ${from} = ${Number(currentQuote.rate).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${to}` : t('fx.enterAmount')}
          </Text>
        </View>
        {(error || quote.error || insufficient) && <Text style={{ color: p.redFg, fontSize: 13, textAlign: 'center', marginTop: 12 }}>
          {error ?? (insufficient ? t('fx.insufficient') : (quote.error as any)?.response?.data?.error ?? t('fx.quoteFailed'))}
        </Text>}
      </ScrollView>
      {/* Bottom spacing comes from ConfirmAction's dock (clear of the home indicator). */}
      <View pointerEvents={busy ? 'none' : 'auto'} style={{ paddingHorizontal: 20 }}>
        <NumericKeypad value={amount} onChange={setAmount} palette={p} maxDecimals={getCurrencyMeta(from)?.decimals ?? 2}
          keyHeight={height < 750 ? 40 : 48} fontSize={25} />
        <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'center', marginVertical: 10 }}>{t('fx.spreadNote')}</Text>
        <ConfirmAction
          action={t('confirm.act.exchange', { amount: ltr(`${format(value || 0, from)} ${from}`) })}
          prompt={insufficient ? t('fx.insufficient') : value > 0 ? t('confirm.priceRefresh') : t('buy.enterAmount')}
          disabled={!valid}
          status={busy ? 'loading' : 'idle'}
          onConfirm={exchange}
          review={currentQuote ? {
            amount: `${format(value, from)} ${from}`,
            rows: [
              { label: t('fx.youReceive'), value: `${format(currentQuote.credited, to)} ${to}` },
              { label: t('confirm.rate'), value: `1 ${from} = ${Number(currentQuote.rate).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${to}` },
            ],
            footnote: t('fx.spreadNote'),
          } : undefined}
        />
      </View>
    </View>
  );
}
