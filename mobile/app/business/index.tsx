/**
 * tazdan Business Dashboard
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
  Alert,
  Linking, ActivityIndicator, Pressable, RefreshControl, ScrollView, View,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BusinessStats, BusinessPayout, BusinessProfile } from '@/types/business';
import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';


function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const p = useThemedPalette();
  return (
    <View style={{
      flex: 1, paddingVertical: 14,
      backgroundColor: 'transparent',
      minWidth: 0,
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.7 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: color ?? p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      {sub && <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '600', marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

function QuickAction({ icon, label, onPress, accent }: {
  icon: any; label: string; onPress: () => void; accent?: string;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <Pressable
      onPress={() => { h.selection(); onPress(); }}
      style={({ pressed }) => ({
        flex: 1, alignItems: 'center', gap: 8,
        paddingVertical: 12, paddingHorizontal: 2,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: p.bgElev,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={22} color={p.fg} />
      </View>
      <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500', textAlign: 'center' }} numberOfLines={1}>
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
    status === 'PROCESSING' ? p.accentText : p.amberFg;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 16, paddingHorizontal: 0,
    }}>
      <View style={{
        width: 36, height: 36, borderRadius: 24,
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
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
          {Number(payout.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: statusColor, fontSize: 10.5, fontWeight: '600', marginTop: 1 }}>
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
  // Not on a business team: show invitations instead of the dashboard.
  const [notMember, setNotMember] = useState(false);
  const [invites,  setInvites]  = useState<Awaited<ReturnType<typeof businessService.myInvitations>>>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const [s, pRes, pr] = await Promise.allSettled([
        businessService.stats(),
        businessService.listPayouts({ limit: 5 }),
        businessService.profile(),
      ]);
      if (s.status === 'fulfilled')     setStats(s.value);
      if (pRes.status === 'fulfilled')  setPayouts(pRes.value.payouts);
      if (pr.status === 'fulfilled')    { setProfile(pr.value); setNotMember(false); }
      else if ((pr.reason as any)?.response?.status === 403) {
        setNotMember(true);
        setInvites(await businessService.myInvitations().catch(() => []));
      }
    } catch { /* handled per-call */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <ScreenShell title="Business" right={
          profile && (
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
                fontSize: 10.5, fontWeight: '600', letterSpacing: 0.4,
              }}>
                KYB {profile.kybStatus}
              </Text>
            </View>
          )
        }  scroll={false} contentStyle={{ paddingHorizontal: 0 }}>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accentText} />}
        >
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={p.accentText} size="large" />
            </View>
          ) : notMember ? (
            <View style={{ paddingTop: 24, gap: 10 }}>
              <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600' }}>{invites.length ? 'Team invitations' : 'No business account'}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19 }}>
                {invites.length ? 'Accept an invitation to work in that business’s account.' : 'This account isn’t part of a business yet. Ask the business owner to invite your email address.'}
              </Text>
              {invites.map((inv) => (
                <View key={inv.id} style={{ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14 }}>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{inv.business.tradingName ?? inv.business.companyName}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>Role: {inv.role.toLowerCase()} · {inv.business.country}</Text>
                  <Pressable onPress={async () => {
                      h.selection();
                      try { await businessService.acceptInvitation(inv.id); h.success(); setLoading(true); await load(); }
                      catch (e: any) { h.error(); Alert.alert('Could not accept', e?.response?.data?.error ?? 'Please try again.'); }
                    }}
                    style={({ pressed }) => ({ marginTop: 12, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: p.ctaBg, opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '600' }}>Accept invitation</Text>
                  </Pressable>
                </View>
              ))}
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
                      ? 'Your business verification is under review. Payouts become available once it is approved.'
                      : profile.kybStatus === 'NOT_SUBMITTED'
                        ? 'Payouts become available once your business is verified. Submit it for review and our team will ask for the company documents.'
                        : `Business verification was not approved${profile.kybNotes ? `: ${profile.kybNotes}` : '.'} You can resubmit once it is resolved.`}
                  </Text>
                </View>
              )}
              {profile && profile.role === 'OWNER' && (profile.kybStatus === 'NOT_SUBMITTED' || profile.kybStatus === 'REJECTED') && (
                <Pressable disabled={submitting}
                  onPress={async () => {
                    setSubmitting(true); h.selection();
                    try { await businessService.submitKyb(); h.success(); await load(); }
                    catch (e: any) { h.error(); Alert.alert('Could not submit', e?.response?.data?.error ?? 'Please try again.'); }
                    finally { setSubmitting(false); }
                  }}
                  style={({ pressed }) => ({ marginTop: 8, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: p.ctaBg, opacity: pressed || submitting ? 0.7 : 1 })}>
                  <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '600' }}>{submitting ? 'Submitting…' : 'Submit for verification'}</Text>
                </Pressable>
              )}

              <View style={{ paddingTop: 24, paddingBottom: 8 }}>
                <Text style={{ color: p.fgMuted, fontSize: 14 }}>{profile?.legalName ?? 'Business account'}</Text>
                <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 22 }}>Paid today · USD</Text>
                <Text style={{ color: p.fg, fontSize: 52, fontWeight: '500', letterSpacing: -2, marginTop: 6, fontVariant: ['tabular-nums'] }}>
                  {stats ? `$${Number(stats.volumeUsdToday).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 6 }}>
                  {stats ? `${stats.payoutsToday} payouts today · $${Number(stats.volumeUsdMonth).toLocaleString('en-US', { maximumFractionDigits: 0 })} this month` : '—'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 18 }}>
                  <StatCard label="Success rate" value={stats ? `${(stats.successRate * 100).toFixed(1)}%` : '—'}
                    color={stats && stats.successRate >= .95 ? p.greenFg : p.fg} />
                  <StatCard label="API calls today" value={stats ? stats.apiCallsToday.toLocaleString('en-US') : '—'} />
                  <StatCard label="Team" value={stats ? String(stats.teamSize) : '—'} />
                </View>
              </View>

              {/* Quick actions */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                QUICK ACTIONS
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <QuickAction icon="key-outline"    label="API Keys"   onPress={() => router.push('/business/api-keys' as never)} />
                <QuickAction icon="people-outline" label="Team"       onPress={() => router.push('/business/team' as never)} />
                <QuickAction icon="send-outline"   label="Bulk Pay"   onPress={() => router.push('/business/bulk-pay' as never)} />
                <QuickAction icon="receipt-outline" label="Payouts"   onPress={() => router.push('/business/invoices' as never)} />
              </View>

              {/* Recent payouts */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                RECENT PAYOUTS
              </Text>
              <View style={{
                borderRadius: 24, overflow: 'hidden',
                backgroundColor: 'transparent',
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
                    <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>View all payouts →</Text>
                  </Pressable>
                )}
              </View>

              {/* API Docs link */}
              <Pressable
                onPress={() => { h.selection(); void Linking.openURL('https://tazdan.com/business'); }}
                style={({ pressed }) => ({
                  marginTop: 20, padding: 16, borderRadius: 16,
                  borderWidth: 1, borderColor: `${p.accent}44`,
                  backgroundColor: `${p.accent}0A`,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name="code-slash-outline" size={22} color={p.accentText} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>API Documentation</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 1 }}>tazdan.com/business</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={p.accentText} />
              </Pressable>
            </>
          )}
        </ScrollView>

    </ScreenShell>
  );
}
