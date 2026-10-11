/**
 * One international transfer: customer-facing status, amounts and a short
 * timeline. Internal states are collapsed to neutral wording (customerStatus).
 */
import { Alert, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, Panel, SecondaryButton } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, extractErrorMessage } from '@/hooks';
import { remittanceService, customerStatus } from '@/services/remittance';
import { QUERY_KEYS } from '@/constants';

// States after which the customer can no longer cancel from the app.
const CANCELLABLE = ['CREATED', 'QUOTED', 'APPROVED', 'FUNDING_PENDING', 'MANUAL_REVIEW', 'FUNDED', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'FAILED', 'PAYOUT_PENDING'];
const fmt = (v: string | number, max = 2) => Number(v).toLocaleString('en-US', { maximumFractionDigits: max, minimumFractionDigits: Math.min(2, max) });

/** The handful of milestones a customer cares about, derived from the lifecycle. */
function milestones(timeline: Array<{ state: string; at: string }>) {
  const at = (states: string[]) => timeline.find((x) => states.includes(x.state))?.at ?? null;
  return [
    { key: 'created', at: at(['QUOTED', 'CREATED']) },
    { key: 'paid', at: at(['FUNDED']) },
    { key: 'sent', at: at(['PAYOUT_PENDING']) },
    { key: 'delivered', at: at(['PAID']) },
  ];
}

export default function RemitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['remit-transfer', id], queryFn: () => remittanceService.get(String(id)), refetchInterval: 15_000 });
  const cancel = useMutation({
    mutationFn: () => remittanceService.cancel(String(id)),
    onSuccess: () => { h.success(); qc.invalidateQueries({ queryKey: ['remit-transfer', id] }); qc.invalidateQueries({ queryKey: ['remit-transfers'] }); qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets }); },
    onError: (e: any) => Alert.alert(t('remit.cancelFailed'), extractErrorMessage(e, t('common.retry'))),
  });

  const tr = q.data?.transfer;
  const st = tr ? customerStatus(tr.state) : null;
  const tone = st?.tone === 'done' ? p.greenFg : st?.tone === 'problem' ? p.redFg : st?.tone === 'progress' ? p.amberFg : p.fgMuted;

  return (
    <ScreenShell title={tr?.reference ?? t('remit.title')} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      {!tr ? <Text style={{ color: p.fgMuted }}>{q.isError ? extractErrorMessage(q.error, t('common.retry')) : t('common.loading')}</Text> : (
        <View>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name={st!.tone === 'done' ? 'checkmark-circle' : st!.tone === 'problem' ? 'alert-circle' : 'time-outline'} size={44} color={tone} />
            <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700', marginTop: 8 }}>{t(`remit.status.${st!.label}`)}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 4 }}>
              {fmt(tr.receiveAmount)} {tr.destCurrency} → {tr.beneficiary?.fullName ?? ''}
            </Text>
          </View>

          {tr.sandbox ? (
            <View style={{ marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: p.amberBg }}>
              <Text style={{ color: p.amberFg, fontSize: 12, lineHeight: 18 }}>{t('remit.sandboxNotice')}</Text>
            </View>
          ) : null}
          {tr.failureReason && st!.tone === 'problem' ? <Text style={{ color: p.fgMuted, fontSize: 13, marginBottom: 14 }}>{tr.failureReason}</Text> : null}

          <Panel style={{ padding: 16 }}>
            {milestones(q.data!.timeline).map((m, i, all) => (
              <View key={m.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: i === all.length - 1 ? 0 : 14 }}>
                <Ionicons name={m.at ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={m.at ? p.greenFg : p.fgFaint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: m.at ? p.fg : p.fgMuted, fontSize: 14, fontWeight: '600' }}>{t(`remit.milestone.${m.key}`)}</Text>
                  {m.at ? <Text style={{ color: p.fgFaint, fontSize: 12 }}>{new Date(m.at).toLocaleString()}</Text> : null}
                </View>
              </View>
            ))}
          </Panel>

          <Panel style={{ padding: 16, marginTop: 14 }}>
            {[
              [t('remit.youSend'), `${fmt(tr.sendAmount)} ${tr.sourceCurrency}`],
              [t('remit.fee'), `${fmt(tr.feeAmount)} ${tr.sourceCurrency}`],
              [t('remit.totalToPay'), `${fmt(tr.totalDebit)} ${tr.sourceCurrency}`],
              [t('remit.rate'), `1 ${tr.sourceCurrency} = ${fmt(tr.customerRate, 6)} ${tr.destCurrency}`],
              [t('remit.theyGet', { name: tr.beneficiary?.fullName.split(' ')[0] ?? '' }), `${fmt(tr.receiveAmount)} ${tr.destCurrency}`],
              [t('remit.purpose'), t(`remit.purpose.${tr.purpose}`)],
              [t('remit.reference'), tr.reference],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: p.fgMuted, fontSize: 13 }}>{label}</Text>
                <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{value}</Text>
              </View>
            ))}
          </Panel>

          {CANCELLABLE.includes(tr.state) ? (
            <View style={{ marginTop: 18 }}>
              <SecondaryButton label={cancel.isPending ? t('common.loading') : t('remit.cancel')} icon="close-circle-outline"
                onPress={() => Alert.alert(t('remit.cancel'), t('remit.cancelBody'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('remit.cancel'), style: 'destructive', onPress: () => cancel.mutate() },
                ])} />
            </View>
          ) : null}
        </View>
      )}
    </ScreenShell>
  );
}
