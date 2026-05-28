/**
 * Shared transaction row used by `/history` and the per-asset history
 * panel on `/asset/[currency]`.
 *
 * Source-of-truth contract: a row always displays its amount in
 * `tx.currency`. Never substitute another symbol from outside — that's
 * how the "500,000 USD spent → 500,000 BTC shown" bug happened.
 *
 * The data model serialises a trade as TWO rows (one in the spent
 * currency, one in the received currency), so the right way to filter
 * for a particular asset is `tx.currency === sym` (normalised). Each
 * row is then a single, complete fact about a movement in one
 * currency.
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import type { Palette } from '@/store/themeStore';

/* ── Tx → icon mapping ──────────────────────────────────────────────
   Same neutral/in/out palette as the home feed: green for incoming,
   red for outgoing, neutral for trades (BUY/SELL — direction is
   already encoded in the per-currency split). */

export function typeIcon(t: string): keyof typeof Ionicons.glyphMap {
  switch (t) {
    case 'BUY':       return 'add';
    case 'SELL':      return 'remove';
    case 'SEND':
    case 'TRANSFER_OUT':
    case 'WITHDRAWAL':
    case 'CARD_SPEND':
      return 'arrow-up';
    case 'RECEIVE':
    case 'TRANSFER_IN':
    case 'DEPOSIT':
    case 'CASHBACK':
      return 'arrow-down';
    case 'TOPUP':     return 'card';
    case 'P2P_BUY':
    case 'P2P_SELL':  return 'people';
    case 'FEE':       return 'receipt';
    default:          return 'swap-horizontal';
  }
}

export function typeBg(t: string, p: Palette): string {
  // Incoming / outgoing get color cues; trades stay neutral so the
  // user reads direction from the sign on the amount.
  if (t === 'RECEIVE' || t === 'TRANSFER_IN' || t === 'DEPOSIT' || t === 'CASHBACK') return p.greenBg;
  if (t === 'SEND' || t === 'TRANSFER_OUT' || t === 'WITHDRAWAL' || t === 'CARD_SPEND') return p.redBg;
  return p.pillBg;
}

export function typeFg(t: string, p: Palette): string {
  if (t === 'RECEIVE' || t === 'TRANSFER_IN' || t === 'DEPOSIT' || t === 'CASHBACK') return p.greenFg;
  if (t === 'SEND' || t === 'TRANSFER_OUT' || t === 'WITHDRAWAL' || t === 'CARD_SPEND') return p.redFg;
  return p.fg;
}

export function prettyType(t: string): string {
  return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalise a currency code so BTC_ERC20 / BTCUSDT / btc all
 *  collapse to BTC for filter comparisons. Network suffixes and
 *  trailing quote-asset pair suffixes are stripped. */
export function normaliseCurrency(c: string | null | undefined): string {
  if (!c) return '';
  const upper = c.toUpperCase();
  // Strip "_<network>" first (BTC_ERC20 → BTC)
  const noNet = upper.replace(/_.*$/, '');
  // Then strip trailing pair suffix (BTCUSDT → BTC) but leave USDT/USDC alone
  if (noNet === 'USDT' || noNet === 'USDC' || noNet === 'BUSD') return noNet;
  return noNet.replace(/(USDT|USDC|BUSD)$/, '');
}

/** Strict per-asset filter. The amount is always in `tx.currency`, so
 *  matching that field (after normalisation) gives us only rows that
 *  belong to the asset we're viewing. */
export function txBelongsToAsset(tx: { currency?: string | null; asset?: string | null }, sym: string): boolean {
  const target = normaliseCurrency(sym);
  if (!target) return false;
  // We intentionally do NOT fall back to description/title matching —
  // that's exactly how the cross-currency bug got in. The structured
  // currency field is the only trustworthy source.
  return normaliseCurrency(tx.currency) === target
      || normaliseCurrency(tx.asset)    === target;
}

/* ── Status pill ───────────────────────────────────────────────────── */

function StatusPill({ status, palette: p }: { status: string; palette: Palette }) {
  const ok  = status === 'COMPLETED' || status === 'FILLED' || status === 'CONFIRMED';
  const bad = status === 'FAILED' || status === 'CANCELLED' || status === 'DECLINED';
  const bg  = ok ? p.greenBg : bad ? 'rgba(239,68,68,0.16)' : p.pillBg;
  const fg  = ok ? p.greenFg : bad ? p.redFg : p.fgMuted;
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
      backgroundColor: bg, marginTop: 2,
    }}>
      <Text style={{ color: fg, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
        {status}
      </Text>
    </View>
  );
}

/* ── Public types + component ─────────────────────────────────────── */

export interface AssetTx {
  id: string;
  type: string;
  amount: string | number;
  currency: string;
  description?: string | null;
  reference?: string | null;
  txHash?: string | null;
  status?: string;
  createdAt: string | Date;
}

interface Props {
  tx: AssetTx;
  palette: Palette;
  last?: boolean;
  /** Optional copy-on-tap handler for the hash row. Omit to hide the hash row. */
  onCopyHash?: (hash: string) => void;
  /** Tap on the whole row — opens a receipt screen, etc. */
  onPress?: () => void;
}

/**
 * Single row. Renders amount in `tx.currency` always. The header /
 * relative-time row matches the visual language used by the home feed.
 */
export function AssetTxRow({ tx, palette: p, last, onCopyHash, onPress }: Props) {
  const amt = Number(tx.amount);
  const negative = amt < 0;
  const abs = Math.abs(amt);
  const date = new Date(tx.createdAt);

  const exact = date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const status = (tx.status ?? 'COMPLETED').toUpperCase();
  const hash = tx.txHash ?? tx.reference ?? null;
  const truncated = hash && hash.length > 14
    ? `${hash.slice(0, 6)}…${hash.slice(-4)}`
    : hash;

  // Crypto values can be tiny (0.00000123 ETH) so we allow up to 8
  // fractional digits; fiat-side rows still render cleanly because
  // Number.toLocaleString trims trailing zeros above the minimum.
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  });

  const Row = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: typeBg(tx.type, p),
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={typeIcon(tx.type)} size={18} color={typeFg(tx.type, p)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {tx.description || prettyType(tx.type)}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }}>
          {exact}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            color: negative ? p.fg : p.greenFg,
            fontSize: 14, fontWeight: '700',
            fontVariant: ['tabular-nums'],
          }}
        >
          {negative ? '−' : '+'}{formatted} {tx.currency}
        </Text>
        {status !== 'COMPLETED' && <StatusPill status={status} palette={p} />}
      </View>
    </View>
  );

  const Body = (
    <View style={{
      padding: 14,
      borderBottomWidth: last ? 0 : 1,
      borderBottomColor: p.border,
      gap: hash && onCopyHash ? 10 : 0,
    }}>
      {Row}
      {hash && onCopyHash && (
        <Pressable
          hitSlop={4}
          onPress={() => onCopyHash(hash)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6,
            alignSelf: 'flex-start',
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
          })}
        >
          <Ionicons name="link-outline" size={11} color={p.fgMuted} />
          <Text
            style={{
              color: p.fgMuted, fontSize: 11, fontWeight: '600',
              fontFamily: 'Menlo' as any,
            }}
            numberOfLines={1}
          >
            {truncated}
          </Text>
          <Ionicons name="copy-outline" size={11} color={p.fgMuted} />
        </Pressable>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}
      >
        {Body}
      </Pressable>
    );
  }
  return Body;
}
