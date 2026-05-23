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

const ICON_FOR: Record<TxType, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  RECEIVE:    { name: 'arrow-down',     color: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  SEND:       { name: 'arrow-up',       color: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
  BUY:        { name: 'add',            color: '#226dff', bg: 'rgba(34,109,255,0.18)' },
  SELL:       { name: 'remove',         color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
  DEPOSIT:    { name: 'arrow-down',     color: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  WITHDRAWAL: { name: 'arrow-up',       color: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
  TOPUP:      { name: 'card',           color: '#226dff', bg: 'rgba(34,109,255,0.18)' },
  P2P_BUY:    { name: 'people',         color: '#226dff', bg: 'rgba(34,109,255,0.18)' },
  P2P_SELL:   { name: 'people',         color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
  CARD_SPEND: { name: 'card',           color: '#ef4444', bg: 'rgba(239,68,68,0.16)' },
  CASHBACK:   { name: 'gift',           color: '#22c55e', bg: 'rgba(34,197,94,0.16)' },
  FEE:        { name: 'receipt',        color: '#94a3b8', bg: 'rgba(148,163,184,0.16)' },
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
