/**
 * Transaction history — MoonPay-flavoured card list.
 *
 * Each row shows:
 *   - Type-coloured icon
 *   - Description (or pretty type)
 *   - ISO date+time to the second (e.g. "Apr 26, 2026, 14:23:07")
 *   - Tx hash / reference (monospace, truncated, tap-to-copy)
 *   - Signed amount + currency
 *   - Status pill (PENDING / COMPLETED / FAILED)
 */

import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useTransactions, useHaptics } from '@/hooks';

type Tx = {
  id: string;
  type: string;
  amount: string | number;
  currency: string;
  fee?: string | number;
  description?: string | null;
  reference?: string | null;
  txHash?: string | null;
  status?: string;
  createdAt: string | Date;
};

export default function History() {
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const { data, isLoading, refetch, isFetching } = useTransactions(1);
  const items = (data?.items ?? []) as Tx[];

  // Group by ISO date so the user gets MoonPay-style date headers.
  const groups = useMemo(() => {
    const out: Record<string, Tx[]> = {};
    items.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      (out[key] ??= []).push(t);
    });
    return out;
  }, [items]);

  return (
    <ScreenShell title={t('history.title')} subtitle={t('history.subtitle')}>
      {/* Refresh pill */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
        <Pressable
          onPress={() => { h.light(); refetch(); }}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          })}
        >
          <Ionicons name={isFetching ? 'sync' : 'refresh'} size={12} color={p.fgMuted} />
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
            {isFetching ? t('common.refreshing').toUpperCase() : t('common.refresh').toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Text style={{ color: p.fgMuted }}>{t('history.loading')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14 }}>
            {t('history.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
          {Object.entries(groups).map(([day, txs]) => (
            <View key={day} style={{ marginTop: 12 }}>
              <Text style={{
                color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
                marginLeft: 4, marginBottom: 8,
              }}>
                {day.toUpperCase()}
              </Text>
              <Panel>
                {txs.map((tx, i) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    palette={p}
                    last={i === txs.length - 1}
                    onCopyHash={(hash) => {
                      h.success();
                      Clipboard.setStringAsync(hash);
                      Alert.alert(t('history.hashCopied'), hash);
                    }}
                  />
                ))}
              </Panel>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ScreenShell>
  );
}

function TxRow({
  tx, palette: p, last, onCopyHash,
}: {
  tx: Tx;
  palette: Palette;
  last: boolean;
  onCopyHash: (hash: string) => void;
}) {
  const amt = Number(tx.amount);
  const negative = amt < 0;
  const abs = Math.abs(amt);
  const date = new Date(tx.createdAt);
  // ISO-ish to-the-second timestamp (locale aware).
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

  return (
    <View style={{
      padding: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
      gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 40, height: 40, borderRadius: 12,
          backgroundColor: typeBg(tx.type, p),
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={typeIcon(tx.type)} size={18} color={typeFg(tx.type, p)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {tx.description || prettyType(tx.type)}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 2 }}>
            {exact}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            color: negative ? p.fg : p.greenFg,
            fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'],
          }}>
            {negative ? '-' : '+'}{abs.toLocaleString('en-US', { maximumFractionDigits: 8 })} {tx.currency}
          </Text>
          <StatusPill status={status} palette={p} />
        </View>
      </View>

      {hash && (
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
}

function StatusPill({ status, palette: p }: { status: string; palette: Palette }) {
  const ok = status === 'COMPLETED' || status === 'FILLED' || status === 'CONFIRMED';
  const bad = status === 'FAILED' || status === 'CANCELLED' || status === 'DECLINED';
  const bg = ok ? p.greenBg : bad ? 'rgba(239,68,68,0.16)' : p.pillBg;
  const fg = ok ? p.greenFg : bad ? p.redFg : p.fgMuted;
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
      backgroundColor: bg, marginTop: 2,
    }}>
      <Text style={{ color: fg, fontSize: 9, fontWeight: '600', letterSpacing: 0.4 }}>
        {status}
      </Text>
    </View>
  );
}

function typeIcon(t: string): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap {
  switch (t) {
    case 'SEND':
    case 'TRANSFER_OUT': return 'arrow-up';
    case 'RECEIVE':
    case 'TRANSFER_IN':  return 'arrow-down';
    case 'BUY':          return 'cart';
    case 'SELL':         return 'cash';
    case 'DEPOSIT':      return 'add-circle';
    case 'WITHDRAW':     return 'remove-circle';
    case 'CONVERT':
    case 'SWAP':         return 'swap-horizontal';
    default:             return 'ellipse';
  }
}

function typeBg(t: string, p: Palette) {
  switch (t) {
    case 'BUY':
    case 'RECEIVE':
    case 'TRANSFER_IN':
    case 'DEPOSIT':  return p.greenBg;
    case 'SELL':
    case 'WITHDRAW':
    case 'SEND':
    case 'TRANSFER_OUT': return 'rgba(239,68,68,0.16)';
    default:         return p.pillBg;
  }
}

function typeFg(t: string, p: Palette) {
  switch (t) {
    case 'BUY':
    case 'RECEIVE':
    case 'TRANSFER_IN':
    case 'DEPOSIT':  return p.greenFg;
    case 'SELL':
    case 'WITHDRAW':
    case 'SEND':
    case 'TRANSFER_OUT': return p.redFg;
    default:         return p.fg;
  }
}

function prettyType(t: string): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}
