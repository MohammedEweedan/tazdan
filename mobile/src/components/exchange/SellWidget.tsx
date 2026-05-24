/**
 * SellWidget — sell any token the user holds.
 * Uses the same quote + execute flow as BuyWidget.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, View, TextInput as RNTextInput, Modal } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette, useTheme, brand } from '@/store/themeStore';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { useWallets, useMarkets, extractErrorMessage, useTransactionSound } from '@/hooks';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { cryptoExchangeAPI, type CryptoQuote, type AssetSearchResult } from '@/lib/cryptoApi';

// ── Static metadata (kept in sync with BuyWidget) ────────────────────────────
const KNOWN: Record<string, { label: string; color: string; icon: string }> = {
  BTC:   { label: 'Bitcoin',     color: '#f7931a', icon: '₿'  },
  ETH:   { label: 'Ethereum',    color: '#627eea', icon: 'Ξ'  },
  SOL:   { label: 'Solana',      color: '#9945ff', icon: '◎'  },
  USDT:  { label: 'Tether',      color: '#26a17b', icon: '₮'  },
  USDC:  { label: 'USD Coin',    color: '#2775ca', icon: '◎'  },
  BNB:   { label: 'BNB',         color: '#f3ba2f', icon: '⬡'  },
  XRP:   { label: 'XRP',         color: '#346aa9', icon: '✕'  },
  ADA:   { label: 'Cardano',     color: '#0033ad', icon: '₳'  },
  DOGE:  { label: 'Dogecoin',    color: '#c3a634', icon: 'Ð'  },
  MATIC: { label: 'Polygon',     color: '#8247e5', icon: '◆'  },
  DOT:   { label: 'Polkadot',    color: '#e6007a', icon: '●'  },
  AVAX:  { label: 'Avalanche',   color: '#e84142', icon: '▲'  },
  LTC:   { label: 'Litecoin',    color: '#bfbbbb', icon: 'Ł'  },
  LINK:  { label: 'Chainlink',   color: '#2a5ada', icon: '⬡'  },
  UNI:   { label: 'Uniswap',     color: '#ff007a', icon: '🦄' },
  AAVE:  { label: 'Aave',        color: '#b6509e', icon: '👻' },
  ATOM:  { label: 'Cosmos',      color: '#6f7590', icon: '⚛'  },
  ALGO:  { label: 'Algorand',    color: '#000000', icon: 'Ⓐ'  },
  NEAR:  { label: 'NEAR',        color: '#000000', icon: '𝗡'  },
  FTM:   { label: 'Fantom',      color: '#1969ff', icon: 'F'  },
  VET:   { label: 'VeChain',     color: '#15bdff', icon: 'V'  },
  TRX:   { label: 'TRON',        color: '#ef0027', icon: 'T'  },
  XLM:   { label: 'Stellar',     color: '#7d00ff', icon: '*'  },
  FIL:   { label: 'Filecoin',    color: '#0090ff', icon: '⨎'  },
  SHIB:  { label: 'Shiba Inu',   color: '#e44d26', icon: '🐕' },
  PEPE:  { label: 'Pepe',        color: '#00a550', icon: '🐸' },
  WIF:   { label: 'dogwifhat',   color: '#9b4dca', icon: '🐶' },
  ARB:   { label: 'Arbitrum',    color: '#12aaff', icon: 'A'  },
  OP:    { label: 'Optimism',    color: '#ff0420', icon: 'O'  },
  SUI:   { label: 'Sui',         color: '#4da2ff', icon: 'S'  },
  APT:   { label: 'Aptos',       color: '#00d4aa', icon: 'Ⓐ'  },
  INJ:   { label: 'Injective',   color: '#00b0ff', icon: 'I'  },
  SEI:   { label: 'Sei',         color: '#9d4edd', icon: 'S'  },
  TON:   { label: 'Toncoin',     color: '#0098ea', icon: '💎' },
};

const DEFAULT_NETWORK: Record<string, string> = {
  BTC: 'BTC', ETH: 'ERC20', SOL: 'SOL', USDT: 'ERC20', USDC: 'ERC20',
  BNB: 'BEP20', XRP: 'XRP', ADA: 'Cardano', DOGE: 'DOGE', TRX: 'TRON',
  LTC: 'LTC', MATIC: 'ERC20',
};
function defaultNetwork(symbol: string) {
  return DEFAULT_NETWORK[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

function symbolColor(sym: string): string {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
}

function assetMeta(symbol: string): { label: string; color: string; icon: string } {
  return KNOWN[symbol.toUpperCase()] ?? {
    label: symbol.toUpperCase(),
    color: symbolColor(symbol),
    icon: symbol[0]?.toUpperCase() ?? '?',
  };
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼' };
function sym(c: string) { return CURRENCY_SYMBOLS[c] ?? c + ' '; }
function fmt(n: string | number, d = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });
}
function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
}

// Crypto-like currency keys that should appear in the sell picker
const CRYPTO_KEYS = new Set([
  'ETH','BTC','SOL','USDT','USDT_ERC20','USDT_TRC20',
  'BNB','XRP','ADA','DOGE','MATIC','DOT','AVAX','LTC','LINK',
  'UNI','AAVE','ATOM','ALGO','NEAR','FTM','VET','TRX','XLM',
  'FIL','SHIB','PEPE','WIF','ARB','OP','SUI','APT','INJ','SEI','TON',
  'USDC',
]);
function isCryptoKey(currency: string) {
  return CRYPTO_KEYS.has(currency.toUpperCase()) || !currency.match(/^(USD|EUR|GBP|AED|SAR|EGP|LYD|CAD|AUD|CHF|JPY|CNY)$/i);
}

export function SellWidget() {
  const { user } = useAuthStore();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const brandAccent = themeMode === 'dark' ? brand.primaryDark : brand.primary;
  const { data: wallets } = useWallets();
  const { data: tickers } = useMarkets();
  const { playSuccess } = useTransactionSound();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // ── Holdings with nonzero balance ────────────────────────────────
  const holdings = useMemo(() => {
    if (!wallets) return [];
    return wallets
      .filter((w) => isCryptoKey(w.currency) && parseFloat(w.balance) > 0)
      .map((w) => {
        const sym_ = w.currency.replace('_ERC20','').replace('_TRC20','');
        return { currency: w.currency, displaySymbol: sym_, balance: parseFloat(w.balance) };
      });
  }, [wallets]);

  // Default to first holding or BTC
  const [asset, setAsset] = useState('BTC');
  const [network, setNetwork] = useState('BTC');
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<RNTextInput>(null);

  // ── Trade state ───────────────────────────────────────────────────
  const [cryptoAmt, setCryptoAmt] = useState('');
  const [quote,    setQuote]    = useState<CryptoQuote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [exec,     setExec]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [seconds,  setSeconds]  = useState(0);
  const [showFees, setShowFees] = useState(false);
  const idemRef = useRef(`ord_${Date.now()}`);

  // Auto-select first holding
  useEffect(() => {
    if (holdings.length > 0 && !holdings.find((h) => h.displaySymbol === asset)) {
      setAsset(holdings[0].displaySymbol);
    }
  }, [holdings]);
  useEffect(() => { setNetwork(defaultNetwork(asset)); }, [asset]);

  // Current balance for selected asset
  const currentHolding = useMemo(() =>
    holdings.find((h) => h.displaySymbol === asset || h.currency === asset),
  [holdings, asset]);
  const balance = currentHolding?.balance ?? 0;

  const livePrice = tickers?.find((t) => t.base === asset)?.price
    ?? searchResults.find((r) => r.symbol === asset)?.price ?? 0;
  const change24h = tickers?.find((t) => t.base === asset)?.changePct24h
    ?? searchResults.find((r) => r.symbol === asset)?.change24h;

  // ── Live search (for asset sheet) ────────────────────────────────
  useEffect(() => {
    if (!assetSheetOpen) return;
    const q = searchQuery.trim();
    const id = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await cryptoExchangeAPI.search(q);
        setSearchResults(res.data.results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchQuery, assetSheetOpen]);

  useEffect(() => {
    if (assetSheetOpen) { setSearchQuery(''); setSearchResults([]); }
  }, [assetSheetOpen]);

  // Bumping this triggers a fresh quote without the user changing cryptoAmt/asset
  const [requoteKey, setRequoteKey] = useState(0);

  // ── Quote fetching ────────────────────────────────────────────────
  useEffect(() => {
    const amt = parseFloat(cryptoAmt);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({ asset, network, side: 'SELL', cryptoAmount: String(amt) });
        setQuote(res.data.quote);
        idemRef.current = `ord_${Date.now()}`;
      } catch (e: any) {
        setError(e?.response?.data?.error ?? 'Could not get quote');
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, network, cryptoAmt, requoteKey]);

  // ── Quote countdown — auto-requote on expiry ──────────────────────
  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
      setSeconds(s);
      if (s <= 0) {
        setQuote(null);
        setRequoteKey((k) => k + 1);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  // ── Confirm ───────────────────────────────────────────────────────
  async function onConfirm() {
    if (!quote) return;
    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({ quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemRef.current });
      playSuccess('sell');
      setSuccess(`${fmt(quote.cryptoAmount, 8)} ${asset} sold for ${sym(baseCurrency)}${fmt(quote.fiatAmount, 2)} ✓`);
      setQuote(null); setCryptoAmt('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.response?.data?.error ?? 'Order failed');
    } finally { setExec(false); }
  }

  const meta = assetMeta(asset);
  const overspend = parseFloat(cryptoAmt) > balance;
  const timerCritical = seconds > 0 && seconds < 8;
  const canConfirm = !!quote && !exec && seconds > 0 && !overspend;

  // Slider label — clean, seconds badge handles the countdown display
  const slideLabel = canConfirm
    ? `Slide to sell ${asset}`
    : overspend ? 'Insufficient balance' : 'Enter amount';

  // Asset sheet: show holdings first, then search results
  const displayList: AssetSearchResult[] = searchResults.length > 0
    ? searchResults
    : holdings.map((h) => ({
        symbol: h.displaySymbol,
        price: Number(tickers?.find((t) => t.base === h.displaySymbol)?.price ?? 0),
        change24h: tickers?.find((t) => t.base === h.displaySymbol)?.changePct24h ?? 0,
        volume24h: 0,
      }));

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Asset selector ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setAssetSheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 20,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 18, opacity: pressed ? 0.85 : 1,
        })}
      >
        <CoinAvatar sym={asset} color={meta.color} size={48} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600' }}>{meta.label}</Text>
            <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>{asset}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            {livePrice > 0 && (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                {sym(baseCurrency)}{fmtPrice(Number(livePrice))}
              </Text>
            )}
            {change24h !== undefined && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: Number(change24h) >= 0 ? p.greenBg : p.redBg }}>
                <Text style={{ color: Number(change24h) >= 0 ? p.greenFg : p.redFg, fontSize: 11, fontWeight: '700' }}>
                  {Number(change24h) >= 0 ? '+' : ''}{Number(change24h).toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
          backgroundColor: `${brandAccent}1f`,
          borderWidth: 1, borderColor: `${brandAccent}3a`,
          flexDirection: 'row', alignItems: 'center', gap: 4,
        }}>
          <Text style={{ color: brandAccent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>CHANGE</Text>
          <Ionicons name="chevron-down" size={13} color={brandAccent} />
        </View>
      </Pressable>

      {/* ── Amount input ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.9 }}>YOU SELL ({asset})</Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setCryptoAmt(String(balance)); setQuote(null); setError(null); }}
          hitSlop={8}
          style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
            backgroundColor: `${brandAccent}1f`,
            borderWidth: 1, borderColor: `${brandAccent}3a`,
          }}
        >
          <Text style={{ color: brandAccent, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>USE MAX</Text>
        </Pressable>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 20,
        borderWidth: 1.5, borderColor: overspend || error ? p.redFg : (parseFloat(cryptoAmt) > 0 ? brandAccent : p.border),
        paddingHorizontal: 18, marginBottom: 12,
      }}>
        <TextInput
          value={cryptoAmt}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
            setCryptoAmt(clean); setQuote(null); setError(null); setSuccess(null); setShowFees(false);
          }}
          placeholder="0.00000000"
          placeholderTextColor={p.fgFaint}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          style={{ flex: 1, color: p.fg, fontSize: 32, fontWeight: '600', paddingVertical: 18, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{asset}</Text>
      </View>

      {/* Balance row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 13, fontWeight: '500' }}>
          {overspend
            ? `Over by ${(parseFloat(cryptoAmt) - balance).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset}`
            : `Balance: ${balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${asset}`}
        </Text>
        {parseFloat(cryptoAmt) > 0 && !overspend && livePrice > 0 && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
            ≈ {sym(baseCurrency)}{(parseFloat(cryptoAmt) * Number(livePrice)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
      </View>

      {/* ── Quote panel ── */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1, borderColor: p.border,
        padding: 16, marginBottom: 14, minHeight: 72, justifyContent: 'center',
      }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={meta.color} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>Getting best price…</Text>
          </View>
        ) : quote ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 }}>YOU RECEIVE</Text>
                <Text style={{ color: p.fg, fontSize: 26, fontWeight: '500', letterSpacing: 0 }}>
                  {sym(baseCurrency)}{fmt(quote.fiatAmount, 2)}{' '}
                  <Text style={{ color: p.fgMuted, fontSize: 14 }}>USDT</Text>
                </Text>
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                backgroundColor: timerCritical ? 'rgba(239,68,68,0.12)' : p.pillBg,
                borderWidth: 1, borderColor: timerCritical ? p.redFg : p.border,
              }}>
                <Ionicons name="timer-outline" size={13} color={timerCritical ? p.redFg : p.fgMuted} />
                <Text style={{ color: timerCritical ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '500' }}>{seconds}s</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowFees(!showFees)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
                Fee  {sym(baseCurrency)}{fmt(Number(quote.platformFee) + Number(quote.networkFee), 2)}
              </Text>
              <Ionicons name={showFees ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgMuted} />
            </Pressable>
            {showFees && (
              <View style={{ marginTop: 10, gap: 6 }}>
                {[
                  ['Market price', `${sym(baseCurrency)}${fmtPrice(Number(quote.marketPrice))}`],
                  ['Your price',   `${sym(baseCurrency)}${fmtPrice(Number(quote.quotedPrice))}`],
                  ['Platform fee', `${sym(baseCurrency)}${fmt(quote.platformFee, 2)}`],
                  ['Network fee',  `${sym(baseCurrency)}${fmt(quote.networkFee, 2)}`],
                ].map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 12 }}>{k}</Text>
                    <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500' }}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={{ color: p.fgFaint, fontSize: 14, textAlign: 'center' }}>
            {parseFloat(cryptoAmt) > 0 && !overspend ? 'Fetching quote…' : 'Enter an amount to sell'}
          </Text>
        )}
      </View>

      {/* ── CTA — slide to confirm ── */}
      <SlideToConfirm
        label={slideLabel}
        onConfirm={() => { if (canConfirm && !error && !success) onConfirm(); }}
        enabled={canConfirm && !error && !success}
        status={exec ? 'loading' : success ? 'success' : error ? 'error' : 'idle'}
        successLabel={success || undefined}
        errorLabel={error || undefined}
        seconds={canConfirm ? seconds : undefined}
        totalSeconds={30}
        accent={brandAccent}
        accentEnd={brand.deep}
        accentFg="#ffffff"
        trackBg={p.bgElev}
        trackFg={p.fg}
        border={p.border}
        greenBg={p.greenBg} greenFg={p.greenFg}
        redBg="rgba(239,68,68,0.15)" redFg={p.redFg}
      />

      {/* ── Asset picker sheet ── */}
      <Modal visible={assetSheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAssetSheetOpen(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: p.border }}>
            <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '500' }}>Select asset to sell</Text>
            <Pressable onPress={() => setAssetSheetOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={p.fg} />
            </Pressable>
          </View>
          {/* Search bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, gap: 10 }}>
            <Ionicons name="search" size={16} color={p.fgMuted} />
            <TextInput
              ref={searchRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search any token…"
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: p.fg, fontSize: 15, paddingVertical: 12 }}
            />
            {searchLoading && <ActivityIndicator size="small" color={p.fgMuted} />}
          </View>
          {/* Section label */}
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginHorizontal: 20, marginBottom: 8 }}>
            {searchQuery.trim() ? 'SEARCH RESULTS' : 'YOUR HOLDINGS'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {displayList.map((item) => {
              const m = assetMeta(item.symbol);
              const holding = holdings.find((h) => h.displaySymbol === item.symbol);
              return (
                <Pressable
                  key={item.symbol}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAsset(item.symbol);
                    setCryptoAmt(''); setQuote(null); setError(null); setSuccess(null);
                    setAssetSheetOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 20, paddingVertical: 14,
                    backgroundColor: pressed ? p.bgElev : 'transparent',
                  })}
                >
                  <CoinAvatar sym={item.symbol} color={m.color} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{m.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={{ color: p.fgMuted, fontSize: 12 }}>{item.symbol}</Text>
                      {holding && (
                        <Text style={{ color: p.fgMuted, fontSize: 12 }}>
                          · {holding.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} held
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {item.price > 0 && (
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                        {sym(baseCurrency)}{fmtPrice(item.price)}
                      </Text>
                    )}
                    {item.change24h !== 0 && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: item.change24h >= 0 ? p.greenBg : p.redBg }}>
                        <Text style={{ color: item.change24h >= 0 ? p.greenFg : p.redFg, fontSize: 10, fontWeight: '500' }}>
                          {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
            {displayList.length === 0 && !searchLoading && (
              <Text style={{ color: p.fgFaint, textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                {searchQuery.trim() ? 'No results found' : 'No holdings yet — buy some crypto first'}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export default SellWidget;
