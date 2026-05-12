/**
 * BuyWidget — MoonPay-style buy/send sheet.
 * Single tappable asset row · large centered amount · live quote · full-width CTA.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette } from '@/store/themeStore';
import { useWallets, useCards, useMarkets } from '@/hooks';
import { cryptoExchangeAPI, type CryptoQuote } from '@/lib/cryptoApi';

// ── Asset / network metadata ──────────────────────────────────────────────────
const ASSET_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',   color: '#fb923c', bg: 'rgba(251,146,60,0.14)',  icon: '₿' },
  ETH:  { label: 'Ethereum',  color: '#818cf8', bg: 'rgba(129,140,248,0.14)', icon: 'Ξ' },
  SOL:  { label: 'Solana',    color: '#a78bfa', bg: 'rgba(167,139,250,0.14)', icon: '◎' },
  USDT: { label: 'Tether',    color: '#4ade80', bg: 'rgba(74,222,128,0.14)',  icon: '₮' },
  USD:  { label: 'US Dollar', color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  icon: '$' },
  EUR:  { label: 'Euro',      color: '#60a5fa', bg: 'rgba(96,165,250,0.14)',  icon: '€' },
  BNB:  { label: 'BNB',       color: '#f3ba2f', bg: 'rgba(243,186,47,0.14)',  icon: 'B' },
  XRP:  { label: 'XRP',       color: '#7eb8f7', bg: 'rgba(126,184,247,0.14)', icon: '✕' },
  ADA:  { label: 'Cardano',   color: '#3b82f6', bg: 'rgba(59,130,246,0.14)',  icon: '₳' },
  DOGE: { label: 'Dogecoin',  color: '#c3a634', bg: 'rgba(195,166,52,0.14)',  icon: 'Ð' },
  MATIC:{ label: 'Polygon',   color: '#8247e5', bg: 'rgba(130,71,229,0.14)',  icon: '◆' },
  DOT:  { label: 'Polkadot',  color: '#e6007a', bg: 'rgba(230,0,122,0.14)',   icon: '●' },
  AVAX: { label: 'Avalanche', color: '#e84142', bg: 'rgba(232,65,66,0.14)',   icon: '▲' },
  LTC:  { label: 'Litecoin',  color: '#bfbbbb', bg: 'rgba(191,187,187,0.14)', icon: 'Ł' },
  LINK: { label: 'Chainlink', color: '#2a5ada', bg: 'rgba(42,90,218,0.14)',   icon: '⬡' },
  DEFAULT: { label: 'Crypto', color: '#888888', bg: 'rgba(136,136,136,0.14)', icon: '◈' },
};

const NETWORKS: Record<string, string[]> = {
  BTC: ['BTC'], ETH: ['ERC-20'], SOL: ['SOL'], USDT: ['ERC-20', 'TRC-20'],
  BNB: ['BEP-20'], XRP: ['XRP'], ADA: ['Cardano'], DOGE: ['DOGE'],
  MATIC: ['ERC-20'], DOT: ['DOT'], AVAX: ['C-Chain'], LTC: ['LTC'],
  LINK: ['ERC-20'],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼',
};
function sym(c: string) { return CURRENCY_SYMBOLS[c] ?? c; }
function fmt(n: string | number, d = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });
}

type PayMethod =
  | { type: 'card';   last4: string; brand: string }
  | { type: 'fiat';   currency: string; balance: number }
  | { type: 'crypto'; asset: string; balance: number; balanceUsd: number };

function methodId(m: PayMethod) {
  if (m.type === 'card')   return `card_${m.last4}`;
  if (m.type === 'fiat')   return `fiat_${m.currency}`;
  return `crypto_${m.asset}`;
}

function methodLabel(m: PayMethod) {
  if (m.type === 'card')   return `${m.brand} ···· ${m.last4}`;
  if (m.type === 'fiat')   return `${m.currency}  ·  ${sym(m.currency)}${fmt(m.balance, 2)}`;
  return `${m.asset}  ·  ${fmt(m.balance, 6)} ${m.asset}`;
}

function methodIconBg(m: PayMethod) {
  if (m.type === 'card')   return 'rgba(96,165,250,0.14)';
  const key = m.type === 'fiat' ? m.currency : m.asset;
  return ASSET_META[key]?.bg ?? ASSET_META.DEFAULT.bg;
}

function methodIconText(m: PayMethod): string {
  if (m.type === 'card')   return '💳';
  const key = m.type === 'fiat' ? m.currency : m.asset;
  return ASSET_META[key]?.icon ?? key[0];
}

// ── Main component ────────────────────────────────────────────────────────────
export function BuyWidget() {
  const { user } = useAuthStore();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: tickers } = useMarkets();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // Available assets from market tickers
  const availableAssets = useMemo(() => {
    const priority = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LTC', 'LINK'];
    if (!tickers?.length) return priority.slice(0, 6);
    const fromTickers = Array.from(new Set(tickers.map((t) => t.base?.toUpperCase()).filter(Boolean)));
    return fromTickers.sort((a, b) => {
      const pa = priority.indexOf(a), pb = priority.indexOf(b);
      if (pa >= 0 && pb >= 0) return pa - pb;
      if (pa >= 0) return -1; if (pb >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [tickers]);

  // Payment methods
  const payMethods = useMemo<PayMethod[]>(() => {
    const out: PayMethod[] = [];
    wallets?.forEach((w) => {
      if (['BTC', 'ETH', 'USDT', 'SOL', 'BNB'].includes(w.currency)) {
        const ticker = tickers?.find((t) => t.base === w.currency);
        out.push({ type: 'crypto', asset: w.currency, balance: Number(w.balance), balanceUsd: ticker ? Number(w.balance) * Number(ticker.price) : 0 });
      } else {
        out.push({ type: 'fiat', currency: w.currency, balance: Number(w.balance) });
      }
    });
    cards?.forEach((c) => { if (c.last4) out.push({ type: 'card', last4: c.last4, brand: c.tier ?? 'Card' }); });
    return out;
  }, [wallets, cards, tickers]);

  const [asset,          setAsset]          = useState('BTC');
  const [network,        setNetwork]        = useState('BTC');
  const [payMethod,      setPayMethod]      = useState<PayMethod | null>(null);
  const [fiat,           setFiat]           = useState('');
  const [sendAddr,       setSendAddr]       = useState('');
  const [intent,         setIntent]         = useState<'buy' | 'send'>('buy');
  const [assetSearch,    setAssetSearch]    = useState('');
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [paySheetOpen,   setPaySheetOpen]   = useState(false);
  const [showFees,       setShowFees]       = useState(false);
  const [quote,          setQuote]          = useState<CryptoQuote | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [exec,           setExec]           = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [seconds,        setSeconds]        = useState(0);
  const [success,        setSuccess]        = useState<string | null>(null);
  const idemRef = useRef(`ord_${Date.now()}`);

  // Auto-select first pay method
  useEffect(() => { if (payMethods.length && !payMethod) setPayMethod(payMethods[0]); }, [payMethods, payMethod]);
  useEffect(() => { setNetwork(NETWORKS[asset]?.[0] ?? asset); }, [asset]);

  // Fetch quote with 500ms debounce
  useEffect(() => {
    const amt = parseFloat(fiat);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({ asset, network, side: 'BUY', fiatAmount: String(amt) });
        setQuote(res.data.quote);
        idemRef.current = `ord_${Date.now()}`;
      } catch (e: any) {
        setError(e?.response?.data?.error ?? 'Could not get quote');
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
  }, [asset, network, fiat, payMethod]);

  // Quote countdown
  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
      setSeconds(s);
      if (s <= 0) setQuote(null);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  const assetMeta = ASSET_META[asset] ?? ASSET_META.DEFAULT;
  const currentPrice = tickers?.find((t) => t.base === asset)?.price ?? 0;

  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return availableAssets;
    const q = assetSearch.toUpperCase();
    return availableAssets.filter((a) => a.includes(q) || ASSET_META[a]?.label?.toUpperCase().includes(q));
  }, [availableAssets, assetSearch]);

  async function onConfirm() {
    if (!quote || !payMethod) return;
    if (intent === 'send' && !sendAddr.trim()) { setError('Enter a recipient address'); return; }
    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({
        quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemRef.current,
        ...(intent === 'send' ? { recipientAddress: sendAddr.trim() } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(intent === 'send'
        ? `${fmt(quote.cryptoAmount, 8)} ${asset} sent`
        : `${fmt(quote.cryptoAmount, 8)} ${asset} purchased`);
      setQuote(null); setFiat(''); setSendAddr('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.response?.data?.error ?? 'Order failed');
    } finally { setExec(false); }
  }

  const timerCritical = seconds > 0 && seconds < 8;
  const canConfirm = !!quote && !exec && seconds > 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Asset selector row ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setAssetSheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 18,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 16,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: assetMeta.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: assetMeta.color }}>{assetMeta.icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800' }}>{assetMeta.label}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }}>
            {asset}{currentPrice > 0 ? `  ·  ${sym(baseCurrency)}${Number(currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={p.fgMuted} />
      </Pressable>

      {/* Network pills — only shown when multiple options */}
      {(NETWORKS[asset]?.length ?? 0) > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
          {NETWORKS[asset].map((n) => (
            <Pressable
              key={n}
              onPress={() => { Haptics.selectionAsync(); setNetwork(n); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: network === n ? p.ctaBg : p.bgElev,
                borderWidth: 1, borderColor: network === n ? p.ctaBg : p.border,
              }}
            >
              <Text style={{ color: network === n ? p.ctaFg : p.fgMuted, fontSize: 12, fontWeight: '700' }}>{n}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── Amount input ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>YOU PAY</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1.5, borderColor: error ? p.redFg : p.border,
        paddingHorizontal: 18, marginBottom: 10,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 22, fontWeight: '300', marginRight: 4 }}>{sym(baseCurrency)}</Text>
        <TextInput
          value={fiat}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            setFiat(clean); setQuote(null); setError(null); setSuccess(null); setShowFees(false);
          }}
          placeholder="0.00"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{ flex: 1, color: p.fg, fontSize: 34, fontWeight: '700', paddingVertical: 16, fontVariant: ['tabular-nums'] }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>{baseCurrency}</Text>
      </View>

      {/* Quick amounts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
        {[25, 50, 100, 250, 500].map((v) => (
          <Pressable
            key={v}
            onPress={() => { Haptics.selectionAsync(); setFiat(String(v)); setQuote(null); setError(null); }}
            style={({ pressed }) => ({
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: Number(fiat) === v ? p.ctaBg : p.bgElev,
              borderWidth: 1, borderColor: Number(fiat) === v ? p.ctaBg : p.border,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ color: Number(fiat) === v ? p.ctaFg : p.fgMuted, fontSize: 13, fontWeight: '700' }}>
              {sym(baseCurrency)}{v}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── You receive / quote panel ── */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1, borderColor: p.border,
        padding: 16, marginBottom: 14,
        minHeight: 72, justifyContent: 'center',
      }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={p.fg} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>Getting best price…</Text>
          </View>
        ) : quote ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
                  {intent === 'send' ? 'RECIPIENT RECEIVES' : 'YOU RECEIVE'}
                </Text>
                <Text style={{ color: p.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                  {fmt(quote.cryptoAmount, 8)}{' '}
                  <Text style={{ color: assetMeta.color, fontSize: 18 }}>{asset}</Text>
                </Text>
              </View>
              {/* Timer pill */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                backgroundColor: timerCritical ? 'rgba(239,68,68,0.12)' : p.pillBg,
                borderWidth: 1, borderColor: timerCritical ? p.redFg : p.border,
              }}>
                <Ionicons name="timer-outline" size={13} color={timerCritical ? p.redFg : p.fgMuted} />
                <Text style={{ color: timerCritical ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '800' }}>{seconds}s</Text>
              </View>
            </View>
            {/* Fee row */}
            <Pressable
              onPress={() => setShowFees(!showFees)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                Fee  {sym(baseCurrency)}{fmt(quote.platformFee + quote.networkFee, 2)}
              </Text>
              <Ionicons name={showFees ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgMuted} />
            </Pressable>
            {showFees && (
              <View style={{ marginTop: 8, gap: 5 }}>
                {[
                  { label: 'Platform fee (0.5%)', value: fmt(quote.platformFee, 2) },
                  { label: 'Network fee',          value: fmt(quote.networkFee, 2) },
                  { label: 'Exchange rate',        value: `1 ${asset} = ${sym(baseCurrency)}${fmt(quote.quotedPrice, 2)}` },
                  { label: 'Total you pay',        value: fmt(quote.totalUserPays, 2), bold: true },
                ].map(({ label, value, bold }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: bold ? '700' : '500' }}>{label}</Text>
                    <Text style={{ color: bold ? p.fg : p.fgMuted, fontSize: 12, fontWeight: bold ? '800' : '500' }}>
                      {bold ? `${sym(baseCurrency)}${value}` : value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
            {Number(fiat) > 0 ? (error ? '' : '…') : 'Enter an amount to see a live quote'}
          </Text>
        )}
      </View>

      {/* ── Pay with row ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setPaySheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 18,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 14,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', flex: 1 }}>Pay with</Text>
        {payMethod ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: methodIconBg(payMethod), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13 }}>{methodIconText(payMethod)}</Text>
            </View>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{methodLabel(payMethod)}</Text>
          </View>
        ) : (
          <Text style={{ color: p.fgMuted, fontSize: 13 }}>Select</Text>
        )}
        <Ionicons name="chevron-forward" size={15} color={p.fgFaint} style={{ marginLeft: 6 }} />
      </Pressable>

      {/* ── Intent toggle ── */}
      <View style={{ flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 14, padding: 3, borderWidth: 1, borderColor: p.border, marginBottom: 14 }}>
        {(['buy', 'send'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => { Haptics.selectionAsync(); setIntent(v); setQuote(null); setError(null); setSuccess(null); }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: intent === v ? p.ctaBg : 'transparent' }}
          >
            <Text style={{ color: intent === v ? p.ctaFg : p.fgMuted, fontSize: 12, fontWeight: '800' }}>
              {v === 'buy' ? 'To my wallet' : 'To address'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Send address */}
      {intent === 'send' && (
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 14,
          borderWidth: 1, borderColor: p.border,
          paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
        }}>
          <Ionicons name="wallet-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={sendAddr} onChangeText={setSendAddr}
            placeholder={`${asset} address`}
            placeholderTextColor={p.fgFaint}
            style={{ flex: 1, color: p.fg, fontSize: 13, marginLeft: 10 }}
            autoCapitalize="none" autoCorrect={false}
          />
        </View>
      )}

      {/* Error / success */}
      {error && !loading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <Ionicons name="alert-circle-outline" size={16} color={p.redFg} />
          <Text style={{ color: p.redFg, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.greenBg, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <Ionicons name="checkmark-circle-outline" size={16} color={p.greenFg} />
          <Text style={{ color: p.greenFg, fontSize: 13, flex: 1 }}>{success}</Text>
        </View>
      )}

      {/* ── CTA ── */}
      <Pressable
        onPress={onConfirm}
        disabled={!canConfirm}
        style={({ pressed }) => ({
          height: 56, borderRadius: 28,
          backgroundColor: canConfirm ? p.ctaBg : p.bgElev,
          borderWidth: canConfirm ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
          opacity: pressed || exec ? 0.85 : 1,
          shadowColor: canConfirm ? p.ctaBg : 'transparent',
          shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
        })}
      >
        {exec ? (
          <ActivityIndicator color={p.ctaFg} />
        ) : (
          <Text style={{ color: canConfirm ? p.ctaFg : p.fgMuted, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
            {quote
              ? `Buy ${asset} · ${sym(baseCurrency)}${fmt(quote.totalUserPays, 2)}`
              : `Buy ${asset}`}
          </Text>
        )}
      </Pressable>

      {/* ── Asset picker sheet ── */}
      <Modal visible={assetSheetOpen} transparent animationType="slide" onRequestClose={() => setAssetSheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setAssetSheetOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', paddingHorizontal: 24, marginBottom: 14 }}>Select Asset</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, backgroundColor: p.bgElev, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: p.border }}>
              <Ionicons name="search" size={16} color={p.fgMuted} />
              <TextInput
                value={assetSearch} onChangeText={setAssetSearch}
                placeholder="Search assets…" placeholderTextColor={p.fgFaint}
                style={{ flex: 1, color: p.fg, marginLeft: 8, fontSize: 14 }}
                autoCapitalize="characters"
              />
              {assetSearch.length > 0 && (
                <Pressable onPress={() => setAssetSearch('')}>
                  <Ionicons name="close-circle" size={16} color={p.fgMuted} />
                </Pressable>
              )}
            </View>
            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
              {filteredAssets.map((a) => {
                const m = ASSET_META[a] ?? ASSET_META.DEFAULT;
                const price = tickers?.find((t) => t.base === a)?.price ?? 0;
                return (
                  <Pressable
                    key={a}
                    onPress={() => { Haptics.selectionAsync(); setAsset(a); setQuote(null); setError(null); setAssetSheetOpen(false); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: p.border,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: m.color, fontSize: 20, fontWeight: '700' }}>{m.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{m.label}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{a}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {price > 0 && (
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>
                          {sym(baseCurrency)}{Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </Text>
                      )}
                      {asset === a && <Ionicons name="checkmark-circle" size={16} color={p.ctaBg} style={{ marginTop: 2 }} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Pay method sheet ── */}
      <Modal visible={paySheetOpen} transparent animationType="slide" onRequestClose={() => setPaySheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setPaySheetOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: 36 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', paddingHorizontal: 24, marginBottom: 16 }}>Pay with</Text>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {payMethods.map((m) => {
                const selected = payMethod ? methodId(m) === methodId(payMethod) : false;
                return (
                  <Pressable
                    key={methodId(m)}
                    onPress={() => { Haptics.selectionAsync(); setPayMethod(m); setPaySheetOpen(false); setQuote(null); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 12, borderRadius: 14, marginBottom: 8,
                      backgroundColor: selected ? p.bgElev : p.bgElev,
                      borderWidth: 1, borderColor: selected ? p.ctaBg : p.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: methodIconBg(m), alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16 }}>{methodIconText(m)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{methodLabel(m)}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 1 }}>
                        {m.type === 'card' ? 'Debit / credit card' : m.type === 'fiat' ? 'Fiat wallet' : 'Crypto balance'}
                      </Text>
                    </View>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? p.ctaBg : p.border, alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.ctaBg }} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default BuyWidget;
