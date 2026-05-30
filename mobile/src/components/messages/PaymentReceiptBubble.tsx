/**
 * PaymentReceiptBubble — Revolut-style transfer card with a gradual
 * checkmark animation.
 *
 * Animation timeline (driven by a single `Animated.Value` 0 → 1):
 *   0.00 – 0.55  → ring stroke "draws" around the icon (stroke-dashoffset trick)
 *   0.55 – 0.70  → ring fill / icon backdrop pops from grey → green
 *   0.55 – 0.95  → checkmark path draws on top
 *   0.95 – 1.00  → soft scale-up settle (bounce)
 *
 * The animation auto-runs on first mount and replays whenever the
 * `status` transitions to "COMPLETED". For PENDING / FAILED states we
 * render a static state with the appropriate colour + glyph.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { useThemedPalette, type Palette } from '@/store/themeStore';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCurrencyMeta } from '@/constants';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ReceiptStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

const SIZE = 64;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
// Approx length of the 24-viewBox check path "M5 13 l4 4 l10 -10".
const CHECK_LENGTH = 28;

const GREEN     = '#10b981';
const GREEN_BG  = 'rgba(16,185,129,0.16)';
const AMBER     = '#f59e0b';
const RED       = '#ef4444';

export interface PaymentReceiptProps {
  amount: number;
  currency: string;
  status?: ReceiptStatus;
  /** Optional human-friendly note shown under the amount. */
  note?: string;
  /** Optional reference to display under the amount. */
  txRef?: string;
  /** ISO timestamp; rendered as "3:42 PM". */
  at: string;
  /** True when the bubble is on the right (sent by me). Tints accents. */
  fromMe?: boolean;
  /** When false, jump to the end-state without animating (used for old bubbles). */
  animate?: boolean;
}

export function PaymentReceiptBubble(props: PaymentReceiptProps) {
  const p = useThemedPalette();
  const status: ReceiptStatus = props.status ?? 'COMPLETED';

  // Master 0 → 1 driver. We only animate when the status is COMPLETED;
  // pending / failed snap to their static states.
  const t = useRef(new Animated.Value(props.animate === false || status !== 'COMPLETED' ? 1 : 0)).current;

  useEffect(() => {
    if (props.animate === false) { t.setValue(1); return; }
    if (status !== 'COMPLETED')   { t.setValue(1); return; }
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 1100,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [status, props.animate, t]);

  // Native-driver-friendly transforms only (no stroke-dashoffset).
  const ringScale  = t.interpolate({ inputRange: [0, 0.55, 0.85, 1], outputRange: [0.6, 1, 1.06, 1] });
  const ringRotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '270deg'] });
  const ringOpacity = t.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] });
  const checkOpacity = t.interpolate({ inputRange: [0, 0.55, 0.6, 1], outputRange: [0, 0, 1, 1] });
  const checkScale   = t.interpolate({ inputRange: [0, 0.55, 0.85, 1], outputRange: [0.4, 0.4, 1.15, 1] });

  // Color shift: grey ring → green ring as we cross the 0.55 mark.
  const ringStrokeOpacity = t.interpolate({ inputRange: [0, 0.55, 0.7, 1], outputRange: [0.3, 0.3, 1, 1] });
  const fillOpacity       = t.interpolate({ inputRange: [0, 0.5, 0.7, 1], outputRange: [0, 0, 1, 1] });

  const accent =
    status === 'COMPLETED' ? GREEN
    : status === 'PENDING' ? AMBER
    : RED;

  const time = useMemo(() => new Date(props.at).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  }), [props.at]);

  return (
    <View style={{
      borderRadius: 18,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      padding: 14,
      gap: 12,
      minWidth: 220,
      shadowColor: '#000',
      shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    }}>
      {/* Icon + headline */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {/* Soft fill backdrop */}
          <Animated.View
            style={{
              position: 'absolute',
              width: SIZE - 6, height: SIZE - 6, borderRadius: (SIZE - 6) / 2,
              backgroundColor: status === 'COMPLETED' ? GREEN_BG : 'transparent',
              opacity: fillOpacity,
            }}
          />

          {/* The animated ring + check */}
          {status === 'PENDING' ? (
            <Ionicons name="time" size={32} color={accent} />
          ) : status === 'FAILED' ? (
            <Ionicons name="close-circle" size={36} color={accent} />
          ) : (
            <Animated.View
              style={{
                width: SIZE, height: SIZE,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }, { rotate: ringRotate }],
              }}
            >
              <Svg width={SIZE} height={SIZE}>
                <AnimatedCircle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={accent}
                  strokeWidth={STROKE}
                  strokeOpacity={ringStrokeOpacity}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
              {/* Counter-rotate so the asset mark doesn't spin with
                  the ring.  Replaces the generic green checkmark with
                  the actual currency icon (BTC, ETH, USDT, USD…) so
                  the receipt makes the asset obvious at a glance.
                  Crypto symbols render via the CoinIcon SVG set;
                  everything else (fiat) falls back to the meta
                  flag/glyph so $/€/£ still read clearly. */}
              <Animated.View
                style={{
                  position: 'absolute',
                  width: SIZE, height: SIZE,
                  alignItems: 'center', justifyContent: 'center',
                  transform: [{ rotate: '90deg' }, { scale: checkScale }],
                  opacity: checkOpacity,
                }}
              >
                <CurrencyMark currency={props.currency} size={34} fallbackColor={accent} />
              </Animated.View>
            </Animated.View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
            {props.fromMe ? 'YOU SENT' : 'YOU RECEIVED'}
          </Text>
          <Text style={{
            color: p.fg, fontSize: 22, fontWeight: '600', marginTop: 1,
            letterSpacing: -0.3, fontVariant: ['tabular-nums'],
          }}>
            {formatAmount(props.amount)}{' '}
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700', letterSpacing: 0 }}>
              {props.currency}
            </Text>
          </Text>
        </View>
      </View>

      {/* Note */}
      {!!props.note && (
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '500', lineHeight: 18 }}>
          {props.note}
        </Text>
      )}

      {/* Footer: status + ref + timestamp */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 8, borderTopWidth: 1, borderTopColor: p.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: accent,
          }} />
          {!!props.txRef && (
            <Text style={{ color: p.fgFaint, fontSize: 8, fontWeight: '600', marginLeft: 2 }}>
              {props.txRef}
            </Text>
          )}
        </View>
        <Text style={{ color: p.fgFaint, fontSize: 8, fontWeight: '600' }}>
          {time}
        </Text>
      </View>
    </View>
  );
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(n);
}

/** Render the asset's brand icon for a PAYMENT receipt.  Crypto goes
 *  through CoinIcon (vector SVG set); fiat falls back to the meta
 *  glyph (`$`, `€`, `د.إ`…) tinted to the accent colour so the
 *  receipt always shows *what* was moved. */
function CurrencyMark({
  currency, size, fallbackColor,
}: {
  currency: string;
  size: number;
  fallbackColor: string;
}) {
  // Normalise chain variants so the badge always reads as the base
  // asset (USDT_TRC20 → USDT, ETH_ERC20 → ETH).
  const base = currency.indexOf('_') >= 0 ? currency.slice(0, currency.indexOf('_')) : currency;
  const meta = getCurrencyMeta(base);
  if (meta?.kind === 'crypto') {
    return <CoinIcon symbol={base} size={size} />;
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{
        color: fallbackColor, fontSize: size * 0.7, fontWeight: '700',
        lineHeight: size,
      }}>
        {meta?.flagOrIcon ?? base.slice(0, 2)}
      </Text>
    </View>
  );
}
