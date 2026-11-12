/**
 * Money in a chat: the payment receipt and the money request card.
 *
 * PaymentReceiptBubble — a sent payment wears the brand colour like my own
 * text bubbles; a received one is the light card. On a fresh payment a ring
 * draws around the currency mark and settles (driven by one Animated value,
 * native transforms only); older receipts render in their end state.
 *
 * MoneyRequestCard — an ask for money. The person asked can pay it in one
 * tap (amount and currency fixed) or decline; the person who asked sees it
 * waiting and can cancel. Paid, declined and cancelled are shown plainly.
 */
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta } from '@/constants';

type ReceiptStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type RequestStatus = 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED';

const SIZE = 50;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';

export interface PaymentReceiptProps {
  amount: number;
  currency: string;
  status?: ReceiptStatus;
  /** Optional human-friendly note shown under the amount. */
  note?: string;
  /** Optional reference shown in the footer. */
  txRef?: string;
  /** ISO timestamp; rendered as "3:42 PM". */
  at: string;
  /** Sent by me: the card takes the brand colour. */
  fromMe?: boolean;
  labelOverride?: string;
  /** When false, jump to the end state without animating (old bubbles). */
  animate?: boolean;
}

const formatAmount = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.min(getCurrencyMeta(currency)?.decimals ?? 2, 8) }).format(n);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function PaymentReceiptBubble(props: PaymentReceiptProps) {
  const p = useThemedPalette();
  const tl = useT();
  const status: ReceiptStatus = props.status ?? 'COMPLETED';
  const mine = !!props.fromMe;
  const fg = mine ? p.accentFg : p.fg;
  const muted = mine ? 'rgba(255,255,255,0.72)' : p.fgMuted;
  const faint = mine ? 'rgba(255,255,255,0.55)' : p.fgFaint;

  const t = useRef(new Animated.Value(props.animate === false || status !== 'COMPLETED' ? 1 : 0)).current;
  useEffect(() => {
    if (props.animate === false || status !== 'COMPLETED') { t.setValue(1); return; }
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 1000, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, [status, props.animate, t]);

  const ringScale = t.interpolate({ inputRange: [0, 0.55, 0.85, 1], outputRange: [0.6, 1, 1.06, 1] });
  const ringRotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '270deg'] });
  const ringOpacity = t.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] });
  const markOpacity = t.interpolate({ inputRange: [0, 0.5, 0.6, 1], outputRange: [0, 0, 1, 1] });
  const markScale = t.interpolate({ inputRange: [0, 0.55, 0.85, 1], outputRange: [0.4, 0.4, 1.12, 1] });

  const accent = status === 'COMPLETED' ? GREEN : status === 'PENDING' ? AMBER : RED;
  const statusText = status === 'COMPLETED' ? tl('receipt.completed') : status === 'PENDING' ? tl('receipt.pending') : tl('receipt.failed');
  const time = useMemo(() => timeOf(props.at), [props.at]);

  return (
    <View style={{
      width: 256, borderRadius: 22, padding: 16, gap: 12,
      backgroundColor: mine ? p.accent : p.bgElev,
      borderWidth: mine ? 0 : 1, borderColor: p.border,
      shadowColor: '#000', shadowOpacity: mine ? 0.16 : 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: SIZE - 8, height: SIZE - 8, borderRadius: (SIZE - 8) / 2, backgroundColor: mine ? 'rgba(255,255,255,0.14)' : p.pillBg }} />
          {status === 'COMPLETED' ? (
            <Animated.View style={{ width: SIZE, height: SIZE, opacity: ringOpacity, transform: [{ scale: ringScale }, { rotate: ringRotate }] }}>
              <Svg width={SIZE} height={SIZE}>
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={accent} strokeWidth={STROKE} fill="none" />
              </Svg>
              {/* Counter-rotated so the mark stays upright while the ring spins. */}
              <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center', opacity: markOpacity, transform: [{ rotate: '90deg' }, { scale: markScale }] }}>
                <CurrencyMark currency={props.currency} size={24} fallbackColor={fg} />
              </Animated.View>
            </Animated.View>
          ) : (
            <Ionicons name={status === 'PENDING' ? 'time' : 'close-circle'} size={26} color={accent} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: muted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 }} numberOfLines={1}>
            {props.labelOverride ?? (mine ? tl('chat.youSent') : tl('chat.youReceived'))}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
            style={{ color: fg, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: 1, fontVariant: ['tabular-nums'] }}>
            {formatAmount(props.amount, props.currency)}
            <Text style={{ color: muted, fontSize: 15, fontWeight: '700', letterSpacing: 0 }}> {props.currency}</Text>
          </Text>
        </View>
      </View>

      {!!props.note && (
        <Text style={{ color: fg, fontSize: 14, fontWeight: '500', lineHeight: 19 }}>{props.note}</Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: mine ? 'rgba(255,255,255,0.14)' : p.border }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} />
        <Text style={{ color: muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{statusText}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: faint, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
          {props.txRef ? `${props.txRef} · ${time}` : time}
        </Text>
      </View>
    </View>
  );
}

export function MoneyRequestCard({ amount, currency, note, at, status, mine, busy, onPay, onDecline, onCancel }: {
  amount: number; currency: string; note?: string; at: string; status: RequestStatus;
  /** I asked for this money. */
  mine: boolean;
  busy?: boolean;
  onPay?: () => void; onDecline?: () => void; onCancel?: () => void;
}) {
  const p = useThemedPalette();
  const t = useT();
  const open = status === 'PENDING';
  const amountText = `${formatAmount(amount, currency)} ${currency}`;

  const closed = status === 'PAID'
    ? { icon: 'checkmark-circle' as const, color: GREEN, label: t('chat.requestPaid') }
    : status === 'DECLINED'
      ? { icon: 'close-circle' as const, color: RED, label: t('chat.requestDeclined') }
      : { icon: 'remove-circle' as const, color: p.fgMuted, label: t('chat.requestCancelled') };

  return (
    <View style={{
      width: 264, borderRadius: 22, overflow: 'hidden',
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: open ? p.accent : p.border,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    }}>
      <View style={{ padding: 16, gap: 10, opacity: open || status === 'PAID' ? 1 : 0.75 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <CurrencyMark currency={currency} size={20} fallbackColor={p.accentText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, color: p.fgMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 }} numberOfLines={1}>
                {mine ? t('chat.youRequested') : t('chat.requestedFromYou')}
              </Text>
              {open ? <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>{timeOf(at)}</Text> : null}
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
              style={{ color: p.fg, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'], textDecorationLine: status === 'CANCELLED' || status === 'DECLINED' ? 'line-through' : 'none' }}>
              {formatAmount(amount, currency)}
              <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '700' }}> {currency}</Text>
            </Text>
          </View>
        </View>
        {!!note && <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', lineHeight: 19 }}>{note}</Text>}
      </View>

      {open && !mine ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
          <Pressable onPress={onDecline} disabled={busy} accessibilityRole="button"
            style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.border, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('chat.decline')}</Text>
          </Pressable>
          <Pressable onPress={onPay} disabled={busy} accessibilityRole="button" accessibilityLabel={t('chat.payAmount', { amount: amountText })}
            style={({ pressed }) => ({ flex: 1.4, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: p.accent, opacity: pressed ? 0.88 : 1 })}>
            {busy ? <ActivityIndicator color={p.accentFg} /> : (
              <>
                <Ionicons name="arrow-up" size={15} color={p.accentFg} />
                <Text style={{ color: p.accentFg, fontSize: 14, fontWeight: '800' }}>{t('chat.pay')}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: p.border }}>
          {open ? (
            <>
              <Ionicons name="hourglass-outline" size={14} color={AMBER} />
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>{t('chat.waitingForPayment')}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={onCancel} disabled={busy} hitSlop={8} accessibilityRole="button">
                {busy ? <ActivityIndicator size="small" color={p.fgMuted} /> : <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '700' }}>{t('chat.cancelRequest')}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Ionicons name={closed.icon} size={15} color={closed.color} />
              <Text style={{ color: closed.color, fontSize: 12, fontWeight: '800' }}>{closed.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>{timeOf(at)}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** The asset's mark: vector coin icons for crypto, the glyph ($, €, LD…) for fiat. */
export function CurrencyMark({ currency, size, fallbackColor }: { currency: string; size: number; fallbackColor: string }) {
  const base = currency.indexOf('_') >= 0 ? currency.slice(0, currency.indexOf('_')) : currency;
  const meta = getCurrencyMeta(base);
  if (meta?.kind === 'crypto') return <CoinIcon symbol={base} size={size} />;
  const glyph = meta?.flagOrIcon ?? base.slice(0, 2);
  return (
    <View style={{ width: size * 1.4, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: fallbackColor, fontSize: glyph.length > 2 ? size * 0.5 : size * 0.72, fontWeight: '800', lineHeight: size }}>
        {glyph}
      </Text>
    </View>
  );
}
