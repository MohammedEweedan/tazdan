/**
 * P2P escrow / trade tracker — `/p2p/trades`.
 *
 * Lists every active and historical P2P trade for the signed-in user.
 * Auto-polls every 15s (set in the hook) so escrow status updates as
 * counterparties act on the trade.
 *
 *   PENDING       → awaiting buyer payment
 *   PAYMENT_SENT  → buyer marked paid, seller must confirm
 *   COMPLETED     → released
 *   CANCELLED     → expired or cancelled
 *   DISPUTED      → support intervention
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useMyP2PTrades } from '@/hooks';
import { p2pService } from '@/services';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import type { Palette } from '@/store/themeStore';
import type { P2PTrade } from '@/services';

type Filter = 'ACTIVE' | 'COMPLETED' | 'ALL';

const ACTIVE_STATUSES = new Set<P2PTrade['status']>(['PENDING', 'PAYMENT_SENT', 'DISPUTED']);

export default function P2PTrades() {
  const h = useHaptics();
  const p = useThemedPalette();
  const qc = useQueryClient();
  const { data: trades, isLoading, refetch } = useMyP2PTrades();
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const all = trades ?? [];
    if (filter === 'ALL')       return all;
    if (filter === 'COMPLETED') return all.filter((t) => t.status === 'COMPLETED');
    return all.filter((t) => ACTIVE_STATUSES.has(t.status));
  }, [trades, filter]);

  // Surface aggregate escrow exposure across active trades — equivalent to
  // "how much is currently locked in P2P for me".
  const lockedFiat = useMemo(() => {
    if (!trades) return 0;
    return trades
      .filter((t) => ACTIVE_STATUSES.has(t.status))
      .reduce((s, t) => s + Number(t.totalFiat || 0), 0);
  }, [trades]);

  const callAction = async (id: string, fn: () => Promise<unknown>, label: string) => {
    setBusyId(id);
    h.medium();
    try {
      await fn();
      h.success();
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
    } catch (e: any) {
      h.error();
      Alert.alert(`Failed to ${label}`, e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScreenShell title="P2P trades" subtitle="Escrow + history">
      {/* Escrow summary card */}
      <Panel style={{ marginTop: 12 }}>
        <View style={{ padding: 18 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            CURRENTLY IN ESCROW
          </Text>
          <Text style={{
            color: p.fg, fontSize: 32, fontWeight: '800',
            letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'],
          }}>
            ${lockedFiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 4 }}>
            Across {filtered.filter((t) => ACTIVE_STATUSES.has(t.status)).length} active trade(s)
          </Text>
        </View>
      </Panel>

      {/* Filter pills */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: p.pillBg,
        borderRadius: 12, padding: 4, gap: 4, marginTop: 14,
      }}>
        {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => { h.selection(); setFilter(f); }}
            style={{
              flex: 1, paddingVertical: 9, borderRadius: 9,
              backgroundColor: filter === f ? p.fg : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: filter === f ? p.bg : p.fgMuted,
              fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
            }}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={p.fg} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Ionicons name="lock-closed-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14, textAlign: 'center' }}>
            {filter === 'ACTIVE' ? 'No active trades.' : 'Nothing here yet.'}
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            Pull to refresh once you start one from the marketplace.
          </Text>
          <Pressable
            onPress={() => { h.selection(); refetch(); }}
            style={{
              marginTop: 14,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
            }}
          >
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Refresh</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginTop: 14, gap: 10 }}>
          {filtered.map((t) => (
            <TradeCard
              key={t.id}
              trade={t}
              palette={p}
              busy={busyId === t.id}
              onPaid={()    => callAction(t.id, () => p2pService.markPaymentSent(t.id), 'mark paid')}
              onConfirm={() => callAction(t.id, () => p2pService.confirmPayment(t.id),  'confirm')}
              onCancel={()  => callAction(t.id, () => p2pService.cancelTrade(t.id),    'cancel')}
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

function TradeCard({
  trade: t, palette: p, busy, onPaid, onConfirm, onCancel,
}: {
  trade: P2PTrade;
  palette: Palette;
  busy: boolean;
  onPaid: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const status = t.status;
  const isActive = ACTIVE_STATUSES.has(status);
  const cp = t.counterparty;
  const cpName = cp?.username
    ? `@${cp.username}`
    : `${cp?.firstName ?? ''} ${cp?.lastName ?? ''}`.trim() || 'Counterparty';

  return (
    <Panel>
      <View style={{ padding: 14 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <StatusPill status={status} palette={p} />
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', flex: 1 }}>
            {new Date(t.createdAt).toLocaleString()}
          </Text>
        </View>

        {/* Body */}
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: p.pillBg,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: p.border,
          }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>
              {(cp?.firstName?.[0] ?? cp?.username?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {cpName}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
              {Number(t.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} {t.listing?.currency ?? ''}
              {' · '}
              {Number(t.totalFiat).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.listing?.fiatCurrency ?? ''}
            </Text>
          </View>
        </View>

        {/* Actions */}
        {isActive && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {status === 'PENDING' && (
              <ActionBtn label="I&apos;ve paid"      icon="checkmark-circle" busy={busy} primary palette={p} onPress={onPaid} />
            )}
            {status === 'PAYMENT_SENT' && (
              <ActionBtn label="Confirm received" icon="shield-checkmark" busy={busy} primary palette={p} onPress={onConfirm} />
            )}
            <ActionBtn label="Cancel" icon="close-circle" busy={busy} palette={p} onPress={onCancel} />
          </View>
        )}
      </View>
    </Panel>
  );
}

function StatusPill({ status, palette: p }: { status: P2PTrade['status']; palette: Palette }) {
  const cfg: Record<P2PTrade['status'], { bg: string; fg: string; label: string }> = {
    PENDING:      { bg: p.pillBg,                   fg: p.fg,     label: 'PENDING' },
    PAYMENT_SENT: { bg: 'rgba(245,158,11,0.16)',    fg: '#f59e0b', label: 'PAID · AWAITING' },
    COMPLETED:    { bg: p.greenBg,                  fg: p.greenFg, label: 'COMPLETED' },
    CANCELLED:    { bg: p.pillBg,                   fg: p.fgMuted, label: 'CANCELLED' },
    DISPUTED:     { bg: 'rgba(239,68,68,0.16)',     fg: p.redFg,   label: 'DISPUTED' },
  };
  const c = cfg[status];
  return (
    <View style={{
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
      backgroundColor: c.bg,
    }}>
      <Text style={{ color: c.fg, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
        {c.label}
      </Text>
    </View>
  );
}

function ActionBtn({
  palette: p, label, icon, primary, busy, onPress,
}: {
  palette: Palette;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => ({
        flex: 1, height: 42, borderRadius: 21,
        backgroundColor: primary ? p.ctaBg : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: p.border,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        opacity: busy ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      {busy
        ? <ActivityIndicator size="small" color={primary ? p.ctaFg : p.fg} />
        : <Ionicons name={icon} size={14} color={primary ? p.ctaFg : p.fg} />}
      <Text style={{
        color: primary ? p.ctaFg : p.fg,
        fontSize: 12, fontWeight: '800', letterSpacing: 0.2,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
