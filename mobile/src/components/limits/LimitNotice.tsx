/**
 * LimitNotice — tells the customer, before they confirm, that a limit stops
 * this amount: until when (dd/mm/yyyy), how much they can do instead, and a
 * way to raise it (verification). Renders nothing when the amount is fine.
 */
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useLimitBlock, type LimitedAction } from '@/hooks/useLimits';

const VERB_KEY: Record<LimitedAction, string> = { SEND: 'limits.verb.send', WITHDRAW: 'limits.verb.withdraw', ONRAMP_BUY: 'limits.verb.buy', OFFRAMP_SELL: 'limits.verb.sell' };
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;

export function LimitNotice({ action, amountUsd, style }: { action: LimitedAction; amountUsd?: number | null; style?: object }) {
  const p = useThemedPalette();
  const t = useT();
  const router = useRouter();
  const { state } = useLimitBlock(action, amountUsd);
  if (state.kind === 'ok') return null;

  const verb = t(VERB_KEY[action]);
  let title: string;
  let body: string | null = null;
  let cta: string | null = t('limits.raise');
  if (state.kind === 'verify') {
    title = t('limits.verifyTitle', { verb });
    cta = t('limits.verifyNow');
  } else if (state.kind === 'used') {
    title = t(state.period === 'monthly' ? 'limits.usedMonthly' : 'limits.usedDaily', { verb });
    body = t('limits.continueOn', { date: state.on });
    if (state.next) body += ' ' + t('limits.orRaise', { amount: usd(state.next.monthlyUsd) });
    else cta = null;
  } else {
    title = t('limits.upTo', { verb, amount: usd(state.maxUsd) });
    body = state.period === 'perTx' ? t('limits.perTx') : t('limits.until', { date: state.on ?? '' });
    if (!state.next) cta = null;
  }

  return (
    <View style={[{ flexDirection: 'row', gap: 10, backgroundColor: p.amberBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }, style]}>
      <Ionicons name="hourglass-outline" size={17} color={p.amberFg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>{title}</Text>
        {body ? <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{body}</Text> : null}
        {cta ? (
          <Pressable onPress={() => router.push('/kyc' as never)} hitSlop={8} style={({ pressed }) => ({ marginTop: 6, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: p.accentText, fontSize: 13, fontWeight: '600' }}>{cta} ›</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
