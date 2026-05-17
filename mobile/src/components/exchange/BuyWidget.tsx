/**
 * BuyWidget — search and buy any token on Binance.
 * Phantom × Binance × MoonPay energy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
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
import { cryptoExchangeAPI, type CryptoQuote, type AssetSearchResult } from '@/lib/cryptoApi';

// ── Static metadata for well-known coins ─────────────────────────────────────
// Everything else gets a generated colour from its ticker symbol.
const KNOWN: Record<string, { label: string; color: string; icon: string }> = {
  BTC:        { label: 'Bitcoin',       color: '#f7931a', icon: '₿'  },
  ETH:        { label: 'Ethereum',      color: '#627eea', icon: 'Ξ'  },
  SOL:        { label: 'Solana',        color: '#9945ff', icon: '◎'  },
  USDT:       { label: 'Tether (ERC20)',color: '#26a17b', icon: '₮'  },
  USDT_ERC20: { label: 'Tether (ERC20)',color: '#26a17b', icon: '₮'  },
  USDT_TRC20: { label: 'Tether (TRC20)',color: '#26a17b', icon: '₮'  },
  USDC:       { label: 'USD Coin',      color: '#2775ca', icon: '◎'  },
  BNB:        { label: 'BNB',           color: '#f3ba2f', icon: '⬡'  },
  XRP:        { label: 'XRP',           color: '#346aa9', icon: '✕'  },
  ADA:        { label: 'Cardano',       color: '#0033ad', icon: '₳'  },
  DOGE:       { label: 'Dogecoin',      color: '#c3a634', icon: 'Ð'  },
  MATIC:      { label: 'Polygon',       color: '#8247e5', icon: '◆'  },
  DOT:        { label: 'Polkadot',      color: '#e6007a', icon: '●'  },
  AVAX:       { label: 'Avalanche',     color: '#e84142', icon: '▲'  },
  LTC:        { label: 'Litecoin',      color: '#bfbbbb', icon: 'Ł'  },
  LINK:       { label: 'Chainlink',     color: '#2a5ada', icon: '⬡'  },
  UNI:        { label: 'Uniswap',       color: '#ff007a', icon: '🦄' },
  AAVE:       { label: 'Aave',          color: '#b6509e', icon: '👻' },
  ATOM:       { label: 'Cosmos',        color: '#6f7590', icon: '⚛'  },
  ALGO:       { label: 'Algorand',      color: '#6cc3a8', icon: 'Ⓐ'  },
  NEAR:       { label: 'NEAR',          color: '#00c08b', icon: '𝗡'  },
  FTM:        { label: 'Fantom',        color: '#1969ff', icon: 'F'  },
  VET:        { label: 'VeChain',       color: '#15bdff', icon: 'V'  },
  TRX:        { label: 'TRON',          color: '#ef0027', icon: 'T'  },
  XLM:        { label: 'Stellar',       color: '#7d00ff', icon: '*'  },
  FIL:        { label: 'Filecoin',      color: '#0090ff', icon: '⨎'  },
  SHIB:       { label: 'Shiba Inu',     color: '#e44d26', icon: '🐕' },
  PEPE:       { label: 'Pepe',          color: '#00a550', icon: '🐸' },
  WIF:        { label: 'dogwifhat',     color: '#9b4dca', icon: '🐶' },
  ARB:        { label: 'Arbitrum',      color: '#12aaff', icon: 'A'  },
  OP:         { label: 'Optimism',      color: '#ff0420', icon: 'O'  },
  SUI:        { label: 'Sui',           color: '#4da2ff', icon: 'S'  },
  APT:        { label: 'Aptos',         color: '#00d4aa', icon: 'Ⓐ'  },
  INJ:        { label: 'Injective',     color: '#00b0ff', icon: 'I'  },
  SEI:        { label: 'Sei',           color: '#9d4edd', icon: 'S'  },
  TON:        { label: 'Toncoin',       color: '#0098ea', icon: '💎' },
};

// Default network for each asset (server expects this in the quote call)
const DEFAULT_NETWORK: Record<string, string> = {
  BTC: 'BTC', ETH: 'ERC20', SOL: 'SOL',
  USDT: 'ERC20', USDT_ERC20: 'ERC20', USDT_TRC20: 'TRC20',
  USDC: 'ERC20', BNB: 'BEP20', XRP: 'XRP',
  ADA: 'Cardano', DOGE: 'DOGE', TRX: 'TRON', LTC: 'LTC', MATIC: 'ERC20',
};
// For USDT_ERC20 / USDT_TRC20 the asset sent to server must be "USDT"
const ASSET_SYMBOL: Record<string, string> = {
  USDT_ERC20: 'USDT',
  USDT_TRC20: 'USDT',
};
function defaultNetwork(symbol: string) {
  return DEFAULT_NETWORK[symbol.toUpperCase()] ?? symbol.toUpperCase();
}
function serverAsset(symbol: string) {
  return ASSET_SYMBOL[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

// Deterministic accent colour from ticker symbol for unknowns
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

// Top coins to show before the user searches (top 10 + USDT variants + popular alts)
const FEATURED = [
  'BTC','ETH','USDT_ERC20','USDT_TRC20',
  'BNB','XRP','SOL','DOGE','ADA','AVAX',
  'LTC','DOT','MATIC','LINK','UNI',
  'SHIB','PEPE','ARB','OP','TON',
];

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

type PayMethod =
  | { type: 'card';   last4: string; brand: string }
  | { type: 'fiat';   currency: string; balance: number }
  | { type: 'crypto'; asset: string; balance: number };

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

// ── Component ─────────────────────────────────────────────────────────────────
export function BuyWidget() {
  const { user } = useAuthStore();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: tickers } = useMarkets();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // ── Asset picker state ────────────────────────────────────────────
  const [asset,          setAsset]          = useState('BTC');
  const [network,        setNetwork]        = useState('BTC');
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState<AssetSearchResult[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const searchRef = useRef<TextInput>(null);

  // ── Trade state ───────────────────────────────────────────────────
  const [fiat,     setFiat]     = useState('');
  const [quote,    setQuote]    = useState<CryptoQuote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [exec,     setExec]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [seconds,  setSeconds]  = useState(0);
  const [showFees, setShowFees] = useState(false);
  const [intent,   setIntent]   = useState<'buy' | 'send'>('buy');
  const [sendAddr, setSendAddr] = useState('');
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const idemRef = useRef(`ord_${Date.now()}`);

  // ── Payment methods ───────────────────────────────────────────────
  const payMethods = useMemo<PayMethod[]>(() => {
    const out: PayMethod[] = [];
    wallets?.forEach((w) => {
      if (['BTC','ETH','USDT','SOL','BNB'].includes(w.currency)) {
        out.push({ type: 'crypto', asset: w.currency, balance: Number(w.balance) });
      } else {
        out.push({ type: 'fiat', currency: w.currency, balance: Number(w.balance) });
      }
    });
    cards?.forEach((c) => { if (c.last4) out.push({ type: 'card', last4: c.last4, brand: c.tier ?? 'Card' }); });
    return out;
  }, [wallets, cards]);

  useEffect(() => { if (payMethods.length && !payMethod) setPayMethod(payMethods[0]); }, [payMethods, payMethod]);
  useEffect(() => { setNetwork(defaultNetwork(asset)); }, [asset]);

  // ── Live search via server → Binance ─────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!assetSheetOpen) return;
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

  // Populate search when sheet opens
  useEffect(() => {
    if (assetSheetOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [assetSheetOpen]);

  // ── Quote fetching ────────────────────────────────────────────────
  useEffect(() => {
    const amt = parseFloat(fiat);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({ asset: serverAsset(asset), network, side: 'BUY', fiatAmount: String(amt) });
        setQuote(res.data.quote);
        idemRef.current = `ord_${Date.now()}`;
      } catch (e: any) {
        setError(e?.response?.data?.error ?? 'Could not get quote');
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
  }, [asset, network, fiat]);

  // ── Quote countdown ───────────────────────────────────────────────
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

  // ── Confirm ───────────────────────────────────────────────────────
  async function onConfirm() {
    if (!quote) return;
    if (intent === 'send' && !sendAddr.trim()) { setError('Enter a recipient address'); return; }
    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({
        quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemRef.current,
        ...(intent === 'send' ? { recipientAddress: sendAddr.trim() } : {}),
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(`${fmt(quote.cryptoAmount, 8)} ${asset} ${intent === 'send' ? 'sent' : 'purchased'} ✓`);
      setQuote(null); setFiat(''); setSendAddr('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.response?.data?.error ?? 'Order failed');
    } finally { setExec(false); }
  }

  const meta = assetMeta(asset);
  // USDT_ERC20/TRC20 map to the USDT ticker (price = $1, pegged)
  const tickerBase = serverAsset(asset);
  const livePrice = tickerBase === 'USDT' ? 1 : (tickers?.find((t) => t.base === tickerBase)?.price ?? searchResults.find((r) => r.symbol === tickerBase)?.price ?? 0);
  const change24h = searchResults.find((r) => r.symbol === tickerBase)?.change24h;
  const timerCritical = seconds > 0 && seconds < 8;
  const canConfirm = !!quote && !exec && seconds > 0;

  // Displayed list in picker: search results if query, else featured
  const displayList: AssetSearchResult[] = searchResults.length > 0
    ? searchResults
    : FEATURED.map((s) => {
        const base = serverAsset(s);
        const price = base === 'USDT' ? 1 : Number(tickers?.find((t) => t.base === base)?.price ?? 0);
        return { symbol: s, price, change24h: 0, volume24h: 0 };
      });

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Asset selector ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setAssetSheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 18,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 16, opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${meta.color}22`, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, color: meta.color, fontWeight: '800' }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 }}>{meta.label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
              {asset}{livePrice > 0 ? `  ·  ${sym(baseCurrency)}${fmtPrice(Number(livePrice))}` : ''}
            </Text>
            {change24h !== undefined && (
              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: change24h >= 0 ? p.greenBg : p.redBg }}>
                <Text style={{ color: change24h >= 0 ? p.greenFg : p.redFg, fontSize: 10, fontWeight: '800' }}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Change</Text>
          <Ionicons name="chevron-down" size={18} color={p.fgMuted} />
        </View>
      </Pressable>

      {/* ── Amount input ── */}
      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 }}>YOU PAY</Text>
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

      {/* ── Quote panel ── */}
      <View style={{
        backgroundColor: p.bgElev, borderRadius: 18,
        borderWidth: 1, borderColor: p.border,
        padding: 16, marginBottom: 14, minHeight: 72, justifyContent: 'center',
      }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color={meta.color} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>Getting best price…</Text>
          </View>
        ) : quote ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>
                  {intent === 'send' ? 'RECIPIENT RECEIVES' : 'YOU RECEIVE'}
                </Text>
                <Text style={{ color: p.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
                  {fmt(quote.cryptoAmount, 8)}{' '}
                  <Text style={{ color: meta.color, fontSize: 18 }}>{asset}</Text>
                </Text>
              </View>
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
                  { label: 'Exchange rate',        value: `1 ${asset} = ${sym(baseCurrency)}${fmtPrice(Number(quote.quotedPrice))}` },
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
            {Number(fiat) > 0 ? '…' : 'Enter an amount to see a live quote'}
          </Text>
        )}
      </View>

      {/* ── Pay with ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setPaySheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 18,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 14, opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', flex: 1 }}>Pay with</Text>
        {payMethod && (
          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{methodLabel(payMethod)}</Text>
        )}
        <Ionicons name="chevron-forward" size={15} color={p.fgFaint} style={{ marginLeft: 6 }} />
      </Pressable>

      {/* Intent toggle */}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 }}>
          <Ionicons name="wallet-outline" size={16} color={p.fgMuted} />
          <TextInput
            value={sendAddr} onChangeText={setSendAddr}
            placeholder={`${asset} address`} placeholderTextColor={p.fgFaint}
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
          height: 58, borderRadius: 29,
          backgroundColor: canConfirm ? meta.color : p.bgElev,
          borderWidth: canConfirm ? 0 : 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
          opacity: pressed || exec ? 0.85 : 1,
          shadowColor: canConfirm ? meta.color : 'transparent',
          shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
        })}
      >
        {exec ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: canConfirm ? '#fff' : p.fgMuted, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>
            {quote ? `Buy ${asset}  ·  ${sym(baseCurrency)}${fmt(quote.totalUserPays, 2)}` : `Buy ${asset}`}
          </Text>
        )}
      </Pressable>

      {/* ══════════════════════════════════════════════════════════════
          ASSET PICKER — full Binance search
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={assetSheetOpen} transparent animationType="slide" onRequestClose={() => setAssetSheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setAssetSheetOpen(false)}>
          <Pressable
            style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: '90%' }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>

            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 16 }}>
              Search any token
            </Text>

            {/* Search bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 4, backgroundColor: p.bgElev, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.border, gap: 10 }}>
              <Ionicons name="search" size={18} color={p.fgMuted} />
              <TextInput
                ref={searchRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Bitcoin, ETH, SHIB, PEPE…"
                placeholderTextColor={p.fgFaint}
                style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '600' }}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={p.fgMuted} />
                </Pressable>
              )}
              {searchLoading && <ActivityIndicator size="small" color={p.fgMuted} />}
            </View>

            {!searchQuery && (
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, marginTop: 12, marginBottom: 6 }}>
                FEATURED
              </Text>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }}
            >
              {displayList.map((item) => {
                const m = assetMeta(item.symbol);
                const isSelected = asset === item.symbol;
                return (
                  <Pressable
                    key={item.symbol}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAsset(item.symbol);
                      setQuote(null); setError(null);
                      setAssetSheetOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: p.border,
                      opacity: pressed ? 0.7 : 1,
                      backgroundColor: isSelected ? `${m.color}11` : 'transparent',
                      borderRadius: isSelected ? 14 : 0,
                      paddingHorizontal: isSelected ? 10 : 0,
                      marginHorizontal: isSelected ? -10 : 0,
                    })}
                  >
                    {/* Icon */}
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${m.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20, color: m.color, fontWeight: '800' }}>{m.icon}</Text>
                    </View>

                    {/* Name + ticker */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>{m.label}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{item.symbol}</Text>
                    </View>

                    {/* Price + 24h change */}
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {item.price > 0 && (
                        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                          {sym(baseCurrency)}{fmtPrice(item.price)}
                        </Text>
                      )}
                      {item.change24h !== 0 && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: item.change24h >= 0 ? p.greenBg : p.redBg }}>
                          <Text style={{ color: item.change24h >= 0 ? p.greenFg : p.redFg, fontSize: 10, fontWeight: '800' }}>
                            {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                          </Text>
                        </View>
                      )}
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={m.color} />}
                    </View>
                  </Pressable>
                );
              })}

              {searchQuery.length > 0 && displayList.length === 0 && !searchLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600' }}>No results for "{searchQuery}"</Text>
                  <Text style={{ color: p.fgFaint, fontSize: 13, marginTop: 6 }}>Try BTC, ETH, DOGE…</Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          PAY METHOD PICKER
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={paySheetOpen} transparent animationType="slide" onRequestClose={() => setPaySheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setPaySheetOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 48 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', paddingHorizontal: 20, marginBottom: 16 }}>Pay with</Text>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {payMethods.map((m) => {
                const selected = payMethod ? methodId(m) === methodId(payMethod) : false;
                const key = m.type === 'crypto' ? m.asset : m.type === 'fiat' ? m.currency : m.last4;
                const mc = m.type === 'crypto' ? assetMeta(m.asset).color : m.type === 'fiat' ? '#60a5fa' : '#818cf8';
                return (
                  <Pressable
                    key={methodId(m)}
                    onPress={() => { Haptics.selectionAsync(); setPayMethod(m); setPaySheetOpen(false); setQuote(null); }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 16, marginBottom: 8,
                      borderWidth: 1.5, borderColor: selected ? mc : p.border,
                      backgroundColor: selected ? `${mc}11` : p.bgElev,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${mc}22`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>{m.type === 'card' ? '💳' : m.type === 'fiat' ? '💵' : assetMeta(m.type === 'crypto' ? m.asset : '').icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{methodLabel(m)}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>
                        {m.type === 'card' ? 'Debit / Credit card' : m.type === 'fiat' ? 'Fiat wallet' : 'Crypto balance'}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={mc} />}
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
