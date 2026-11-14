/**
 * /pay/<payee>?amount=&currency=&ref= — pay a scanned code or a picked
 * @handle. Reached from the Pay tab, the scanner and tazdan://pay/ links.
 * Route params arrive straight from a link, so they're validated here with
 * the scanner's own rules before anything is shown.
 */
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { PayForm } from '@/components/pay/PayForm';
import { presetFrom } from '@/lib/payCode';
import { payService } from '@/services';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';

const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export default function PayPage() {
  const p = useThemedPalette();
  const t = useT();
  const params = useLocalSearchParams<{ payee: string; amount?: string; currency?: string; ref?: string; till?: string }>();
  const ref = (one(params.payee) ?? '').trim().replace(/^@/, '');
  const preset = presetFrom({ amount: one(params.amount), currency: one(params.currency), ref: one(params.ref), till: one(params.till) });

  const { data: payee, isLoading, error, refetch } = useQuery({
    queryKey: ['payee', ref],
    queryFn: () => payService.payee(ref),
    enabled: !!ref && !!preset,
    // A 404 is an answer, not a blip.
    retry: (n, e: any) => e?.response?.status !== 404 && n < 2,
  });

  const problem = !preset ? { title: t('pay.badCode'), hint: t('pay.badCodeHint') }
    : !ref || (error as any)?.response?.status === 404 ? { title: t('pay.notFound'), hint: t('pay.notFoundHint') }
    : error ? { title: t('pay.loadFailed'), hint: t('pay.loadFailedHint'), retry: true }
    : null;

  return (
    <ScreenShell closeOnly title={t('pay.title')} scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      {payee && preset ? (
        <PayForm payee={payee} preset={preset} />
      ) : problem ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 }}>
          <Ionicons name="qr-code-outline" size={40} color={p.fgFaint} />
          <Text style={{ color: p.fg, fontSize: 17, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>{problem.title}</Text>
          <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>{problem.hint}</Text>
          {'retry' in problem && (
            <Pressable onPress={() => refetch()} hitSlop={10} accessibilityRole="button" style={{ marginTop: 16 }}>
              <Text style={{ color: p.accentText, fontSize: 14, fontWeight: '600' }}>{t('pay.retry')}</Text>
            </Pressable>
          )}
        </View>
      ) : isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <ActivityIndicator color={p.fgMuted} />
        </View>
      ) : null}
    </ScreenShell>
  );
}
