/**
 * Single transaction row used on the home dashboard and history screen.
 * Left: icon avatar based on tx type. Middle: counterparty + relative time.
 * Right: signed amount + status pill (only when not COMPLETED).
 */

import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { formatAmount, formatRelativeTime } from '@/utils/format';
import type { Transaction, TxType } from '@/types';

// Monochrome — direction signaled by red (out) / green (in) only.
// Type-specific colors (blue for BUY, amber for SELL) are replaced with
// a neutral gray so direction reads clearly without color noise.
const NEUTRAL    = '#A3A3A3';
const NEUTRAL_BG = 'rgba(163,163,163,0.16)';
const IN_FG      = '#3FCF8E';
const IN_BG      = 'rgba(63,207,142,0.14)';
const OUT_FG     = '#F87171';
const OUT_BG     = 'rgba(248,113,113,0.14)';

const ICON_FOR: Record<TxType, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  RECEIVE:    { name: 'arrow-down',     color: IN_FG,    bg: IN_BG },
  SEND:       { name: 'arrow-up',       color: OUT_FG,   bg: OUT_BG },
  BUY:        { name: 'add',            color: NEUTRAL,  bg: NEUTRAL_BG },
  SELL:       { name: 'remove',         color: NEUTRAL,  bg: NEUTRAL_BG },
  DEPOSIT:    { name: 'arrow-down',     color: IN_FG,    bg: IN_BG },
  WITHDRAWAL: { name: 'arrow-up',       color: OUT_FG,   bg: OUT_BG },
  TOPUP:      { name: 'card',           color: NEUTRAL,  bg: NEUTRAL_BG },
  P2P_BUY:    { name: 'people',         color: NEUTRAL,  bg: NEUTRAL_BG },
  P2P_SELL:   { name: 'people',         color: NEUTRAL,  bg: NEUTRAL_BG },
  CARD_SPEND: { name: 'card',           color: OUT_FG,   bg: OUT_BG },
  CASHBACK:   { name: 'gift',           color: IN_FG,    bg: IN_BG },
  FEE:        { name: 'receipt',        color: NEUTRAL,  bg: NEUTRAL_BG },
};

interface Props {
  tx: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ tx, onPress }: Props) {
  const ic = ICON_FOR[tx.type];
  const positive = tx.amount.startsWith('+') || (!tx.amount.startsWith('-') && Number(tx.amount) > 0);
  const title    = tx.counterpartyName || tx.counterpartyHandle || prettyType(tx.type);
  const subtitle = tx.note || tx.counterpartyHandle || formatRelativeTime(tx.createdAt);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: ic.bg, alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {tx.counterpartyAvatar ? (
          <Avatar name={title} uri={tx.counterpartyAvatar} size={40} />
        ) : (
          <Ionicons name={ic.name} size={18} color={ic.color} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text className="text-ink-primary text-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-ink-tertiary text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
        <Text
          className="text-sm font-bold"
          style={{ color: positive ? '#22c55e' : '#ef4444', fontVariant: ['tabular-nums'] }}
        >
          {formatAmount(tx.amount, tx.currency, { signed: true, showSymbol: true })}
        </Text>
        {tx.status !== 'COMPLETED' && (
          <View
            style={{
              marginTop: 4,
              paddingHorizontal: 8, paddingVertical: 2,
              borderRadius: 8,
              backgroundColor: tx.status === 'FAILED' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: tx.status === 'FAILED' ? '#ef4444' : '#f59e0b' }}>
              {tx.status}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function prettyType(t: TxType) {
  return t.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
