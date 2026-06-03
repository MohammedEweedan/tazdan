/**
 * BuyWidget — search and buy any token on Binance.
 * Phantom × Binance × MoonPay energy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, View, TextInput as RNTextInput, Modal } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { ExpressPayButton } from '@/components/ui/ExpressPayButton';
import { useWallets, useCards, useMarkets, useTransactionSound } from '@/hooks';
import * as LocalAuthentication from 'expo-local-authentication';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
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

// Networks available per asset (buy side — same table as SellWidget)
const ASSET_NETWORKS: Record<string, { label: string; network: string }[]> = {
  USDT:  [{ label: 'Ethereum (ERC-20)', network: 'ERC20'   },
          { label: 'Tron (TRC-20)',     network: 'TRC20'   },
          { label: 'BNB Chain (BEP-20)',network: 'BEP20'   },
          { label: 'Solana (SPL)',       network: 'SOL'     }],
  USDC:  [{ label: 'Ethereum (ERC-20)', network: 'ERC20'   },
          { label: 'Solana (SPL)',       network: 'SOL'     },
          { label: 'BNB Chain (BEP-20)',network: 'BEP20'   }],
  BNB:   [{ label: 'BNB Chain (BEP-20)',network: 'BEP20'   },
          { label: 'Ethereum (ERC-20)', network: 'ERC20'   }],
  MATIC: [{ label: 'Polygon',           network: 'Polygon' },
          { label: 'Ethereum (ERC-20)', network: 'ERC20'   }],
  ETH:   [{ label: 'Ethereum (ERC-20)', network: 'ERC20'   }],
  BTC:   [{ label: 'Bitcoin',           network: 'BTC'     }],
  SOL:   [{ label: 'Solana',            network: 'SOL'     }],
  XRP:   [{ label: 'XRP Ledger',        network: 'XRP'     }],
  ADA:   [{ label: 'Cardano',           network: 'Cardano' }],
  DOGE:  [{ label: 'Dogecoin',          network: 'DOGE'    }],
  LTC:   [{ label: 'Litecoin',          network: 'LTC'     }],
  TRX:   [{ label: 'TRON',             network: 'TRON'    }],
  AVAX:  [{ label: 'Avalanche C-Chain', network: 'AVAX'    }],
  DOT:   [{ label: 'Polkadot',          network: 'DOT'     }],
  LINK:  [{ label: 'Ethereum (ERC-20)', network: 'ERC20'   }],
};

// For USDT_ERC20 / USDT_TRC20 the asset sent to server must be "USDT"
const ASSET_SYMBOL: Record<string, string> = { USDT_ERC20: 'USDT', USDT_TRC20: 'USDT' };
function defaultNetwork(symbol: string) {
  const s = ASSET_SYMBOL[symbol.toUpperCase()] ?? symbol.toUpperCase();
  return ASSET_NETWORKS[s]?.[0]?.network ?? s;
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


function assetMeta(symbol: string | undefined | null): { label: string; color: string; icon: string } {
  if (!symbol) return { label: '?', color: '#888888', icon: '?' };
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
interface BuyWidgetProps {
  /**
   * When provided, the widget initialises with this asset pre-selected
   * AND (if `lockAsset` is also set) hides the change-asset chip and
   * disables the asset picker — so a user landing on the BTC detail
   * page can only buy BTC.
   */
  defaultAsset?: string;
  lockAsset?:    boolean;
}

