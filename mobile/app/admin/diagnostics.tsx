/**
 * Admin Diagnostics — one place to see whether the platform is healthy:
 *   • System: database, redis, email transport (from /health diagnostics).
 *   • Money integrity: trading halt, per-currency fund drift, ledger
 *     conservation + cache drift (from /admin/fund-integrity).
 *   • Actions: clear a trading halt, reconcile a drifted currency.
 *
 * Uses the shared AdminScreen chrome introduced in the admin redesign.
 */

import { Alert, Pressable, RefreshControl, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useThemedPalette } from '@/store/themeStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { AdminScreen, AdminCard, AdminStatRow } from '@/components/admin/AdminScreen';

export default function AdminDiagnostics() {
  const p = useThemedPalette();
  const qc = useQueryClient();

  const health = useQuery({ queryKey: ['sys-health'], queryFn: adminService.systemHealth, refetchInterval: 30_000 });
  const fi = useQuery({ queryKey: ['fund-integrity'], queryFn: adminService.fundIntegrity, refetchInterval: 30_000 });
  const readiness = useQuery({ queryKey: ['operational-readiness'], queryFn: adminService.operationalReadiness, refetchInterval: 30_000 });

  const clearHalt = useMutation({
    mutationFn: adminService.clearTradingHalt,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fund-integrity'] }); },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Try again'),
  });

  const reconcile = useMutation({
    mutationFn: (currency: string) => adminService.reconcileFundIntegrity(currency),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['fund-integrity'] }); Alert.alert('Reconciled', `${r.currency}: ${r.reconciledAmount} (diff after ${r.diffAfter})`); },
    onError: (e: any) => Alert.alert('Reconcile failed', e?.response?.data?.error ?? 'Try again'),
  });
  const dailyClose = useMutation({
    mutationFn: adminService.runDailyClose,
    onSuccess: (r) => { readiness.refetch(); Alert.alert('Daily close completed', `${r.closeDate} · ${r.report.overall.toUpperCase()}`); },
    onError: (e: any) => Alert.alert('Daily close failed', e?.response?.data?.error ?? 'Try again'),
  });
  const auditReview = useMutation({
    mutationFn: () => adminService.markAuditLogReviewed('Reviewed from admin diagnostics'),
    onSuccess: () => { readiness.refetch(); Alert.alert('Recorded', 'Audit log review recorded.'); },
    onError: (e: any) => Alert.alert('Review failed', e?.response?.data?.error ?? 'Try again'),
  });
  const backfill = useMutation({
    mutationFn: adminService.backfillLedgerOpeningBalances,
    onSuccess: (r) => { fi.refetch(); readiness.refetch(); Alert.alert('Backfill complete', `${r.report.ran} posted · ${r.report.skipped} skipped`); },
    onError: (e: any) => Alert.alert('Backfill failed', e?.response?.data?.error ?? 'Try again'),
  });

  const refreshing = health.isFetching || fi.isFetching || readiness.isFetching;
  const refresh = () => { health.refetch(); fi.refetch(); readiness.refetch(); };

  const dbOk = health.data?.checks?.database === 'ok';
  const redisOk = health.data?.checks?.redis === 'ok';
  const email = health.data?.diagnostics?.email;
  const halted = fi.data?.tradingHalted;
  const fundsOk = fi.data?.funds?.ok;
  const ledgerOk = fi.data?.ledger?.ok;

  // Overall status banner colour.
  const readinessOk = readiness.data?.overall === 'ok';
  const allOk = dbOk && redisOk && !!email?.canSend && !halted && fundsOk && ledgerOk && readinessOk;

  return (
    <AdminScreen
      title="Diagnostics"
      subtitle="System health & money integrity"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={p.fg} />}
    >
      {health.isLoading && fi.isLoading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <LoadingPulse size={56} icon="pulse-outline" label="Running checks…" />
        </View>
      ) : (
        <>
          {/* Overall banner */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: allOk ? p.greenBg : p.redBg, borderRadius: 16, padding: 16, marginBottom: 16,
          }}>
            <Ionicons name={allOk ? 'shield-checkmark' : 'warning'} size={26} color={allOk ? p.greenFg : p.redFg} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: allOk ? p.greenFg : p.redFg, fontSize: 16, fontWeight: '800' }}>
                {allOk ? 'All systems healthy' : 'Attention needed'}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                {health.data?.environment ?? '—'} · v{health.data?.version ?? '—'}
                {health.data?.uptime != null ? ` · up ${Math.floor(health.data.uptime / 3600)}h` : ''}
              </Text>
            </View>
          </View>

          {/* System */}
          <Text style={sectionLabel(p)}>SYSTEM</Text>
          <AdminCard style={{ marginBottom: 16 }}>
            <AdminStatRow label="Database" value={dbOk ? 'OK' : 'DOWN'} tone={dbOk ? 'ok' : 'bad'} p={p} />
            <AdminStatRow label="Redis" value={redisOk ? 'OK' : 'DOWN'} tone={redisOk ? 'ok' : 'bad'} p={p} />
            <AdminStatRow label="Email transport" value={email?.transport ?? '—'} p={p} />
            <AdminStatRow label="Email can send" value={email?.canSend ? 'YES' : 'NO'} tone={email?.canSend ? 'ok' : 'bad'} p={p} />
            {!!email?.missingEnv?.length && (
              <AdminStatRow label="Missing env" value={email.missingEnv.join(', ')} tone="warn" p={p} />
            )}
          </AdminCard>

          <Text style={sectionLabel(p)}>OPERATIONAL READINESS</Text>
          <AdminCard style={{ marginBottom: 16 }}>
            <AdminStatRow
              label="Overall"
              value={(readiness.data?.overall ?? '—').toUpperCase()}
              tone={readiness.data?.overall === 'ok' ? 'ok' : readiness.data?.overall === 'critical' ? 'bad' : 'warn'}
              p={p}
            />
            <AdminStatRow label="Generated" value={readiness.data?.generatedAt ? new Date(readiness.data.generatedAt).toLocaleString() : '—'} p={p} />
            {Object.entries(readiness.data?.controls ?? {}).slice(0, 8).map(([key, value]: any) => (
              <AdminStatRow
                key={key}
                label={key.replace(/([A-Z])/g, ' $1')}
                value={(value?.status ?? 'ok').toUpperCase()}
                tone={value?.status === 'critical' ? 'bad' : value?.status === 'warn' ? 'warn' : 'ok'}
                p={p}
              />
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <ActionButton label={dailyClose.isPending ? 'Closing…' : 'Daily close'} onPress={() => dailyClose.mutate()} p={p} />
              <ActionButton label={auditReview.isPending ? 'Recording…' : 'Audit reviewed'} onPress={() => auditReview.mutate()} p={p} />
              <ActionButton
                label={backfill.isPending ? 'Backfilling…' : 'Backfill ledger'}
                danger
                onPress={() => Alert.alert('Backfill ledger?', 'Posts opening-balance differences for Wallet, UserWallet, and dynamic alt assets.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Backfill', style: 'destructive', onPress: () => backfill.mutate() },
                ])}
                p={p}
              />
            </View>
          </AdminCard>

          {/* Money integrity */}
          <Text style={sectionLabel(p)}>MONEY INTEGRITY</Text>
          <AdminCard style={{ marginBottom: 16 }}>
            <AdminStatRow label="Trading halt" value={halted ? 'HALTED' : 'Active'} tone={halted ? 'bad' : 'ok'} p={p} />
            <AdminStatRow label="Fund reconciliation" value={fundsOk ? 'Balanced' : 'Drift detected'} tone={fundsOk ? 'ok' : 'bad'} p={p} />
            <AdminStatRow label="Ledger conservation" value={ledgerOk ? 'OK' : 'Drift detected'} tone={ledgerOk ? 'ok' : 'bad'} p={p} />

            {halted && (
              <Pressable
                onPress={() => Alert.alert('Clear trading halt?', 'Only do this once the drift is resolved.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear halt', style: 'destructive', onPress: () => clearHalt.mutate() },
                ])}
                style={{ marginTop: 12, height: 46, borderRadius: 12, backgroundColor: p.redFg, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{clearHalt.isPending ? 'Clearing…' : 'Clear trading halt'}</Text>
              </Pressable>
            )}
          </AdminCard>

          {/* Per-currency drift (only the ones that aren't balanced get a reconcile button) */}
          {!!fi.data?.funds?.perCurrency?.length && (
            <>
              <Text style={sectionLabel(p)}>PER-CURRENCY HOLDINGS</Text>
              <AdminCard>
                {fi.data.funds.perCurrency.map((c, i) => (
                  <View key={c.currency} style={{ paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{c.currency}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={c.ok ? 'checkmark-circle' : 'alert-circle'} size={15} color={c.ok ? p.greenFg : p.redFg} />
                        <Text style={{ color: c.ok ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '700' }}>{c.ok ? 'OK' : `diff ${c.diff}`}</Text>
                      </View>
                    </View>
                    <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                      held {c.internalHeld} · entered {c.enteredOutside}
                    </Text>
                    {!c.ok && (
                      <Pressable
                        onPress={() => Alert.alert(`Reconcile ${c.currency}?`, 'Writes a balancing reconciliation entry.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Reconcile', onPress: () => reconcile.mutate(c.currency) },
                        ])}
                        style={{ alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder }}
                      >
                        <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '700' }}>{reconcile.isPending ? 'Reconciling…' : `Reconcile ${c.currency}`}</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </AdminCard>
            </>
          )}
        </>
      )}
    </AdminScreen>
  );
}

function ActionButton({ label, onPress, p, danger }: { label: string; onPress: () => void; p: ReturnType<typeof useThemedPalette>; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: 40,
        paddingHorizontal: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: danger ? p.redBg : p.accentSoft,
        borderWidth: 1,
        borderColor: danger ? p.redFg : p.accentBorder,
      }}
    >
      <Text style={{ color: danger ? p.redFg : p.accentText, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function sectionLabel(p: ReturnType<typeof useThemedPalette>) {
  return { color: p.fgFaint, fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 };
}
