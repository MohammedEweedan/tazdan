/**
 * Fortuni Business Dashboard
 *
 * Overview of the business account: key stats, API health, quick actions,
 * and the last few payouts. All data from businessService.
 *
 * Sections:
 *   ① KYB status banner (if not approved)
 *   ② Stats grid: payouts today, volume USD, API calls, success rate
 *   ③ Quick actions: API Keys · Bulk Pay · Team · Payouts
 *   ④ Recent payouts mini-list
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, View,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { brand, useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BusinessStats, BusinessPayout, BusinessProfile } from '@/types/business';
import { TopGradient } from '@/components/ui/ScreenShell';

const ACCENT = '#226dff';

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const p = useThemedPalette();
  return (
    <View style={{
      flex: 1, padding: 14, borderRadius: 18,
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
      minWidth: 0,
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.7 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: color ?? p.fg, fontSize: 24, fontWeight: '800', letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {sub && <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '600', marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

function QuickAction({ icon, label, onPress, accent = ACCENT }: {
  icon: any; label: string; onPress: () => void; accent?: string;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <Pressable
      onPress={() => { h.selection(); onPress(); }}
      style={({ pressed }) => ({
        flex: 1, alignItems: 'center', gap: 8,
        paddingVertical: 14, paddingHorizontal: 8,
        borderRadius: 16, backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: `${accent}18`,
        borderWidth: 1, borderColor: `${accent}40`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={{ color: p.fg, fontSize: 11.5, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PayoutRow({ payout, palette: p }: { payout: BusinessPayout; palette: ReturnType<typeof useThemedPalette> }) {
  const status = payout.status;
  const statusColor =
    status === 'COMPLETED'  ? p.greenFg :
    status === 'FAILED'     ? p.redFg   :
    status === 'CANCELLED'  ? p.fgFaint :
    status === 'PROCESSING' ? '#60a5fa' : p.amberFg;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: p.border,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: p.bgRaised,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Ionicons
          name={status === 'COMPLETED' ? 'checkmark-circle' : status === 'FAILED' ? 'close-circle' : 'time'}
          size={18}
          color={statusColor}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {payout.recipientHandle ?? payout.recipientEmail ?? payout.reference}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500', marginTop: 1 }}>
          {payout.currency} · {new Date(payout.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {Number(payout.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: statusColor, fontSize: 10.5, fontWeight: '700', marginTop: 1 }}>
          {status}
        </Text>
      </View>
    </View>
  );
}

export default function BusinessDashboard() {
  const router = useRouter();
  const p      = useThemedPalette();
  const h      = useHaptics();
  const mode   = useTheme((s) => s.mode);

  const [stats,    setStats]    = useState<BusinessStats | null>(null);
  const [payouts,  setPayouts]  = useState<BusinessPayout[]>([]);
  const [profile,  setProfile]  = useState<BusinessProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [s, pRes, pr] = await Promise.allSettled([
        businessService.stats(),
        businessService.listPayouts({ limit: 5 }),
        businessService.profile(),
      ]);
      if (s.status === 'fulfilled')     setStats(s.value);
      if (pRes.status === 'fulfilled')  setPayouts(pRes.value.payouts);
      if (pr.status === 'fulfilled')    setProfile(pr.value);
    } catch { /* handled per-call */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => router.back()} hitSlop={8}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={20} color={p.fg} />
            </Pressable>
            <View>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>
                Fortuni Business
              </Text>
              {profile && (
                <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '600' }}>
                  {profile.legalName}
                </Text>
              )}
            </View>
          </View>

          {/* KYB badge */}
          {profile && (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
              backgroundColor: profile.kybStatus === 'APPROVED'
                ? p.greenBg : profile.kybStatus === 'PENDING' ? p.amberBg : 'rgba(248,113,113,0.14)',
              borderWidth: 1,
              borderColor: profile.kybStatus === 'APPROVED'
                ? `${p.greenFg}44` : profile.kybStatus === 'PENDING' ? `${p.amberFg}44` : 'rgba(248,113,113,0.4)',
            }}>
              <Text style={{
                color: profile.kybStatus === 'APPROVED' ? p.greenFg
                  : profile.kybStatus === 'PENDING' ? p.amberFg : p.redFg,
                fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4,
              }}>
                KYB {profile.kybStatus}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        >
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={ACCENT} size="large" />
            </View>
          ) : (
            <>
              {/* KYB pending banner */}
              {profile && profile.kybStatus !== 'APPROVED' && (
                <View style={{
                  marginTop: 8, marginBottom: 4,
                  padding: 14, borderRadius: 16,
                  backgroundColor: p.amberBg, borderWidth: 1, borderColor: `${p.amberFg}44`,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                  <Ionicons name="information-circle-outline" size={18} color={p.amberFg} />
                  <Text style={{ flex: 1, color: p.amberFg, fontSize: 12.5, fontWeight: '600', lineHeight: 17 }}>
                    {profile.kybStatus === 'PENDING'
                      ? 'Your business verification is under review. Payouts are limited until approved.'
                      : profile.kybStatus === 'NOT_SUBMITTED'
                        ? 'Submit your business documents to unlock full payout limits.'
                        : 'Business verification was rejected. Contact support to resolve.'}
                  </Text>
                </View>
              )}

              {/* Stats grid */}
              <View style={{ gap: 10, marginTop: 16 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard
                    label="Payouts today"
                    value={String(stats?.payoutsToday ?? '—')}
                    sub={stats ? `${stats.payoutsThisMonth} this month` : undefined}
                  />
                  <StatCard
                    label="Volume (USD)"
                    value={stats ? `$${Number(stats.volumeUsdToday).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    sub={stats ? `$${Number(stats.volumeUsdMonth).toLocaleString('en-US', { maximumFractionDigits: 0 })} / mo` : undefined}
                    color={ACCENT}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <StatCard
                    label="API calls today"
                    value={String(stats?.apiCallsToday ?? '—')}
                    sub={stats ? `${stats.activeKeys} active key${stats.activeKeys === 1 ? '' : 's'}` : undefined}
                  />
                  <StatCard
                    label="Success rate"
                    value={stats ? `${(stats.successRate * 100).toFixed(1)}%` : '—'}
                    color={stats && stats.successRate >= 0.95 ? p.greenFg : stats && stats.successRate >= 0.80 ? p.amberFg : p.redFg}
                    sub={stats ? `${stats.teamSize} team member${stats.teamSize === 1 ? '' : 's'}` : undefined}
                  />
                </View>
              </View>

              {/* Quick actions */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                QUICK ACTIONS
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <QuickAction icon="key-outline"    label="API Keys"   onPress={() => router.push('/business/api-keys' as never)} />
                <QuickAction icon="people-outline" label="Team"       onPress={() => router.push('/business/team' as never)} />
                <QuickAction icon="send-outline"   label="Bulk Pay"   onPress={() => router.push('/business/bulk-pay' as never)} />
                <QuickAction icon="receipt-outline" label="Payouts"   onPress={() => router.push('/business/invoices' as never)} />
              </View>

              {/* Recent payouts */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                RECENT PAYOUTS
              </Text>
              <View style={{
                borderRadius: 18, overflow: 'hidden',
                borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev,
              }}>
                {payouts.length > 0 ? (
                  payouts.map((payout) => (
                    <PayoutRow key={payout.id} payout={payout} palette={p} />
                  ))
                ) : (
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Ionicons name="receipt-outline" size={32} color={p.fgFaint} />
                    <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 10 }}>
                      No payouts yet
                    </Text>
                    <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4 }}>
                      Use Bulk Pay or the API to send your first payout.
                    </Text>
                  </View>
                )}
                {payouts.length > 0 && (
                  <Pressable
                    onPress={() => router.push('/business/invoices' as never)}
                    style={({ pressed }) => ({
                      paddingVertical: 14, alignItems: 'center',
                      backgroundColor: pressed ? p.bgRaised : 'transparent',
                    })}
                  >
                    <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>View all payouts →</Text>
                  </Pressable>
                )}
              </View>

              {/* API Docs link */}
              <Pressable
                onPress={() => { h.selection(); /* Linking.openURL('https://docs.fortuni.com') */ }}
                style={({ pressed }) => ({
                  marginTop: 20, padding: 16, borderRadius: 16,
                  borderWidth: 1, borderColor: `${ACCENT}44`,
                  backgroundColor: `${ACCENT}0A`,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name="code-slash-outline" size={22} color={ACCENT} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>API Documentation</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>docs.fortuni.com</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={ACCENT} />
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
