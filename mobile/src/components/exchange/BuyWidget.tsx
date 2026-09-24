/**
 * BuyWidget — search and buy any token on Binance.
 * Phantom × Binance × MoonPay energy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, TextInput as RNTextInput, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { SuccessModal, type TxSuccessData } from '@/components/ui/SuccessModal';
import { ExpressPayButton } from '@/components/ui/ExpressPayButton';
import { useWallets, useCards, useMarkets, useTransactionSound } from '@/hooks';
import * as LocalAuthentication from 'expo-local-authentication';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { cryptoExchangeAPI, type CryptoQuote, type AssetSearchResult } from '@/lib/cryptoApi';
import { isStepUpChallengeError, stepUpErrorMessage } from '@/lib/stepUpErrors';
import { STRIPE, fiatSymbol as fiatGlyph, getCurrencyMeta } from '@/constants';

import { BottomSheet } from '@/components/ui/BottomSheet';
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

function currencySymbol(c: string, locale?: string) {
  const meta = getCurrencyMeta(c);
  return meta?.kind === 'fiat' ? fiatGlyph(c, locale) : (meta?.symbol ?? c);
}
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
function methodLabel(m: PayMethod, locale?: string) {
  if (m.type === 'card')   return `${m.brand} ···· ${m.last4}`;
  if (m.type === 'fiat')   return `${m.currency}  ·  ${currencySymbol(m.currency, locale)}${fmt(m.balance, 2)}`;
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
  const locale = useI18n((s) => s.locale);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const tight = height < 700;
  const compact = height < 780;
  const amountMaxSize = tight ? 48 : compact ? 56 : 64;
  const keypadHeight = tight ? 42 : compact ? 48 : 56;
  const keypadFont = tight ? 22 : compact ? 24 : 27;
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
  const [seconds,  setSeconds]  = useState(0);
  const [showFees,         setShowFees]         = useState(false);
  const [paySheetOpen,     setPaySheetOpen]     = useState(false);
  const [networkSheetOpen, setNetworkSheetOpen] = useState(false);
  const [payMethod,        setPayMethod]        = useState<PayMethod | null>(null);
  const [successModal,     setSuccessModal]     = useState<TxSuccessData | null>(null);
  const idemRef = useRef(`ord_${Date.now()}`);

  // ── Payment methods — exclude the asset being bought ─────────────
  // You can't pay for BTC with BTC. Fiat wallets, cards, and other
  // crypto wallets are all valid. Stablecoins (USDT/USDC) are valid
  // payment for any non-stablecoin purchase.
  const buyingBase = serverAsset(asset); // normalised symbol (no _ERC20 suffix)
  const payMethods = useMemo<PayMethod[]>(() => {
    const out: PayMethod[] = [];
    wallets?.forEach((w) => {
      const wBase = ASSET_SYMBOL[w.currency] ?? w.currency;
      // Skip if it's the same asset the user is buying
      if (wBase === buyingBase) return;
      // Classify by the currency's real kind, not a hardcoded allowlist —
      // otherwise any crypto outside the list (DOGE, ADA, dust coins…) gets
      // mislabelled as a fiat wallet.
      const isCrypto = getCurrencyMeta(wBase)?.kind === 'crypto';
      if (isCrypto) {
        // Only offer crypto you actually hold as a funding source.
        if (Number(w.balance) > 0) {
          out.push({ type: 'crypto', asset: w.currency, balance: Number(w.balance) });
        }
      } else {
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

  // Funding sources (fiat wallet + crypto wallet + saved cards) all live in
  // the same compact picker so cards don't consume their own row.
  const walletMethods = useMemo(
    () => payMethods.filter((m) => m.type !== 'card') as Extract<PayMethod, { type: 'fiat' | 'crypto' }>[],
    [payMethods],
  );
  const fundingPickerItems = useMemo<CurrencyItem[]>(
    () => payMethods.map((m) => {
      if (m.type === 'card') {
        return {
          id: methodId(m),
          currency: 'CARD',
          displayCode: `•••• ${m.last4}`,
          balance: 0,
          label: m.brand,
          icon: 'CARD',
          color: p.fg,
          bg: p.bgElev,
          kind: 'card',
          showBalance: false,
        };
      }
      const cur = m.type === 'fiat' ? m.currency : m.asset;
      const meta2 = assetMeta(cur);
      const isFiat = m.type === 'fiat';
      return {
        id: methodId(m),
        currency: cur,
        balance: m.balance,
        label: isFiat ? `${meta2.label} Wallet` : meta2.label,
        icon: isFiat ? currencySymbol(cur, locale) : meta2.icon,
        color: isFiat ? p.fg : meta2.color,
        bg: `${meta2.color}22`,
        kind: isFiat ? 'fiat' : 'crypto',
        isFiat,
      };
    }),
    [payMethods, locale, p.bgElev, p.fg],
  );
  const selectedFundingId = payMethod ? methodId(payMethod) : (fundingPickerItems[0]?.id ?? fundingPickerItems[0]?.currency ?? '');

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
    if (!amt || amt <= 0 || !payMethod) { setQuote(null); return; }
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

  // ── Execute order — called with the chosen payment method ─────────
  async function doExecute(method: PayMethod | null, stepUpCode?: string) {
    if (!quote || !method) { setExec(false); return; }

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
      } catch {}
    }

    setExec(true); setError(null);
    const snapQuote = quote; // capture before any state resets
    try {
      const result = await cryptoExchangeAPI.execute({
        quoteId: snapQuote.id, confirmedByUser: true, idempotencyKey: idemRef.current,
        ...(stepUpCode ? { stepUpCode } : {}),
        ...(biometricVerified ? { biometricVerified: true } : {}),
      } as any) as any;
      playSuccess('buy');
      // First/second completed buy is the moment a user decides this app is
      // real — the prompt lib self-throttles and never throws.
      import('@/lib/reviewPrompt').then(({ maybeAskForReview }) => maybeAskForReview());
      setStepUpOpen(false);
      setQuote(null); setFiat('');
      const txRef = result?.data?.txRef ?? result?.data?.orderId ?? result?.data?.id ?? `#${idemRef.current}`;
      const rate = Number(snapQuote.totalUserPays) / Math.max(Number(snapQuote.cryptoAmount), 1e-18);
      const creditedWallet = `${asset} Wallet`;
      const debitedWallet  = method.type === 'fiat'   ? `${method.currency} Wallet`
                           : method.type === 'crypto' ? `${method.asset} Wallet`
                           : `${fundingCurrency} (Card)`;
      setSuccessModal({
        type: 'buy', asset,
        cryptoAmount: Number(snapQuote.cryptoAmount),
        settledCurrency: fundingCurrency,
        txRef, rate, creditedWallet, debitedWallet,
        timestamp: new Date(),
      });
    } catch (e: any) {
      const msg = stepUpErrorMessage(e);
      if (isStepUpChallengeError(e) && !stepUpCode) {
        setError(null);
        setStepUpOpen(true);
        return;
      }
      playError();
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
  const canConfirm    = !!quote && !!payMethod && !exec && seconds > 0;

  // Instant price estimate: shown while no quote exists but amount + livePrice are known
  const fiatNum       = parseFloat(fiat) || 0;
  const priceEstimate = livePrice > 0 && fiatNum > 0 ? fiatNum / Number(livePrice) : null;

  const slideLabel = !payMethod
    ? 'Select a payment method'
    : canConfirm
    ? tr('buy.slideToBuy').replace('{asset}', asset)
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
  const handleExpressPaySuccess = () => {
    const ca = Number(quote?.cryptoAmount ?? priceEstimate ?? 0);
    const rate = ca > 0 ? fiatNum / ca : 0;
    setSuccessModal({
      type: 'buy', asset, cryptoAmount: ca,
      settledCurrency: fundingCurrency,
      txRef: `#${idemRef.current}`,
      rate, creditedWallet: `${asset} Wallet`,
      debitedWallet: `${fundingCurrency} (Card)`,
      timestamp: new Date(),
    });
    setQuote(null);
    setFiat('');
    setPaySheetOpen(false);
  };
  const showExpressPay = fiatNum > 0 && !!STRIPE.publishableKey && (Platform.OS === 'ios' || Platform.OS === 'android');

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Top row: crypto picker (½) + chain selector (½) ── */}
      {(() => {
        const networks = ASSET_NETWORKS[serverAsset(asset)];
        const multiChain = !!networks && networks.length > 1;
        const currentLabel = networks?.find((n) => n.network === network)?.label ?? network;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            {/* Crypto picker — minimal, borderless */}
            <Pressable
              disabled={lockAsset}
              onPress={() => { if (lockAsset) return; Haptics.selectionAsync(); setAssetSheetOpen(true); }}
              style={({ pressed }) => ({
                flex: 1, minWidth: 0,
                flexDirection: 'row', alignItems: 'center', gap: 9,
                paddingVertical: 4,
                opacity: pressed && !lockAsset ? 0.6 : 1,
              })}
            >
              <CoinAvatar sym={asset} size={32} color={meta.color} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}>{asset}</Text>
                <Text numberOfLines={1} style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>{meta.label}</Text>
              </View>
              {!lockAsset && <Ionicons name="chevron-down" size={15} color={p.fgMuted} />}
            </Pressable>

            {/* Chain selector — minimal chip, only when multi-chain */}
            {multiChain && (
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setNetworkSheetOpen(true); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: p.pillBg,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{currentLabel}</Text>
                <Ionicons name="chevron-down" size={13} color={p.fgMuted} />
              </Pressable>
            )}
          </View>
        );
      })()}

      {/* ── Pay with ── one picker for wallet currencies + saved cards */}
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{tr('buy.payWith').toUpperCase()}</Text>
      {fundingPickerItems.length > 0 && (
        <View style={{ marginBottom: compact ? 8 : 12 }}>
          <CurrencyPicker
            items={fundingPickerItems}
            value={selectedFundingId}
            onChange={(id) => {
              const m = payMethods.find((candidate) => methodId(candidate) === id);
              if (m) { setPayMethod(m); setQuote(null); setError(null); }
            }}
            palette={p}
            fmtBalance={(n) => fmt(n, 2)}
          />
        </View>
      )}

      {/* ── Amount (big, centered) ── */}
      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center', marginBottom: 6 }}>
        {tr('buy.youPay')}
      </Text>
      {/* Big centered amount — matches the home balance treatment */}
      <View style={{ marginBottom: 6 }}>
        <AmountDisplay
          value={fiat}
          symbol={currencySymbol(fundingCurrency, locale).trim()}
          palette={p}
          tint={error ? p.redFg : undefined}
          maxSize={amountMaxSize}
        />
      </View>
      {priceEstimate && !quote && livePrice > 0 && (
        <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>
          ≈ {fmt(priceEstimate, 6)} {asset}
        </Text>
      )}

      <View style={{ height: 10 }} />

      {/* ── Quote line — minimal, borderless ── */}
      <View style={{
        paddingHorizontal: 4, paddingVertical: 6, marginBottom: 6,
      }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={meta.color} />
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{tr('buy.gettingPrice')}</Text>
          </View>
        ) : quote ? (
          <>
            {/* You receive + timer — single compact row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>{tr('buy.youReceive')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
                  {fmt(quote.cryptoAmount, 8)} <Text style={{ color: meta.color, fontSize: 13 }}>{asset}</Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: timerCritical ? 'rgba(239,68,68,0.12)' : p.pillBg }}>
                  <Ionicons name="timer-outline" size={11} color={timerCritical ? p.redFg : p.fgMuted} />
                  <Text style={{ color: timerCritical ? p.redFg : p.fgMuted, fontSize: 11, fontWeight: '600' }}>{seconds}s</Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => setShowFees(!showFees)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: p.border }}
            >
              <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500' }}>
                {tr('buy.totalYouPay')} · {currencySymbol(fundingCurrency, locale)}{fmt(quote.totalUserPays, 2)}
              </Text>
              <Ionicons name={showFees ? 'chevron-up' : 'chevron-down'} size={13} color={p.fgMuted} />
            </Pressable>
            {showFees && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {([
                  { label: tr('buy.platformFee'), value: `${currencySymbol(fundingCurrency, locale)}${fmt(quote.platformFeeSettlement ?? quote.platformFee, 2)}` },
                  { label: tr('buy.networkFee'),  value: `${currencySymbol(fundingCurrency, locale)}${fmt(quote.networkFeeSettlement ?? quote.networkFee, 2)}` },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: p.fgFaint, fontSize: 11.5, fontWeight: '500' }}>{label}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500' }}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : priceEstimate ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>{tr('buy.youReceiveEst')}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
              ≈ {fmt(priceEstimate, 8)} <Text style={{ color: meta.color, fontSize: 12 }}>{asset}</Text>
            </Text>
          </View>
        ) : (
          <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500', textAlign: 'center' }}>
            {tr('buy.enterAmountQuote')}
          </Text>
        )}
      </View>

      {/* ── Status banner (errors only; success shown inside slider) ── */}
      <StatusBanner kind="error" message={error} onDismiss={() => setError(null)} />

      {/* Flexible spacer pushes the keypad + CTA to the bottom of the screen
          so everything fits in view without scrolling. */}
      <View style={{ flex: 1, minHeight: 8 }} />

      {/* ── Numeric keypad — drives the fiat amount ── */}
      <View style={{ marginBottom: 14 }}>
        <NumericKeypad
          value={fiat}
          onChange={(v) => { setFiat(v); setQuote(null); setError(null); setShowFees(false); }}
          palette={p}
          maxDecimals={2}
          keyHeight={keypadHeight}
          fontSize={keypadFont}
        />
      </View>

      {/* Express pay — appears directly above the slide confirmation. */}
      {fiatNum > 0 && payMethod?.type === 'card' && (
        <View style={{ marginBottom: 10 }}>
          <ExpressPayButton
            amount={fiatNum}
            currency={fundingCurrency}
            cryptoCurrency={serverAsset(asset)}
            enabled={!exec}
            onSuccess={handleExpressPaySuccess}
            onError={(m) => setError(m)}
          />
        </View>
      )}

      {/* ── CTA — pinned at the bottom ── */}
      <SlideToConfirm
        label={slideLabel}
        onConfirm={() => { if (canConfirm && !error && !exec) doExecute(payMethod); }}
        enabled={canConfirm && !error}
        status={exec ? 'loading' : error ? 'error' : 'idle'}
        errorLabel={error || undefined}
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
        onSubmit={(code) => doExecute(payMethod, code)}
        onCancel={() => { setStepUpOpen(false); setExec(false); }}
      />

      {/* ══════════════════════════════════════════════════════════════
          NETWORK PICKER
      ══════════════════════════════════════════════════════════════ */}
      <BottomSheet visible={networkSheetOpen} onClose={() => setNetworkSheetOpen(false)} title={"Select network"} contentStyle={{ paddingHorizontal: 0 }}>
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
          </BottomSheet>

      {/* ══════════════════════════════════════════════════════════════
          ASSET PICKER — full Binance search
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={assetSheetOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAssetSheetOpen(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
          {/* Header: title + close */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>
              {tr('buy.searchTitle') || 'Search any token'}
            </Text>
            <Pressable onPress={() => setAssetSheetOpen(false)} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color={p.fg} />
            </Pressable>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
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
                    <CoinAvatar sym={item.symbol} size={42} color={m.color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{(item as AssetSearchResult).name ?? m.label}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>{item.symbol}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {item.price > 0 && (
                        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                          {currencySymbol(baseCurrency, locale)}{fmtPrice(item.price)}
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
                              {currencySymbol(baseCurrency, locale)}{fmtPrice(item.price)}
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
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          PAY METHOD PICKER
      ══════════════════════════════════════════════════════════════ */}
      <BottomSheet visible={paySheetOpen} onClose={() => setPaySheetOpen(false)} title={tr('buy.payWith')} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            {showExpressPay && (
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <View style={{ backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Fast checkout</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                        {currencySymbol(fundingCurrency, locale)}{fmt(fiatNum, 2)} for {serverAsset(asset)}
                      </Text>
                    </View>
                    <Ionicons name="flash-outline" size={18} color={p.accentText} />
                  </View>
                  <ExpressPayButton
                    amount={fiatNum}
                    currency={fundingCurrency}
                    cryptoCurrency={serverAsset(asset)}
                    enabled={!exec}
                    onSuccess={handleExpressPaySuccess}
                    onError={(m) => setError(m)}
                  />
                </View>
              </View>
            )}
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {payMethods.map((m) => {
                const selected = payMethod ? methodId(m) === methodId(payMethod) : false;
                const key = m.type === 'crypto' ? m.asset : m.type === 'fiat' ? m.currency : m.last4;
                // Fiat/card use the theme accent (mono-safe); crypto keeps its brand colour.
                const mc = m.type === 'crypto' ? assetMeta(m.asset).color : p.accent;
                return (
                  <Pressable
                    key={methodId(m)}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPayMethod(m);
                      setPaySheetOpen(false);
                      setQuote(null); // requote with new funding currency
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 16, marginBottom: 8,
                      borderWidth: 1.5, borderColor: selected ? mc : p.border,
                      backgroundColor: selected ? `${mc}11` : p.bgElev,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: selected ? `${mc}22` : p.bgRaised,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: p.fg, fontSize: m.type === 'fiat' ? 18 : 16, fontWeight: '800' }}>
                        {m.type === 'card'
                          ? 'CARD'
                          : m.type === 'fiat'
                          ? currencySymbol(m.currency, locale)
                          : assetMeta(m.asset).icon}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500' }}>{methodLabel(m, locale)}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>
                        {m.type === 'card' ? tr('buy.methodCard') : m.type === 'fiat' ? tr('buy.methodFiat') : tr('buy.methodCrypto')}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={22} color={mc} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </BottomSheet>

      <SuccessModal
        data={successModal}
        onClose={() => setSuccessModal(null)}
      />
    </View>
  );
}
