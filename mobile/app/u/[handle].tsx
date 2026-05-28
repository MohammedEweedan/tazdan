/**
 * Public user profile — `/u/[handle]`.
 *
 * Reachable via:
 *   - QR-code scan on `receive.tsx`
 *   - Tap a `@handle` anywhere in the app
 *   - Direct deep-link `Fortuni://u/<handle>`
 *
 * Shows: avatar + name + KYC tier badge, P2P stats (orders / completion %),
 *  bio, accepted currencies, and a SEND CTA so any visitor can pay them in
 *  one tap. If the visitor has at least one P2P listing under this handle
 *  they're surfaced underneath.
 */

import { useMemo } from 'react';
import { Pressable, View, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useHaptics, useP2POffers, usePublicProfile } from '@/hooks';
import type { Palette } from '@/store/themeStore';

export default function PublicProfile() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();

  const cleanHandle = (handle ?? '').replace(/^@/, '');
  const { data, isLoading, error } = usePublicProfile(cleanHandle || undefined);
  const { data: allOffers } = useP2POffers('ALL');

  // Filter offers from this trader (match by @handle in `trader.handle`).
  const traderOffers = useMemo(() => {
    if (!allOffers || !cleanHandle) return [];
    return allOffers.filter(
      (o) => o.trader.handle.replace(/^@/, '').toLowerCase() === cleanHandle.toLowerCase(),
    );
  }, [allOffers, cleanHandle]);

  if (isLoading) {
    return (
      <ScreenShell title={`@${cleanHandle}`}>
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <ActivityIndicator color={p.fg} />
        </View>
      </ScreenShell>
    );
  }

  if (error || !data) {
    return (
      <ScreenShell title="Profile">
        <View style={{ paddingTop: 80, alignItems: 'center' }}>
          <Ionicons name="person-remove-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14, textAlign: 'center' }}>
            We couldn&apos;t find @{cleanHandle}.
          </Text>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
            The profile may be private or the handle is incorrect.
          </Text>
        </View>
      </ScreenShell>
    );
  }

  const fullName = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || data.username;
  const initial = (data.firstName?.[0] ?? data.username?.[0] ?? '?').toUpperCase();
  const tierLabel = data.kycVerified ? 'VERIFIED' : (data.kycStatus ?? 'UNVERIFIED').replace(/_/g, ' ');

  return (
    <ScreenShell title={`@${data.username}`} subtitle={fullName}>
      {/* ── Identity card ─────────────────────── */}
      <Panel style={{ marginTop: 14 }}>
        <View style={{ padding: 18, alignItems: 'center' }}>
          <View style={{
            width: 84, height: 84, borderRadius: 42,
            backgroundColor: '#7c3aed',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '600' }}>{initial}</Text>
          </View>

          <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }}>
            {fullName}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 2 }}>
            @{data.username}
          </Text>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            marginTop: 12,
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
            backgroundColor: data.kycVerified ? p.greenBg : p.pillBg,
            borderWidth: 1, borderColor: data.kycVerified ? p.greenFg : p.border,
          }}>
            <Ionicons
              name={data.kycVerified ? 'shield-checkmark' : 'shield-outline'}
              size={13}
              color={data.kycVerified ? p.greenFg : p.fgMuted}
            />
            <Text style={{
              color: data.kycVerified ? p.greenFg : p.fgMuted,
              fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
            }}>
              {tierLabel}
            </Text>
          </View>

          {data.bio ? (
            <Text style={{
              color: p.fgMuted, fontSize: 14, lineHeight: 20,
              textAlign: 'center', marginTop: 14, paddingHorizontal: 8,
            }}>
              {data.bio}
            </Text>
          ) : null}
        </View>
      </Panel>

      {/* ── Stats row ─────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <StatCard palette={p} value={String(data.totalTrades)}     label="P2P trades" />
        <StatCard palette={p} value={`${data.completionRate}%`}    label="Completion" />
        <StatCard palette={p} value={String(traderOffers.length)}  label="Open offers" />
      </View>

      {/* ── Accepted currencies ───────────────── */}
      {data.acceptedCurrencies && data.acceptedCurrencies.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4 }}>
            ACCEPTS
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {data.acceptedCurrencies.map((c) => (
              <View
                key={c}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
                  backgroundColor: p.pillBg,
                  borderWidth: 1, borderColor: p.border,
                }}
              >
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Active P2P offers ─────────────────── */}
      {traderOffers.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 4 }}>
            P2P OFFERS
          </Text>
          <Panel style={{ marginTop: 8 }}>
            {traderOffers.map((o, i) => (
              <Pressable
                key={o.id}
                onPress={() => { h.selection(); router.push(`/p2p/${o.id}`); }}
                style={({ pressed }) => ({
                  padding: 14, gap: 4,
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: pressed ? p.border : 'transparent',
                  borderBottomWidth: i === traderOffers.length - 1 ? 0 : 1,
                  borderBottomColor: p.border,
                })}
              >
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                  backgroundColor: o.side === 'BUY' ? p.greenBg : 'rgba(239,68,68,0.16)',
                  marginRight: 12,
                }}>
                  <Text style={{
                    color: o.side === 'BUY' ? p.greenFg : p.redFg,
                    fontSize: 10, fontWeight: '600', letterSpacing: 0.4,
                  }}>
                    {o.side}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                    {Number(o.price).toLocaleString('en-US', { maximumFractionDigits: 4 })} {o.quote}/{o.base}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                    {Number(o.minLimit).toLocaleString()}–{Number(o.maxLimit).toLocaleString()} {o.quote}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
              </Pressable>
            ))}
          </Panel>
        </View>
      )}

      {/* ── CTAs ───────────────────────────────── */}
      <View style={{ marginTop: 28, gap: 10 }}>
        <CTAButton
          label={`Send to @${data.username}`}
          icon="paper-plane"
          onPress={() => {
            h.medium();
            // Route into the chat thread with the payment sheet pre-opened.
            // No need to retype the username — partner id comes from the
            // public profile payload, and the sheet picks the source asset
            // from the user's actual holdings.
            router.push({ pathname: '/messages/[id]', params: { id: data.id, openPay: '1' } });
          }}
        />
        <Pressable
          onPress={() => { h.selection(); router.push('/(tabs)/p2p'); }}
          style={({ pressed }) => ({
            height: 52, borderRadius: 26,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: p.border,
            backgroundColor: pressed ? p.pillBg : 'transparent',
            flexDirection: 'row', gap: 8,
          })}
        >
          <Ionicons name="swap-horizontal" size={16} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>
            View P2P marketplace
          </Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

function StatCard({ palette: p, value, label }: { palette: Palette; value: string; label: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: p.bgElev,
      borderRadius: 14,
      borderWidth: 1, borderColor: p.border,
      padding: 14,
      alignItems: 'center',
    }}>
      <Text style={{
        color: p.fg, fontSize: 20, fontWeight: '600',
        letterSpacing: -0.4, fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}
