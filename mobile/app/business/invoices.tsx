/**
 * Payouts / Invoices — paginated list of all business payouts.
 *
 * Features:
 *   • Filter by status (all / pending / processing / completed / failed / cancelled)
 *   • Infinite-scroll pagination
 *   • Tap a payout to see full detail (bottom sheet)
 *   • Cancel a PENDING payout
 *   • Batch filter: if launched with ?batchId=xxx pre-filters to that batch
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, View,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BusinessPayout, PayoutStatus } from '@/types/business';

const ACCENT = '#737373';
const PAGE_SIZE = 20;

type StatusFilter = 'ALL' | PayoutStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL',        label: 'All'        },
  { key: 'PENDING',    label: 'Pending'    },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'COMPLETED',  label: 'Completed'  },
  { key: 'FAILED',     label: 'Failed'     },
  { key: 'CANCELLED',  label: 'Cancelled'  },
];

function statusColor(status: PayoutStatus, p: ReturnType<typeof useThemedPalette>): string {
  switch (status) {
    case 'COMPLETED':  return p.greenFg;
    case 'FAILED':     return p.redFg;
    case 'CANCELLED':  return p.fgFaint;
    case 'PROCESSING': return '#60a5fa';
    default:           return p.amberFg;
  }
}

function statusIcon(status: PayoutStatus): any {
  switch (status) {
    case 'COMPLETED':  return 'checkmark-circle';
    case 'FAILED':     return 'close-circle';
    case 'CANCELLED':  return 'ban-outline';
    case 'PROCESSING': return 'sync-outline';
    default:           return 'time-outline';
  }
}

/* ─── Payout Row ───────────────────────────────────────────────── */
function PayoutItem({
  payout,
  onPress,
  palette: p,
}: {
  payout: BusinessPayout;
  onPress: () => void;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const col = statusColor(payout.status, p);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 13, paddingHorizontal: 16,
        backgroundColor: pressed ? p.bgElev : 'transparent',
      })}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: p.bgRaised, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons name={statusIcon(payout.status)} size={19} color={col} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {payout.recipientHandle
            ? `@${payout.recipientHandle}`
            : payout.recipientEmail ?? payout.reference}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', marginTop: 1 }}>
          {payout.currency} · {new Date(payout.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
          {payout.batchId ? ' · batch' : ''}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {Number(payout.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: col, fontSize: 10, fontWeight: '700', marginTop: 1 }}>
          {payout.status}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Payout Detail Modal ──────────────────────────────────────── */
function DetailModal({
  payout,
  onClose,
  onCancel,
  palette: p,
}: {
  payout: BusinessPayout | null;
  onClose: () => void;
  onCancel: (id: string) => Promise<void>;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied]         = useState<string | null>(null);

  const copy = async (val: string, key: string) => {
    await Clipboard.setStringAsync(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleCancel = async () => {
    if (!payout) return;
    Alert.alert(
      'Cancel payout',
      'Are you sure you want to cancel this payout?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel payout',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            await onCancel(payout.id).finally(() => setCancelling(false));
          },
        },
      ]
    );
  };

  if (!payout) return null;

  const col = statusColor(payout.status, p);

  const rows: { label: string; value: string; copyKey?: string }[] = [
    { label: 'Reference',    value: payout.reference,   copyKey: 'ref' },
    { label: 'Recipient',    value: payout.recipientHandle ? `@${payout.recipientHandle}` : payout.recipientEmail ?? '—' },
    { label: 'Amount',       value: `${Number(payout.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${payout.currency}` },
    { label: 'Fee',          value: `${Number(payout.feeAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${payout.currency}` },
    { label: 'Net amount',   value: `${Number(payout.netAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${payout.currency}` },
    { label: 'Status',       value: payout.status },
    { label: 'Created',      value: new Date(payout.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
    ...(payout.completedAt ? [{ label: 'Completed', value: new Date(payout.completedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) }] : []),
    ...(payout.batchId      ? [{ label: 'Batch ID',  value: payout.batchId, copyKey: 'batch' }] : []),
    ...(payout.note         ? [{ label: 'Note',      value: payout.note }] : []),
  ];

  return (
    <Modal visible={!!payout} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: p.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          {/* Title */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingHorizontal: 20, paddingVertical: 14,
            borderBottomWidth: 1, borderBottomColor: p.border,
          }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={statusIcon(payout.status)} size={22} color={col} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }}>
                Payout detail
              </Text>
              <Text style={{ color: col, fontSize: 11.5, fontWeight: '700', marginTop: 1 }}>
                {payout.status}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={p.fgMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 20 }}>
            {rows.map(({ label, value, copyKey }, i) => (
              <View key={label} style={{
                flexDirection: 'row', alignItems: 'flex-start',
                paddingVertical: 10,
                borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                borderBottomColor: p.border,
              }}>
                <Text style={{ color: p.fgMuted, fontSize: 12.5, fontWeight: '500', flex: 1 }}>{label}</Text>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1.6 }}
                  onPress={copyKey ? () => copy(value, copyKey) : undefined}
                >
                  <Text
                    style={{
                      color: label === 'Status' ? col : p.fg,
                      fontSize: 12.5, fontWeight: '600', flex: 1, textAlign: 'right',
                    }}
                    numberOfLines={2}
                  >
                    {value}
                  </Text>
                  {copyKey && (
                    <Ionicons
                      name={copied === copyKey ? 'checkmark' : 'copy-outline'}
                      size={13}
                      color={copied === copyKey ? p.greenFg : p.fgFaint}
                    />
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {/* Cancel action */}
          {payout.status === 'PENDING' && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 }}>
              <Pressable
                onPress={handleCancel}
                disabled={cancelling}
                style={({ pressed }) => ({
                  paddingVertical: 14, borderRadius: 14, alignItems: 'center',
                  borderWidth: 1, borderColor: `${p.redFg}40`,
                  backgroundColor: 'rgba(248,113,113,0.08)',
                  opacity: pressed || cancelling ? 0.7 : 1,
                })}
              >
                {cancelling
                  ? <ActivityIndicator color={p.redFg} size="small" />
                  : <Text style={{ color: p.redFg, fontSize: 14, fontWeight: '700' }}>Cancel payout</Text>
                }
              </Pressable>
            </View>
          )}

          {payout.status !== 'PENDING' && (
            <View style={{ height: 32 }} />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Main Screen ──────────────────────────────────────────────── */
export default function Invoices() {
  const router = useRouter();
  const p      = useThemedPalette();
  const h      = useHaptics();
  const mode   = useTheme((s) => s.mode);
  const params = useLocalSearchParams<{ batchId?: string }>();

  const [payouts,    setPayouts]    = useState<BusinessPayout[]>([]);
  const [filter,     setFilter]     = useState<StatusFilter>('ALL');
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected,   setSelected]   = useState<BusinessPayout | null>(null);

  const load = useCallback(async (p2: number, f: StatusFilter, append = false) => {
    if (p2 === 1 && !append) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await businessService.listPayouts({
        page:     p2,
        limit:    PAGE_SIZE,
        ...(f !== 'ALL' ? { status: f } : {}),
        ...(params.batchId ? { batchId: params.batchId } : {}),
      });
      setPayouts((prev) => append ? [...prev, ...result.payouts] : result.payouts);
      setTotalPages(result.pages);
    } catch { /* ignore */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, [params.batchId]);

  useEffect(() => {
    setPage(1);
    load(1, filter, false);
  }, [filter, load]);

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    load(next, filter, true);
  };

  const handleCancel = async (id: string) => {
    h.selection();
    try {
      const updated = await businessService.cancelPayout(id);
      setPayouts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      if (selected?.id === id) setSelected(updated);
      h.success();
    } catch (err: any) {
      h.error();
      Alert.alert('Failed', err?.response?.data?.message ?? 'Could not cancel payout.');
    }
  };

  const separator = () => (
    <View style={{ height: 1, backgroundColor: p.border, marginHorizontal: 16 }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18, backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>
              Payouts
            </Text>
            {params.batchId && (
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500' }} numberOfLines={1}>
                Batch {params.batchId.slice(0, 8)}…
              </Text>
            )}
          </View>
        </View>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}
        >
          {STATUS_FILTERS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => { h.selection(); setFilter(key); }}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: filter === key ? ACCENT : p.bgElev,
                borderWidth: 1, borderColor: filter === key ? ACCENT : p.border,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{
                color: filter === key ? '#fff' : p.fgMuted,
                fontSize: 12, fontWeight: '700',
              }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={ACCENT} size="large" />
          </View>
        ) : (
          <FlatList
            data={payouts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PayoutItem
                payout={item}
                onPress={() => { h.selection(); setSelected(item); }}
                palette={p}
              />
            )}
            ItemSeparatorComponent={separator}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore
                ? <View style={{ paddingVertical: 20, alignItems: 'center' }}><ActivityIndicator color={ACCENT} /></View>
                : null
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 80 }}>
                <Ionicons name="receipt-outline" size={40} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginTop: 12 }}>
                  No payouts found
                </Text>
                <Text style={{ color: p.fgFaint, fontSize: 13, marginTop: 4 }}>
                  {filter !== 'ALL' ? `No ${filter.toLowerCase()} payouts.` : 'Send your first payout via Bulk Pay or the API.'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <DetailModal
        payout={selected}
        onClose={() => setSelected(null)}
        onCancel={handleCancel}
        palette={p}
      />
    </View>
  );
}
