import { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';

const { width: W, height: H } = Dimensions.get('window');

const EMOJIS = ['🎉', '✨', '🎊', '⭐', '💫', '🌟', '💎', '🚀', '🎁', '🔥', '🏆', '🌈'];
const N = 18;

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: '﷼' };
function sym(c: string) { return CURRENCY_SYMBOLS[c] ?? (c + ' '); }
function fmtRate(n: number) {
  if (n >= 10000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1000)  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1)     return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toFixed(8);
}

export interface TxSuccessData {
  type: 'buy' | 'sell';
  asset: string;
  cryptoAmount: number;
  settledCurrency: string;
  txRef: string;
  rate: number;
  creditedWallet: string;
  debitedWallet: string;
  timestamp: Date;
}

export const SuccessModal = memo(function SuccessModal({
  data,
  onClose,
}: {
  data: TxSuccessData | null;
  onClose: () => void;
}) {
  const p = useThemedPalette();

  // Stable animated values — reset & re-fired on each new `data`
  const slideY = useRef(new Animated.Value(H)).current;
  const backdropA = useRef(new Animated.Value(0)).current;

  const particles = useRef(
    Array.from({ length: N }, (_, i) => ({
      y:       new Animated.Value(-80),
      opacity: new Animated.Value(0),
      x: (i / N) * W + (i % 2 === 0 ? 12 : -12),
      emoji: EMOJIS[i % EMOJIS.length],
      size:  16 + (i % 5) * 5,
      delay: i * 75 + Math.floor(i * 40),
      dur:   1800 + (i % 4) * 400,
    }))
  ).current;

  useEffect(() => {
    if (!data) {
      slideY.setValue(H);
      backdropA.setValue(0);
      return;
    }

    particles.forEach((pt) => { pt.y.setValue(-80); pt.opacity.setValue(0); });

    Animated.parallel([
      Animated.spring(slideY,   { toValue: 0, tension: 62, friction: 11, useNativeDriver: true }),
      Animated.timing(backdropA, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    particles.forEach((pt) => {
      Animated.sequence([
        Animated.delay(pt.delay),
        Animated.parallel([
          Animated.timing(pt.y, { toValue: H + 100, duration: pt.dur, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(pt.opacity, { toValue: 0.92, duration: 140, useNativeDriver: true }),
            Animated.delay(pt.dur - 290),
            Animated.timing(pt.opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]),
        ]),
      ]).start();
    });
  }, [data?.txRef]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;

  const ts   = data.timestamp;
  const time = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const isBuy = data.type === 'buy';

  const rows = [
    { label: 'Ref',       value: data.txRef },
    { label: 'Date',      value: date },
    { label: 'Time',      value: time },
    { label: 'Rate',      value: `1 ${data.asset} = ${sym(data.settledCurrency)}${fmtRate(data.rate)}` },
    { label: 'Credited',  value: data.creditedWallet, green: true },
    { label: 'Debited',   value: data.debitedWallet },
  ];

  return (
    <Modal visible={!!data} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Confetti layer */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
        {particles.map((pt, i) => (
          <Animated.Text
            key={i}
            style={{
              position: 'absolute',
              left: pt.x,
              top: 0,
              fontSize: pt.size,
              transform: [{ translateY: pt.y }],
              opacity: pt.opacity,
            }}
          >
            {pt.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropA }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.62)' }]}
          onPress={onClose}
        />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5, transform: [{ translateY: slideY }] }}
      >
        <Pressable
          style={{ backgroundColor: p.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingBottom: 48, paddingHorizontal: 24 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          {/* Check icon + title */}
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <View style={{
              width: 76, height: 76, borderRadius: 38,
              backgroundColor: p.greenBg,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1.5,
              borderColor: p.greenFg + '44',
            }}>
              <Ionicons name="checkmark" size={40} color={p.greenFg} />
            </View>
            <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 }}>
              {isBuy ? 'Purchase Complete' : 'Sale Complete'}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
              {isBuy
                ? `${data.cryptoAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${data.asset} added to your wallet`
                : `${data.cryptoAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${data.asset} sold`}
            </Text>
          </View>

          {/* Transaction details */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 20, borderWidth: 1, borderColor: p.border, overflow: 'hidden', marginBottom: 20 }}>
            {rows.map(({ label, value, green }, idx) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingHorizontal: 16, paddingVertical: 13,
                  borderBottomWidth: idx < rows.length - 1 ? 1 : 0,
                  borderBottomColor: p.border,
                }}
              >
                <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>{label}</Text>
                <Text
                  style={{ color: green ? p.greenFg : p.fg, fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 16 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: p.greenBg,
              borderRadius: 22, paddingVertical: 16,
              alignItems: 'center', opacity: pressed ? 0.8 : 1,
              borderWidth: 1, borderColor: p.greenFg + '55',
            })}
          >
            <Text style={{ color: p.greenFg, fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
});
