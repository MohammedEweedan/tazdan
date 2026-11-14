/**
 * Brand — the business's logo and colours, used on its pay QR, printed
 * poster, till plaques and kiosk. Colours are #RRGGBB; a colour too light
 * for a scanner still brands the plaque, while the QR itself falls back to
 * navy (lib/plaque qrInk).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { PlaquePreview } from '@/components/business/PlaquePreview';
import { useThemedPalette } from '@/store/themeStore';
import { extractErrorMessage, useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import { BRAND_PRESETS, contrastWarning } from '@/lib/plaque';

const HEX = /^#[0-9A-F]{6}$/i;
const tidy = (v: string) => {
  const x = v.trim().replace(/^#?/, '#').toUpperCase();
  return x.slice(0, 7);
};

export default function BusinessBrand() {
  const p = useThemedPalette();
  const h = useHaptics();
  const router = useRouter();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const profile = useQuery({ queryKey: ['business', 'profile'], queryFn: businessService.profile });
  const code = useQuery({ queryKey: ['business-pay-code'], queryFn: businessService.payCode });

  const [primary, setPrimary] = useState('#24384F');
  const [secondary, setSecondary] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [editing, setEditing] = useState<'primary' | 'secondary'>('primary');
  const [busy, setBusy] = useState<null | 'logo' | 'save'>(null);

  useEffect(() => {
    if (!profile.data) return;
    setPrimary(profile.data.brandPrimary ?? '#24384F');
    setSecondary(profile.data.brandSecondary ?? '');
    setLogo(profile.data.logoUrl ?? null);
  }, [profile.data]);

  const name = profile.data?.tradingName || profile.data?.legalName || 'Your business';
  const current = editing === 'primary' ? primary : secondary;
  const setCurrent = editing === 'primary' ? setPrimary : setSecondary;
  const valid = HEX.test(primary) && (!secondary || HEX.test(secondary));
  const warn = HEX.test(primary) ? contrastWarning(primary) : null;

  const pickLogo = async () => {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photos access needed', 'Allow tazdan to read your photos to choose a logo.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy('logo');
    try {
      // Square, 512 px, PNG — sharp on a printed plaque, small to upload.
      const ctx = ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 512, height: 512 });
      const img = await ctx.renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.PNG, base64: true });
      if (!out.base64) throw new Error('Could not read the image');
      const url = await businessService.uploadLogo(out.base64);
      setLogo(url);
      h.success();
      qc.invalidateQueries({ queryKey: ['business', 'profile'] });
      qc.invalidateQueries({ queryKey: ['business-pay-code'] });
    } catch (e) {
      h.error();
      Alert.alert('Logo not uploaded', extractErrorMessage(e));
    } finally { setBusy(null); }
  };

  const removeLogo = () => Alert.alert('Remove logo?', 'Your QR and plaques will show the tazdan mark instead.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try {
        await businessService.updateProfile({ logoUrl: null });
        setLogo(null);
        qc.invalidateQueries({ queryKey: ['business', 'profile'] });
        qc.invalidateQueries({ queryKey: ['business-pay-code'] });
      } catch (e) { Alert.alert('Could not remove the logo', extractErrorMessage(e)); }
    } },
  ]);

  const save = async () => {
    if (!valid || busy) return;
    setBusy('save');
    try {
      await businessService.updateProfile({ brandPrimary: primary, brandSecondary: secondary || null });
      h.success();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['business', 'profile'] }),
        qc.invalidateQueries({ queryKey: ['business-pay-code'] }),
      ]);
      router.back();
    } catch (e) {
      h.error();
      Alert.alert('Brand not saved', extractErrorMessage(e));
    } finally { setBusy(null); }
  };

  const previewW = Math.min(width - 120, 260);

  return (
    <ScreenShell title="Brand" subtitle="Logo and colours for your QR and plaques" keyboard>
      {profile.isLoading ? <ActivityIndicator color={p.fgMuted} style={{ marginTop: 40 }} /> : (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <PlaquePreview width={previewW} name={name} value={code.data?.payUrl ?? 'https://tazdan.com'}
              primary={HEX.test(primary) ? primary : null} secondary={HEX.test(secondary) ? secondary : null}
              logo={logo} locale="en" />
          </View>

          <Section title="LOGO">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logo ? <Image source={{ uri: logo }} style={{ width: 56, height: 56, borderRadius: 12 }} resizeMode="contain" />
                  : <Ionicons name="image-outline" size={24} color="#8A94A3" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{logo ? 'Your logo' : 'No logo yet'}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>Square works best. It sits in the middle of your QR.</Text>
              </View>
              <Pressable onPress={pickLogo} disabled={!!busy} accessibilityRole="button"
                style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: p.accent, opacity: pressed ? 0.85 : 1 })}>
                {busy === 'logo' ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontWeight: '700' }}>{logo ? 'Change' : 'Upload'}</Text>}
              </Pressable>
            </View>
            {logo ? (
              <Pressable onPress={removeLogo} hitSlop={8} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '600' }}>Remove logo</Text>
              </Pressable>
            ) : null}
          </Section>

          <Section title="COLOURS">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['primary', 'secondary'] as const).map((k) => {
                const v = k === 'primary' ? primary : secondary;
                const on = editing === k;
                return (
                  <Pressable key={k} onPress={() => { h.selection(); setEditing(k); }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? p.accent : p.border, backgroundColor: p.bg }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: HEX.test(v) ? v : 'transparent', borderWidth: 1, borderColor: p.border }} />
                    <View>
                      <Text style={{ color: p.fgMuted, fontSize: 11 }}>{k === 'primary' ? 'Main' : 'Second (optional)'}</Text>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{v || 'None'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {BRAND_PRESETS.map((c) => (
                <Pressable key={c} onPress={() => { h.selection(); setCurrent(c); }} accessibilityLabel={c}
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: current === c ? 3 : 0, borderColor: p.fg }} />
              ))}
              {editing === 'secondary' && secondary ? (
                <Pressable onPress={() => setSecondary('')} accessibilityLabel="No second colour"
                  style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color={p.fgMuted} />
                </Pressable>
              ) : null}
            </View>
            <TextInput value={current} onChangeText={(v) => setCurrent(tidy(v))} autoCapitalize="characters" autoCorrect={false} maxLength={7}
              placeholder="#RRGGBB" placeholderTextColor={p.fgFaint}
              style={{ marginTop: 14, color: p.fg, fontSize: 15, fontVariant: ['tabular-nums'], backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: current && !HEX.test(current) ? p.redFg : p.border, paddingHorizontal: 14, paddingVertical: 12 }} />
            {warn ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>{warn}</Text> : null}
          </Section>

          <Pressable onPress={save} disabled={!valid || !!busy} accessibilityRole="button"
            style={({ pressed }) => ({ marginTop: 8, marginBottom: 24, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: p.accent, opacity: !valid ? 0.5 : pressed ? 0.85 : 1 })}>
            {busy === 'save' ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontSize: 16, fontWeight: '700' }}>Save brand</Text>}
          </Pressable>
        </>
      )}
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 }}>{title}</Text>
      <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 16 }}>{children}</View>
    </View>
  );
}
