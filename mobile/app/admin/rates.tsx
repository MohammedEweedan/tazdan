import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin Rates — a USD/LYD price chart on top, with the editable rate pairs
 * below it. Each pair shows the STORED value next to the current LIVE value so
 * a stale override is obvious. Admins can override buy/sell, refresh from
 * upstream (which clears the override), or clear an override to fall back to live.
 */

import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService, type AdminFxStatus } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';
import { FxChart, type FxChartMode } from '@/components/admin/FxChart';

type Rate = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  buyPrice: number;
  sellPrice: number;
  isActive: boolean;
  setBy?: string | null;
  setByUser?: { firstName?: string; lastName?: string; email?: string } | null;
  updatedAt: string;
  // Decorated by the backend: the current live provider rate, override-bypassed.
  live?: { buyPrice: number; sellPrice: number; source: string } | null;
  // Decorated by the backend: the rate users actually get right now.
  effective?: { buyPrice: number; sellPrice: number; source: string; fetchedAt?: string } | null;
};

export default function AdminRates() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Rate | null>(null);
  const [creating, setCreating] = useState(false);
  const [chartMode, setChartMode] = useState<FxChartMode>('sparkline');

  const q = useQuery({
    queryKey: ['admin-rates'],
    queryFn: () => adminService.rates(),
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  // USD/LYD price history for the chart.
  const fxQ = useQuery<AdminFxStatus>({
    queryKey: ['admin-fx-status', 24],
    queryFn: () => adminService.fxStatus(24),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  const refreshMut = useMutation({
    mutationFn: ({ base, quote }: { base: string; quote: string }) => adminService.refreshRate(base, quote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rates'] });
      qc.invalidateQueries({ queryKey: ['admin-fx-status'] });
    },
  });

  const clearMut = useMutation({
    mutationFn: ({ base, quote }: { base: string; quote: string }) => adminService.clearRateOverride(base, quote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rates'] });
      qc.invalidateQueries({ queryKey: ['admin-fx-status'] });
    },
  });

  const rates = useMemo<Rate[]>(() => {
    const list: Rate[] = (q.data?.rates ?? []) as Rate[];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((r) => `${r.baseCurrency}${r.quoteCurrency}`.toLowerCase().includes(s.replace('/', '')));
  }, [q.data, search]);

  const usdLyd = fxQ.data?.currencies?.find((c) => c.code === 'USD');
  const usdHistory = fxQ.data?.usdLydHistory ?? [];
  const usdMid = usdLyd?.buyPrice != null && usdLyd?.sellPrice != null
    ? (usdLyd.buyPrice + usdLyd.sellPrice) / 2
    : null;

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <TopGradient />
        <Text style={{ color: p.fg }}>Admin only</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="Exchange Rates" right={<><Pressable onPress={() => setCreating(true)} hitSlop={8} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: p.ctaBg, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={15} color={p.ctaFg} />
            <Text style={{ color: p.ctaFg, fontSize: 12, fontWeight: '600' }}>NEW</Text>
          </Pressable></>} />

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => { q.refetch(); fxQ.refetch(); }} tintColor={p.fg} />}
        >
          {/* ── USD/LYD chart ─────────────────────────────────────────────── */}
          <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>USD/LYD</Text>
                <Text style={{ color: p.fg, fontSize: 26, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'], marginTop: 2 }}>
                  {usdMid != null ? usdMid.toFixed(4) : '—'}
                </Text>
                <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 1 }}>LYD per 1 USD · parallel market</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.greenFg }} />
                <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                  {usdLyd?.source?.includes('fulus') ? 'FULUS LIVE' : usdLyd?.source?.startsWith('live') ? 'LIVE' : (usdLyd?.source?.toUpperCase() ?? '—')}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignSelf: 'flex-start', gap: 6, marginTop: 12, backgroundColor: p.pillBg, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: p.border }}>
              {([
                ['sparkline', 'analytics-outline', 'Line'],
                ['candles', 'stats-chart-outline', 'Candles'],
              ] as [FxChartMode, keyof typeof Ionicons.glyphMap, string][]).map(([mode, icon, label]) => {
                const active = chartMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setChartMode(mode)}
                    hitSlop={6}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: active ? p.ctaBg : 'transparent',
                    }}
                  >
                    <Ionicons name={icon} size={13} color={active ? p.ctaFg : p.fgMuted} />
                    <Text style={{ color: active ? p.ctaFg : p.fgMuted, fontSize: 11, fontWeight: '800' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <FxChart history={usdHistory} p={p} showVolume={chartMode === 'sparkline'} mode={chartMode} />
          </View>

          {/* ── Editable pairs ────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 42, marginBottom: 12 }}>
            <Ionicons name="search" size={15} color={p.fgFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search pair (e.g. USD/LYD)"
              placeholderTextColor={p.fgFaint}
              autoCapitalize="characters"
              style={{ flex: 1, color: p.fg, fontSize: 13, fontWeight: '600' }}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={15} color={p.fgFaint} />
              </Pressable>
            )}
          </View>

          {q.isLoading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}><LoadingPulse size={56} icon="trending-up-outline" label="Loading rates…" /></View>
          ) : rates.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="trending-up-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>No rates {search ? 'match' : 'configured'}</Text>
            </View>
          ) : (
            rates.map((r) => (
              <RateCard
                key={r.id}
                r={r}
                p={p}
                onEdit={() => setEditing(r)}
                onRefresh={() => Alert.alert('Refresh from upstream?', `Pull live ${r.baseCurrency}/${r.quoteCurrency} and clear any override?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Refresh', onPress: () => refreshMut.mutate({ base: r.baseCurrency, quote: r.quoteCurrency }) },
                ])}
                onClear={() => Alert.alert('Clear override?', `Restore live FX for ${r.baseCurrency}/${r.quoteCurrency}? Users will see the upstream rate again.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: () => clearMut.mutate({ base: r.baseCurrency, quote: r.quoteCurrency }) },
                ])}
              />
            ))
          )}
        </ScrollView>

        {/* Edit modal */}
        {!!editing && (
          <RateForm
            mode="edit"
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin-rates'] }); }}
            p={p}
          />
        )}

        {/* Create modal */}
        {creating && (
          <RateForm
            mode="create"
            initial={null}
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin-rates'] }); }}
            p={p}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

/** One editable rate pair card with stored-vs-live and action buttons. */
function RateCard({ r, p, onEdit, onRefresh, onClear }: { r: Rate; p: any; onEdit: () => void; onRefresh: () => void; onClear: () => void }) {
  const storedMid = (r.buyPrice + r.sellPrice) / 2;
  const liveMid = r.live ? (r.live.buyPrice + r.live.sellPrice) / 2 : null;
  const effective = r.effective ?? (!r.isActive && r.live ? r.live : null);
  const shownBuy = effective?.buyPrice ?? r.buyPrice;
  const shownSell = effective?.sellPrice ?? r.sellPrice;
  const effectiveMid = effective ? (effective.buyPrice + effective.sellPrice) / 2 : storedMid;
  const effectiveSource = effective?.source ?? (r.isActive ? 'admin:stored' : r.live?.source ?? 'stored');
  const activeOverride = effectiveSource.startsWith('admin:');
  const staleOverride = r.isActive && !activeOverride && liveMid != null;
  const liveLabel = effectiveSource.startsWith('live:fulus')
    ? 'FULUS LIVE'
    : effectiveSource.includes('lyd-parallel-scrape')
      ? 'SCRAPE FALLBACK'
    : effectiveSource.startsWith('live:')
      ? effectiveSource.replace('live:', '').toUpperCase()
      : effectiveSource.startsWith('derived:')
        ? `DERIVED ${effectiveSource.replace('derived:', '').toUpperCase()}`
        : effectiveSource.startsWith('fallback:')
          ? 'FALLBACK'
          : activeOverride
            ? 'OVERRIDE'
            : 'LIVE FX';
  // Flag a meaningful gap between the override and the live market (>0.5%).
  const drift = r.isActive && liveMid != null && storedMid > 0 ? Math.abs(storedMid - liveMid) / liveMid : 0;
  const stale = drift > 0.005;
  const shownMid = (shownBuy + shownSell) / 2;
  const shownSpread = shownMid > 0 ? Math.abs(shownBuy - shownSell) / shownMid * 100 : 0;

  return (
    <View style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: stale ? 'rgba(245,158,11,0.45)' : (activeOverride ? p.border : 'rgba(99,161,219,0.25)'), padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: p.fg }}>
          <Text style={{ color: p.bg, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }}>{r.baseCurrency}/{r.quoteCurrency}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>
            SPREAD {shownSpread.toFixed(2)}%
          </Text>
          {r.setByUser && (
            <Text style={{ color: p.fgFaint, fontSize: 10 }}>
              OVERRIDE by {r.setByUser.firstName ?? r.setByUser.email}
            </Text>
          )}
        </View>
        <View style={{
          paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
          backgroundColor: activeOverride ? 'rgba(245,158,11,0.15)' : 'rgba(99,161,219,0.15)',
        }}>
          <Text style={{ color: activeOverride ? '#f59e0b' : p.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 }}>
            {liveLabel}
          </Text>
        </View>
      </View>

      {/* Stored-vs-live: surfaced for active/stale overrides so frozen values are obvious. */}
      {(r.isActive || staleOverride) && liveMid != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: p.pillBg }}>
          <Ionicons name={stale || staleOverride ? 'warning' : 'information-circle-outline'} size={14} color={stale || staleOverride ? '#f59e0b' : p.fgMuted} />
          <Text style={{ flex: 1, color: p.fgMuted, fontSize: 11 }}>
            Stored <Text style={{ color: p.fg, fontWeight: '700' }}>{storedMid.toFixed(4)}</Text> · live <Text style={{ color: p.fg, fontWeight: '700' }}>{liveMid.toFixed(4)}</Text> · shown <Text style={{ color: p.fg, fontWeight: '700' }}>{effectiveMid.toFixed(4)}</Text>
            {stale ? `  (${((storedMid - liveMid) / liveMid * 100).toFixed(1)}% off)` : staleOverride ? '  (stored override expired)' : ''}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
          <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>BUY</Text>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {shownBuy.toLocaleString('en-US', { maximumFractionDigits: 8 })}
          </Text>
        </View>
        <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
          <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>SELL</Text>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
            {shownSell.toLocaleString('en-US', { maximumFractionDigits: 8 })}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={onEdit}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.ctaBg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
        >
          <Ionicons name="pencil" size={13} color={p.ctaFg} />
          <Text style={{ color: p.ctaFg, fontSize: 12, fontWeight: '600' }}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={onRefresh}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
        >
          <Ionicons name="refresh" size={13} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Go live</Text>
        </Pressable>
        {r.isActive && (
          <Pressable
            onPress={onClear}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
          >
            <Ionicons name="close" size={13} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function RateForm({ mode, initial, onClose, onSaved, p }: { mode: 'create' | 'edit'; initial: Rate | null; onClose: () => void; onSaved: () => void; p: any }) {
  const [base,  setBase]  = useState(initial?.baseCurrency  ?? '');
  const [quote, setQuote] = useState(initial?.quoteCurrency ?? '');
  const [buy,   setBuy]   = useState(initial?.buyPrice  != null ? String(initial.buyPrice)  : '');
  const [sell,  setSell]  = useState(initial?.sellPrice != null ? String(initial.sellPrice) : '');

  const mut = useMutation({
    mutationFn: async () => {
      const buyNum  = Number(buy);
      const sellNum = Number(sell);
      if (!buyNum || !sellNum || buyNum <= sellNum) {
        throw new Error('Buy price must be greater than sell price and both must be positive');
      }
      const baseU  = base.trim().toUpperCase();
      const quoteU = quote.trim().toUpperCase();
      if (mode === 'create') {
        if (!baseU || !quoteU) throw new Error('Both currencies are required');
        return adminService.createRate({ baseCurrency: baseU, quoteCurrency: quoteU, buyPrice: buyNum, sellPrice: sellNum });
      }
      return adminService.updateRate(baseU, quoteU, { buyPrice: buyNum, sellPrice: sellNum });
    },
    onSuccess: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onSaved(); },
    onError: (e: any) => Alert.alert('Save failed', e?.response?.data?.error ?? e?.message ?? 'Try again'),
  });

  return (
    <BottomSheet visible onClose={onClose} title={mode === 'create' ? 'Create Pair' : `Edit ${base}/${quote}`}>

        {mode === 'create' && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 }}>BASE</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12 }}>
                <TextInput value={base} onChangeText={setBase} placeholder="USD" placeholderTextColor={p.fgFaint} autoCapitalize="characters" maxLength={6} style={{ color: p.fg, fontSize: 16, fontWeight: '600', paddingVertical: 12 }} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 }}>QUOTE</Text>
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12 }}>
                <TextInput value={quote} onChangeText={setQuote} placeholder="LYD" placeholderTextColor={p.fgFaint} autoCapitalize="characters" maxLength={6} style={{ color: p.fg, fontSize: 16, fontWeight: '600', paddingVertical: 12 }} />
              </View>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 }}>BUY PRICE</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12 }}>
              <TextInput value={buy} onChangeText={setBuy} placeholder="0.00" placeholderTextColor={p.fgFaint} keyboardType="decimal-pad" style={{ color: p.fg, fontSize: 16, fontWeight: '600', paddingVertical: 12 }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 5 }}>SELL PRICE</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12 }}>
              <TextInput value={sell} onChangeText={setSell} placeholder="0.00" placeholderTextColor={p.fgFaint} keyboardType="decimal-pad" style={{ color: p.fg, fontSize: 16, fontWeight: '600', paddingVertical: 12 }} />
            </View>
          </View>
        </View>

        {!!Number(buy) && !!Number(sell) && Number(buy) > Number(sell) && (
          <View style={{ backgroundColor: p.pillBg, padding: 10, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fgMuted, fontSize: 11 }}>
              Spread: <Text style={{ color: p.fg, fontWeight: '600' }}>{(((Number(buy) - Number(sell)) / Number(sell)) * 100).toFixed(2)}%</Text>
            </Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={onClose} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => mut.mutate()}
            disabled={mut.isPending}
            style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.ctaFg, fontWeight: '600' }}>{mut.isPending ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
    </BottomSheet>
  );
}
