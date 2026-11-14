/**
 * One till — its figures, recent payments, kiosk and open/close/rename.
 */
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { extractErrorMessage } from '@/hooks';
import { businessService } from '@/services/business';
import { countOf, totalsLine } from '@/lib/tills';

export default function BusinessTill() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const router = useRouter();
  const qc = useQueryClient();
  const tills = useQuery({ queryKey: ['business', 'tills'], queryFn: businessService.tills });
  const payments = useQuery({ queryKey: ['business', 'till', id, 'payments'], queryFn: () => businessService.tillPayments(id!), enabled: !!id, refetchInterval: 15_000 });
  const till = tills.data?.find((t) => t.id === id);

  const toggle = () => {
    if (!till) return;
    Alert.alert(till.active ? 'Close this till?' : 'Reopen this till?', till.active ? 'Its QR stops accepting payments until you reopen it.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: till.active ? 'Close till' : 'Reopen', style: till.active ? 'destructive' : 'default', onPress: async () => {
        try { await businessService.updateTill(till.id, { active: !till.active }); await qc.invalidateQueries({ queryKey: ['business', 'tills'] }); }
        catch (e) { Alert.alert('Could not change the till', extractErrorMessage(e)); }
      } },
    ]);
  };
  const rename = () => {
    if (!till) return;
    Alert.prompt?.('Rename till', undefined, async (name) => {
      if (!name?.trim()) return;
      try { await businessService.updateTill(till.id, { name: name.trim() }); await qc.invalidateQueries({ queryKey: ['business', 'tills'] }); }
      catch (e) { Alert.alert('Could not rename the till', extractErrorMessage(e)); }
    }, 'plain-text', till.name);
  };

  const stat = (label: string, v: any) => (
    <View style={{ flex: 1, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 12 }}>
      <Text style={{ color: p.fgMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{countOf(v)}</Text>
      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{totalsLine(v)}</Text>
      {Object.entries<any>(v).map(([c, x]) => (
        <Text key={c} style={{ color: p.fgFaint, fontSize: 10.5, marginTop: 2 }}>avg {Number(x.average).toLocaleString('en-US', { maximumFractionDigits: 3 })} {c}</Text>
      ))}
    </View>
  );

  return (
    <ScreenShell title={till?.name ?? 'Till'} subtitle={till ? (till.active ? 'Open' : 'Closed') : undefined}
      onRefresh={() => { tills.refetch(); payments.refetch(); }} refreshing={tills.isFetching || payments.isFetching}>
      {till ? (
        <>
          <Pressable disabled={!till.active} onPress={() => router.push(`/business/kiosk/${till.id}` as never)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: p.accent, borderRadius: 16, paddingVertical: 16, marginBottom: 16, opacity: !till.active ? 0.5 : pressed ? 0.85 : 1 })}>
            <Ionicons name="tablet-landscape-outline" size={20} color={p.accentFg} />
            <Text style={{ color: p.accentFg, fontSize: 16, fontWeight: '800' }}>Open kiosk</Text>
          </Pressable>
          <Pressable disabled={!till.active} onPress={() => router.push({ pathname: '/business/plaque', params: { till: till.id } } as never)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: p.border, paddingVertical: 12, marginTop: -6, marginBottom: 16, opacity: !till.active ? 0.5 : pressed ? 0.8 : 1 })}>
            <Ionicons name="pricetag-outline" size={17} color={p.fg} />
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Plaque for this till</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
            {stat('Today', till.today)}{stat('7 days', till.week)}{stat('30 days', till.month)}
          </View>
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>Recent payments</Text>
          {(payments.data ?? []).length ? payments.data!.map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{x.payer}</Text>
                <Text style={{ color: p.fgFaint, fontSize: 11.5, marginTop: 2 }}>{new Date(x.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {x.reference}</Text>
              </View>
              <Text style={{ color: p.greenFg, fontSize: 15, fontWeight: '800' }}>+{Number(x.amount).toLocaleString('en-US', { maximumFractionDigits: 3 })} {x.currency}</Text>
            </View>
          )) : <Text style={{ color: p.fgMuted, marginTop: 8 }}>No payments at this till yet.</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
            <Pressable onPress={rename} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: p.border }}>
              <Text style={{ color: p.fg, fontWeight: '700' }}>Rename</Text>
            </Pressable>
            <Pressable onPress={toggle} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: till.active ? p.redFg : p.border }}>
              <Text style={{ color: till.active ? p.redFg : p.fg, fontWeight: '700' }}>{till.active ? 'Close till' : 'Reopen till'}</Text>
            </Pressable>
          </View>
        </>
      ) : <Text style={{ color: p.fgMuted, marginTop: 40, textAlign: 'center' }}>{tills.isLoading ? 'Loading…' : 'Till not found.'}</Text>}
    </ScreenShell>
  );
}
