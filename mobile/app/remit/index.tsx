/**
 * Send abroad — the customer's international transfers.
 * Lists transfers with customer-facing status and opens a new transfer.
 */
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell, CTAButton, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { remittanceService, customerStatus } from '@/services/remittance';
import { formatRelativeTime } from '@/utils/format';

export default function RemitHome() {
  const router = useRouter();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const q = useQuery({ queryKey: ['remit-transfers'], queryFn: remittanceService.list, refetchInterval: 30_000 });
  const items = q.data ?? [];

  const toneColor = (tone: string) => (tone === 'done' ? p.greenFg : tone === 'problem' ? p.redFg : tone === 'progress' ? p.amberFg : p.fgMuted);

  return (
    <ScreenShell title={t('remit.title')} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 20, marginBottom: 18 }}>{t('remit.intro')}</Text>
      <CTAButton label={t('remit.new')} icon="paper-plane-outline" onPress={() => { h.selection(); router.push('/remit/new' as never); }} />

      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginTop: 28, marginBottom: 10 }}>{t('remit.recent').toUpperCase()}</Text>
      {q.isLoading ? (
        <Text style={{ color: p.fgMuted, fontSize: 13 }}>{t('common.loading')}</Text>
      ) : items.length === 0 ? (
        <Panel style={{ padding: 18 }}>
          <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>{t('remit.none')}</Text>
        </Panel>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((tr) => {
            const st = customerStatus(tr.state);
            return (
              <Pressable key={tr.id} onPress={() => { h.selection(); router.push(`/remit/${tr.id}` as never); }}
                style={({ pressed }) => ({ backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 14, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{tr.beneficiary?.fullName ?? tr.reference}</Text>
                    <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{tr.corridor?.name ?? ''} · {formatRelativeTime(tr.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{Number(tr.receiveAmount).toLocaleString('en-US', { maximumFractionDigits: 2 })} {tr.destCurrency}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name={st.tone === 'done' ? 'checkmark-circle' : st.tone === 'problem' ? 'alert-circle' : 'time-outline'} size={12} color={toneColor(st.tone)} />
                      <Text style={{ color: p.fgMuted, fontSize: 12 }}>{t(`remit.status.${st.label}`)}</Text>
                    </View>
                  </View>
                </View>
                {tr.sandbox ? <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 8 }}>{t('remit.sandboxShort')}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}