export function BuyWidget({ defaultAsset, lockAsset = false }: BuyWidgetProps = {}) {
  const { user, biometricEnabled } = useAuthStore();
  const tr = useT();
  const p = useThemedPalette();
  // Accent follows the active palette — the soft brand blue on dark/light,
  // greyscale in mono. Drives selected chips, the focus ring, and the
  // "Change" pill below. Primary CTAs stay neutral (p.ctaBg).
  const brandAccent = p.accent;
  const { data: wallets } = useWallets();
  const { data: cards } = useCards();
  const { data: tickers } = useMarkets();
  const { playSuccess, playError } = useTransactionSound();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // ── Asset picker state ────────────────────────────────────────────
  // When the widget is opened from a specific asset's detail page we
  // pre-select that asset. The `lockAsset` flag further prevents the
  // user from switching away — you shouldn't be able to buy ETH from
  // the BTC screen.
  const [asset,          setAsset]          = useState((defaultAsset || 'BTC').toUpperCase());
  const [network,        setNetwork]        = useState('BTC');
  const [assetSheetOpen, setAssetSheetOpen] = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState<AssetSearchResult[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchRef = useRef<RNTextInput>(null);

  const RECENT_KEY = '@buy_recent_searches';

  // ── Trade state ───────────────────────────────────────────────────
  const [fiat,     setFiat]     = useState('');
  const [quote,    setQuote]    = useState<CryptoQuote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [exec,     setExec]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [seconds,  setSeconds]  = useState(0);
  const [showFees, setShowFees] = useState(false);
  const [intent,   setIntent]   = useState<'buy' | 'send'>('buy');
  const [sendAddr, setSendAddr] = useState('');
  const [paySheetOpen,     setPaySheetOpen]     = useState(false);
  const [networkSheetOpen, setNetworkSheetOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const idemRef = useRef(`ord_${Date.now()}`);

  // ── Payment methods — exclude the asset being bought ─────────────
  // You can't pay for BTC with BTC. Fiat wallets, cards, and other
  // crypto wallets are all valid. Stablecoins (USDT/USDC) are valid
  // payment for any non-stablecoin purchase.
  const buyingBase = serverAsset(asset); // normalised symbol (no _ERC20 suffix)
  const payMethods = useMemo<PayMethod[]>(() => {
    const out: PayMethod[] = [];
    const CRYPTO_PAY = new Set(['BTC','ETH','USDT','USDC','SOL','BNB','XRP']);
    wallets?.forEach((w) => {
      const wBase = ASSET_SYMBOL[w.currency] ?? w.currency;
      // Skip if it's the same asset the user is buying
      if (wBase === buyingBase) return;
      if (CRYPTO_PAY.has(w.currency) && Number(w.balance) > 0) {
        out.push({ type: 'crypto', asset: w.currency, balance: Number(w.balance) });
      } else if (!CRYPTO_PAY.has(w.currency)) {
        out.push({ type: 'fiat', currency: w.currency, balance: Number(w.balance) });
      }
    });
    cards?.forEach((c) => { if (c.last4) out.push({ type: 'card', last4: c.last4, brand: c.tier ?? 'Card' }); });
    return out;
  }, [wallets, cards, buyingBase]);

  // Reset pay method when asset changes (old method might now be invalid)
  useEffect(() => {
    setPayMethod((prev) => {
      if (!prev) return payMethods[0] ?? null;
      const stillValid = payMethods.some((m) => methodId(m) === methodId(prev));
      return stillValid ? prev : (payMethods[0] ?? null);
    });
  }, [payMethods]);
  useEffect(() => { setNetwork(defaultNetwork(asset)); }, [asset]);

  // ── Asset selection + recent search persistence ─────────────────
  const selectAsset = useCallback((symbol: string) => {
    Haptics.selectionAsync();
    setAsset(symbol);
    setQuote(null); setError(null);
    setAssetSheetOpen(false);
    // Persist recent search
    setRecentSearches((prev) => {
      const next = [symbol, ...prev.filter((s) => s !== symbol)].slice(0, 8);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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

  // Load recent searches when sheet opens
  useEffect(() => {
    if (assetSheetOpen) {
      setSearchQuery('');
      setSearchResults([]);
      AsyncStorage.getItem(RECENT_KEY).then((v) => {
        if (v) setRecentSearches(JSON.parse(v));
      });
    }
  }, [assetSheetOpen]);

  // First mount on the main index (no explicit defaultAsset): prefer
  // the user's most-recently-searched coin over the hard-coded BTC.
  // Defaults still settle on BTC if there's nothing in AsyncStorage.
  // We don't override when `defaultAsset` was passed — the caller is
  // already telling us exactly which coin to land on (e.g. asset page).
  useEffect(() => {
    if (defaultAsset) return;
    AsyncStorage.getItem(RECENT_KEY).then((v) => {
      if (!v) return;
      try {
        const arr = JSON.parse(v);
        if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0].length > 0) {
          setAsset(arr[0].toUpperCase());
        }
      } catch { /* malformed cache, ignore */ }
    });
    // Run-once on mount; `defaultAsset` is a prop and doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bumping this triggers a fresh quote without the user changing fiat/asset
  const [requoteKey, setRequoteKey] = useState(0);

  // Which currency funds this BUY. ALWAYS concrete — the server now REQUIRES
  // it and never defaults, so an undefined here would (correctly) fail the
  // quote rather than silently debit the wrong wallet.
  //  - fiat wallet   → that fiat currency (LYD, USD, GBP, …)
  //  - crypto wallet → that asset (USDT, BTC, …)
  //  - card          → charged in the user's base currency (external on-ramp
  //                    into that currency basis)
  const fundingCurrency =
    payMethod?.type === 'fiat'   ? payMethod.currency :
    payMethod?.type === 'crypto' ? payMethod.asset    :
    payMethod?.type === 'card'   ? baseCurrency       :
    baseCurrency; // no method selected yet → base currency (amount is in base)

  // ── Quote fetching ────────────────────────────────────────────────
  useEffect(() => {
    const amt = parseFloat(fiat);
    if (!amt || amt <= 0) { setQuote(null); return; }
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({ asset: serverAsset(asset), network, side: 'BUY', fiatAmount: String(amt), fundingCurrency });
        setQuote(res.data.quote);
        idemRef.current = `ord_${Date.now()}`;
      } catch (e: any) {
        setError(e?.response?.data?.error ?? tr('buy.errQuote'));
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, network, fiat, requoteKey, fundingCurrency]);

  // ── Quote countdown — auto-requote when it expires ───────────────
  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
      setSeconds(s);
      if (s <= 0) {
        setQuote(null);
        // Trigger a fresh quote automatically (user doesn't need to do anything)
        setRequoteKey((k) => k + 1);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  // ── Confirm ───────────────────────────────────────────────────────
  async function onConfirm(stepUpCode?: string) {
    if (!quote) return;
    if (intent === 'send' && !sendAddr.trim()) { setError(tr('buy.enterRecipient')); return; }

    // Face ID confirmation for the purchase (when enabled + enrolled). On a
    // trusted device the server accepts this in lieu of a code; on a new device
    // it'll still 401 and we fall back to the code modal below.
    let biometricVerified = false;
    if (!stepUpCode && biometricEnabled) {
      try {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (enrolled) {
          const r = await LocalAuthentication.authenticateAsync({
            promptMessage: `Confirm purchase of ${asset}`,
            cancelLabel: tr('common.cancel'), fallbackLabel: tr('common.usePasscode'), disableDeviceFallback: false,
          });
          if (!r.success) { setError(tr('common.verificationCancelled')); setExec(false); return; }
          biometricVerified = true;
        }
      } catch { /* biometric unavailable → server will require a code */ }
    }

    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({
        quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemRef.current,
        ...(stepUpCode ? { stepUpCode } : {}),
        ...(biometricVerified ? { biometricVerified: true } : {}),
        ...(intent === 'send' ? { recipientAddress: sendAddr.trim() } : {}),
      } as any);
      playSuccess('buy');
      setStepUpOpen(false);
      setSuccess(`${fmt(quote.cryptoAmount, 8)} ${asset} ${intent === 'send' ? tr('buy.sent') : tr('buy.purchased')} ✓`);
      setQuote(null); setFiat(''); setSendAddr('');
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      // 401 with a step-up message → prompt for the 6-digit code.
      const msg = e?.response?.data?.error ?? '';
      if (e?.response?.status === 401 && /security|verification|code|device/i.test(msg) && !stepUpCode) {
        setStepUpOpen(true);
        return; // modal will re-call onConfirm(code)
      }
      playError();
      // If the modal is open, rethrow so the modal shows the error (bad code).
      if (stepUpCode) throw e;
      setError(msg || tr('buy.errOrder'));
    } finally { setExec(false); }
  }

  const meta = assetMeta(asset);
  // USDT_ERC20/TRC20 map to the USDT ticker (price = $1, pegged)
  const tickerBase = serverAsset(asset);
  const livePrice  = tickerBase === 'USDT' ? 1 : (tickers?.find((t) => t.base === tickerBase)?.price ?? searchResults.find((r) => r.symbol === tickerBase)?.price ?? 0);
  const change24h  = searchResults.find((r) => r.symbol === tickerBase)?.change24h;
  const timerCritical = seconds > 0 && seconds < 8;
  const canConfirm    = !!quote && !exec && seconds > 0;

  // Instant price estimate: shown while no quote exists but amount + livePrice are known
  const fiatNum       = parseFloat(fiat) || 0;
  const priceEstimate = livePrice > 0 && fiatNum > 0 ? fiatNum / Number(livePrice) : null;

  // Slider label — clean, no embedded seconds (badge handles that)
  const slideLabel = canConfirm
    ? (intent === 'send' ? tr('buy.slideToSend').replace('{asset}', asset) : tr('buy.slideToBuy').replace('{asset}', asset))
    : tr('buy.enterAmount');

  // Top gainers: top 5 by 24h change from tickers
  const topGainers = useMemo(() => {
    if (!tickers) return [];
    return [...tickers]
      .filter((t) => t.changePct24h !== 0)
      .sort((a, b) => b.changePct24h - a.changePct24h)
      .slice(0, 5)
      .map((t) => ({
        symbol: t.base,
        name: t.displayName ?? t.base,
        price: t.price,
        change24h: t.changePct24h,
        volume24h: 0,
      }));
  }, [tickers]);

  // Top 10 featured coins
  const topTen = useMemo(() =>
    FEATURED.slice(0, 10).map((s) => {
      const base = serverAsset(s);
      const t = tickers?.find((x) => x.base === base);
      const price = base === 'USDT' ? 1 : Number(t?.price ?? 0);
      return { symbol: s, name: assetMeta(s).label, price, change24h: Number(t?.changePct24h ?? 0), volume24h: 0 };
    }),
  [tickers]);

  // Displayed list in picker: search results if query, else empty (sections render separately)
  const displayList: AssetSearchResult[] = searchResults.length > 0 ? searchResults : [];

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Asset selector ──
          Locked when opened from a coin detail page. Switching the
          asset there would conflict with the user's navigation
          intent. */}
      <Pressable
        disabled={lockAsset}
        onPress={() => { if (lockAsset) return; Haptics.selectionAsync(); setAssetSheetOpen(true); }}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: p.bgElev, borderRadius: 20,
          borderWidth: 1, borderColor: p.border,
          padding: 14, marginBottom: 18, opacity: pressed && !lockAsset ? 0.85 : 1,
        })}
      >
        <CoinAvatar sym={asset} size={48} color={meta.color} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600' }}>{meta.label}</Text>
            <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>{asset}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            {/* Show OUR price (the quoted, marked-up rate in the funding
                currency) when a quote exists; otherwise the live reference. */}
            {quote ? (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                {sym(fundingCurrency)}{fmtPrice(Number(quote.settlementAmount ?? quote.fiatAmount) / Math.max(Number(quote.cryptoAmount), 1e-18))} · your price
              </Text>
            ) : livePrice > 0 ? (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                {sym(baseCurrency)}{fmtPrice(Number(livePrice))}
              </Text>
            ) : null}
            {change24h !== undefined && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: change24h >= 0 ? p.greenBg : p.redBg }}>
                <Text style={{ color: change24h >= 0 ? p.greenFg : p.redFg, fontSize: 11, fontWeight: '700' }}>
                  {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                </Text>
              </View>
            )}
          </View>
        </View>
        {!lockAsset && (
          <View style={{
            paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12,
            backgroundColor: `${brandAccent}1f`,
            borderWidth: 1, borderColor: `${brandAccent}3a`,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <Text style={{ color: brandAccent, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{tr('buy.change')}</Text>
            <Ionicons name="chevron-down" size={13} color={brandAccent} />
          </View>
        )}
      </Pressable>

      {/* Network selector — only shown when asset has multiple chains */}
      {(() => {
        const networks = ASSET_NETWORKS[serverAsset(asset)];
        if (!networks || networks.length <= 1) return null;
        const currentLabel = networks.find((n) => n.network === network)?.label ?? network;
        return (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setNetworkSheetOpen(true); }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: p.bgElev, borderRadius: 12,
              borderWidth: 1, borderColor: p.border,
              paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
              marginTop: -10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="git-branch-outline" size={14} color={p.fgMuted} />
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', flex: 1 }}>{tr('common.network')}</Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{currentLabel}</Text>
            <Ionicons name="chevron-down" size={14} color={p.fgMuted} />
          </Pressable>
        );
      })()}

      {/* ── Amount input ──
          Label + price-estimate share a row. The estimate can be long
          (e.g. "≈ 0.000034 BTC") and was pushing the YOU PAY label
          out on small screens. flexShrink + ellipsize + numberOfLines
          keep both visible. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
        <Text
          numberOfLines={1}
          style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, flexShrink: 0 }}
        >
          {tr('buy.youPay')}
        </Text>
        {priceEstimate && !quote && livePrice > 0 && (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: p.fgFaint, fontSize: 11, fontWeight: '600',
              letterSpacing: 0.3, flexShrink: 1, minWidth: 0,
              textAlign: 'right',
            }}
          >
            ≈ {fmt(priceEstimate, 6)} {asset}
          </Text>
        )}
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: p.bgElev, borderRadius: 20,
        borderWidth: 1.5, borderColor: error ? p.redFg : (fiatNum > 0 ? brandAccent : p.border),
        paddingHorizontal: 18, marginBottom: 12,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 24, fontWeight: '500', marginRight: 6 }}>{sym(fundingCurrency)}</Text>
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
          style={{ flex: 1, color: p.fg, fontSize: 36, fontWeight: '600', paddingVertical: 18, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
        />
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>{fundingCurrency}</Text>
      </View>

      {/* Quick amounts */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 22 }}>
        {[25, 50, 100, 250, 500].map((v) => {
          const sel = Number(fiat) === v;
          return (
            <Pressable
              key={v}
              onPress={() => { Haptics.selectionAsync(); setFiat(String(v)); setQuote(null); setError(null); }}
              style={({ pressed }) => ({
                paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22,
                backgroundColor: sel ? brandAccent : p.bgElev,
                borderWidth: 1, borderColor: sel ? brandAccent : p.border,
                opacity: pressed ? 0.8 : 1,
                // Soft lift, not a glow — keep the blue calm, never poppy.
                shadowColor: sel ? brandAccent : 'transparent',
                shadowOpacity: sel ? 0.18 : 0,
                shadowOffset: { width: 0, height: 3 },
                shadowRadius: 8,
              })}
            >
              <Text style={{ color: sel ? p.accentFg : p.fgMuted, fontSize: 13, fontWeight: '700' }}>
                {sym(fundingCurrency)}{v}
              </Text>
            </Pressable>
          );
        })}
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
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{tr('buy.gettingPrice')}</Text>
          </View>
        ) : quote ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 }}>
                  {intent === 'send' ? tr('buy.recipientReceives') : tr('buy.youReceive')}
                </Text>
                <Text style={{ color: p.fg, fontSize: 26, fontWeight: '500', letterSpacing: 0 }}>
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
                <Text style={{ color: timerCritical ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '500' }}>{seconds}s</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowFees(!showFees)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: p.border }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
                Fee  {sym(fundingCurrency)}{fmt(Number(quote.platformFeeSettlement ?? quote.platformFee) + Number(quote.networkFeeSettlement ?? quote.networkFee), 2)}
              </Text>
              <Ionicons name={showFees ? 'chevron-up' : 'chevron-down'} size={14} color={p.fgMuted} />
            </Pressable>
            {showFees && (
              <View style={{ marginTop: 8, gap: 5 }}>
                {[
                  { label: tr('buy.platformFee'), value: fmt(quote.platformFeeSettlement ?? quote.platformFee, 2) },
                  { label: tr('buy.networkFee'),  value: fmt(quote.networkFeeSettlement ?? quote.networkFee, 2) },
                  { label: tr('buy.exchangeRate'), value: `1 ${asset} = ${sym(fundingCurrency)}${fmtPrice(Number(quote.settlementAmount ?? quote.fiatAmount) / Math.max(Number(quote.cryptoAmount), 1e-18))}` },
                  { label: tr('common.spread'), value: `${(Number(quote.spreadPct) * 100).toFixed(2)}%` },
                  { label: tr('buy.totalYouPay'), value: fmt(quote.totalUserPays, 2), bold: true },
                ].map(({ label, value, bold }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: bold ? '700' : '500' }}>{label}</Text>
                    <Text style={{ color: bold ? p.fg : p.fgMuted, fontSize: 12, fontWeight: bold ? '800' : '500' }}>
                      {bold ? `${sym(fundingCurrency)}${value}` : value}
                    </Text>
                  </View>
                ))}
                <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 2 }}>
                  Our price already includes the {(Number(quote.spreadPct) * 100).toFixed(1)}% spread.
                </Text>
              </View>
            )}
          </>
        ) : priceEstimate ? (
          // Instant price estimate from live ticker — before full quote arrives
          <View>
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginBottom: 4 }}>
              {intent === 'send' ? tr('buy.recipientReceivesEst') : tr('buy.youReceiveEst')}
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 24, fontWeight: '500' }}>
              ≈ {fmt(priceEstimate, 8)}{' '}
              <Text style={{ color: meta.color, fontSize: 16 }}>{asset}</Text>
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 6 }}>
              {loading ? tr('buy.gettingExactQuote') : tr('buy.liveEstimate')}
            </Text>
          </View>
        ) : (
          <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
            {tr('buy.enterAmountQuote')}
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
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', flex: 1 }}>{tr('buy.payWith')}</Text>
        {payMethod && (
          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{methodLabel(payMethod)}</Text>
        )}
        <Ionicons name="chevron-forward" size={15} color={p.fgFaint} style={{ marginLeft: 6 }} />
      </Pressable>

      {/* Intent toggle */}
      <View style={{
        flexDirection: 'row', backgroundColor: p.bgElev, borderRadius: 16,
        padding: 4, borderWidth: 1, borderColor: p.border, marginBottom: 16,
      }}>
        {(['buy', 'send'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => { Haptics.selectionAsync(); setIntent(v); setQuote(null); setError(null); setSuccess(null); }}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 12,
              alignItems: 'center',
              backgroundColor: intent === v ? brandAccent : 'transparent',
              shadowColor: intent === v ? brandAccent : 'transparent',
              shadowOpacity: intent === v ? 0.18 : 0,
              shadowOffset: { width: 0, height: 3 },
              shadowRadius: 8,
            }}
          >
            <Text style={{
              // p.accentFg is the palette's "text on accent" colour —
              // in dark mode the accent is white so accentFg is black;
              // in light mode the accent is black so accentFg is white.
              // Using the token instead of an inline ternary keeps this
              // in sync if the brand palette ever shifts.
              color: intent === v ? p.accentFg : p.fgMuted,
              fontSize: 13, fontWeight: '700',
            }}>
              {v === 'buy' ? tr('buy.toMyWallet') : tr('buy.toAddress')}
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
            placeholder={tr('buy.addressPlaceholder').replace('{asset}', asset)} placeholderTextColor={p.fgFaint}
            style={{ flex: 1, color: p.fg, fontSize: 13, marginLeft: 10 }}
            autoCapitalize="none" autoCorrect={false}
          />
        </View>
      )}

      {/* ── Express pay (Apple/Google) — appears for "buy to my wallet" only ── */}
      {intent === 'buy' && fiatNum > 0 && payMethod?.type === 'card' && (
        <View style={{ marginBottom: 12 }}>
          <ExpressPayButton
            amount={fiatNum}
            currency={fundingCurrency}
            cryptoCurrency={serverAsset(asset)}
            enabled={!exec && !success}
            onSuccess={() => {
              setSuccess(`${fmt(quote?.cryptoAmount ?? priceEstimate ?? 0, 8)} ${asset} ${tr('buy.purchased')} ✓`);
              setQuote(null); setFiat('');
            }}
            onError={(m) => setError(m)}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.8 }}>{tr('buy.or')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: p.border }} />
          </View>
        </View>
      )}

      {/* ── Status banner (error / success) ── */}
      <StatusBanner kind="error" message={error} onDismiss={() => setError(null)} />
      <StatusBanner kind="success" message={success} />

      {/* ── CTA — slide to confirm ── */}
      <SlideToConfirm
        label={slideLabel}
        onConfirm={() => { if (canConfirm && !error && !success) onConfirm(); }}
        enabled={canConfirm && !error && !success}
        status={exec ? 'loading' : success ? 'success' : error ? 'error' : 'idle'}
        successLabel={success || undefined}
        errorLabel={error || undefined}
        // Confirm slider wears the brand blue so the primary action carries
        // the brand colour.
        accent={brandAccent}
        accentFg={p.accentFg}
        trackBg={p.bgElev}
        trackFg={p.fg}
        border={p.border}
        greenBg={p.greenBg} greenFg={p.greenFg}
        redBg={p.redBg} redFg={p.redFg}
      />

      {/* Step-up 6-digit confirmation (high-value / new device) */}
      <StepUpModal
        visible={stepUpOpen}
        action="buy"
        subtitle={quote ? `${fmt(quote.cryptoAmount, 6)} ${asset}` : undefined}
        onSubmit={(code) => onConfirm(code)}
        onCancel={() => { setStepUpOpen(false); setExec(false); }}
      />

      {/* ══════════════════════════════════════════════════════════════
          NETWORK PICKER
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={networkSheetOpen} transparent animationType="slide" onRequestClose={() => setNetworkSheetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setNetworkSheetOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 48 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', paddingHorizontal: 20, marginBottom: 6 }}>
              Select network
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 16 }}>
              Choose which network to receive {serverAsset(asset)} on.
            </Text>
            {(ASSET_NETWORKS[serverAsset(asset)] ?? [{ label: serverAsset(asset), network: network }]).map((n) => {
              const selected = n.network === network;
              return (
                <Pressable
                  key={n.network}
                  onPress={() => { Haptics.selectionAsync(); setNetwork(n.network); setNetworkSheetOpen(false); setQuote(null); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingHorizontal: 20, paddingVertical: 16,
                    backgroundColor: pressed ? p.bgElev : selected ? `${brandAccent}11` : 'transparent',
                    borderBottomWidth: 1, borderBottomColor: p.border,
                  })}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: selected ? `${brandAccent}22` : p.bgElev,
                    borderWidth: 1, borderColor: selected ? brandAccent : p.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="git-branch-outline" size={16} color={selected ? brandAccent : p.fgMuted} />
                  </View>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: selected ? '700' : '500', flex: 1 }}>
                    {n.label}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={brandAccent} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

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

            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '500', letterSpacing: 0, paddingHorizontal: 20, marginBottom: 16 }}>
              Search any token
            </Text>

            {/* Search bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 4, backgroundColor: p.bgElev, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: p.border, gap: 10 }}>
              <Ionicons name="search" size={18} color={p.fgMuted} />
              <TextInput
                ref={searchRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr('buy.searchPlaceholder')}
                placeholderTextColor={p.fgFaint}
                style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '500' }}
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

            {/* ── Recent searches (horizontal chips) ── */}
            {!searchQuery && recentSearches.length > 0 && (
              <>
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, marginTop: 16, marginBottom: 8 }}>
                  RECENT SEARCHES
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
                  {recentSearches.map((sym) => {
                    const m = assetMeta(sym);
                    return (
                      <Pressable
                        key={sym}
                        onPress={() => selectAsset(sym)}
                        style={({ pressed }) => ({
                          flexDirection: 'row', alignItems: 'center', gap: 8,
                          paddingHorizontal: 12, paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: p.bgElev,
                          borderWidth: 1, borderColor: p.border,
                          opacity: pressed ? 0.75 : 1,
                        })}
                      >
                        <CoinAvatar sym={sym} size={24} color={m.color} />
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{sym}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 56 }}
            >
              {/* Section: Top 10 (when no query) */}
              {!searchQuery && (
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 12, marginBottom: 6 }}>
                  TOP 10
                </Text>
              )}

              {(searchQuery.length > 0 ? displayList : topTen).map((item) => {
                const m = assetMeta(item.symbol);
                const isSelected = asset === item.symbol;
                return (
                  <Pressable
                    key={item.symbol}
                    onPress={() => selectAsset(item.symbol)}
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
                    <CoinAvatar sym={item.symbol} size={46} color={m.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{m.label}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{item.symbol}</Text>
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
                      {isSelected && <Ionicons name="checkmark-circle" size={18} color={m.color} />}
                    </View>
                  </Pressable>
                );
              })}

              {/* Section: Top Gainers (when no query) */}
              {!searchQuery && topGainers.length > 0 && (
                <>
                  <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 20, marginBottom: 6 }}>
                    TOP GAINERS
                  </Text>
                  {topGainers.map((item) => {
                    const m = assetMeta(item.symbol);
                    const isSelected = asset === item.symbol;
                    return (
                      <Pressable
                        key={item.symbol}
                        onPress={() => selectAsset(item.symbol)}
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
                        <CoinAvatar sym={item.symbol} size={46} color={m.color} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{m.label}</Text>
                          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{item.symbol}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {item.price > 0 && (
                            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                              {sym(baseCurrency)}{fmtPrice(item.price)}
                            </Text>
                          )}
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: p.greenBg }}>
                            <Text style={{ color: p.greenFg, fontSize: 10, fontWeight: '500' }}>
                              +{(item.change24h ?? 0).toFixed(2)}%
                            </Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={18} color={m.color} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              )}

              {searchQuery.length > 0 && displayList.length === 0 && !searchLoading && (
                <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                  <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '500' }}>{tr('buy.noResults').replace('{query}', searchQuery)}</Text>
                  <Text style={{ color: p.fgFaint, fontSize: 13, marginTop: 6 }}>{tr('buy.tryExamples')}</Text>
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
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '500', paddingHorizontal: 20, marginBottom: 16 }}>{tr('buy.payWith')}</Text>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {payMethods.map((m) => {
                const selected = payMethod ? methodId(m) === methodId(payMethod) : false;
                const key = m.type === 'crypto' ? m.asset : m.type === 'fiat' ? m.currency : m.last4;
                // Fiat/card use the theme accent (mono-safe); crypto keeps its brand colour.
                const mc = m.type === 'crypto' ? assetMeta(m.asset).color : p.accent;
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
                    <Text style={{ fontSize: 22, width: 40, textAlign: 'center' }}>
                      {m.type === 'card' ? '💳' : m.type === 'fiat' ? '💵' : assetMeta(m.type === 'crypto' ? m.asset : '').icon}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500' }}>{methodLabel(m)}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>
                        {m.type === 'card' ? tr('buy.methodCard') : m.type === 'fiat' ? tr('buy.methodFiat') : tr('buy.methodCrypto')}
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
