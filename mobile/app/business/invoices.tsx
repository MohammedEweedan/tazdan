import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
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
import { StackHeader } from '@/components/ui/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BusinessPayout, PayoutBatch, PayoutStatus } from '@/types/business';

import { BottomSheet } from '@/components/ui/BottomSheet';
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
    case 'PROCESSING': return p.accentText;
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
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {Number(payout.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: col, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
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
    <BottomSheet visible={!!payout} onClose={onClose} title={"Payout detail"} scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
          {/* Title */}
          

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
            <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 8 }}>
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
                  : <Text style={{ color: p.redFg, fontSize: 14, fontWeight: '600' }}>Cancel payout</Text>
                }
              </Pressable>
            </View>
          )}

          {payout.status !== 'PENDING' && (
            <View style={{ height: 32 }} />
          )}
        </BottomSheet>
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
  // Maker-checker queue: batches another owner/admin created that need a second approver.
  const [pending,    setPending]    = useState<PayoutBatch[]>([]);
  const [deciding,   setDeciding]   = useState<string | null>(null);
  const loadPending = useCallback(async () => {
    try { setPending(await businessService.listBatches('PENDING_APPROVAL')); } catch { /* not every role can see batches */ }
  }, []);
  useEffect(() => { void loadPending(); }, [loadPending]);

  const decide = (b: PayoutBatch, approve: boolean) => {
    const run = async (reason?: string) => {
      setDeciding(b.id); h.selection();
      try {
        if (approve) await businessService.approveBatch(b.id); else await businessService.rejectBatch(b.id, reason ?? 'Rejected');
        h.success();
        await Promise.all([loadPending(), load(1, filter, false)]);
      } catch (err: any) {
        h.error();
        Alert.alert(approve ? 'Approval failed' : 'Rejection failed', err?.response?.data?.error ?? 'Please try again.');
      } finally { setDeciding(null); }
    };
    if (approve) {
      Alert.alert('Approve batch', `Pay ${b.count} payout${b.count === 1 ? '' : 's'} totalling ${Number(b.totalAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${b.currency}?`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => { void run(); } },
      ]);
    } else {
      Alert.alert('Reject batch', 'The reserved funds return to your balance and no one is paid.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Reject', style: 'destructive', onPress: () => { void run('Rejected by approver in the app'); } },
      ]);
    }
  };

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
      Alert.alert('Failed', err?.response?.data?.error ?? err?.response?.data?.message ?? 'Could not cancel payout.');
    }
  };

  const separator = () => (
    <View style={{ height: 1, backgroundColor: p.border, marginHorizontal: 16 }} />
  );

  return (
    <ScreenShell
          title="Payouts"
          subtitle={params.batchId ? `Batch ${params.batchId.slice(0, 8)}…` : undefined}
         scroll={false} contentStyle={{ paddingHorizontal: 0 }}>

        {/* Status filter chips */}
        <ScrollView
          horizontal
          style={{ flexGrow: 0, flexShrink: 0 }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}
        >
          {STATUS_FILTERS.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => { h.selection(); setFilter(key); }}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: filter === key ? p.ctaBg : p.bgElev,
                borderWidth: 1, borderColor: filter === key ? p.ctaBg : p.border,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{
                color: filter === key ? p.ctaFg : p.fgMuted,
                fontSize: 12, fontWeight: '600',
              }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={p.accentText} size="large" />
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
            ListHeaderComponent={pending.length ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>WAITING FOR APPROVAL</Text>
                {pending.map((b) => (
                  <View key={b.id} style={{ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14, marginBottom: 8 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>
                      {Number(b.totalAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} {b.currency} · {b.count} payout{b.count === 1 ? '' : 's'}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{b.reference}{b.source === 'API' ? ' · via API' : ''}</Text>
                    {b.approvalReason ? <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6 }}>{b.approvalReason}</Text> : null}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <Pressable disabled={deciding === b.id} onPress={() => decide(b, false)}
                        style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.border, opacity: pressed || deciding === b.id ? 0.6 : 1 })}>
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>Reject</Text>
                      </Pressable>
                      <Pressable disabled={deciding === b.id} onPress={() => decide(b, true)}
                        style={({ pressed }) => ({ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: p.ctaBg, opacity: pressed || deciding === b.id ? 0.6 : 1 })}>
                        <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '600' }}>{deciding === b.id ? 'Working…' : 'Approve'}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore
                ? <View style={{ paddingVertical: 20, alignItems: 'center' }}><ActivityIndicator color={p.accentText} /></View>
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


      <DetailModal
        payout={selected}
        onClose={() => setSelected(null)}
        onCancel={handleCancel}
        palette={p}
      />
    </ScreenShell>
  );
}
