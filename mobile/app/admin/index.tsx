/**
 * Admin Dashboard — full ops console with period-over-period
 * comparisons: today/yesterday, this week/last week, this month/last
 * month, this year/last year. Plus live socket metrics, top pairs,
 * user growth, and one-tap access to every admin surface.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TopGradient } from '@/components/ui/ScreenShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService, type AdminDashboard, type PeriodStats } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';

type Metrics = {
  onlineSockets: number;
  onlineUsers: number;
  recentTransactions5m: number;
  recentOrders5m: number;
  recentDeposits5m: number;
  recentWithdrawals5m: number;
  totalCommissionsUSD: number;
  commissions24hUSD: number;
  uptimeSeconds: number;
  memoryMb: number;
};

type Period = 'today' | 'week' | 'month' | 'year';

const PERIOD_LABEL: Record<Period, { current: string; previous: string }> = {
  today: { current: 'Today',      previous: 'Yesterday'  },
  week:  { current: 'This week',  previous: 'Last week'  },
  month: { current: 'This month', previous: 'Last month' },
  year:  { current: 'This year',  previous: 'Last year'  },
};

function formatUSD(n: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(n)) return '$0.00';
  if (opts?.compact && Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (opts?.compact && Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '0%';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatUptime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

export default function AdminScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const setViewMode = useAuthStore((s) => s.setViewMode);
  const qc = useQueryClient();
  const backfillMut = useMutation({
    mutationFn: () => adminService.backfillFees(),
    onSuccess: (data) => {
      const r = data?.imported ?? { orders: 0, withdrawals: 0, cryptoOrders: 0, p2pTrades: 0 };
      Alert.alert(
        'Backfill complete',
        `Imported ${data?.total ?? 0} historical fee records.\n\nOrders: ${r.orders}\nWithdrawals: ${r.withdrawals}\nCrypto orders: ${r.cryptoOrders}\nP2P trades: ${r.p2pTrades}`,
      );
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (e: any) => Alert.alert('Backfill failed', e?.response?.data?.error ?? e?.message ?? 'Try again'),
  });
  const router = useRouter();

  const isAdmin = user?.role === 'ADMIN';
  const [period, setPeriod] = useState<Period>('today');

  const dashQ = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminService.dashboard(),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });
  const metricsQ = useQuery<Metrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data } = await (await import('@/lib/api')).api.get<Metrics>('/admin/metrics');
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 5_000,
  });

  const d = dashQ.data as AdminDashboard | undefined;
  const m = metricsQ.data;
  const stats: PeriodStats | undefined = d?.[period];

  // Live pulse for the realtime dot
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);
  const dotScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });

  const onRefresh = async () => {
    await Promise.all([dashQ.refetch(), metricsQ.refetch()]);
  };

  const switchToUser = async () => {
    await setViewMode('user');
    router.replace('/(tabs)');
  };

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <Ionicons name="lock-closed-outline" size={48} color={p.fgFaint} />
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 14 }}>Admin access only</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 24, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
          <Text style={{ color: p.fg, fontWeight: '700' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (dashQ.isLoading && !d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
        <LoadingPulse fullscreen icon="speedometer-outline" label="Loading admin console…" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <TopGradient />

      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={dashQ.isFetching || metricsQ.isFetching} onRefresh={onRefresh} tintColor={p.fg} />}
        >
          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={p.fg} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', transform: [{ scale: dotScale }], opacity: dotOpacity }} />
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>LIVE</Text>
              <Pressable onPress={switchToUser} hitSlop={8} style={{ marginLeft: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.fg, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>USER VIEW</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 4 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.7 }}>ADMIN CONSOLE</Text>
            <Text style={{ color: p.fg, fontSize: 28, fontWeight: '600', letterSpacing: -0.6, marginTop: 2 }}>
              Operations
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4 }}>
              {user?.firstName ?? 'Admin'} · {user?.role}
            </Text>
          </View>

          {/* Period picker */}
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <View style={{
              flexDirection: 'row', gap: 4,
              backgroundColor: p.bgElev, borderRadius: 12,
              borderWidth: 1, borderColor: p.border,
              padding: 4,
            }}>
              {(['today', 'week', 'month', 'year'] as Period[]).map((per) => {
                const on = period === per;
                return (
                  <Pressable
                    key={per}
                    onPress={() => setPeriod(per)}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: on ? p.fg : 'transparent', alignItems: 'center' }}
                  >
                    <Text style={{ color: on ? p.bg : p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'capitalize' }}>
                      {per}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Big revenue card */}
          <View style={{ marginHorizontal: 20, marginTop: 14 }}>
            <View style={{
              borderRadius: 20, padding: 20,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7 }}>
                FEES COLLECTED · {PERIOD_LABEL[period].current.toUpperCase()}
              </Text>
              <Text style={{ color: p.fg, fontSize: 40, fontWeight: '600', letterSpacing: -1.4, marginTop: 6, fontVariant: ['tabular-nums'] }}>
                {formatUSD(stats?.fees ?? 0)}
              </Text>
              <DeltaRow current={stats?.fees ?? 0} prev={stats?.prevFees ?? 0} delta={stats?.feesDelta ?? 0} prevLabel={PERIOD_LABEL[period].previous} p={p} />

              <View style={{ height: 1, backgroundColor: p.border, marginVertical: 14 }} />

              <View style={{ flexDirection: 'row', gap: 14 }}>
                <PeriodMiniStat label="Volume" curr={stats?.volume ?? 0} prev={stats?.prevVolume ?? 0} delta={stats?.volumeDelta ?? 0} format={(v) => formatUSD(v, { compact: true })} p={p} />
                <PeriodMiniStat label="Transactions" curr={stats?.txCount ?? 0} prev={stats?.prevTxCount ?? 0} delta={stats?.txDelta ?? 0} format={(v) => v.toLocaleString()} p={p} />
              </View>
            </View>
          </View>

          {/* Real-time strip */}
          <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>REAL-TIME</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <KpiCard label="USERS ONLINE"  value={(m?.onlineUsers ?? 0).toLocaleString()} hint={`${m?.onlineSockets ?? 0} sockets`} icon="people-outline" accent="#22c55e" p={p} />
              <KpiCard label="TXS / 5MIN"    value={(m?.recentTransactions5m ?? 0).toLocaleString()} hint={`${m?.recentOrders5m ?? 0} orders`} icon="flash-outline" accent="#f59e0b" p={p} />
              <KpiCard label="ACTIVE USERS"  value={(d?.activeUsers ?? 0).toLocaleString()} hint={`+${d?.newUsersWeek ?? 0} this week`} icon="person-add-outline" accent="#3b82f6" p={p} />
              <KpiCard label="FROZEN"        value={(d?.frozenUsers ?? d?.suspendedUsers ?? 0).toLocaleString()} hint="suspended" icon="snow-outline" accent="#ef4444" p={p} />
              <KpiCard label="UPTIME"        value={formatUptime(m?.uptimeSeconds ?? 0)} hint={`${m?.memoryMb ?? 0} MB`} icon="pulse-outline" accent={p.fg} p={p} />
              <KpiCard label="TOTAL USERS"   value={(d?.totalUsers ?? 0).toLocaleString()} hint={`+${d?.newUsersToday ?? 0} today`} icon="globe-outline" accent={p.fg} p={p} />
            </View>
          </View>

          {/* Lifetime totals strip */}
          <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>LIFETIME</Text>
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap',
              backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border,
              overflow: 'hidden',
            }}>
              <BigCell label="TOTAL FEES" value={formatUSD(d?.totalFees ?? 0, { compact: true })} p={p} />
              <BigCell label="TOTAL VOLUME" value={formatUSD(d?.totalVolume ?? 0, { compact: true })} p={p} />
              <BigCell label="TRANSACTIONS" value={(d?.totalTransactions ?? 0).toLocaleString()} p={p} />
              <BigCell label="DEPOSITS USD" value={formatUSD(d?.totalDepositsUSD ?? 0, { compact: true })} p={p} last />
            </View>
          </View>

          {/* Pending action queue */}
          <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>PENDING ACTIONS</Text>
            <ActionRow icon="document-text-outline"   label="KYC Reviews"             count={d?.pendingKYC ?? 0}         onPress={() => router.push('/admin/kyc' as any)} p={p} />
            <ActionRow icon="arrow-down-circle-outline" label="Deposits Awaiting"     count={d?.pendingDeposits ?? 0}    onPress={() => router.push('/admin/deposits' as any)} p={p} />
            <ActionRow icon="arrow-up-circle-outline"  label="Withdrawal Queue"        count={d?.pendingWithdrawals ?? 0} onPress={() => router.push('/admin/withdrawals' as any)} p={p} />
            <ActionRow icon="warning-outline"          label="Escalated P2P / Support"                                    onPress={() => router.push('/admin/escalations' as any)} p={p} />
            <ActionRow icon="chatbubble-ellipses-outline" label="Support Chats"                                          onPress={() => router.push('/admin/support' as any)} p={p} />
          </View>

          {/* Trade flow */}
          <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>TRADE FLOW</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>{PERIOD_LABEL[period].current} Volume</Text>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {formatUSD(stats?.volume ?? 0, { compact: true })}
                </Text>
              </View>
              <BuySellBar buys={d?.buyOrders ?? 0} sells={d?.sellOrders ?? 0} p={p} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>BUY · {(d?.buyOrders ?? 0).toLocaleString()}</Text>
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>SELL · {(d?.sellOrders ?? 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Top pairs */}
          {!!d?.ordersByPair?.length && (
            <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>TOP PAIRS BY ORDER COUNT</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
                {d.ordersByPair.slice(0, 6).map((row, i, arr) => {
                  const max = Math.max(...d.ordersByPair.map((r) => r.count));
                  const pct = max > 0 ? (row.count / max) * 100 : 0;
                  return (
                    <View key={row.pair} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{row.pair}</Text>
                        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                          {row.count.toLocaleString()} · {formatUSD(row.volume, { compact: true })}
                        </Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: p.pillBg, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: 4, width: `${pct}%`, backgroundColor: p.fg, borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* User growth */}
          {!!d?.userGrowth?.length && (
            <View style={{ marginTop: 18, paddingHorizontal: 20 }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>USER GROWTH · 7 DAYS</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
                  {d.userGrowth.map((g) => {
                    const max = Math.max(...d.userGrowth.map((x) => x.count), 1);
                    const h = (g.count / max) * 70 + 4;
                    return <View key={g.date} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: '70%', height: h, backgroundColor: p.fg, borderRadius: 4 }} /></View>;
                  })}
                </View>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  {d.userGrowth.map((g) => (
                    <Text key={g.date} style={{ flex: 1, textAlign: 'center', color: p.fgFaint, fontSize: 9, fontWeight: '700' }}>{g.date.slice(5)}</Text>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Backfill banner — only show if total commissions is suspiciously low */}
          {(m?.totalCommissionsUSD ?? 0) < 1 && (
            <View style={{ marginTop: 18, marginHorizontal: 20 }}>
              <View style={{
                borderRadius: 14, padding: 14,
                backgroundColor: 'rgba(245,158,11,0.10)',
                borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)',
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <Ionicons name="flash-outline" size={22} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>Backfill historical fees</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>Import fees from existing orders, withdrawals, and P2P trades into the platform ledger.</Text>
                </View>
                <Pressable
                  onPress={() => backfillMut.mutate()}
                  disabled={backfillMut.isPending}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#f59e0b' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {backfillMut.isPending ? 'Importing…' : 'Run'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Manage tiles */}
          <View style={{ marginTop: 22, paddingHorizontal: 20 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>MANAGE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <NavTile icon="people-outline"            label="Users"          onPress={() => router.push('/admin/users' as any)} p={p} />
              <NavTile icon="trending-up-outline"       label="Rates"          onPress={() => router.push('/admin/rates' as any)} p={p} />
              <NavTile icon="server-outline"            label="Database"       onPress={() => router.push('/admin/data' as any)} p={p} />
              <NavTile icon="cash-outline"              label="Fee Ledger"     onPress={() => router.push('/admin/fees' as any)} p={p} />
              <NavTile icon="shield-outline"            label="AML Flags"      onPress={() => router.push('/admin/aml' as any)} p={p} />
              <NavTile icon="settings-outline"          label="Settings"       onPress={() => router.push('/admin/settings' as any)} p={p} />
              <NavTile icon="cube-outline"              label="Orders"         onPress={() => router.push('/admin/orders' as any)} p={p} />
              <NavTile icon="swap-horizontal-outline"   label="P2P"            onPress={() => router.push('/admin/p2p' as any)} p={p} />
              <NavTile icon="card-outline"              label="Cards"          onPress={() => router.push('/admin/cards' as any)} p={p} />
              <NavTile icon="chatbubbles-outline"       label="Messages"       onPress={() => router.push('/admin/messages' as any)} p={p} />
              <NavTile icon="logo-whatsapp"             label="WhatsApp"       onPress={() => router.push('/admin/whatsapp' as any)} p={p} />
              <NavTile icon="arrow-up-circle-outline"   label="On-Ramps"       onPress={() => router.push('/admin/ramps' as any)} p={p} />
              <NavTile icon="git-branch-outline"        label="On-Chain"       onPress={() => router.push('/admin/onchain' as any)} p={p} />
              <NavTile icon="gift-outline"              label="Referrals"      onPress={() => router.push('/admin/referrals' as any)} p={p} />
              <NavTile icon="key-outline"               label="Sessions"       onPress={() => router.push('/admin/sessions' as any)} p={p} />
              <NavTile icon="notifications-outline"     label="Notifications"  onPress={() => router.push('/admin/notifications' as any)} p={p} />
              <NavTile icon="business-outline"          label="Platform Banks" onPress={() => router.push('/admin/platform-banks' as any)} p={p} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── helpers ────────────────────────────────────────── */

function DeltaRow({ current, prev, delta, prevLabel, p }: { current: number; prev: number; delta: number; prevLabel: string; p: any }) {
  const positive = delta >= 0;
  const color = positive ? '#22c55e' : '#ef4444';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
        backgroundColor: positive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      }}>
        <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={10} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatPct(delta)}</Text>
      </View>
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
        vs {prevLabel.toLowerCase()} (${prev.toLocaleString('en-US', { maximumFractionDigits: 2 })})
      </Text>
    </View>
  );
}

function PeriodMiniStat({ label, curr, prev, delta, format, p }: { label: string; curr: number; prev: number; delta: number; format: (v: number) => string; p: any }) {
  const positive = delta >= 0;
  const color = positive ? '#22c55e' : '#ef4444';
  return (
    <View style={{ flex: 1, paddingVertical: 8 }}>
      <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>{format(curr)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
        <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={9} color={color} />
        <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{formatPct(delta)}</Text>
        <Text style={{ color: p.fgFaint, fontSize: 10, marginLeft: 2 }}>was {format(prev)}</Text>
      </View>
    </View>
  );
}

function KpiCard({ label, value, hint, icon, accent, p }: { label: string; value: string; hint?: string; icon: keyof typeof Ionicons.glyphMap; accent: string; p: any }) {
  return (
    <View style={{ width: '48%', backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>{label}</Text>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {hint && <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '600', marginTop: 3 }}>{hint}</Text>}
    </View>
  );
}

function BigCell({ label, value, p, last }: { label: string; value: string; p: any; last?: boolean }) {
  return (
    <View style={{
      width: '50%', padding: 14,
      borderRightWidth: 1, borderRightColor: p.border,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, count, onPress, p }: { icon: keyof typeof Ionicons.glyphMap; label: string; count?: number; onPress: () => void; p: any }) {
  const hasCount = typeof count === 'number';
  const urgent = hasCount && (count ?? 0) > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 13,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        borderRadius: 14, marginBottom: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: urgent ? 'rgba(239,68,68,0.15)' : p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={urgent ? '#ef4444' : p.fg} />
      </View>
      <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      {hasCount ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: urgent ? '#ef4444' : p.pillBg }}>
          <Text style={{ color: urgent ? '#fff' : p.fgMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{(count ?? 0).toLocaleString()}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
      )}
    </Pressable>
  );
}

function NavTile({ icon, label, onPress, p }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; p: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '31%', aspectRatio: 1.1,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={p.fg} />
      <Text style={{ color: p.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function BuySellBar({ buys, sells, p }: { buys: number; sells: number; p: any }) {
  const total = buys + sells || 1;
  const buyPct = (buys / total) * 100;
  return (
    <View style={{ height: 8, backgroundColor: p.pillBg, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginTop: 14 }}>
      <View style={{ width: `${buyPct}%`, backgroundColor: '#22c55e' }} />
      <View style={{ flex: 1, backgroundColor: '#ef4444' }} />
    </View>
  );
}
