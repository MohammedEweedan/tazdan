/**
 * BuyWidget — matches app UI (dark theme, purple accent, Panel/PanelRow style).
 * Supports: card payment, fiat wallet balance, crypto asset balances.
 * Supports: Buy to own vs Buy to send.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useWallets, useCards, useMarkets } from '@/hooks';
import {
  cryptoExchangeAPI,
  type CryptoAsset,
  type CryptoQuote,
} from '@/lib/cryptoApi';

// ─── Asset metadata (extended for all supported pairs) ─────────────────────
const ASSET_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  BTC:  { label: 'Bitcoin',   color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  icon: '₿' },
  ETH:  { label: 'Ethereum',  color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: 'Ξ' },
  SOL:  { label: 'Solana',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '◎' },
  USDT: { label: 'Tether',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  icon: '₮' },
  USD:  { label: 'US Dollar', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: '$' },
  EUR:  { label: 'Euro',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: '€' },
  BNB:  { label: 'BNB',       color: '#f3ba2f', bg: 'rgba(243,186,47,0.12)',  icon: 'B' },
  XRP:  { label: 'XRP',       color: '#23292f', bg: 'rgba(35,41,47,0.12)',   icon: '✕' },
  ADA:  { label: 'Cardano',   color: '#0033ad', bg: 'rgba(0,51,173,0.12)',   icon: '₳' },
  DOGE: { label: 'Dogecoin',  color: '#c3a634', bg: 'rgba(195,166,52,0.12)',  icon: 'Ð' },
  MATIC:{ label: 'Polygon',   color: '#8247e5', bg: 'rgba(130,71,229,0.12)',  icon: '◆' },
  DOT:  { label: 'Polkadot',  color: '#e6007a', bg: 'rgba(230,0,122,0.12)',   icon: '●' },
  AVAX: { label: 'Avalanche', color: '#e84142', bg: 'rgba(232,65,66,0.12)',   icon: '▲' },
  LTC:  { label: 'Litecoin',  color: '#bfbbbb', bg: 'rgba(191,187,187,0.12)', icon: 'Ł' },
  LINK: { label: 'Chainlink', color: '#2a5ada', bg: 'rgba(42,90,218,0.12)',   icon: '⬡' },
  UNI:  { label: 'Uniswap',   color: '#ff007a', bg: 'rgba(255,0,122,0.12)',   icon: '🦄' },
  AAVE: { label: 'Aave',      color: '#b6509e', bg: 'rgba(182,80,158,0.12)',  icon: '👻' },
  ATOM: { label: 'Cosmos',    color: '#2e3148', bg: 'rgba(46,49,72,0.12)',   icon: '⚛' },
  ALGO: { label: 'Algorand',  color: '#000000', bg: 'rgba(0,0,0,0.12)',      icon: 'Ⱥ' },
  NEAR: { label: 'NEAR',      color: '#00c1de', bg: 'rgba(0,193,222,0.12)',   icon: '⦿' },
  FTM:  { label: 'Fantom',    color: '#1969ff', bg: 'rgba(25,105,255,0.12)',  icon: 'ƒ' },
  VET:  { label: 'VeChain',   color: '#15bdff', bg: 'rgba(21,189,255,0.12)',  icon: 'V' },
  TRX:  { label: 'Tron',      color: '#ff060a', bg: 'rgba(255,6,10,0.12)',    icon: 'T' },
  ETC:  { label: 'Ethereum Classic', color: '#328c35', bg: 'rgba(50,140,53,0.12)', icon: 'ξ' },
  XLM:  { label: 'Stellar',   color: '#090020', bg: 'rgba(9,0,32,0.12)',      icon: '*' },
  XMR:  { label: 'Monero',    color: '#ff6600', bg: 'rgba(255,102,0,0.12)',   icon: 'ɱ' },
  FIL:  { label: 'Filecoin',  color: '#0090ff', bg: 'rgba(0,144,255,0.12)',   icon: '⨍' },
  EOS:  { label: 'EOS',       color: '#000000', bg: 'rgba(0,0,0,0.12)',      icon: 'ε' },
  THETA:{ label: 'Theta',     color: '#2ab8e6', bg: 'rgba(42,184,230,0.12)',  icon: 'θ' },
  DEFAULT: { label: 'Crypto', color: '#888888', bg: 'rgba(136,136,136,0.12)', icon: '◈' },
};

const NETWORKS: Record<string, string[]> = {
  BTC:  ['BTC'],
  ETH:  ['ERC-20'],
  SOL:  ['SOL'],
  USDT: ['ERC-20', 'TRC-20'],
  BNB:  ['BEP-20'],
  XRP:  ['XRP'],
  ADA:  ['Cardano'],
  DOGE: ['DOGE'],
  MATIC:['ERC-20'],
  DOT:  ['DOT'],
  AVAX: ['C-Chain'],
  LTC:  ['LTC'],
  LINK: ['ERC-20'],
  UNI:  ['ERC-20'],
  AAVE: ['ERC-20'],
  ATOM: ['Cosmos'],
  ALGO: ['Algorand'],
  NEAR: ['NEAR'],
  FTM:  ['Fantom'],
  VET:  ['VeChain'],
  TRX:  ['TRC-20'],
  ETC:  ['ETC'],
  XLM:  ['Stellar'],
  XMR:  ['Monero'],
  FIL:  ['Filecoin'],
  EOS:  ['EOS'],
  THETA:['Theta'],
};

// Generate dynamic asset list from available market tickers
function getAvailableAssets(tickers: any[] | undefined): string[] {
  if (!tickers || tickers.length === 0) return ['BTC', 'ETH', 'SOL', 'USDT'];
  
  // Extract unique base currencies from tickers
  const assets = new Set<string>();
  tickers.forEach((t) => {
    if (t.base && typeof t.base === 'string') {
      assets.add(t.base.toUpperCase());
    }
  });
  
  // Fallback to defaults if no tickers available
  if (assets.size === 0) return ['BTC', 'ETH', 'SOL', 'USDT'];
  
  // Convert to array and sort by priority (major coins first)
  const priority = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
  const sorted = Array.from(assets).sort((a, b) => {
    const pa = priority.indexOf(a);
    const pb = priority.indexOf(b);
    if (pa >= 0 && pb >= 0) return pa - pb;
    if (pa >= 0) return -1;
    if (pb >= 0) return 1;
    return a.localeCompare(b);
  });
  
  return sorted;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼', EGP: 'ج.م',
  USDT: '₮', BTC: '₿', ETH: 'Ξ', SOL: '◎', BNB: 'B',
};

function sym(c: string) { return CURRENCY_SYMBOLS[c] ?? c; }
function fmt(n: string | number, d = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });
}
function newKey() {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Payment method types ─────────────────────────────────────────────────────
type PayMethod =
  | { type: 'card';   last4: string; brand: string }
  | { type: 'fiat';   currency: string; balance: number }
  | { type: 'crypto'; asset: string; balance: number; balanceUsd: number };

function payMethodId(m: PayMethod) {
  if (m.type === 'card')   return `card_${m.last4}`;
  if (m.type === 'fiat')   return `fiat_${m.currency}`;
  return `crypto_${m.asset}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children, p }: { children: string; p: Palette }) {
  return <Text style={[s.sectionLabel, { color: p.fgFaint }]}>{children}</Text>;
}

function Divider({ p }: { p: Palette }) {
  return <View style={[s.divider, { backgroundColor: p.border }]} />;
}

function FeeRow({ label, value, total, p }: { label: string; value: string; total?: boolean; p: Palette }) {
  return (
    <View style={[s.feeRow, total && s.feeTotalRow]}>
      <Text style={[s.feeLabel, total && s.feeTotalLabel, { color: total ? p.fg : p.fgMuted }]}>{label}</Text>
      <Text style={[s.feeValue, total && s.feeTotalValue, { color: p.fg }]}>{value}</Text>
    </View>
  );
}

function MethodIcon({ m, p }: { m: PayMethod; p: Palette }) {
  if (m.type === 'card') {
    return (
      <View style={[s.methodIcon, { backgroundColor: p.pillBg }]}>
        <Ionicons name="card-outline" size={18} color={p.fgMuted} />
      </View>
    );
  }
  const key = m.type === 'fiat' ? m.currency : m.asset;
  const meta = ASSET_META[key] ?? ASSET_META['USD'];
  return (
    <View style={[s.methodIcon, { backgroundColor: meta.bg }]}>
      <Text style={[s.methodIconText, { color: meta.color }]}>{meta.icon}</Text>
    </View>
  );
}

function MethodRow({
  m, selected, onPress, p,
}: { m: PayMethod; selected: boolean; onPress: () => void; p: Palette }) {
  let title = '';
  let sub   = '';
  if (m.type === 'card') {
    title = `${m.brand} ···· ${m.last4}`;
    sub   = 'Credit / Debit card';
  } else if (m.type === 'fiat') {
    title = `${m.currency} Wallet`;
    sub   = `${sym(m.currency)}${fmt(m.balance, 2)} available`;
  } else {
    title = `${m.asset} Balance`;
    sub   = `${fmt(m.balance, 6)} ${m.asset}  ·  $${fmt(m.balanceUsd, 2)}`;
  }
  return (
    <Pressable onPress={onPress} style={[s.methodRow, { backgroundColor: p.pillBg, borderColor: selected ? p.ctaBg : p.border }, selected && s.methodRowSelected]}>
      <MethodIcon m={m} p={p} />
      <View style={{ flex: 1 }}>
        <Text style={[s.methodTitle, { color: p.fg }]}>{title}</Text>
        <Text style={[s.methodSub, { color: p.fgMuted }]}>{sub}</Text>
      </View>
      <View style={[s.radio, selected && s.radioSelected, !selected && { borderColor: p.border }]}>
        {selected && <View style={s.radioDot} />}
      </View>
    </Pressable>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

type Intent = 'buy' | 'send';

export function BuyWidget() {
  const { user } = useAuthStore();
  const p = useThemedPalette();
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: tickers } = useMarkets();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // Transform wallets into PayMethod format
  const payMethods = useMemo<PayMethod[]>(() => {
    const methods: PayMethod[] = [];

    // Add fiat wallets
    wallets?.forEach((w) => {
      if (!['BTC', 'ETH', 'USDT', 'SOL'].includes(w.currency)) {
        methods.push({
          type: 'fiat',
          currency: w.currency,
          balance: Number(w.balance),
        });
      }
    });

    // Add crypto wallets with USD values
    wallets?.forEach((w) => {
      if (['BTC', 'ETH', 'USDT', 'SOL'].includes(w.currency)) {
        const ticker = tickers?.find((t) => t.base === w.currency);
        const balanceUsd = ticker ? Number(w.balance) * Number(ticker.price) : 0;
        methods.push({
          type: 'crypto',
          asset: w.currency,
          balance: Number(w.balance),
          balanceUsd,
        });
      }
    });

    // Add cards
    cards?.forEach((c) => {
      if (c.last4) {
        methods.push({
          type: 'card',
          last4: c.last4,
          brand: c.tier || 'Card',
        });
      }
    });

    return methods;
  }, [wallets, cards, tickers]);

  // Get dynamic list of available assets from market tickers
  const availableAssets = useMemo(() => getAvailableAssets(tickers), [tickers]);

  const [intent,    setIntent]  = useState<Intent>('buy');
  const [asset,     setAsset]   = useState<string>('BTC');
  const [network,   setNetwork] = useState<string>('BTC');
  const [payMethod, setPay]     = useState<PayMethod | null>(null);
  const [sheetOpen, setSheet]   = useState(false);
  const [fiat,      setFiat]    = useState('');
  const [sendAddr,  setSendAddr]= useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);

  // Filter assets based on search
  const filteredAssets = useMemo(() => {
    if (!assetSearch.trim()) return availableAssets;
    const query = assetSearch.toUpperCase();
    return availableAssets.filter((a) => 
      a.toUpperCase().includes(query) || 
      (ASSET_META[a]?.label?.toUpperCase().includes(query))
    );
  }, [availableAssets, assetSearch]);

  // Update asset when available assets change
  useEffect(() => {
    if (availableAssets.length > 0 && !availableAssets.includes(asset)) {
      setAsset(availableAssets[0]);
    }
  }, [availableAssets, asset]);

  // Set initial pay method when data loads
  useEffect(() => {
    if (payMethods.length > 0 && !payMethod) {
      setPay(payMethods[0]);
    }
  }, [payMethods, payMethod]);

  const [quote,   setQuote]   = useState<CryptoQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [exec,    setExec]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { setNetwork(NETWORKS[asset]?.[0] ?? asset); }, [asset]);

  useEffect(() => {
    const amt = parseFloat(fiat);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({ asset, network, side: 'BUY', fiatAmount: String(amt) });
        setQuote(res.data.quote);
      } catch (e: any) {
        setError(e?.response?.data?.error ?? 'Failed to get quote');
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [asset, network, fiat, payMethod]);

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

  const idemKey = useMemo(newKey, [quote?.id]);

  async function onConfirm() {
    if (!quote || !payMethod) return;
    if (intent === 'send' && !sendAddr.trim()) { setError('Enter a recipient address'); return; }
    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({
        quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemKey,
        ...(intent === 'send' ? { recipientAddress: sendAddr.trim() } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(intent === 'send'
        ? `${fmt(quote.cryptoAmount, 8)} ${quote.asset} sent`
        : `${fmt(quote.cryptoAmount, 8)} ${quote.asset} purchased`);
      setQuote(null); setFiat(''); setSendAddr('');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.response?.data?.error ?? 'Order failed');
    } finally { setExec(false); }
  }

  const timerCritical = seconds > 0 && seconds < 8;
  const assetMeta = ASSET_META[asset] ?? {};

  function switchIntent(v: Intent) {
    Haptics.selectionAsync();
    setIntent(v); setQuote(null); setError(null); setSuccess(null);
  }

  return (
    <View style={[s.root, { backgroundColor: p.bg, borderColor: p.border }]}>

      {/* ── Buy / Send toggle ── */}
      <View style={[s.intentRow, { backgroundColor: p.pillBg, borderColor: p.border }]}>
        {(['buy', 'send'] as Intent[]).map((v) => (
          <Pressable key={v} onPress={() => switchIntent(v)}
            style={[s.intentTab, intent === v && s.intentTabActive]}>
            <Ionicons
              name={v === 'buy' ? 'arrow-down-circle-outline' : 'paper-plane-outline'}
              size={14} color={intent === v ? '#fff' : p.fgMuted}
              style={{ marginRight: 5 }}
            />
            <Text style={[s.intentLabel, intent === v ? { color: '#fff' } : { color: p.fgMuted }]}>
              {v === 'buy' ? 'Buy' : 'Buy & Send'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Asset Search ── */}
      <SectionLabel p={p}>SEARCH ASSET</SectionLabel>
      <View style={[s.searchBox, { backgroundColor: p.pillBg, borderColor: p.border }]}>
        <Ionicons name="search" size={16} color={p.fgMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={assetSearch}
          onChangeText={setAssetSearch}
          placeholder="Search BTC, Ethereum..."
          placeholderTextColor={p.fgFaint}
          style={[s.searchInput, { color: p.fg }]}
          autoCapitalize="characters"
        />
        {assetSearch.length > 0 && (
          <Pressable onPress={() => setAssetSearch('')}>
            <Ionicons name="close-circle" size={16} color={p.fgMuted} />
          </Pressable>
        )}
      </View>

      {/* ── Asset picker ── */}
      <SectionLabel p={p}>ASSET</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        style={{ marginBottom: 20 }}>
        {filteredAssets.map((a) => {
          const m = ASSET_META[a] ?? ASSET_META.DEFAULT;
          const active = asset === a;
          return (
            <Pressable key={a} onPress={() => { Haptics.selectionAsync(); setAsset(a); setQuote(null); }}
              style={[s.assetChip, { backgroundColor: p.pillBg, borderColor: active ? p.ctaBg : p.border }]}>
              <Text style={[s.assetChipIcon, { color: m?.color ?? p.fg }]}>{m?.icon ?? a[0]}</Text>
              <Text style={[s.assetChipLabel, { color: active ? p.fg : p.fgMuted }]}>{a}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Network pills (only if multiple) */}
      {(NETWORKS[asset]?.length ?? 0) > 1 && (
        <View style={[s.networkRow, { marginTop: -12, marginBottom: 20 }]}>
          {NETWORKS[asset].map((n) => (
            <Pressable key={n} onPress={() => { Haptics.selectionAsync(); setNetwork(n); }}
              style={[s.networkPill, { backgroundColor: p.pillBg, borderColor: network === n ? p.ctaBg : p.border }]}>
              <Text style={[s.networkPillText, network === n ? { color: p.fg } : { color: p.fgMuted }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── Amount ── */}
      <SectionLabel p={p}>AMOUNT</SectionLabel>
      <View style={[s.amountBox, { backgroundColor: p.pillBg, borderColor: p.border }]}>
        <Text style={[s.amountPrefix, { color: p.fgMuted }]}>{sym(baseCurrency)}</Text>
        <TextInput
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
          value={fiat}
          onChangeText={(v) => {
            // Only allow numbers and single decimal point
            const filtered = v.replace(/[^0-9.]/g, '');
            const parts = filtered.split('.');
            const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
            setFiat(clean);
            setSuccess(null);
            setError(null);
            setQuote(null);
            setShowQuoteDetails(false);
          }}
          placeholder="0.00"
          placeholderTextColor={p.fgFaint}
          style={[s.amountInput, { color: p.fg }]}
          selectionColor={p.fg}
        />
      </View>

      {/* ── Pay with — slim ── */}
      <SectionLabel p={p}>PAY WITH</SectionLabel>
      {!payMethod ? (
        <View style={[s.payWithRowSlim, { backgroundColor: p.pillBg, borderColor: p.border }]}>
          <Text style={[s.payWithSub, { color: p.fgMuted }]}>Loading...</Text>
        </View>
      ) : (
        <Pressable onPress={() => { Haptics.selectionAsync(); setSheet(true); }} style={[s.payWithRowSlim, { backgroundColor: p.pillBg, borderColor: p.border }]}>
          <MethodIcon m={payMethod} p={p} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.payWithTitleSlim, { color: p.fg }]} numberOfLines={1}>
              {payMethod.type === 'card'
                ? `${payMethod.brand} ···· ${payMethod.last4}`
                : payMethod.type === 'fiat'
                ? `${payMethod.currency} · ${sym(payMethod.currency)}${fmt(payMethod.balance, 2)}`
                : `${payMethod.asset} · ${fmt(payMethod.balance, 6)}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={p.fgFaint} />
        </Pressable>
      )}

      {/* ── Send address ── */}
      {intent === 'send' && (
        <>
          <SectionLabel p={p}>RECIPIENT ADDRESS</SectionLabel>
          <View style={[s.addressBox, { backgroundColor: p.pillBg, borderColor: p.border }]}>
            <Ionicons name="wallet-outline" size={15} color={p.fgMuted} style={{ marginRight: 8 }} />
            <TextInput
              value={sendAddr}
              onChangeText={setSendAddr}
              placeholder={`${asset} address`}
              placeholderTextColor={p.fgFaint}
              style={[s.addressInput, { color: p.fg }]}
              selectionColor={p.fg}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {sendAddr.length > 0 && (
              <Pressable onPress={() => setSendAddr('')}>
                <Ionicons name="close-circle" size={15} color={p.fgFaint} />
              </Pressable>
            )}
          </View>
        </>
      )}

      <Divider p={p} />

      {/* ── States ── */}
      {loading && (
        <View style={s.quoteLoading}>
          <ActivityIndicator size="small" color={p.fg} />
          <Text style={[s.quoteLoadingText, { color: p.fgMuted }]}>Getting best price…</Text>
        </View>
      )}
      {error && !loading && (
        <View style={[s.alert, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
          <Ionicons name="alert-circle-outline" size={14} color={p.redFg} />
          <Text style={[s.alertText, { color: p.redFg }]}>{error}</Text>
        </View>
      )}
      {success && (
        <View style={[s.alert, { backgroundColor: p.greenBg }]}>
          <Ionicons name="checkmark-circle-outline" size={14} color={p.greenFg} />
          <Text style={[s.alertText, { color: p.greenFg }]}>{success}</Text>
        </View>
      )}

      {/* ── Quote Overlay (covers input when quote ready) ── */}
      {quote && !loading && (
        <View style={[s.quoteOverlay, { backgroundColor: p.bg }]}>
          {/* Timer at top */}
          <View style={[s.timerBar, { borderColor: timerCritical ? p.redFg : p.ctaBg }]}>
            <Ionicons name="time-outline" size={14} color={timerCritical ? p.redFg : p.ctaBg} />
            <Text style={[s.timerBarText, { color: timerCritical ? p.redFg : p.ctaBg }]}>
              Quote expires in {seconds}s
            </Text>
          </View>

          {!showQuoteDetails ? (
            // Summary view with button to expand
            <View style={s.quoteSummary}>
              <View>
                <Text style={[s.receiveLabel, { color: p.fgFaint }]}>
                  {intent === 'send' ? 'RECIPIENT RECEIVES' : 'YOU RECEIVE'}
                </Text>
                <Text style={[s.receiveAmount, { color: p.fg }]}>
                  {fmt(quote.cryptoAmount, 8)}{' '}
                  <Text style={{ color: (assetMeta as any).color ?? p.fg }}>{quote.asset}</Text>
                </Text>
                <Text style={[s.receiveFiat, { color: p.fgMuted }]}>
                  {sym(baseCurrency)}{fmt(quote.totalUserPays, 2)} total
                </Text>
              </View>
              <Pressable 
                onPress={() => setShowQuoteDetails(true)}
                style={[s.viewDetailsBtn, { backgroundColor: p.pillBg, borderColor: p.border }]}
              >
                <Text style={[s.viewDetailsText, { color: p.fg }]}>View breakdown</Text>
                <Ionicons name="chevron-down" size={14} color={p.fg} />
              </Pressable>
            </View>
          ) : (
            // Full details view
            <View>
              <View style={s.receivePanel}>
                <View>
                  <Text style={[s.receiveLabel, { color: p.fgFaint }]}>
                    {intent === 'send' ? 'RECIPIENT RECEIVES' : 'YOU RECEIVE'}
                  </Text>
                  <Text style={[s.receiveAmount, { color: p.fg }]}>
                    {fmt(quote.cryptoAmount, 8)}{' '}
                    <Text style={{ color: (assetMeta as any).color ?? p.fg }}>{quote.asset}</Text>
                  </Text>
                </View>
              </View>

              <View style={[s.feePanel, { backgroundColor: p.pillBg, borderColor: p.border }]}>
                <FeeRow label="Platform fee (0.5%)" value={`${sym(baseCurrency)}${fmt(quote.platformFee, 2)}`} p={p} />
                <FeeRow label="Network fee"          value={`${sym(baseCurrency)}${fmt(quote.networkFee, 2)}`} p={p} />
                <FeeRow label="Your price" value={`${sym(baseCurrency)}${fmt(quote.quotedPrice, 2)}`} p={p} />
                <FeeRow label="Total"      value={`${sym(baseCurrency)}${fmt(quote.totalUserPays, 2)}`} total p={p} />
              </View>

              <Pressable onPress={() => setShowQuoteDetails(false)} style={{ alignSelf: 'center', marginTop: 8 }}>
                <Ionicons name="chevron-up" size={20} color={p.fgMuted} />
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={onConfirm}
            disabled={exec || seconds <= 0}
            style={({ pressed }) => [s.cta, (exec || seconds <= 0) && s.ctaDisabled, pressed && { opacity: 0.85 }]}
          >
            {exec
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons
                    name={intent === 'buy' ? 'arrow-down-circle' : 'paper-plane'}
                    size={17} color="#fff" style={{ marginRight: 8 }}
                  />
                  <Text style={s.ctaText}>
                    {intent === 'buy' ? 'Confirm purchase' : 'Confirm & send'}
                    {' · '}{sym(baseCurrency)}{fmt(quote.totalUserPays, 2)}
                  </Text>
                </>
            }
          </Pressable>
        </View>
      )}

      {!quote && !loading && !error && !success && (
        <Text style={[s.hint, { color: p.fgFaint }]}>Enter an amount to see a live quote</Text>
      )}

      {/* ── Payment method sheet ── */}
      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setSheet(false)}>
          <Pressable style={[s.sheet, { backgroundColor: p.bg, borderColor: p.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={[s.sheetHandle, { backgroundColor: p.border }]} />
            <Text style={[s.sheetTitle, { color: p.fg }]}>Pay with</Text>

            <SectionLabel p={p}>FIAT WALLETS</SectionLabel>
            {payMethods.filter((m) => m.type === 'fiat').map((m) => (
              <MethodRow key={payMethodId(m)} m={m} p={p}
                selected={payMethod ? payMethodId(m) === payMethodId(payMethod) : false}
                onPress={() => { Haptics.selectionAsync(); setPay(m); setSheet(false); setQuote(null); }}
              />
            ))}

            <SectionLabel p={p}>CRYPTO BALANCES</SectionLabel>
            {payMethods.filter((m) => m.type === 'crypto').map((m) => (
              <MethodRow key={payMethodId(m)} m={m} p={p}
                selected={payMethod ? payMethodId(m) === payMethodId(payMethod) : false}
                onPress={() => { Haptics.selectionAsync(); setPay(m); setSheet(false); setQuote(null); }}
              />
            ))}

            <SectionLabel p={p}>CARDS</SectionLabel>
            {payMethods.filter((m) => m.type === 'card').map((m) => (
              <MethodRow key={payMethodId(m)} m={m} p={p}
                selected={payMethod ? payMethodId(m) === payMethodId(payMethod) : false}
                onPress={() => { Haptics.selectionAsync(); setPay(m); setSheet(false); setQuote(null); }}
              />
            ))}

            <Pressable style={[s.sheetCancel, { backgroundColor: p.pillBg, borderColor: p.border }]} onPress={() => setSheet(false)}>
              <Text style={[s.sheetCancelText, { color: p.fgMuted }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default BuyWidget;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  sectionLabel: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 2,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 14,
  },

  // Intent toggle
  intentRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  intentTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 8, borderRadius: 10,
  },
  intentTabActive: {
    backgroundColor: '#49A8F0',
    shadowColor: '#49A8F0', shadowOpacity: 0.3,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  intentLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },

  // Asset chips
  assetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  assetChipIcon: { fontSize: 13, fontWeight: '700' },
  assetChipLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },

  // Network
  networkRow: { flexDirection: 'row', gap: 5 },
  networkPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  networkPillActive: { borderColor: '#49A8F0', backgroundColor: 'rgba(73,168,240,0.12)' },
  networkPillText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.2 },

  // Amount
  amountBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, marginBottom: 16,
  },
  amountPrefix: { fontSize: 18, fontWeight: '300', color: 'rgba(255,255,255,0.55)', marginRight: 2 },
  amountInput: {
    flex: 1, fontSize: 26, fontWeight: '600', color: '#ffffff',
    paddingVertical: 12, letterSpacing: -0.5,
  },
  assetBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  assetBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },

  // Pay with
  payWithRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 12, gap: 10, marginBottom: 16,
  },
  payWithTitle: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  payWithSub:   { fontSize: 11, marginTop: 1 },

  // Address
  addressBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  addressInput: { flex: 1, fontSize: 12, fontWeight: '500', color: '#ffffff' },

  // Method icon
  methodIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  methodIconText: { fontSize: 15, fontWeight: '700' },

  // Quote loading
  quoteLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  quoteLoadingText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  // Alert
  alert: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  alertText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Receive
  receivePanel: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  receiveLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.32)',
    letterSpacing: 0.8, marginBottom: 3,
  },
  receiveAmount: { fontSize: 22, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3 },
  timerRing: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#49A8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  timerText: { fontSize: 11, fontWeight: '700', color: '#49A8F0' },

  // Fee
  feePanel: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    padding: 12, gap: 7, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  feeRow:        { flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel:      { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  feeValue:      { fontSize: 12, color: '#ffffff', fontWeight: '500' },
  feeTotalRow:   {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 8, marginTop: 3,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  feeTotalLabel: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  feeTotalValue: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  // CTA
  cta: {
    backgroundColor: '#49A8F0', borderRadius: 12,
    paddingVertical: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    shadowColor: '#49A8F0', shadowOpacity: 0.25,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  ctaDisabled: { backgroundColor: 'rgba(255,255,255,0.08)', shadowOpacity: 0 },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: -0.1 },
  disclaimer: { fontSize: 10, color: 'rgba(255,255,255,0.32)', textAlign: 'center' },
  hint:       { fontSize: 12, color: 'rgba(255,255,255,0.32)', textAlign: 'center', paddingVertical: 8 },

  // Sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    width: 32, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '700', color: '#ffffff',
    letterSpacing: -0.2, marginBottom: 14,
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 12, marginBottom: 5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  methodRowSelected: { borderColor: '#49A8F0', backgroundColor: 'rgba(73,168,240,0.12)' },
  methodTitle: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  methodSub:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#49A8F0' },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#49A8F0' },
  sheetCancel: {
    marginTop: 8, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetCancelText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: '#ffffff' },

  // Slim pay with
  payWithRowSlim: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  payWithTitleSlim: { fontSize: 13, fontWeight: '700' },

  // Quote overlay
  quoteOverlay: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  timerBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  timerBarText: { fontSize: 12, fontWeight: '700' },
  quoteSummary: { gap: 12 },
  receiveFiat: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  viewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  viewDetailsText: { fontSize: 12, fontWeight: '700' },
});