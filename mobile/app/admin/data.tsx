/**
 * Admin Database Browser — paginated reads of every core table.
 * Each tab shows raw rows with key columns surfaced + JSON drill-down on tap.
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { formatRelativeTime } from '@/utils/format';
import { TopGradient } from '@/components/ui/ScreenShell';

type Tab =
  | 'TRANSACTIONS' | 'P2P_TRADES' | 'P2P_LISTINGS' | 'P2P_DISPUTES'
  | 'WALLETS' | 'CARDS' | 'CARD_TXS' | 'BANKS'
  | 'MESSAGES' | 'REPORTS' | 'REFERRALS'
  | 'SESSIONS' | 'LOGINS' | 'API_KEYS'
  | 'WHATSAPP' | 'ONRAMPS' | 'OFFRAMPS'
  | 'MARKETS' | 'ONCHAIN' | 'TRANSFERS' | 'NOTIFICATIONS' | 'PLATFORM_BANKS' | 'FEES';

const TABS: { key: Tab; label: string }[] = [
  { key: 'TRANSACTIONS',   label: 'Transactions' },
  { key: 'P2P_TRADES',     label: 'P2P Trades' },
  { key: 'P2P_LISTINGS',   label: 'P2P Listings' },
  { key: 'P2P_DISPUTES',   label: 'P2P Disputes' },
  { key: 'WALLETS',        label: 'Wallets' },
  { key: 'CARDS',          label: 'Cards' },
  { key: 'CARD_TXS',       label: 'Card Txns' },
  { key: 'BANKS',          label: 'Bank Accounts' },
  { key: 'FEES',           label: 'Fee Ledger' },
  { key: 'MESSAGES',       label: 'Messages' },
  { key: 'REPORTS',        label: 'Reports' },
  { key: 'REFERRALS',      label: 'Referrals' },
  { key: 'SESSIONS',       label: 'Sessions' },
  { key: 'LOGINS',         label: 'Login History' },
  { key: 'API_KEYS',       label: 'API Keys' },
  { key: 'WHATSAPP',       label: 'WhatsApp' },
  { key: 'ONRAMPS',        label: 'On-Ramps' },
  { key: 'OFFRAMPS',       label: 'Off-Ramps' },
  { key: 'MARKETS',        label: 'Markets' },
  { key: 'ONCHAIN',        label: 'On-Chain' },
  { key: 'TRANSFERS',      label: 'Transfers' },
  { key: 'NOTIFICATIONS',  label: 'Notifications' },
  { key: 'PLATFORM_BANKS', label: 'Platform Banks' },
];

async function fetchTab(tab: Tab, page: number, search: string): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
  const p = { page, limit: 50, ...(search ? { search } : {}) };
  switch (tab) {
    case 'TRANSACTIONS':   return adminService.rawTransactions(p);
    case 'P2P_TRADES':     return adminService.rawP2PTrades(p);
    case 'P2P_LISTINGS':   return adminService.rawP2PListings(p);
    case 'P2P_DISPUTES':   return adminService.rawP2PDisputes(p);
    case 'WALLETS':        return adminService.rawWallets(p);
    case 'CARDS':          return adminService.rawCards(p);
    case 'CARD_TXS':       return adminService.rawCardTransactions(p);
    case 'BANKS':          return adminService.rawBankAccounts(p);
    case 'FEES':           return adminService.platformFees(p) as any;
    case 'MESSAGES':       return adminService.rawMessages(p);
    case 'REPORTS':        return adminService.rawMessageReports(p);
    case 'REFERRALS':      return adminService.rawReferrals(p);
    case 'SESSIONS':       return adminService.rawSessions(p);
    case 'LOGINS':         return adminService.rawLoginHistory(p);
    case 'API_KEYS':       return adminService.rawApiKeys(p);
    case 'WHATSAPP': {
      const r = await adminService.rawWhatsApp(p);
      return { items: (r as any).messages ?? [], total: (r as any).total, page: (r as any).page, totalPages: (r as any).totalPages };
    }
    case 'ONRAMPS':        return adminService.rawOnRamps(p);
    case 'OFFRAMPS':       return adminService.rawOffRamps(p);
    case 'MARKETS':        return adminService.rawMarkets(p);
    case 'ONCHAIN':        return adminService.rawOnchain(p);
    case 'TRANSFERS':      return adminService.rawTransfers(p);
    case 'NOTIFICATIONS':  return adminService.rawNotifications(p);
    case 'PLATFORM_BANKS': return adminService.rawPlatformBanks(p);
    default:               return { items: [], total: 0, page: 1, totalPages: 1 };
  }
}

function keyColumns(tab: Tab, row: any): string {
  switch (tab) {
    case 'TRANSACTIONS':   return `${row.type ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'P2P_TRADES':     return `${row.status ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''}`;
    case 'P2P_LISTINGS':   return `${row.type ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'P2P_DISPUTES':   return `${row.status ?? ''} · ${row.reason ?? ''}`;
    case 'WALLETS':        return `${row.currency ?? ''} · bal: ${row.balance ?? ''}`;
    case 'CARDS':          return `${row.label ?? ''} · ${row.status ?? ''} · ${row.currency ?? ''}`;
    case 'CARD_TXS':       return `${row.type ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'BANKS':          return `${row.bankName ?? ''} · ${row.currency ?? ''} · ${row.country ?? ''}`;
    case 'FEES':           return `${row.source ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''} · $${row.amountUsd ?? 0}`;
    case 'MESSAGES':       return `${row.type ?? 'TEXT'} · ${(row.content ?? '').slice(0, 60)}`;
    case 'REPORTS':        return `${row.status ?? ''} · ${row.reason ?? ''}`;
    case 'REFERRALS':      return `${row.status ?? ''} · ${row.amount ?? ''} ${row.currency ?? ''}`;
    case 'SESSIONS':       return `${row.userAgent?.slice(0, 40) ?? 'n/a'}`;
    case 'LOGINS':         return `${row.ip ?? ''} · ${row.success ? 'OK' : 'FAIL'}`;
    case 'API_KEYS':       return `${row.label ?? ''} · ${row.isActive ? 'active' : 'revoked'}`;
    case 'WHATSAPP':       return `${row.direction ?? ''} · ${(row.message ?? '').slice(0, 60)}`;
    case 'ONRAMPS':        return `${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'OFFRAMPS':       return `${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'MARKETS':        return `${row.symbol ?? ''} · ${row.isVisible ? 'visible' : 'hidden'}`;
    case 'ONCHAIN':        return `${row.type ?? ''} · ${row.status ?? ''} · ${row.txHash?.slice(0, 12) ?? ''}`;
    case 'TRANSFERS':      return `${row.amount ?? ''} ${row.currency ?? ''} · ${row.status ?? ''}`;
    case 'NOTIFICATIONS':  return `${row.type ?? ''} · ${(row.title ?? '').slice(0, 50)}`;
    case 'PLATFORM_BANKS': return `${row.bankName ?? ''} · ${row.currency ?? ''} · ${row.country ?? ''}`;
    default: return JSON.stringify(row).slice(0, 80);
  }
}

export default function AdminData() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('TRANSACTIONS');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drill, setDrill] = useState<any | null>(null);

  const q = useQuery({
    queryKey: ['admin-data', tab, page, search],
    queryFn: () => fetchTab(tab, page, search),
    enabled: isAdmin,
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => adminService.revokeSession(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-data', 'SESSIONS'] }); Alert.alert('Session revoked'); },
    onError: () => Alert.alert('Failed to revoke session'),
  });

  if (!isAdmin) {
    return <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      <TopGradient /><Text style={{ color: p.fg }}>Admin only</Text></View>;
  }

  const items = q.data?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Database</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text>
        </View>

        {/* Tab strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
          {TABS.map(({ key, label }) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => { setTab(key); setPage(1); setSearch(''); }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search */}
        <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 40 }}>
            <Ionicons name="search-outline" size={16} color={p.fgMuted} />
            <TextInput
              value={search}
              onChangeText={(t) => { setSearch(t); setPage(1); }}
              placeholder="Search…"
              placeholderTextColor={p.fgFaint}
              style={{ flex: 1, color: p.fg, fontSize: 14, marginLeft: 8 }}
            />
            {search ? <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={p.fgMuted} /></Pressable> : null}
          </View>
        </View>

        {q.isLoading && !items.length ? (
          <LoadingPulse fullscreen icon="server-outline" label={`Loading ${tab.replace('_', ' ').toLowerCase()}…`} />
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          >
            {items.map((row) => (
              <Pressable
                key={row.id ?? Math.random()}
                onPress={() => setDrill(row)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 12, paddingHorizontal: 14,
                  backgroundColor: pressed ? p.bgElev : p.bgElev,
                  borderWidth: 1, borderColor: p.border, borderRadius: 12, marginBottom: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                    {keyColumns(tab, row)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                    <Text style={{ color: p.fgFaint, fontSize: 10 }} numberOfLines={1}>
                      {row.id?.slice(0, 8) ?? '—'}
                    </Text>
                    {row.createdAt ? (
                      <Text style={{ color: p.fgFaint, fontSize: 10 }}>
                        {formatRelativeTime(row.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {/* Session revoke quick action */}
                {tab === 'SESSIONS' && !row.revokedAt ? (
                  <Pressable
                    onPress={() => revokeMut.mutate(row.id)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)' }}
                  >
                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Revoke</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={p.fgFaint} />
                )}
              </Pressable>
            ))}

            {/* Pagination */}
            {(q.data?.totalPages ?? 1) > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 }}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((n) => Math.max(1, n - 1))}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, opacity: page <= 1 ? 0.4 : 1 }}
                >
                  <Text style={{ color: p.fg, fontWeight: '700' }}>← Prev</Text>
                </Pressable>
                <Text style={{ color: p.fgMuted, alignSelf: 'center', fontWeight: '700' }}>
                  {page} / {q.data?.totalPages ?? 1}
                </Text>
                <Pressable
                  disabled={page >= (q.data?.totalPages ?? 1)}
                  onPress={() => setPage((n) => n + 1)}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, opacity: page >= (q.data?.totalPages ?? 1) ? 0.4 : 1 }}
                >
                  <Text style={{ color: p.fg, fontWeight: '700' }}>Next →</Text>
                </Pressable>
              </View>
            )}

            {!q.isLoading && items.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="server-outline" size={40} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, marginTop: 12, fontWeight: '600' }}>No records</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* JSON drill-down modal */}
      <Modal visible={!!drill} transparent animationType="slide" onRequestClose={() => setDrill(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setDrill(null)}>
          <View
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '80%', backgroundColor: p.bgElev, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border, alignSelf: 'center', marginTop: 10, marginBottom: 12 }} />
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>
                {JSON.stringify(drill, null, 2)}
              </Text>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
