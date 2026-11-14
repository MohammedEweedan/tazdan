/**
 * LYDT — tazdan's dinar token (sandbox).
 *
 *   Balance and the peg (1 LYDT = 1 LYD at the Central Bank of Libya)
 *   Get · Redeem · Send (Pay)
 *   Reserves — the public transparency report, live
 *   Activity
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell, SectionLabel } from '@/components/ui/ScreenShell';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { lydtService } from '@/services';

const num = (v: string | number) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function LydtHome() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const router = useRouter();
  // Metric rows read right to left in Arabic (labels, not currency names).
  const rtl = useI18n((s) => s.locale === 'ar');
  const [refreshing, setRefreshing] = useState(false);
  const me = useQuery({ queryKey: ['lydt-me'], queryFn: lydtService.me });
  const reserves = useQuery({ queryKey: ['lydt-reserves'], queryFn: lydtService.reserves, refetchInterval: 30_000 });
  const r = reserves.data;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([me.refetch(), reserves.refetch()]);
    setRefreshing(false);
  };

  const Row = ({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) => (
    <View style={{
      flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 16, paddingVertical: 13,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.border,
    }}>
      <Text style={{ flex: 1, color: p.fgMuted, fontSize: 14, textAlign: rtl ? 'right' : 'left' }}>{label}</Text>
      <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
        {!!sub && <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
    </View>
  );

  const Action = ({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable
      onPress={() => { h.selection(); onPress(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: 8, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={22} color={p.fg} />
      </View>
      <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  const frozen = me.data?.frozen === true;
  const balance = Number(me.data?.balance ?? 0);

  return (
    <ScreenShell title={t('lydt.title')} subtitle={t('lydt.subtitle')} onRefresh={refresh} refreshing={refreshing}>
      <View style={{ marginTop: 8 }}>
        <StatusBanner kind="info" message={t('lydt.sandbox')} />
      </View>

      <View style={{ alignItems: 'center', paddingTop: 26, paddingBottom: 6 }}>
        <Text style={{ color: p.fg, fontSize: 40, fontWeight: '600', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
          {num(balance)} <Text style={{ fontSize: 20, color: p.fgMuted, fontWeight: '600' }}>LYDT</Text>
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 6, textAlign: 'center', maxWidth: 300, lineHeight: 18 }}>{t('lydt.peg')}</Text>
      </View>

      {frozen && (
        <View style={{ marginTop: 12 }}><StatusBanner kind="error" message={t('lydt.frozen')} /></View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 32, marginTop: 22 }}>
        <Action icon="add" label={t('lydt.get')} disabled={frozen || r?.issuanceOpen === false}
          onPress={() => router.push({ pathname: '/lydt/convert', params: { mode: 'issue' } })} />
        <Action icon="arrow-undo-outline" label={t('lydt.redeem')} disabled={frozen || balance <= 0}
          onPress={() => router.push({ pathname: '/lydt/convert', params: { mode: 'redeem' } })} />
        <Action icon="arrow-up" label={t('lydt.send')} disabled={frozen || balance <= 0}
          onPress={() => router.push('/pay')} />
      </View>

      <SectionLabel>{t('lydt.reserves')}</SectionLabel>
      {r && (
        <View>
          <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name={r.fullyBacked ? 'shield-checkmark' : 'alert-circle'} size={18} color={r.fullyBacked ? p.greenFg : p.redFg} />
            <Text style={{ color: r.fullyBacked ? p.greenFg : p.redFg, fontSize: 15, fontWeight: '600' }}>
              {r.fullyBacked ? t('lydt.fullyBacked') : t('lydt.checkBacking')}
            </Text>
            {!!r.coverage && (
              <Text style={{ color: p.fgMuted, fontSize: 13 }}>· {(Number(r.coverage) * 100).toFixed(1)}%</Text>
            )}
          </View>
          <Row label={t('lydt.supply')} value={`${num(r.supply)} LYDT`} />
          <Row label={t('lydt.reserveAtCbl')} value={r.attestation ? `${num(r.attestation.balance)} LYD` : '—'}
            sub={r.attestation ? `${t('lydt.statement')} ${new Date(r.attestation.statementDate).toLocaleDateString('en-GB')} · ${r.attestation.reference}` : t('lydt.noStatement')} />
          <Row label={t('lydt.headroom')} value={`${num(r.headroom)} LYDT`} />
          <Row label={t('lydt.holders')} value={r.holders.toLocaleString('en-US')} last />
          {!r.issuanceOpen && (
            <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginTop: 10 }}>{t('lydt.issuancePaused')}</Text>
          )}
        </View>
      )}

      <SectionLabel>{t('lydt.activity')}</SectionLabel>
      {(me.data?.activity ?? []).map((a, i, all) => {
        const label = a.kind === 'TRANSFER' ? t(a.direction === 'IN' ? 'lydt.kind.IN' : 'lydt.kind.OUT') : t(`lydt.kind.${a.kind}`);
        const incoming = a.kind === 'ISSUE' || a.direction === 'IN';
        return (
          <View key={a.reference} style={{
            flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
            borderBottomWidth: i === all.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.border,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500' }}>{label}</Text>
              <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 2 }}>
                {[a.note, new Date(a.createdAt).toLocaleDateString('en-GB'), a.reference].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={{ color: incoming ? p.greenFg : p.fg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {incoming ? '+' : '−'}{num(a.amount)}
            </Text>
          </View>
        );
      })}
      {me.isSuccess && me.data.activity.length === 0 && (
        <Text style={{ color: p.fgMuted, fontSize: 14, marginLeft: 4 }}>{t('lydt.empty')}</Text>
      )}
    </ScreenShell>
  );
}
