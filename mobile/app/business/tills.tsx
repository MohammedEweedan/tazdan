/**
 * Tills — the business's checkout points. Each has its own QR and kiosk;
 * payments made at it are counted here per till (today, 7 days, 30 days).
 * The manager sets the kiosk PIN here: it is what lets staff leave a kiosk.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { extractErrorMessage, useHaptics } from '@/hooks';
import { businessService, type BusinessTill, type TillTotals } from '@/services/business';
import { countOf, totalsLine } from '@/lib/tills';

export default function BusinessTills() {
  const p = useThemedPalette();
  const h = useHaptics();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['business', 'tills'], queryFn: businessService.tills, refetchInterval: 30_000 });
  const pin = useQuery({ queryKey: ['business', 'kiosk-pin'], queryFn: businessService.kioskPin });
  const [pinOpen, setPinOpen] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const till = await businessService.createTill(name.trim());
      setName('');
      h.success();
      await qc.invalidateQueries({ queryKey: ['business', 'tills'] });
      router.push(`/business/till/${till.id}` as never);
    } catch (e) { Alert.alert('Could not add the till', extractErrorMessage(e)); } finally { setBusy(false); }
  };

  const tills = q.data ?? [];
  return (
    <ScreenShell title="Tills" subtitle="Checkout points, each with its own QR" onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        <TextInput value={name} onChangeText={setName} placeholder="New till, e.g. Front counter" placeholderTextColor={p.fgFaint} maxLength={40}
          onSubmitEditing={create} returnKeyType="done"
          style={{ flex: 1, color: p.fg, fontSize: 15, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, paddingVertical: 12 }} />
        <Pressable onPress={create} disabled={busy || !name.trim()}
          style={({ pressed }) => ({ paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', backgroundColor: p.accent, opacity: busy || !name.trim() ? 0.5 : pressed ? 0.85 : 1 })}>
          {busy ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontWeight: '700' }}>Add</Text>}
        </Pressable>
      </View>

      <Pressable onPress={() => { h.selection(); setPinOpen((v) => !v); }} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: pinOpen ? 0 : 18, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pin.data?.set ? p.greenBg : p.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="lock-closed-outline" size={18} color={pin.data?.set ? p.greenFg : p.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>Kiosk PIN</Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
            {pin.data?.lockedUntil && new Date(pin.data.lockedUntil) > new Date() ? 'Locked after wrong tries — try again shortly'
              : pin.data?.set ? 'Set — staff need it to leave a kiosk' : 'Not set — set one before using a kiosk'}
          </Text>
        </View>
        <Text style={{ color: p.accentText, fontWeight: '700' }}>{pin.data?.set ? 'Change' : 'Set'}</Text>
      </Pressable>
      {pinOpen ? <PinSetter onDone={() => { setPinOpen(false); pin.refetch(); }} /> : null}

      {q.isLoading ? <ActivityIndicator color={p.fgMuted} style={{ marginTop: 40 }} /> : null}
      {q.error ? <Text style={{ color: p.redFg }}>{extractErrorMessage(q.error)}</Text> : null}
      {!q.isLoading && !tills.length && !q.error ? (
        <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 40, lineHeight: 20 }}>
          Add a till for each checkout point. Customers scan its code and pay from their balance — no card, no PIN at the counter.
        </Text>
      ) : null}

      {tills.map((t: BusinessTill) => (
        <Pressable key={t.id} onPress={() => router.push(`/business/till/${t.id}` as never)}
          style={({ pressed }) => ({ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16, marginBottom: 10, opacity: pressed ? 0.8 : t.active ? 1 : 0.6 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="storefront-outline" size={20} color={p.fg} />
            <Text style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{t.name}</Text>
            {!t.active ? <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '700' }}>CLOSED</Text> : null}
            <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            {[['Today', t.today], ['7 days', t.week], ['30 days', t.month]].map(([label, v]) => (
              <View key={label as string} style={{ flex: 1, backgroundColor: p.bg, borderRadius: 10, padding: 10 }}>
                <Text style={{ color: p.fgMuted, fontSize: 11 }}>{label as string}</Text>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800', marginTop: 2 }}>{countOf(v as TillTotals)}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 11 }} numberOfLines={1}>{totalsLine(v as TillTotals)}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

/** New 6-digit kiosk PIN, typed twice. The server refuses easy ones (111111, 123456). */
function PinSetter({ onDone }: { onDone: () => void }) {
  const p = useThemedPalette();
  const h = useHaptics();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = /^\d{6}$/.test(a) && a === b;
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try { await businessService.setKioskPin(a); h.success(); Alert.alert('Kiosk PIN saved', 'Use it to leave kiosk mode. On iPhone and iPad, use the same digits as the Guided Access passcode.'); onDone(); }
    catch (e) { h.error(); Alert.alert('PIN not saved', extractErrorMessage(e)); }
    finally { setBusy(false); }
  };
  const field = { flex: 1, color: p.fg, fontSize: 20, letterSpacing: 8, textAlign: 'center' as const, backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingVertical: 12 };
  return (
    <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0, padding: 14, marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput value={a} onChangeText={(v) => setA(v.replace(/\D/g, '').slice(0, 6))} placeholder="New PIN" placeholderTextColor={p.fgFaint}
          keyboardType="number-pad" secureTextEntry maxLength={6} style={field} />
        <TextInput value={b} onChangeText={(v) => setB(v.replace(/\D/g, '').slice(0, 6))} placeholder="Again" placeholderTextColor={p.fgFaint}
          keyboardType="number-pad" secureTextEntry maxLength={6} style={field} />
      </View>
      {b.length === 6 && a !== b ? <Text style={{ color: p.redFg, fontSize: 12, marginTop: 8 }}>The two PINs don’t match.</Text> : null}
      <Pressable onPress={save} disabled={!ok || busy}
        style={({ pressed }) => ({ marginTop: 12, paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: p.accent, opacity: !ok ? 0.5 : pressed ? 0.85 : 1 })}>
        {busy ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontWeight: '700' }}>Save PIN</Text>}
      </Pressable>
    </View>
  );
}
