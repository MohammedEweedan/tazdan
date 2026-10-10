/**
 * Contact — someone you've exchanged money with: who they are (public details
 * only), quick Send / Message, totals between you, and every payment.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useUiStore } from '@/store/uiStore';
import { useHaptics } from '@/hooks';
import { formatMoney } from '@/utils/format';
import { contactsService, type ContactPayment } from '@/services/contacts';
import type { Currency } from '@/types';

export default function ContactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const router = useRouter();
  const locale = useI18n((s) => s.locale);
  const hidden = useUiStore((s) => s.balancesHidden);
  const q = useQuery({ queryKey: ['contact', id], queryFn: () => contactsService.detail(String(id)), enabled: Boolean(id) });
  const dateLocale = locale === 'ar' ? 'ar-LY' : 'en-GB';

  const groups = useMemo(() => {
    const out: Array<{ month: string; items: ContactPayment[] }> = [];
    for (const i of q.data?.items ?? []) {
      const month = new Date(i.createdAt).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
      const g = out[out.length - 1];
      if (g && g.month === month) g.items.push(i); else out.push({ month, items: [i] });
    }
    return out;
  }, [q.data?.items, dateLocale]);

  const c = q.data?.contact;
  const money = (amount: string | number, cur: string) => (hidden ? '••••' : formatMoney(amount, cur as Currency, { showSymbol: true }));

  return (
    <ScreenShell title="" onRefresh={() => { void q.refetch(); }} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 12, gap: 12 }}><Skeleton width={84} height={84} /><Skeleton width={180} height={22} /></View>
      ) : q.isError || !c ? (
        <EmptyState icon="person-outline" title={t('contact.notFound')} actionLabel={t('common.retry')} onAction={() => q.refetch()} />
      ) : (
        <>
          {/* Who */}
          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <Avatar name={c.name} uri={c.avatarUrl ?? undefined} size={84} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }} numberOfLines={1}>{c.name}</Text>
              {c.verified ? <Ionicons name="checkmark-circle" size={18} color={p.accentText} /> : null}
            </View>
            {c.username ? <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 2 }}>@{c.username}</Text> : null}
            <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6 }}>
              {t('contact.memberSince', { date: new Date(c.memberSince).toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' }) })}
            </Text>
          </View>

          {/* Actions */}
          {c.username ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 20 }}>
              {[
                { icon: 'arrow-up' as const, label: t('action.send'), primary: true, onPress: () => router.push({ pathname: '/send', params: { to: c.id, handle: c.username!, name: c.name } } as never) },
                { icon: 'chatbubble-outline' as const, label: t('contact.message'), primary: false, onPress: () => router.push(`/messages/${c.id}` as never) },
              ].map((a) => (
                <Pressable key={a.label} onPress={() => { h.light(); a.onPress(); }} style={({ pressed }) => ({ alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: a.primary ? p.ctaBg : p.bgElev, borderWidth: a.primary ? 0 : StyleSheet.hairlineWidth, borderColor: p.border }}>
                    <Ionicons name={a.icon} size={20} color={a.primary ? p.ctaFg : p.fg} />
                  </View>
                  <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500' }}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Between you */}
          <View style={{ flexDirection: 'row', marginTop: 24, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: p.border }}>
            {[
              { label: t('contact.youSent'), key: 'sent' as const },
              { label: t('contact.youReceived'), key: 'received' as const },
            ].map((col, i) => (
              <View key={col.key} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: p.border }}>
                <Text style={{ color: p.fgMuted, fontSize: 12 }}>{col.label}</Text>
                {(q.data!.summary.byCurrency.filter((b) => Number(b[col.key]) > 0).length ? q.data!.summary.byCurrency.filter((b) => Number(b[col.key]) > 0) : [{ currency: q.data!.summary.byCurrency[0]?.currency ?? 'USD', sent: '0', received: '0' }]).map((b) => (
                  <Text key={b.currency} style={{ color: p.fg, fontSize: 16, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] }}>{money(b[col.key], b.currency)}</Text>
                ))}
              </View>
            ))}
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 12, textAlign: 'center', marginTop: 8 }}>{t('contact.payments', { count: q.data!.summary.count })}</Text>

          {/* Every payment */}
          {groups.map((g) => (
            <View key={g.month}>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginTop: 22, marginBottom: 4 }}>{g.month.toUpperCase()}</Text>
              {g.items.map((i, idx) => {
                const sent = i.direction === 'SENT';
                return (
                  <View key={i.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: sent ? p.bgElev : p.greenBg }}>
                        <Ionicons name={sent ? 'arrow-up' : 'arrow-down'} size={17} color={sent ? p.fg : p.greenFg} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                          {i.note || t(sent ? 'contact.youSentItem' : 'contact.youReceivedItem')}
                        </Text>
                        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                          {[new Date(i.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' }) + ', ' + new Date(i.createdAt).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' }),
                            i.via === 'chat' ? t('contact.viaChat') : i.via === 'link' ? t('contact.viaLink') : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Text style={{ color: sent ? p.fg : p.greenFg, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {hidden ? '••••' : `${sent ? '−' : '+'}${formatMoney(i.amount, i.currency as Currency, { showSymbol: true })}`}
                      </Text>
                    </View>
                    {idx < g.items.length - 1 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginLeft: 50 }} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </>
      )}
    </ScreenShell>
  );
}
