/**
 * Admin Rates — manual exchange-rate control. Lists every pair, lets
 * admins override buy/sell prices, add new pairs, refresh from the
 * upstream FX provider, or clear an override and fall back to live.
 */

import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';

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

  const q = useQuery({
    queryKey: ['admin-rates'],
    queryFn: () => adminService.rates(),
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const refreshMut = useMutation({
    mutationFn: ({ base, quote }: { base: string; quote: string }) => adminService.refreshRate(base, quote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rates'] }),
  });

  const clearMut = useMutation({
    mutationFn: ({ base, quote }: { base: string; quote: string }) => adminService.clearRateOverride(base, quote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rates'] }),
  });

  const rates = useMemo<Rate[]>(() => {
    const list: Rate[] = (q.data?.rates ?? []) as Rate[];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((r) => `${r.baseCurrency}${r.quoteCurrency}`.toLowerCase().includes(s.replace('/', '')));
  }, [q.data, search]);

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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Exchange Rates</Text>
          <Pressable onPress={() => setCreating(true)} hitSlop={8} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: p.ctaBg, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="add" size={15} color={p.ctaFg} />
            <Text style={{ color: p.ctaFg, fontSize: 12, fontWeight: '600' }}>NEW</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 42 }}>
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
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={p.fg} />}>
          {q.isLoading ? (
            <View style={{ paddingTop: 80, alignItems: 'center' }}><LoadingPulse size={56} icon="trending-up-outline" label="Loading rates…" /></View>
          ) : rates.length === 0 ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Ionicons name="trending-up-outline" size={42} color={p.fgFaint} />
              <Text style={{ color: p.fgMuted, marginTop: 10 }}>No rates {search ? 'match' : 'configured'}</Text>
            </View>
          ) : (
            rates.map((r) => (
              <View key={r.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: r.isActive ? p.border : 'rgba(239,68,68,0.3)', padding: 14, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: p.fg }}>
                    <Text style={{ color: p.bg, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }}>{r.baseCurrency}/{r.quoteCurrency}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>
                      SPREAD {(((r.buyPrice - r.sellPrice) / r.sellPrice) * 100).toFixed(2)}%
                    </Text>
                    {r.setByUser && (
                      <Text style={{ color: p.fgFaint, fontSize: 10 }}>
                        OVERRIDE by {r.setByUser.firstName ?? r.setByUser.email}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                    backgroundColor: r.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  }}>
                    <Text style={{ color: r.isActive ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 }}>
                      {r.isActive ? 'OVERRIDE' : 'LIVE FX'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.10)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)' }}>
                    <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>BUY</Text>
                    <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                      {r.buyPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </Text>
                  </View>
                  <View style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                    <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>SELL</Text>
                    <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] }}>
                      {r.sellPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable
                    onPress={() => setEditing(r)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.ctaBg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
                  >
                    <Ionicons name="pencil" size={13} color={p.ctaFg} />
                    <Text style={{ color: p.ctaFg, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Alert.alert('Refresh from upstream?', `Pull live ${r.baseCurrency}/${r.quoteCurrency} from FX provider?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Refresh', onPress: () => refreshMut.mutate({ base: r.baseCurrency, quote: r.quoteCurrency }) },
                    ])}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
                  >
                    <Ionicons name="refresh" size={13} color={p.fg} />
                    <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Refresh</Text>
                  </Pressable>
                  {r.isActive && (
                    <Pressable
                      onPress={() => Alert.alert('Clear override?', `Restore live FX for ${r.baseCurrency}/${r.quoteCurrency}? Users will see the upstream rate again.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: () => clearMut.mutate({ base: r.baseCurrency, quote: r.quoteCurrency }) },
                      ])}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
                    >
                      <Ionicons name="close" size={13} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Clear</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Edit modal */}
        <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
          <RateForm
            mode="edit"
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['admin-rates'] }); }}
            p={p}
          />
        </Modal>

        {/* Create modal */}
        <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
          <RateForm
            mode="create"
            initial={null}
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin-rates'] }); }}
            p={p}
          />
        </Modal>
      </SafeAreaView>
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
          {mode === 'create' ? 'Create Pair' : `Edit ${base}/${quote}`}
        </Text>

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
      </View>
    </KeyboardAvoidingView>
  );
}
