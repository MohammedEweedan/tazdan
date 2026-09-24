/**
 * SellWidget — sell any crypto the user holds, receive to a chosen fiat/stablecoin wallet.
 *
 * Key fixes:
 *  - "You receive" is the user's chosen fiat/stablecoin wallet (USD, EUR, GBP, USDC…)
 *    not hardcoded USDT
 *  - Multi-chain selector for assets that exist on multiple networks (USDT ERC20/TRC20/BEP20,
 *    USDC ERC20/SOL, BNB BEP20/ERC20, MATIC ERC20/Polygon, etc.)
 *  - Receive-to wallet is always a different asset than what's being sold
 *  - Auto-selects sensible defaults; user can change both sides independently
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, View, TextInput as RNTextInput, Modal, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { CurrencyPicker, type CurrencyItem } from '@/components/ui/CurrencyPicker';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { useWallets, useMarkets, useTransactionSound } from '@/hooks';
import * as LocalAuthentication from 'expo-local-authentication';
import { CoinAvatar } from '@/components/ui/CoinAvatar';
import { cryptoExchangeAPI, type CryptoQuote } from '@/lib/cryptoApi';
import { isStepUpChallengeError, stepUpErrorMessage } from '@/lib/stepUpErrors';
import { fiatSymbol as fiatGlyph, getCurrencyMeta } from '@/constants';

import { BottomSheet } from '@/components/ui/BottomSheet';
// ── Shared metadata ───────────────────────────────────────────────────────────
const KNOWN: Record<string, { label: string; color: string; icon: string }> = {
  BTC:   { label: 'Bitcoin',      color: '#f7931a', icon: '₿'  },
  ETH:   { label: 'Ethereum',     color: '#627eea', icon: 'Ξ'  },
  SOL:   { label: 'Solana',       color: '#9945ff', icon: '◎'  },
  USDT:  { label: 'Tether',       color: '#26a17b', icon: '₮'  },
  USDC:  { label: 'USD Coin',     color: '#2775ca', icon: '◎'  },
  BNB:   { label: 'BNB',          color: '#f3ba2f', icon: '⬡'  },
  XRP:   { label: 'XRP',          color: '#346aa9', icon: '✕'  },
  ADA:   { label: 'Cardano',      color: '#0033ad', icon: '₳'  },
  DOGE:  { label: 'Dogecoin',     color: '#c3a634', icon: 'Ð'  },
  MATIC: { label: 'Polygon',      color: '#8247e5', icon: '◆'  },
  DOT:   { label: 'Polkadot',     color: '#e6007a', icon: '●'  },
  AVAX:  { label: 'Avalanche',    color: '#e84142', icon: '▲'  },
  LTC:   { label: 'Litecoin',     color: '#bfbbbb', icon: 'Ł'  },
  LINK:  { label: 'Chainlink',    color: '#2a5ada', icon: '⬡'  },
  UNI:   { label: 'Uniswap',      color: '#ff007a', icon: '🦄' },
  AAVE:  { label: 'Aave',         color: '#b6509e', icon: '👻' },
  ATOM:  { label: 'Cosmos',       color: '#6f7590', icon: '⚛'  },
  ALGO:  { label: 'Algorand',     color: '#6cc3a8', icon: 'Ⓐ'  },
  NEAR:  { label: 'NEAR',         color: '#00c08b', icon: '𝗡'  },
  FTM:   { label: 'Fantom',       color: '#1969ff', icon: 'F'  },
  VET:   { label: 'VeChain',      color: '#15bdff', icon: 'V'  },
  TRX:   { label: 'TRON',         color: '#ef0027', icon: 'T'  },
  XLM:   { label: 'Stellar',      color: '#7d00ff', icon: '*'  },
  FIL:   { label: 'Filecoin',     color: '#0090ff', icon: '⨎'  },
  SHIB:  { label: 'Shiba Inu',    color: '#e44d26', icon: '🐕' },
  PEPE:  { label: 'Pepe',         color: '#00a550', icon: '🐸' },
  ARB:   { label: 'Arbitrum',     color: '#12aaff', icon: 'A'  },
  OP:    { label: 'Optimism',     color: '#ff0420', icon: 'O'  },
  SUI:   { label: 'Sui',          color: '#4da2ff', icon: 'S'  },
  TON:   { label: 'Toncoin',      color: '#0098ea', icon: '💎' },
};

// Networks available per asset (sell side)
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

function defaultNetwork(sym: string): string {
  return ASSET_NETWORKS[sym]?.[0]?.network ?? sym;
}

function symbolColor(sym: string): string {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 65%, 55%)`;
}
function assetMeta(symbol: string | undefined | null) {
  if (!symbol) return { label: '?', color: '#888888', icon: '?' };
  return KNOWN[symbol.toUpperCase()] ?? { label: symbol.toUpperCase(), color: symbolColor(symbol), icon: symbol[0]?.toUpperCase() ?? '?' };
}

const FIAT_CODES = new Set(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);
// Intl.DisplayNames is not available in Hermes, so we map fiat codes to names locally.
const FIAT_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', AED: 'UAE Dirham',
  SAR: 'Saudi Riyal', EGP: 'Egyptian Pound', LYD: 'Libyan Dinar', CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar', CHF: 'Swiss Franc', JPY: 'Japanese Yen', CNY: 'Chinese Yuan',
};
const fiatName = (code: string) => FIAT_NAMES[code] ?? code;
const CRYPTO_SELL_KEYS = new Set([
  'BTC','ETH','SOL','USDT','USDC','BNB','XRP','ADA','DOGE','MATIC',
  'DOT','AVAX','LTC','LINK','UNI','AAVE','ATOM','ALGO','NEAR','FTM',
  'VET','TRX','XLM','FIL','SHIB','PEPE','ARB','OP','SUI','TON',
]);

function currSym(c: string, locale?: string) {
  const meta = getCurrencyMeta(c);
  return meta?.kind === 'fiat' ? fiatGlyph(c, locale) : (meta?.symbol ?? c);
}
function fmt(n: string | number, d = 6) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d });
}
function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1)    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (n >= 0.01) return n.toFixed(5);
  return n.toFixed(8);
}

// ── Receive-to wallet option ──────────────────────────────────────────────────
interface ReceiveOption {
  currency: string;   // e.g. "USD", "EUR", "USDC"
  balance:  number;
  isFiat:   boolean;
  label:    string;   // "US Dollar — $1,234.56"
}

interface SellWidgetProps {
  defaultAsset?: string;
  lockAsset?:    boolean;
}

export function SellWidget({ defaultAsset, lockAsset = false }: SellWidgetProps = {}) {
  const { user, biometricEnabled } = useAuthStore();
  const tr = useT();
  const p = useThemedPalette();
  const locale = useI18n((s) => s.locale);
  const { height } = useWindowDimensions();
  const tight = height < 700;
  const compact = height < 780;
  const amountMaxSize = tight ? 48 : compact ? 56 : 64;
  const keypadHeight = tight ? 42 : compact ? 48 : 56;
  const keypadFont = tight ? 22 : compact ? 24 : 27;
  // Accent follows the active palette — soft brand blue on dark/light,
  // greyscale in mono. Drives the USE MAX pill, focus ring, and selected
  // network rows. The confirm CTA stays neutral (accent-only policy).
  const brandAccent = p.accent;
  const { data: wallets } = useWallets();
  const { data: tickers } = useMarkets();
  const { playSuccess, playError } = useTransactionSound();
  const baseCurrency = (user as any)?.baseCurrency ?? 'USD';

  // ── Sellable holdings ─────────────────────────────────────────────
  const holdings = useMemo(() => {
    if (!wallets) return [];
    return wallets
      .filter((w) => CRYPTO_SELL_KEYS.has(w.currency.toUpperCase()) && parseFloat(w.balance) > 0)
      .map((w) => ({ currency: w.currency, balance: parseFloat(w.balance) }));
  }, [wallets]);

  // ── Receive options — every fiat the platform settles into (all ledger
  //    fiats) plus the USDC stablecoin. We DON'T restrict to wallets the user
  //    already holds: selling crypto into e.g. LYD must be offered even before
  //    the user has an LYD balance — the backend creates the wallet on
  //    settlement. Balances are shown when a row exists, else 0. ───
  const receiveOptions = useMemo<ReceiveOption[]>(() => {
    // All fiat currencies the ledger supports (mirrors server LEDGER_CURRENCIES).
    const LEDGER_FIATS = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'];
    const STABLES = ['USDC'];
    const balanceOf = (cur: string) =>
      parseFloat(wallets?.find((w) => w.currency === cur)?.balance ?? '0') || 0;

    const out: ReceiveOption[] = [];
    // Lead with the user's base currency, then the rest of the fiats.
    const fiatOrder = [baseCurrency, ...LEDGER_FIATS.filter((c) => c !== baseCurrency)];
    for (const cur of fiatOrder) {
      out.push({ currency: cur, balance: balanceOf(cur), isFiat: true, label: fiatName(cur) });
    }
    for (const cur of STABLES) {
      out.push({ currency: cur, balance: balanceOf(cur), isFiat: false, label: assetMeta(cur).label });
    }
    return out;
  }, [wallets, baseCurrency]);

  // ── Selected state ────────────────────────────────────────────────
  const [asset,           setAsset]           = useState((defaultAsset || holdings[0]?.currency || 'BTC').toUpperCase());
  const [network,         setNetwork]         = useState(() => defaultNetwork((defaultAsset || 'BTC').toUpperCase()));
  const [networkSheetOpen,setNetworkSheetOpen]= useState(false);
  const [assetSheetOpen,  setAssetSheetOpen]  = useState(false);
  const [receiveSheetOpen,setReceiveSheetOpen]= useState(false);
  const [receiveTo,       setReceiveTo]       = useState<ReceiveOption | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const searchRef = useRef<RNTextInput>(null);

  // ── Trade state ───────────────────────────────────────────────────
  const [cryptoAmt, setCryptoAmt] = useState('');
  const [quote,    setQuote]    = useState<CryptoQuote | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [exec,     setExec]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [seconds,  setSeconds]  = useState(0);
  const [showFees, setShowFees] = useState(false);
  const idemRef = useRef(`ord_${Date.now()}`);
  const [requoteKey, setRequoteKey] = useState(0);

  // Set default receive-to: user's base currency, excluding the asset being sold
  useEffect(() => {
    if (receiveOptions.length === 0) return;
    // pick base currency first, then any other fiat, then USDC — but never the same as `asset`
    const preferred = receiveOptions.find((o) => o.currency === baseCurrency && o.currency !== asset)
      ?? receiveOptions.find((o) => o.isFiat && o.currency !== asset)
      ?? receiveOptions.find((o) => o.currency !== asset)
      ?? null;
    setReceiveTo((prev) => {
      if (prev && prev.currency !== asset) return prev;
      return preferred;
    });
  }, [receiveOptions, asset, baseCurrency]);

  // When asset changes, reset network to default for that asset
  useEffect(() => { setNetwork(defaultNetwork(asset)); }, [asset]);

  // Reset search when asset sheet opens
  useEffect(() => { if (assetSheetOpen) setSearchQuery(''); }, [assetSheetOpen]);

  const currentHolding = useMemo(
    () => holdings.find((h) => h.currency === asset || h.currency === asset.replace('_ERC20','').replace('_TRC20','')),
    [holdings, asset],
  );
  const balance   = currentHolding?.balance ?? 0;
  const change24h = tickers?.find((t) => t.base === asset)?.changePct24h;
  const networks  = ASSET_NETWORKS[asset] ?? [{ label: asset, network: defaultNetwork(asset) }];
  const multiChain= networks.length > 1;
  const currentNetworkLabel = networks.find((n) => n.network === network)?.label ?? network;

  // ── Quote fetching ────────────────────────────────────────────────
  useEffect(() => {
    const amt = parseFloat(cryptoAmt);
    if (!amt || amt <= 0 || !receiveTo) { setQuote(null); return; }
    const id = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const res = await cryptoExchangeAPI.quote({
          asset,
          network,
          side: 'SELL',
          cryptoAmount: String(amt),
          receiveCurrency: receiveTo.currency,
        });
        setQuote(res.data.quote);
        idemRef.current = `ord_${Date.now()}`;
      } catch (e: any) {
        setError(e?.response?.data?.error ?? tr('buy.errQuote'));
        setQuote(null);
      } finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, network, cryptoAmt, receiveTo, requoteKey]);

  // ── Quote countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000));
      setSeconds(s);
      if (s <= 0) { setQuote(null); setRequoteKey((k) => k + 1); }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [quote]);

  // ── Confirm ───────────────────────────────────────────────────────
  async function onConfirm(stepUpCode?: string) {
    if (!quote) return;

    // Face ID confirmation for the sale (when enabled). Trusted device → server
    // accepts it; new device → 401 falls through to the code modal.
    let biometricVerified = false;
    if (!stepUpCode && biometricEnabled) {
      try {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (enrolled) {
          const r = await LocalAuthentication.authenticateAsync({
            promptMessage: `Confirm sale of ${asset}`,
            cancelLabel: tr('common.cancel'), fallbackLabel: tr('common.usePasscode'), disableDeviceFallback: false,
          });
          if (!r.success) { setError(tr('common.verificationCancelled')); return; }
          biometricVerified = true;
        }
      } catch { /* biometric unavailable → server will require a code */ }
    }

    setExec(true); setError(null);
    try {
      await cryptoExchangeAPI.execute({ quoteId: quote.id, confirmedByUser: true, idempotencyKey: idemRef.current, ...(stepUpCode ? { stepUpCode } : {}), ...(biometricVerified ? { biometricVerified: true } : {}) } as any);
      playSuccess('sell');
      setStepUpOpen(false);
      const recvAmt = receiveTo?.isFiat
        ? `${currSym(receiveTo.currency, locale)}${fmt(quote.settlementAmount ?? quote.fiatAmount, 2)}`
        : `${fmt(quote.settlementAmount ?? quote.fiatAmount, 6)} ${receiveTo?.currency ?? ''}`;
      setSuccess(`Sold ${fmt(quote.cryptoAmount, 8)} ${asset} → ${recvAmt} ✓`);
      setQuote(null); setCryptoAmt('');
      // Auto-dismiss the success banner so the widget returns to a clean state.
      setTimeout(() => setSuccess(null), 4000);
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
  const overspend = parseFloat(cryptoAmt) > balance;
  const timerCritical = seconds > 0 && seconds < 8;
  const canConfirm = !!quote && !exec && seconds > 0 && !overspend;

  const slideLabel = canConfirm
    ? tr('sell.slideToSell').replace('{asset}', asset)
    : overspend ? tr('sell.insufficient') : tr('sell.enterAmountToSell');

  // Holdings filtered by search for the asset sheet
  const filteredHoldings = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return holdings.filter((h) =>
      !q || h.currency.includes(q) || assetMeta(h.currency).label.toUpperCase().includes(q),
    );
  }, [holdings, searchQuery]);

  // Receive options excluding the currently-sold asset
  const validReceiveOptions = useMemo(
    () => receiveOptions.filter((o) => o.currency !== asset),
    [receiveOptions, asset],
  );

  // Map the receive options into the swipeable CurrencyPicker's item shape.
  const receivePickerItems = useMemo<CurrencyItem[]>(
    () => validReceiveOptions.map((o) => {
      const m = assetMeta(o.currency);
      return {
        currency: o.currency,
        balance: o.balance,
        label: o.label,
        icon: o.isFiat ? currSym(o.currency, locale) : m.icon,
        color: o.isFiat ? p.fg : m.color,
        bg: `${m.color}22`,
        kind: o.isFiat ? 'fiat' : 'crypto',
        isFiat: o.isFiat,
      };
    }),
    [validReceiveOptions, locale, p.fg],
  );

  return (
    <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 8 }}>

      {/* ── Top row: asset + network (minimal, matches Buy) ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        {/* Asset — borderless */}
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
          <CoinAvatar sym={asset} color={meta.color} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}>{asset}</Text>
            <Text numberOfLines={1} style={{ color: p.fgFaint, fontSize: 11, fontWeight: '500' }}>{meta.label}</Text>
          </View>
          {!lockAsset && <Ionicons name="chevron-down" size={15} color={p.fgMuted} />}
        </Pressable>

        {/* Network — minimal chip, only when multi-chain */}
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
            <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{currentNetworkLabel}</Text>
            <Ionicons name="chevron-down" size={13} color={p.fgMuted} />
          </Pressable>
        )}
      </View>

      {/* ── CREDIT TO — same picker position as Buy's payment source ── */}
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>{tr('sell.creditTo') || 'Credit to'}</Text>
      <View style={{ marginBottom: compact ? 10 : 14 }}>
        {receiveTo && receivePickerItems.length > 0 && (
          <CurrencyPicker
            items={receivePickerItems}
            value={receiveTo.currency}
            onChange={(c) => {
              const opt = validReceiveOptions.find((o) => o.currency === c);
              if (opt) { setReceiveTo(opt); setQuote(null); }
            }}
            palette={p}
            fmtBalance={(n) => fmt(n, 2)}
          />
        )}
      </View>

      {/* ── Amount (big, centered) + USE MAX ── */}
      <Pressable
        onPress={() => { Haptics.selectionAsync(); setCryptoAmt(String(balance)); setQuote(null); setError(null); }}
        hitSlop={6} style={{ alignSelf: 'flex-end', marginBottom: 6 }}
      >
        <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>{tr('common.useMax').toUpperCase()}</Text>
      </Pressable>
      <View style={{ marginBottom: 6 }}>
        <AmountDisplay value={cryptoAmt} symbol={asset} palette={p} tint={overspend || error ? p.redFg : undefined} maxSize={amountMaxSize} />
      </View>
      <Text style={{ color: overspend ? p.redFg : p.fgMuted, fontSize: 12, fontWeight: '500', textAlign: 'center', marginBottom: compact ? 12 : 18 }}>
        {overspend
          ? tr('sell.overBy').replace('{amount}', (parseFloat(cryptoAmt) - balance).toLocaleString(undefined, { maximumFractionDigits: 8 })).replace('{asset}', asset)
          : tr('sell.balance').replace('{balance}', balance.toLocaleString(undefined, { maximumFractionDigits: 8 })).replace('{asset}', asset)}
      </Text>

      {/* ── Quote line — minimal, borderless (matches Buy) ── */}
      <View style={{ paddingHorizontal: 4, paddingVertical: 6, marginBottom: 6 }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={meta.color} />
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{tr('sell.gettingBestPrice')}</Text>
          </View>
        ) : quote && receiveTo ? (
          <>
            {/* You receive + timer — single compact row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>{tr('sell.youReceiveLabel')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
                  {receiveTo.isFiat
                    ? `${currSym(receiveTo.currency, locale)}${fmt(quote.settlementAmount ?? quote.fiatAmount, 2)}`
                    : fmt(quote.settlementAmount ?? quote.fiatAmount, 6)}
                  {' '}<Text style={{ color: p.fgMuted, fontSize: 13 }}>{receiveTo.currency}</Text>
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
                {tr('sell.youReceiveLabel')} · {currSym(receiveTo.currency, locale)}{fmt(quote.settlementAmount ?? quote.fiatAmount, 2)}
              </Text>
              <Ionicons name={showFees ? 'chevron-up' : 'chevron-down'} size={13} color={p.fgMuted} />
            </Pressable>
            {showFees && (
              <View style={{ marginTop: 8, gap: 6 }}>
                {([
                  { label: tr('sell.platformFee'), value: `${currSym(receiveTo.currency, locale)}${fmt(quote.platformFeeSettlement ?? quote.platformFee, 2)}` },
                  { label: tr('sell.networkFee'),  value: `${currSym(receiveTo.currency, locale)}${fmt(quote.networkFeeSettlement ?? quote.networkFee, 2)}` },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: p.fgFaint, fontSize: 11.5, fontWeight: '500' }}>{label}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500' }}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500', textAlign: 'center' }}>
            {parseFloat(cryptoAmt) > 0 && !overspend ? tr('sell.fetchingQuote') : tr('sell.enterAmountToReceive')}
          </Text>
        )}
      </View>

      {/* ── Status banner (errors only; success shown inside slider) ── */}
      <StatusBanner kind="error" message={error} onDismiss={() => setError(null)} />

      {/* Flexible spacer pushes the keypad + CTA to the bottom (no scroll). */}
      <View style={{ flex: 1, minHeight: 8 }} />

      {/* ── Numeric keypad — drives the crypto amount ── */}
      <View style={{ marginBottom: 14 }}>
        <NumericKeypad
          value={cryptoAmt}
          onChange={(v) => { setCryptoAmt(v); setQuote(null); setError(null); setSuccess(null); setShowFees(false); }}
          palette={p}
          keyHeight={keypadHeight}
          fontSize={keypadFont}
        />
      </View>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <SlideToConfirm
        label={slideLabel}
        onConfirm={() => { if (canConfirm && !error && !success) onConfirm(); }}
        enabled={canConfirm && !error && !success}
        status={exec ? 'loading' : success ? 'success' : error ? 'error' : 'idle'}
        successLabel={success || undefined}
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
        action="sell"
        subtitle={quote ? `${fmt(quote.cryptoAmount, 6)} ${asset}` : undefined}
        onSubmit={(code) => onConfirm(code)}
        onCancel={() => { setStepUpOpen(false); setExec(false); }}
      />

      {/* ══ SELL ASSET SHEET ══════════════════════════════════════════ */}
      <Modal visible={assetSheetOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAssetSheetOpen(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: p.border }}>
            <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>{tr('sell.selectAsset')}</Text>
            <Pressable onPress={() => setAssetSheetOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={p.fg} />
            </Pressable>
          </View>
          {holdings.length > 3 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, gap: 10 }}>
              <Ionicons name="search" size={16} color={p.fgMuted} />
              <TextInput
                ref={searchRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={tr('sell.filterHoldings')}
                placeholderTextColor={p.fgFaint}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: p.fg, fontSize: 15, paddingVertical: 12 }}
              />
            </View>
          )}
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
            {tr('sell.yourHoldings')}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredHoldings.map((holding) => {
              const m = assetMeta(holding.currency);
              const price = tickers?.find((t) => t.base === holding.currency)?.price ?? 0;
              const usdVal = holding.balance * Number(price);
              const isSelected = asset === holding.currency;
              return (
                <Pressable
                  key={holding.currency}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAsset(holding.currency);
                    setCryptoAmt(''); setQuote(null); setError(null); setSuccess(null);
                    setAssetSheetOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingHorizontal: 20, paddingVertical: 14,
                    backgroundColor: pressed ? p.bgElev : isSelected ? `${m.color}11` : 'transparent',
                  })}
                >
                  <CoinAvatar sym={holding.currency} color={m.color} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{m.label}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                      {holding.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })} {holding.currency}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    {usdVal > 0 && (
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        ${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    )}
                    {price > 0 && (
                      <Text style={{ color: p.fgMuted, fontSize: 11 }}>
                        ${fmtPrice(Number(price))}
                      </Text>
                    )}
                    {isSelected && <Ionicons name="checkmark-circle" size={18} color={m.color} />}
                  </View>
                </Pressable>
              );
            })}
            {filteredHoldings.length === 0 && (
              <View style={{ paddingHorizontal: 24, paddingVertical: 48, alignItems: 'center', gap: 10 }}>
                <Ionicons name="wallet-outline" size={32} color={p.fgMuted} />
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                  {searchQuery.trim() ? tr('sell.noMatching') : tr('sell.nothingToSell')}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', lineHeight: 18, maxWidth: 260 }}>
                  {searchQuery.trim() ? tr('sell.noMatchHint').replace('{query}', searchQuery.trim()) : tr('sell.nothingToSellHint')}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ══ NETWORK SHEET ═════════════════════════════════════════════ */}
      <BottomSheet visible={networkSheetOpen} onClose={() => setNetworkSheetOpen(false)} title={tr('sell.selectNetwork')} contentStyle={{ paddingHorizontal: 0 }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 16 }}>
              {tr('sell.selectNetworkHint')}
            </Text>
            {networks.map((n) => {
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

      {/* ══ RECEIVE-TO SHEET ══════════════════════════════════════════ */}
      <BottomSheet visible={receiveSheetOpen} onClose={() => setReceiveSheetOpen(false)} title={tr('sell.receiveProceeds')} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 16 }}>
              {tr('sell.receiveProceedsHint')}
            </Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {validReceiveOptions.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
                  <Ionicons name="wallet-outline" size={28} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: 'center' }}>
                    {tr('sell.noEligibleWallets')}
                  </Text>
                </View>
              ) : (
                validReceiveOptions.map((opt) => {
                  const selected = receiveTo?.currency === opt.currency;
                  const iconColor = opt.isFiat ? p.fg : assetMeta(opt.currency).color;
                  const glyph = opt.isFiat ? currSym(opt.currency, locale) : assetMeta(opt.currency).icon;
                  return (
                    <Pressable
                      key={opt.currency}
                      onPress={() => { Haptics.selectionAsync(); setReceiveTo(opt); setReceiveSheetOpen(false); setQuote(null); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                        padding: 14, borderRadius: 16, marginBottom: 8,
                        borderWidth: 1.5, borderColor: selected ? iconColor : p.border,
                        backgroundColor: selected ? `${iconColor}14` : p.bgElev,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: opt.isFiat ? p.fg : iconColor, fontSize: opt.isFiat ? 16 : 22, fontWeight: opt.isFiat ? '800' : '700' }}>{glyph}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                          {opt.currency}
                          {opt.balance > 0 && ` · ${tr('sell.balanceShort').replace('{balance}', `${currSym(opt.currency, locale)}${fmt(opt.balance, 2)}`)}`}
                        </Text>
                      </View>
                      {selected && <Ionicons name="checkmark-circle" size={22} color={iconColor} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </BottomSheet>
    </View>
  );
}

export default SellWidget;
