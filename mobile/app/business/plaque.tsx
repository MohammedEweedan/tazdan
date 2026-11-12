/**
 * Till plaques — the sign on the counter. The business's logo sits in the
 * middle of the QR, its name and colours frame it, and the footer carries
 * the tazdan ن with "tazdan accepted here" in the chosen language.
 *
 * Print one now (or save a PDF), or order finished plaques: tazdan confirms
 * the order by phone, produces and ships it; the status shows here and the
 * order can be cancelled until production starts.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { PlaquePreview } from '@/components/business/PlaquePreview';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n } from '@/store/i18nStore';
import { extractErrorMessage, useHaptics } from '@/hooks';
import { businessService, type PlaqueOrder, type PlaqueSize } from '@/services/business';
import { PLAQUE_LOCALES, plaqueHtml, plaqueText } from '@/lib/plaque';
import { logoDataUri } from '@/lib/brandAssets';

const SIZES: Array<{ key: PlaqueSize; label: string; hint: string }> = [
  { key: 'A6', label: 'Counter card', hint: 'A6 · 105 × 148 mm' },
  { key: 'STAND', label: 'Desk stand', hint: 'Acrylic · 100 × 150 mm' },
  { key: 'A5', label: 'Wall sign', hint: 'A5 · 148 × 210 mm' },
];
const STATUS: Record<PlaqueOrder['status'], string> = {
  REQUESTED: 'Requested — we will call to confirm', IN_PRODUCTION: 'In production', SHIPPED: 'On its way', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

export default function BusinessPlaque() {
  const p = useThemedPalette();
  const h = useHaptics();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const appLocale = useI18n((s) => s.locale);

  const code = useQuery({ queryKey: ['business-pay-code'], queryFn: businessService.payCode });
  const tills = useQuery({ queryKey: ['business', 'tills'], queryFn: businessService.tills });
  const orders = useQuery({ queryKey: ['business', 'plaques'], queryFn: businessService.plaqueOrders });

  const params = useLocalSearchParams<{ till?: string }>();
  const [tillId, setTillId] = useState<string | null>(typeof params.till === 'string' ? params.till : null);
  const [locale, setLocale] = useState<string>(PLAQUE_LOCALES.some((l) => l.code === appLocale) ? appLocale : 'en');
  const [size, setSize] = useState<PlaqueSize>('A6');
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'print' | 'pdf' | 'order'>(null);
  const [ordering, setOrdering] = useState(false);
  const [form, setForm] = useState({ quantity: 1, shippingName: '', shippingPhone: '', shippingAddress: '', shippingCity: '', notes: '' });

  const openTills = (tills.data ?? []).filter((t) => t.active);
  const till = openTills.find((t) => t.id === tillId) ?? null;
  const tillCode = useQuery({
    queryKey: ['business', 'till', tillId, 'code'],
    queryFn: () => businessService.tillCode(tillId!),
    enabled: !!tillId,
  });
  const value = tillId ? tillCode.data?.url : code.data?.payUrl;

  const logoUrl = code.data?.brand.logoUrl ?? null;
  useEffect(() => { let on = true; logoDataUri(logoUrl).then((d) => { if (on) setLogo(d); }); return () => { on = false; }; }, [logoUrl]);
  useEffect(() => { if (code.data && !form.shippingName) setForm((f) => ({ ...f, shippingName: code.data!.name })); }, [code.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const html = useMemo(() => (code.data && value ? plaqueHtml({
    name: code.data.name, value, primary: code.data.brand.primary, secondary: code.data.brand.secondary,
    logo, locale, size, till: till?.name ?? null,
  }) : null), [code.data, value, logo, locale, size, till]);

  const print = async () => {
    if (!html || busy) return;
    setBusy('print'); h.selection();
    try { await Print.printAsync({ html }); } catch (e) { Alert.alert('Could not print', extractErrorMessage(e)); } finally { setBusy(null); }
  };
  const pdf = async () => {
    if (!html || busy) return;
    setBusy('pdf'); h.selection();
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Plaque PDF' });
    } catch (e) { Alert.alert('Could not make the PDF', extractErrorMessage(e)); } finally { setBusy(null); }
  };

  const formOk = form.shippingName.trim().length >= 2 && form.shippingPhone.trim().length >= 6 && form.shippingAddress.trim().length >= 5 && form.shippingCity.trim().length >= 2;
  const order = async () => {
    if (!formOk || busy) return;
    setBusy('order');
    try {
      await businessService.orderPlaques({
        tillId, quantity: form.quantity, size, locale,
        shippingName: form.shippingName.trim(), shippingPhone: form.shippingPhone.trim(),
        shippingAddress: form.shippingAddress.trim(), shippingCity: form.shippingCity.trim(), notes: form.notes.trim() || null,
      });
      h.success();
      setOrdering(false);
      await qc.invalidateQueries({ queryKey: ['business', 'plaques'] });
      Alert.alert('Order sent', 'We will call you to confirm the price and delivery before we make it.');
    } catch (e) {
      h.error();
      Alert.alert('Order not sent', extractErrorMessage(e));
    } finally { setBusy(null); }
  };

  const cancel = (o: PlaqueOrder) => Alert.alert('Cancel this order?', undefined, [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Cancel order', style: 'destructive', onPress: async () => {
      try { await businessService.cancelPlaque(o.id); await qc.invalidateQueries({ queryKey: ['business', 'plaques'] }); }
      catch (e) { Alert.alert('Could not cancel', extractErrorMessage(e)); }
    } },
  ]);

  const previewW = Math.min(width - 96, 300);
  const chip = (on: boolean) => ({ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: on ? p.accent : p.border, backgroundColor: on ? p.accent : p.bgElev });
  const chipText = (on: boolean) => ({ color: on ? p.accentFg : p.fg, fontSize: 13, fontWeight: '600' as const });
  const input = { color: p.fg, fontSize: 15, backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 } as const;

  return (
    <ScreenShell title="Till plaques" subtitle="Your logo, your colours, tazdan accepted here" keyboard
      onRefresh={() => { code.refetch(); orders.refetch(); tills.refetch(); }} refreshing={code.isFetching || orders.isFetching}>
      {code.isLoading ? <ActivityIndicator color={p.fgMuted} style={{ marginTop: 40 }} /> : code.error || !code.data ? (
        <Text style={{ color: p.redFg, marginTop: 30, textAlign: 'center' }}>{extractErrorMessage(code.error)}</Text>
      ) : (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            {value ? (
              <PlaquePreview width={previewW} name={code.data.name} value={value} primary={code.data.brand.primary}
                secondary={code.data.brand.secondary} logo={logo ?? logoUrl} locale={locale} till={till?.name ?? null} />
            ) : <View style={{ width: previewW, height: previewW * 1.41, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={p.fgMuted} /></View>}
          </View>

          <Label>CODE</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable onPress={() => setTillId(null)} style={chip(!tillId)}><Text style={chipText(!tillId)}>Main code</Text></Pressable>
            {openTills.map((t) => (
              <Pressable key={t.id} onPress={() => setTillId(t.id)} style={chip(tillId === t.id)}><Text style={chipText(tillId === t.id)}>{t.name}</Text></Pressable>
            ))}
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6 }}>A till's code counts its payments under that till.</Text>

          <Label>LANGUAGE</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PLAQUE_LOCALES.map((l) => (
              <Pressable key={l.code} onPress={() => setLocale(l.code)} style={chip(locale === l.code)}><Text style={chipText(locale === l.code)}>{l.label}</Text></Pressable>
            ))}
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6 }}>“{plaqueText(locale).accepted}”</Text>

          <Label>SIZE</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SIZES.map((s) => (
              <Pressable key={s.key} onPress={() => setSize(s.key)} style={[chip(size === s.key), { flex: 1, alignItems: 'center', paddingVertical: 10 }]}>
                <Text style={chipText(size === s.key)}>{s.label}</Text>
                <Text style={{ color: size === s.key ? p.accentFg : p.fgMuted, fontSize: 10, marginTop: 2, opacity: 0.85 }}>{s.hint}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Action icon="print-outline" label="Print" busy={busy === 'print'} onPress={print} />
            <Action icon="document-outline" label="Save PDF" busy={busy === 'pdf'} onPress={pdf} />
            <Action icon="cart-outline" label="Order plaques" primary onPress={() => { h.selection(); setOrdering((v) => !v); }} />
          </View>

          {ordering ? (
            <View style={{ backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border, padding: 16, marginTop: 14 }}>
              <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>Order finished plaques</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                {SIZES.find((s) => s.key === size)!.label}, {PLAQUE_LOCALES.find((l) => l.code === locale)!.label}{till ? `, ${till.name}` : ''}. We call to confirm the price and delivery before production.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
                <Text style={{ color: p.fg, fontWeight: '600', flex: 1 }}>Quantity</Text>
                <Stepper value={form.quantity} onChange={(quantity) => setForm((f) => ({ ...f, quantity }))} />
              </View>
              <TextInput value={form.shippingName} onChangeText={(v) => setForm((f) => ({ ...f, shippingName: v }))} placeholder="Name on the delivery" placeholderTextColor={p.fgFaint} maxLength={120} style={input} />
              <TextInput value={form.shippingPhone} onChangeText={(v) => setForm((f) => ({ ...f, shippingPhone: v }))} placeholder="Phone, e.g. +218 91 000 0000" placeholderTextColor={p.fgFaint} keyboardType="phone-pad" maxLength={30} style={input} />
              <TextInput value={form.shippingAddress} onChangeText={(v) => setForm((f) => ({ ...f, shippingAddress: v }))} placeholder="Street and building" placeholderTextColor={p.fgFaint} maxLength={300} style={input} />
              <TextInput value={form.shippingCity} onChangeText={(v) => setForm((f) => ({ ...f, shippingCity: v }))} placeholder="City" placeholderTextColor={p.fgFaint} maxLength={80} style={input} />
              <TextInput value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Notes (optional)" placeholderTextColor={p.fgFaint} maxLength={500} multiline style={[input, { minHeight: 60, textAlignVertical: 'top' }]} />
              <Pressable onPress={order} disabled={!formOk || !!busy}
                style={({ pressed }) => ({ marginTop: 14, paddingVertical: 15, borderRadius: 14, alignItems: 'center', backgroundColor: p.accent, opacity: !formOk ? 0.5 : pressed ? 0.85 : 1 })}>
                {busy === 'order' ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontWeight: '800', fontSize: 15 }}>Send order</Text>}
              </Pressable>
            </View>
          ) : null}

          {(orders.data ?? []).length ? <Label>YOUR ORDERS</Label> : null}
          {(orders.data ?? []).map((o) => (
            <View key={o.id} style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700', flex: 1 }}>
                  {o.quantity} × {SIZES.find((s) => s.key === o.size)?.label ?? o.size} · {PLAQUE_LOCALES.find((l) => l.code === o.locale)?.label ?? o.locale}
                </Text>
                <Text style={{ color: p.fgFaint, fontSize: 12 }}>{new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
              </View>
              <Text style={{ color: o.status === 'CANCELLED' ? p.fgMuted : o.status === 'DELIVERED' ? p.greenFg : p.fg, fontSize: 13, marginTop: 4 }}>{STATUS[o.status]}</Text>
              {o.statusNote && o.status !== 'CANCELLED' ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{o.statusNote}</Text> : null}
              {o.status === 'REQUESTED' ? (
                <Pressable onPress={() => cancel(o)} hitSlop={8} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                  <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600' }}>Cancel order</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <View style={{ height: 24 }} />
        </>
      )}
    </ScreenShell>
  );
}

function Label({ children }: { children: string }) {
  const p = useThemedPalette();
  return <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginTop: 20, marginBottom: 10 }}>{children}</Text>;
}

function Action({ icon, label, onPress, busy, primary }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean; primary?: boolean }) {
  const p = useThemedPalette();
  const fg = primary ? p.accentFg : p.fg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: primary ? p.accent : p.bgElev, opacity: pressed ? 0.8 : 1 })}>
      {busy ? <ActivityIndicator color={fg} /> : <Ionicons name={icon} size={20} color={fg} />}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const p = useThemedPalette();
  const btn = { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: p.bg, borderWidth: 1, borderColor: p.border };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => onChange(Math.max(1, value - 1))} style={btn} accessibilityLabel="Fewer"><Ionicons name="remove" size={18} color={p.fg} /></Pressable>
      <Text style={{ color: p.fg, fontSize: 17, fontWeight: '800', minWidth: 22, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(20, value + 1))} style={btn} accessibilityLabel="More"><Ionicons name="add" size={18} color={p.fg} /></Pressable>
    </View>
  );
}
