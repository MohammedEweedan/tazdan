/**
 * /lydt/convert?mode=issue|redeem — dinars to LYDT and back, one for one.
 * Issue moves LYD into the reserve held at the CBL; redeem returns it.
 * One idempotency key per intended conversion: a retry after a lost reply
 * converts once.
 */
import { useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { AmountDisplay } from '@/components/ui/AmountDisplay';
import { NumericKeypad } from '@/components/ui/NumericKeypad';
import { ConfirmAction, ltr, useConfirmDockInset } from '@/components/ui/ConfirmAction';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useWallets, extractErrorMessage, useTransactionSound } from '@/hooks';
import { isTransientSendError } from '@/hooks/useMessages';
import { lydtService } from '@/services';

const num = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function LydtConvert() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const router = useRouter();
  const qc = useQueryClient();
  const dock = useConfirmDockInset();
  const { height } = useWindowDimensions();
  const compact = height < 780;
  const { playSuccess, playError } = useTransactionSound();
  const mode = useLocalSearchParams<{ mode?: string }>().mode === 'redeem' ? 'redeem' : 'issue';
  const { data: wallets } = useWallets();
  const me = useQuery({ queryKey: ['lydt-me'], queryFn: lydtService.me });

  const [amount, setAmount] = useState('');
  const [cta, setCta] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: number; reference: string } | null>(null);

  const [from, to] = mode === 'issue' ? ['LYD', 'LYDT'] : ['LYDT', 'LYD'];
  const available = mode === 'issue'
    ? Number(wallets?.find((w) => w.currency === 'LYD')?.balance ?? 0)
    : Number(me.data?.balance ?? 0);
  const value = Number(amount || 0);
  const over = value > available;
  const valid = value > 0 && !over && !me.data?.frozen;

  const attempt = useRef<{ key: string; amount: number } | null>(null);
  const keyFor = (v: number) => {
    if (attempt.current?.amount === v) return attempt.current.key;
    const key = `lydt_${mode}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    attempt.current = { key, amount: v };
    return key;
  };

  const onConfirm = async () => {
    if (!valid || cta !== 'idle') return;
    setCta('loading'); setError(null);
    try {
      const op = mode === 'issue' ? await lydtService.issue(value, keyFor(value)) : await lydtService.redeem(value, keyFor(value));
      attempt.current = null;
      playSuccess('transfer');
      setCta('success');
      setDone({ amount: value, reference: op.reference });
      void qc.invalidateQueries({ queryKey: ['lydt-me'] });
      void qc.invalidateQueries({ queryKey: ['lydt-reserves'] });
      void qc.invalidateQueries({ queryKey: ['wallets'] });
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['activities'] });
    } catch (e) {
      playError();
      setError(isTransientSendError(e) ? t('pay.unconfirmed') : extractErrorMessage(e, t('lydt.failed')));
      setCta('error');
      setTimeout(() => setCta('idle'), 2200);
    }
  };

  const amountText = `${num(value)} ${from}`;

  return (
    <ScreenShell closeOnly title={t(mode === 'issue' ? 'lydt.issueTitle' : 'lydt.redeemTitle')} scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      {done ? (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: dock }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite">
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.greenBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={36} color={p.greenFg} />
            </View>
            <Text style={{ color: p.fg, fontSize: 34, fontWeight: '600', letterSpacing: -1, marginTop: 18 }}>{ltr(`${num(done.amount)} ${to}`)}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 10 }}>{done.reference}</Text>
          </View>
          <CTAButton label={t('lydt.done')} onPress={() => { h.selection(); router.back(); }} />
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <Text style={{ color: p.fg, fontSize: 22, fontWeight: '600', letterSpacing: -0.4, marginTop: 4 }}>
            {t(mode === 'issue' ? 'lydt.issueTitle' : 'lydt.redeemTitle')}
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {t(mode === 'issue' ? 'lydt.issueHint' : 'lydt.redeemHint')}
          </Text>

          <View style={{ marginTop: compact ? 18 : 30 }}>
            <AmountDisplay value={amount} symbol={from} palette={p} tint={over ? p.redFg : undefined} maxSize={compact ? 56 : 64} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Ionicons name="arrow-down" size={14} color={p.fgMuted} />
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>{ltr(`${num(value)} ${to}`)}</Text>
          </View>
          <Text style={{ color: over ? p.redFg : p.fgFaint, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
            {over ? t('send.exceedsBalance') : `${t('common.available')}: ${ltr(`${num(available)} ${from}`)}`}
          </Text>

          <View style={{ flex: 1, minHeight: 8 }} />
          <View style={{ marginBottom: 14 }}>
            <NumericKeypad value={amount} onChange={setAmount} palette={p} keyHeight={compact ? 48 : 56} fontSize={compact ? 24 : 27} />
          </View>
          <ConfirmAction
            action={t('confirm.act.convert', { amount: ltr(amountText) })}
            prompt={over ? t('send.exceedsBalance') : t('buy.enterAmount')}
            onConfirm={onConfirm}
            disabled={!valid || cta !== 'idle'}
            status={cta}
            successLabel={t('lydt.converted')}
            errorLabel={error ?? t('lydt.failed')}
            review={{
              amount: amountText,
              caption: `→ ${num(value)} ${to}`,
              rows: [
                { label: t('confirm.from'), value: from, sub: `${t('common.available')}: ${ltr(`${num(available)} ${from}`)}` },
                { label: t('confirm.to'), value: to },
              ],
              footnote: t('lydt.peg'),
            }}
          />
        </View>
      )}
    </ScreenShell>
  );
}
