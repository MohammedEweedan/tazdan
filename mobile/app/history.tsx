/**
 * Transaction history — theme-aware list of recent activity.
 */

import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useTransactions, useHaptics } from '@/hooks';

export default function History() {
  const h = useHaptics();
  const p = useThemedPalette();
  const { data } = useTransactions(1);
  const items = data?.items ?? [];

  return (
    <ScreenShell title="Transaction history">
      {items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 64 }}>
          <Ionicons name="receipt-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14 }}>
            No transactions yet.
          </Text>
        </View>
      ) : (
        <Panel style={{ marginTop: 14 }}>
          {items.map((tx, i) => {
            const negative = ['SEND', 'WITHDRAW', 'BUY'].includes(tx.type);
            const sign = negative ? '-' : '+';
            const color = negative ? p.fg : p.greenFg;
            return (
              <Pressable
                key={tx.id}
                onPress={() => h.selection()}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center',
                  padding: 14, gap: 12,
                  backgroundColor: pressed ? p.border : 'transparent',
                  borderBottomWidth: i === items.length - 1 ? 0 : 1,
                  borderBottomColor: p.border,
                })}
              >
                <View style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: p.pillBg,
                  borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons
                    name={typeIcon(tx.type)}
                    size={16}
                    color={p.fg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                    {tx.counterpartyName ?? prettyType(tx.type)}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                    {new Date(tx.createdAt).toLocaleDateString()} · {tx.status}
                  </Text>
                </View>
                <Text style={{
                  color, fontSize: 14, fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                }}>
                  {sign}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {tx.currency}
                </Text>
              </Pressable>
            );
          })}
        </Panel>
      )}
    </ScreenShell>
  );
}

function typeIcon(t: string): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap {
  switch (t) {
    case 'SEND':     return 'arrow-up';
    case 'RECEIVE':  return 'arrow-down';
    case 'BUY':      return 'cart';
    case 'SELL':     return 'cash';
    case 'DEPOSIT':  return 'add-circle';
    case 'WITHDRAW': return 'remove-circle';
    case 'CONVERT':  return 'swap-horizontal';
    default:         return 'ellipse';
  }
}

function prettyType(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}
