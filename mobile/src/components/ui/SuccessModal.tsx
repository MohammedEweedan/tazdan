import { memo, useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';

import { BottomSheet } from '@/components/ui/BottomSheet';
const { height: H } = Dimensions.get('window');

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

  useEffect(() => {
    if (!data) {
      slideY.setValue(H);
      backdropA.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(slideY,   { toValue: 0, tension: 62, friction: 11, useNativeDriver: true }),
      Animated.timing(backdropA, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
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
    <BottomSheet visible={!!data} onClose={onClose}>
          {/* Minimal check + title — no heavy ringed badge */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Ionicons name="checkmark-circle" size={44} color={p.greenFg} style={{ marginBottom: 14 }} />
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, marginBottom: 8 }}>
              {isBuy ? 'PURCHASE COMPLETE' : 'SALE COMPLETE'}
            </Text>
            {/* Big amount figure — same treatment as the trade widgets */}
            <Text style={{ color: p.fg, fontSize: 38, fontWeight: '600', letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit>
              {data.cryptoAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
              <Text style={{ color: p.fgMuted, fontSize: 22, fontWeight: '600' }}> {data.asset}</Text>
            </Text>
          </View>

          {/* Transaction details — borderless, divider-only rows */}
          <View style={{ marginBottom: 22 }}>
            {rows.map(({ label, value, green }, idx) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  paddingVertical: 11,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: p.border,
                }}
              >
                <Text style={{ color: p.fgFaint, fontSize: 12.5, fontWeight: '500' }}>{label}</Text>
                <Text
                  style={{ color: green ? p.greenFg : p.fg, fontSize: 12.5, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 16 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>

          {/* White pill CTA — matches the widgets' confirm button */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: p.ctaBg,
              borderRadius: 28, paddingVertical: 17,
              alignItems: 'center', opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </BottomSheet>
  );
});
