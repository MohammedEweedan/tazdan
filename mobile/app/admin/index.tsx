/**
 * Admin Dashboard — full ops console with period-over-period
 * comparisons: today/yesterday, this week/last week, this month/last
 * month, this year/last year. Plus live socket metrics, top pairs,
 * user growth, and one-tap access to every admin surface.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { adminService, type AdminDashboard, type PeriodStats, type AdminExposure, type AdminFxStatus, type AdminFundIntegrity } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { FxChart, type FxChartMode } from '@/components/admin/FxChart';

type Metrics = {
  onlineSockets: number;
  onlineUsers: number;
  txPerMin: number;
  feesPerMin: number;
  recentTransactions5m: number;
  recentOrders5m: number;
  recentDeposits5m: number;
  recentWithdrawals5m: number;
  recentTransfers5m: number;
  recentP2P5m: number;
  recentCardTx5m: number;
  commissions5mUSD: number;
  totalCommissionsUSD: number;
  commissions24hUSD: number;
  feesBySource?: Array<{ source: string; totalUsd: number; count: number }>;
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

function fmtSignedUsd(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  const a = Math.abs(n);
  const body = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `$${(a / 1_000).toFixed(1)}k` : `$${a.toFixed(0)}`;
  return `${sign}${body}`;
}

// Grouped admin navigation — replaces the flat 21-tile grid so the hub scans
// fast instead of forcing a long scroll. Each group collapses; Trading opens by
// default since rates/orders are the most-touched surfaces.
type NavItem = { icon: keyof typeof Ionicons.glyphMap; label: string; route: string };
type NavGroupDef = { title: string; icon: keyof typeof Ionicons.glyphMap; defaultOpen?: boolean; items: NavItem[] };

const NAV_GROUPS: NavGroupDef[] = [
  { title: 'Trading', icon: 'trending-up-outline', defaultOpen: true, items: [
    { icon: 'trending-up-outline',     label: 'Rates',         route: '/admin/rates' },
    { icon: 'cube-outline',            label: 'Orders',        route: '/admin/orders' },
    { icon: 'swap-horizontal-outline', label: 'P2P',           route: '/admin/p2p' },
  ]},
  { title: 'Money', icon: 'cash-outline', items: [
    { icon: 'arrow-down-circle-outline', label: 'Deposits',    route: '/admin/deposits' },
    { icon: 'arrow-up-circle-outline',   label: 'Withdrawals', route: '/admin/withdrawals' },
    { icon: 'arrow-up-circle-outline',   label: 'On-Ramps',    route: '/admin/ramps' },
    { icon: 'git-branch-outline',        label: 'On-Chain',    route: '/admin/onchain' },
    { icon: 'cash-outline',              label: 'Fee Ledger',  route: '/admin/fees' },
    { icon: 'card-outline',              label: 'Cards',       route: '/admin/cards' },
  ]},
  { title: 'People', icon: 'people-outline', items: [
    { icon: 'people-outline',          label: 'Users',         route: '/admin/users' },
    { icon: 'document-text-outline',   label: 'KYC',           route: '/admin/kyc' },
    { icon: 'shield-outline',          label: 'AML Flags',     route: '/admin/aml' },
    { icon: 'gift-outline',            label: 'Referrals',     route: '/admin/referrals' },
    { icon: 'key-outline',             label: 'Sessions',      route: '/admin/sessions' },
  ]},
  { title: 'Comms', icon: 'chatbubbles-outline', items: [
    { icon: 'chatbubbles-outline',     label: 'Messages',      route: '/admin/messages' },
    { icon: 'logo-whatsapp',           label: 'WhatsApp',      route: '/admin/whatsapp' },
    { icon: 'notifications-outline',   label: 'Notifications', route: '/admin/notifications' },
    { icon: 'mail-outline',            label: 'Waitlist',      route: '/admin/waitlist' },
    { icon: 'chatbubble-ellipses-outline', label: 'Support',   route: '/admin/support' },
  ]},
  { title: 'System', icon: 'settings-outline', items: [
    { icon: 'pulse-outline',           label: 'Diagnostics',   route: '/admin/diagnostics' },
    { icon: 'server-outline',          label: 'Database',      route: '/admin/data' },
    { icon: 'settings-outline',        label: 'Settings',      route: '/admin/settings' },
    { icon: 'business-outline',        label: 'Platform Banks', route: '/admin/platform-banks' },
  ]},
];

export default function AdminScreen() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const toggleTheme = useTheme((s) => s.toggle);
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [scrolling, setScrolling] = useState(false);
  const scrollingRef = useRef(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const scrollSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markScrolling = () => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    if (!scrollingRef.current) {
      scrollingRef.current = true;
      setScrolling(true);
    }
  };
  const settleScrolling = (delay = 0) => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
    scrollSettleTimer.current = setTimeout(() => {
      scrollingRef.current = false;
      setScrolling(false);
      scrollSettleTimer.current = null;
    }, delay);
  };

  const dashQ = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminService.dashboard(),
    enabled: isAdmin,
    refetchInterval: scrolling ? false : 15_000,
    refetchOnWindowFocus: false,
  });
  const metricsQ = useQuery<Metrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data } = await (await import('@/lib/api')).api.get<Metrics>('/admin/metrics');
      return data;
    },
    enabled: isAdmin,
    refetchInterval: scrolling ? false : 5_000,
    refetchOnWindowFocus: false,
  });

  const exposureQ = useQuery<AdminExposure>({
    queryKey: ['admin-exposure'],
    queryFn: () => adminService.exposure(),
    enabled: isAdmin,
    refetchInterval: scrolling ? false : 30_000,
    refetchOnWindowFocus: false,
  });

  const [fxHours, setFxHours] = useState(24);
  const [fxChartMode, setFxChartMode] = useState<FxChartMode>('sparkline');
  const fxQ = useQuery<AdminFxStatus>({
    queryKey: ['admin-fx-status', fxHours],
    queryFn: () => adminService.fxStatus(fxHours),
    enabled: isAdmin,
    refetchInterval: scrolling ? false : 30_000,
    refetchOnWindowFocus: false,
  });

  const fundQ = useQuery<AdminFundIntegrity>({
    queryKey: ['admin-fund-integrity'],
    queryFn: () => adminService.fundIntegrity(),
    enabled: isAdmin,
    refetchInterval: scrolling ? false : 60_000,
    refetchOnWindowFocus: false,
  });
  const clearHaltMut = useMutation({
    mutationFn: () => adminService.clearTradingHalt(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fund-integrity'] }); Alert.alert('Cleared', 'Trading halt lifted.'); },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not clear'),
  });

  const reconcileMut = useMutation({
    mutationFn: (currency: string) => adminService.reconcileFundIntegrity(currency, 'Admin-confirmed credit reconciliation'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-fund-integrity'] });
      Alert.alert('Reconciled', `Recorded ${res.reconciledAmount} ${res.currency} as an admin credit. Remaining diff: ${res.diffAfter}.`);
    },
    onError: (e: any) => Alert.alert('Reconcile failed', e?.response?.data?.error ?? 'Could not reconcile'),
  });

  // Ask the admin to confirm the breach is a legitimate credit before booking it.
  const confirmReconcile = (currency: string, diff: string) => {
    Alert.alert(
      `Reconcile ${currency}?`,
      `This records ${diff} ${currency} as an admin credit (a credit reconciliation) so the books balance. ` +
        `Only do this if the funds are legitimate (e.g. opening balances / admin seeding that entered outside the deposit flow). ` +
        `No user balances change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, it was a credit', style: 'destructive', onPress: () => reconcileMut.mutate(currency) },
      ],
    );
  };

  const d = dashQ.data as AdminDashboard | undefined;
  const m = metricsQ.data;
  const exp = exposureQ.data;
  const fx = fxQ.data;
  const fund = fundQ.data;
  const stats: PeriodStats | undefined = d?.[period];
  const lastSyncAt = Math.max(
    dashQ.dataUpdatedAt || 0,
    metricsQ.dataUpdatedAt || 0,
    exposureQ.dataUpdatedAt || 0,
    fxQ.dataUpdatedAt || 0,
    fundQ.dataUpdatedAt || 0,
  );

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
  useEffect(() => () => {
    if (scrollSettleTimer.current) clearTimeout(scrollSettleTimer.current);
  }, []);
  const dotScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });

  const onRefresh = async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([dashQ.refetch(), metricsQ.refetch(), exposureQ.refetch(), fxQ.refetch(), fundQ.refetch()]);
    } finally {
      setManualRefreshing(false);
    }
  };

  const switchToUser = async () => {
    await setViewMode('user');
    router.replace('/(tabs)');
  };

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
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
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        <LoadingPulse fullscreen icon="speedometer-outline" label="Loading admin console…" />
      </View>
    );
  }

  if (dashQ.isError && !d) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        <Ionicons name="cloud-offline-outline" size={48} color={p.fgFaint} />
        <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 14, textAlign: 'center' }}>Could not load dashboard</Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
          {(dashQ.error as any)?.response?.data?.message ?? (dashQ.error as any)?.message ?? 'Check your connection or session.'}
        </Text>
        <Pressable onPress={() => dashQ.refetch()} style={{ marginTop: 24, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
          <Text style={{ color: p.fg, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <TopGradient />

      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          scrollEventThrottle={16}
          onScrollBeginDrag={markScrolling}
          onMomentumScrollEnd={() => settleScrolling()}
          onScrollEndDrag={() => settleScrolling(900)}
          refreshControl={<RefreshControl refreshing={manualRefreshing} onRefresh={onRefresh} tintColor={p.fg} />}
        >
          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={p.fg} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.greenFg, transform: [{ scale: dotScale }], opacity: dotOpacity }} />
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>LIVE</Text>
              {/* Theme toggle — cycles dark → light → mono, matching settings. */}
              <Pressable
                onPress={() => toggleTheme()}
                hitSlop={8}
                style={{ marginLeft: 8, width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}
              >
                <Ionicons
                  name={themeMode === 'light' ? 'sunny-outline' : themeMode === 'mono' ? 'contrast' : 'moon-outline'}
                  size={15}
                  color={p.fg}
                />
              </Pressable>
              <Pressable onPress={switchToUser} hitSlop={8} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                <Ionicons name="sync-outline" size={13} color={p.fgMuted} />
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700' }}>
                  {lastSyncAt ? `Synced ${new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for sync'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: fund?.tradingHalted ? p.redBg : p.greenBg, borderWidth: 1, borderColor: fund?.tradingHalted ? p.redFg : p.greenFg }}>
                <Ionicons name={fund?.tradingHalted ? 'warning-outline' : 'shield-checkmark-outline'} size={13} color={fund?.tradingHalted ? p.redFg : p.greenFg} />
                <Text style={{ color: fund?.tradingHalted ? p.redFg : p.greenFg, fontSize: 11, fontWeight: '800' }}>
                  {fund?.tradingHalted ? 'Trading halted' : 'Controls healthy'}
                </Text>
              </View>
            </View>
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
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: on ? p.accent : 'transparent', alignItems: 'center' }}
                  >
                    <Text style={{ color: on ? p.accentFg : p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'capitalize' }}>
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
              borderRadius: 16, padding: 20,
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
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader icon="flash-outline" title="Real-time" p={p} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <KpiCard label="USERS ONLINE"  value={(m?.onlineUsers ?? 0).toLocaleString()} hint={`${m?.onlineSockets ?? 0} sockets`} icon="people-outline" p={p} />
              <KpiCard label="TXS / 5MIN"    value={(m?.recentTransactions5m ?? 0).toLocaleString()} hint={`${m?.recentOrders5m ?? 0} orders`} icon="flash-outline" p={p} />
              <KpiCard label="ACTIVE USERS"  value={(d?.activeUsers ?? 0).toLocaleString()} hint={`+${d?.newUsersWeek ?? 0} this week`} icon="person-add-outline" p={p} />
              <KpiCard label="FROZEN"        value={(d?.frozenUsers ?? d?.suspendedUsers ?? 0).toLocaleString()} hint="suspended" icon="snow-outline" p={p} />
              <KpiCard label="UPTIME"        value={formatUptime(m?.uptimeSeconds ?? 0)} hint={`${m?.memoryMb ?? 0} MB`} icon="pulse-outline" p={p} />
              <KpiCard label="TOTAL USERS"   value={(d?.totalUsers ?? 0).toLocaleString()} hint={`+${d?.newUsersToday ?? 0} today`} icon="globe-outline" p={p} />
            </View>
          </View>

          {/* Platform control strip */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader icon="speedometer-outline" title="Platform control" p={p} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <KpiCard label="TX / MIN"       value={(m?.txPerMin ?? 0).toFixed(1)} hint="5 min avg" icon="speedometer-outline" p={p} />
              <KpiCard label="FEES / MIN"     value={formatUSD(m?.feesPerMin ?? 0, { compact: true })} hint={`${formatUSD(m?.commissions5mUSD ?? 0, { compact: true })} / 5m`} icon="cash-outline" p={p} />
              <KpiCard label="DEPOSITS 5M"   value={(m?.recentDeposits5m ?? 0).toLocaleString()} hint={`${d?.pendingDeposits ?? 0} pending`} icon="arrow-down-circle-outline" p={p} />
              <KpiCard label="WITHDRAWALS"   value={(m?.recentWithdrawals5m ?? 0).toLocaleString()} hint={`${d?.pendingWithdrawals ?? 0} queue`} icon="arrow-up-circle-outline" p={p} />
              <KpiCard label="P2P / 5MIN"    value={(m?.recentP2P5m ?? 0).toLocaleString()} hint="trades opened" icon="swap-horizontal-outline" p={p} />
              <KpiCard label="CARDS / 5MIN"  value={(m?.recentCardTx5m ?? 0).toLocaleString()} hint="card events" icon="card-outline" p={p} />
            </View>
          </View>

          {/* Lifetime totals strip */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader icon="infinite-outline" title="Lifetime" p={p} />
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap',
              backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border,
              overflow: 'hidden',
            }}>
              <BigCell label="TOTAL FEES" value={formatUSD(d?.totalFees ?? 0, { compact: true })} p={p} />
              <BigCell label="TOTAL VOLUME" value={formatUSD(d?.totalVolume ?? 0, { compact: true })} p={p} />
              <BigCell label="TRANSACTIONS" value={(d?.totalTransactions ?? 0).toLocaleString()} p={p} />
              <BigCell label="DEPOSITS USD" value={formatUSD(d?.totalDepositsUSD ?? 0, { compact: true })} p={p} last />
            </View>
          </View>

          {/* Exposure & total holdings */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader
              icon="wallet-outline"
              title="Exposure & holdings"
              right={exp ? <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700' }}>spread {(exp.spreadPct * 100).toFixed(2)}%</Text> : undefined}
              p={p}
            />

            <View style={{ borderRadius: 16, padding: 20, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
              <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.7 }}>
                TOTAL USER HOLDINGS · ALL PLATFORMS
              </Text>
              <Text style={{ color: p.fg, fontSize: 36, fontWeight: '600', letterSpacing: -1.2, marginTop: 6, fontVariant: ['tabular-nums'] }}>
                {exposureQ.isLoading && !exp ? '—' : formatUSD(exp?.totals.totalHoldingsUsd ?? 0)}
              </Text>

              <View style={{ height: 1, backgroundColor: p.border, marginVertical: 14 }} />

              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>CRYPTO</Text>
                  <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>{formatUSD(exp?.totals.cryptoValueUsd ?? 0, { compact: true })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>FIAT</Text>
                  <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>{formatUSD(exp?.totals.fiatValueUsd ?? 0, { compact: true })}</Text>
                </View>
              </View>
            </View>

            {/* Instant-liquidation exposure */}
            <View style={{ marginTop: 10, borderRadius: 16, padding: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={15} color={p.redFg} />
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>If all users sold instantly</Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 4 }}>
                Payout owed at our sell price (market − spread):
              </Text>
              <Text style={{ color: p.redFg, fontSize: 26, fontWeight: '700', marginTop: 6, fontVariant: ['tabular-nums'] }}>
                {formatUSD(exp?.totals.exposureUsd ?? 0)}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>Spread cushion retained</Text>
                <Text style={{ color: p.greenFg, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  +{formatUSD(exp?.totals.spreadCushionUsd ?? 0)}
                </Text>
              </View>
            </View>

            {/* Top holdings breakdown */}
            {!!exp?.crypto?.length && (
              <View style={{ marginTop: 10, backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
                {exp.crypto.slice(0, 6).map((row, i, arr) => (
                  <View key={row.symbol} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{row.symbol}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatUSD(row.valueUsd, { compact: true })}</Text>
                      <Text style={{ color: p.fgFaint, fontSize: 10, fontVariant: ['tabular-nums'] }}>
                        {row.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} @ {formatUSD(row.price, { compact: true })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!!exp?.unpriced?.length && (
              <Text style={{ color: p.fgFaint, fontSize: 10, marginTop: 8 }}>
                Excludes (no price): {exp.unpriced.join(', ')}
              </Text>
            )}
          </View>

          {/* Treasury integrity — fund audit + ledger reconciliation */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader
              icon="shield-checkmark-outline"
              title="Treasury integrity"
              right={fund ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: fund.tradingHalted ? p.redBg : p.greenBg }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: fund.tradingHalted ? p.redFg : p.greenFg }} />
                  <Text style={{ color: fund.tradingHalted ? p.redFg : p.greenFg, fontSize: 10, fontWeight: '800' }}>{fund.tradingHalted ? 'HALTED' : 'OK'}</Text>
                </View>
              ) : undefined}
              p={p}
            />

            {fund?.tradingHalted && (
              <View style={{ marginBottom: 10, borderRadius: 16, padding: 14, backgroundColor: p.redBg, borderWidth: 1, borderColor: p.redFg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="warning" size={18} color={p.redFg} />
                  <Text style={{ color: p.redFg, fontSize: 14, fontWeight: '800' }}>TRADING HALTED</Text>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 6 }}>
                  A money-conservation check failed. Trading is blocked until you investigate and clear it.
                </Text>
                <Pressable
                  onPress={() => clearHaltMut.mutate()}
                  disabled={clearHaltMut.isPending}
                  style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: p.redFg }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{clearHaltMut.isPending ? 'Clearing…' : 'Clear halt'}</Text>
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, borderRadius: 16, padding: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>FUND AUDIT</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Ionicons name={fund?.funds.ok ? 'checkmark-circle' : 'information-circle'} size={16} color={fund?.funds.ok ? p.greenFg : p.amberFg} />
                  <Text style={{ color: fund?.funds.ok ? p.greenFg : p.amberFg, fontSize: 15, fontWeight: '700' }}>{fund ? (fund.funds.ok ? 'Balanced' : 'Review') : '—'}</Text>
                </View>
                <Text style={{ color: p.fgFaint, fontSize: 9, marginTop: 4 }}>internal balances vs net deposits</Text>
              </View>
              <View style={{ flex: 1, borderRadius: 16, padding: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>LEDGER</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Ionicons name={fund?.ledger.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={fund?.ledger.ok ? p.greenFg : p.redFg} />
                  <Text style={{ color: fund?.ledger.ok ? p.greenFg : p.redFg, fontSize: 15, fontWeight: '700' }}>{fund ? (fund.ledger.ok ? 'Reconciled' : 'BROKEN') : '—'}</Text>
                </View>
                <Text style={{ color: p.fgFaint, fontSize: 9, marginTop: 4 }}>double-entry conservation</Text>
              </View>
            </View>

            {/* Explain the (non-contradictory) "review + reconciled" combo. */}
            {fund && !fund.funds.ok && fund.ledger.ok && (
              <View style={{ flexDirection: 'row', gap: 8, padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: p.amberBg, borderWidth: 1, borderColor: p.amberFg + '40' }}>
                <Ionicons name="information-circle-outline" size={16} color={p.amberFg} />
                <Text style={{ flex: 1, color: p.fgMuted, fontSize: 11, lineHeight: 16 }}>
                  Books are internally consistent (ledger reconciled — no money created or lost). The amounts below entered outside the deposit flow (opening balances / admin seeding) and just need a recorded source for full attribution.
                </Text>
              </View>
            )}

            {/* Per-currency drift rows (only show non-OK to keep it tight) */}
            {!!fund?.funds.perCurrency?.some((c) => !c.ok) && (
              <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
                {fund.funds.perCurrency.filter((c) => !c.ok).slice(0, 8).map((c) => {
                  const positive = !String(c.diff).trim().startsWith('-'); // only a positive diff is a credit recon
                  return (
                    <View key={c.currency} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.border }}>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{c.currency}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>off by {c.diff}</Text>
                        {positive ? (
                          <Pressable
                            onPress={() => confirmReconcile(c.currency, c.diff)}
                            disabled={reconcileMut.isPending}
                            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: p.amberFg, opacity: reconcileMut.isPending ? 0.6 : 1 }}
                          >
                            <Text style={{ color: '#1a1a1a', fontSize: 11, fontWeight: '800' }}>{reconcileMut.isPending && reconcileMut.variables === c.currency ? 'Reconciling…' : 'Reconcile'}</Text>
                          </Pressable>
                        ) : (
                          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600' }}>investigate (leak)</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* FX — USD/LYD order book + scraped parallel rates */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader
              icon="git-compare-outline"
              title="FX · USD/LYD order book"
              right={(
                <Pressable onPress={() => router.push('/admin/rates' as any)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={{ color: p.accent, fontSize: 11, fontWeight: '800' }}>Manage</Text>
                  <Ionicons name="chevron-forward" size={13} color={p.accent} />
                </Pressable>
              )}
              p={p}
            />

            <View style={{ borderRadius: 16, padding: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
              {/* Current rate + skew */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>USD/LYD (LIVE)</Text>
                  <Text style={{ color: p.fg, fontSize: 30, fontWeight: '600', letterSpacing: -1, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                    {fx?.usdLydHistory?.length ? fx.usdLydHistory[fx.usdLydHistory.length - 1].price.toFixed(4) : (fx?.lydParallelScraped?.USD?.toFixed(4) ?? '—')}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 10, marginTop: 2 }}>
                    floor {fx?.lydParallelScraped?.USD?.toFixed(4) ?? '—'} (street)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                    backgroundColor: (fx?.lydOrderBook.skewPct ?? 0) > 0 ? p.greenBg : p.pillBg,
                  }}>
                    <Ionicons name="trending-up" size={12} color={(fx?.lydOrderBook.skewPct ?? 0) > 0 ? p.greenFg : p.fgMuted} />
                    <Text style={{ color: (fx?.lydOrderBook.skewPct ?? 0) > 0 ? p.greenFg : p.fgMuted, fontSize: 12, fontWeight: '700' }}>
                      +{((fx?.lydOrderBook.skewPct ?? 0) * 100).toFixed(2)}% skew
                    </Text>
                  </View>
                  <Text style={{ color: p.fgFaint, fontSize: 10, marginTop: 4 }}>
                    net flow {fmtSignedUsd(fx?.lydOrderBook.netUsd ?? 0)}
                  </Text>
                </View>
              </View>

              {/* Range + chart type picker */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {([[6, '6h'], [24, '24h'], [72, '3d'], [168, '7d']] as [number, string][]).map(([h, lbl]) => (
                    <Pressable key={h} onPress={() => setFxHours(h)} style={{
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                      backgroundColor: fxHours === h ? p.accent : 'transparent',
                      borderWidth: 1, borderColor: fxHours === h ? p.accent : p.border,
                    }}>
                      <Text style={{ color: fxHours === h ? p.accentFg : p.fgMuted, fontSize: 11, fontWeight: '700' }}>{lbl}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: p.pillBg, borderRadius: 9, padding: 2, borderWidth: 1, borderColor: p.border }}>
                  {([
                    ['sparkline', 'analytics-outline'],
                    ['candles', 'stats-chart-outline'],
                  ] as [FxChartMode, keyof typeof Ionicons.glyphMap][]).map(([mode, icon]) => {
                    const active = fxChartMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => setFxChartMode(mode)}
                        hitSlop={6}
                        style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: active ? p.ctaBg : 'transparent' }}
                      >
                        <Ionicons name={icon} size={13} color={active ? p.ctaFg : p.fgMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Price + volume chart */}
              <FxChart history={fx?.usdLydHistory ?? []} p={p} showVolume={fxChartMode === 'sparkline'} mode={fxChartMode} />
            </View>

            {/* Live parallel rates table — Fulus-first, scraper only as backend fallback. */}
            {((fx?.currencies?.some((c) => c.buyPrice != null && c.sellPrice != null)) || (fx?.lydParallelScraped && Object.keys(fx.lydParallelScraped).length > 0)) && (
              <View style={{ marginTop: 10, backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
                <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, padding: 12, paddingBottom: 6 }}>
                  PARALLEL RATES (LYD per unit · live)
                </Text>
                {(fx?.currencies?.some((c) => c.buyPrice != null && c.sellPrice != null)
                  ? fx.currencies
                      .filter((c) => c.buyPrice != null && c.sellPrice != null)
                      .map((c) => [c.code, ((c.buyPrice! + c.sellPrice!) / 2), c.source] as const)
                  : Object.entries(fx?.lydParallelScraped ?? {}).map(([cur, val]) => [cur, Number(val), 'scrape'] as const)
                ).map(([cur, val, source]) => (
                    <View key={cur} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: p.border }}>
                      <View>
                        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{cur}/LYD</Text>
                        <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700', marginTop: 1 }}>
                          {String(source ?? '').includes('fulus') ? 'FULUS' : String(source ?? 'LIVE').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{Number(val).toFixed(2)}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>

          {/* Pending action queue */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            {(() => {
              const totalPending = (d?.pendingKYC ?? 0) + (d?.pendingDeposits ?? 0) + (d?.pendingWithdrawals ?? 0);
              return (
                <SectionHeader
                  icon="alert-circle-outline"
                  title="Needs attention"
                  right={(
                    <View style={{ minWidth: 22, paddingHorizontal: 7, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: totalPending > 0 ? p.amberBg : p.greenBg }}>
                      <Text style={{ color: totalPending > 0 ? p.amberFg : p.greenFg, fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{totalPending}</Text>
                    </View>
                  )}
                  p={p}
                />
              );
            })()}
            <ActionRow icon="document-text-outline"   label="KYC Reviews"             count={d?.pendingKYC ?? 0}         onPress={() => router.push('/admin/kyc' as any)} p={p} />
            <ActionRow icon="arrow-down-circle-outline" label="Deposits Awaiting"     count={d?.pendingDeposits ?? 0}    onPress={() => router.push('/admin/deposits' as any)} p={p} />
            <ActionRow icon="arrow-up-circle-outline"  label="Withdrawal Queue"        count={d?.pendingWithdrawals ?? 0} onPress={() => router.push('/admin/withdrawals' as any)} p={p} />
            <ActionRow icon="person-add-outline"       label="Create Relationship User"                                  onPress={() => router.push('/admin/users' as any)} p={p} />
            <ActionRow icon="warning-outline"          label="Escalated P2P / Support"                                    onPress={() => router.push('/admin/escalations' as any)} p={p} />
            <ActionRow icon="chatbubble-ellipses-outline" label="Support Chats"                                          onPress={() => router.push('/admin/support' as any)} p={p} />
          </View>

          {/* Trade flow */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader icon="swap-vertical-outline" title="Trade flow" p={p} />
            <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>{PERIOD_LABEL[period].current} Volume</Text>
                <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {formatUSD(stats?.volume ?? 0, { compact: true })}
                </Text>
              </View>
              <BuySellBar buys={d?.buyOrders ?? 0} sells={d?.sellOrders ?? 0} p={p} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: p.greenFg, fontSize: 11, fontWeight: '600' }}>BUY · {(d?.buyOrders ?? 0).toLocaleString()}</Text>
                <Text style={{ color: p.redFg, fontSize: 11, fontWeight: '600' }}>SELL · {(d?.sellOrders ?? 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Top pairs */}
          {!!d?.ordersByPair?.length && (
            <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
              <SectionHeader icon="podium-outline" title="Top pairs by order count" p={p} />
              <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
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
            <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
              <SectionHeader icon="people-circle-outline" title="User growth · 7 days" p={p} />
              <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16 }}>
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
            <View style={{ marginTop: 24, marginHorizontal: 20 }}>
              <View style={{
                borderRadius: 16, padding: 14,
                backgroundColor: p.amberBg,
                borderWidth: 1, borderColor: p.amberFg + '40',
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <Ionicons name="flash-outline" size={22} color={p.amberFg} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>Backfill historical fees</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>Import fees from existing orders, withdrawals, and P2P trades into the platform ledger.</Text>
                </View>
                <Pressable
                  onPress={() => backfillMut.mutate()}
                  disabled={backfillMut.isPending}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: p.amberFg }}
                >
                  <Text style={{ color: '#1a1a1a', fontSize: 12, fontWeight: '700' }}>
                    {backfillMut.isPending ? 'Importing…' : 'Run'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Manage — grouped, collapsible. Replaces the flat 21-tile wall that
              forced a long scroll. Groups open on tap; Trading is open by default
              since rates/orders are the most-touched. */}
          <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
            <SectionHeader icon="grid-outline" title="Manage" p={p} />
            {NAV_GROUPS.map((g) => (
              <NavGroup
                key={g.title}
                group={g}
                open={openGroups[g.title] ?? g.defaultOpen ?? false}
                onToggle={() => setOpenGroups((s) => ({ ...s, [g.title]: !(s[g.title] ?? g.defaultOpen ?? false) }))}
                onNavigate={(route) => router.push(route as any)}
                p={p}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── helpers ────────────────────────────────────────── */

function DeltaRow({ current, prev, delta, prevLabel, p }: { current: number; prev: number; delta: number; prevLabel: string; p: any }) {
  const positive = delta >= 0;
  const color = positive ? p.greenFg : p.redFg;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
        backgroundColor: positive ? p.greenBg : p.redBg,
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
  const color = positive ? p.greenFg : p.redFg;
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

/**
 * Consistent section header — neutral by design. Colour in a control panel is
 * reserved for STATE (halted, pending, up/down); decorating every section with
 * its own hue reads as a consumer app, not an ops console. State, when there
 * is one, arrives via the `right` accessory (already tinted by the caller).
 */
function SectionHeader({ icon, title, right, p }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  right?: ReactNode;
  p: any;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}>
        <Ionicons name={icon} size={13} color={p.fgMuted} />
      </View>
      <Text style={{ flex: 1, color: p.fg, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 }}>{title}</Text>
      {right}
    </View>
  );
}

function KpiCard({ label, value, hint, icon, p }: { label: string; value: string; hint?: string; icon: keyof typeof Ionicons.glyphMap; p: any }) {
  return (
    <View style={{ width: '48%', backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>{label}</Text>
        <Ionicons name={icon} size={14} color={p.fgFaint} />
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
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: urgent ? p.redBg : p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={urgent ? p.redFg : p.fg} />
      </View>
      <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      {hasCount ? (
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: urgent ? p.redFg : p.pillBg }}>
          <Text style={{ color: urgent ? '#fff' : p.fgMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{(count ?? 0).toLocaleString()}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
      )}
    </Pressable>
  );
}

/**
 * Collapsible navigation group rendered as a single card: header row toggles
 * a settings-style row list. List rows beat a tile grid for an ops console —
 * labels left-aligned on one scan line, bigger touch targets, and the card
 * reads as one unit instead of a mosaic.
 */
function NavGroup({ group, open, onToggle, onNavigate, p }: {
  group: NavGroupDef;
  open: boolean;
  onToggle: () => void;
  onNavigate: (route: string) => void;
  p: any;
}) {
  return (
    <View style={{
      marginBottom: 10, borderRadius: 16, overflow: 'hidden',
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
    }}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, paddingVertical: 13,
          backgroundColor: pressed ? p.pillBg : 'transparent',
        })}
      >
        <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}>
          <Ionicons name={group.icon} size={15} color={p.fgMuted} />
        </View>
        <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 }}>{group.title}</Text>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{group.items.length}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={p.fgFaint} />
      </Pressable>
      {open && group.items.map((it) => (
        <Pressable
          key={it.route}
          onPress={() => onNavigate(it.route)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingVertical: 12, paddingLeft: 18, paddingRight: 14,
            borderTopWidth: 1, borderTopColor: p.border,
            backgroundColor: pressed ? p.pillBg : 'transparent',
          })}
        >
          <Ionicons name={it.icon} size={17} color={p.fgMuted} />
          <Text style={{ flex: 1, color: p.fg, fontSize: 13.5, fontWeight: '600' }}>{it.label}</Text>
          <Ionicons name="chevron-forward" size={14} color={p.fgFaint} />
        </Pressable>
      ))}
    </View>
  );
}

function BuySellBar({ buys, sells, p }: { buys: number; sells: number; p: any }) {
  const total = buys + sells || 1;
  const buyPct = (buys / total) * 100;
  return (
    <View style={{ height: 8, backgroundColor: p.pillBg, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginTop: 14 }}>
      <View style={{ width: `${buyPct}%`, backgroundColor: p.greenFg }} />
      <View style={{ flex: 1, backgroundColor: p.redFg }} />
    </View>
  );
}
