/**
 * Business payment QR — the one code a business is paid into.
 *
 * The code links to the business account's id (server: payCode.service), so
 * it never changes, even if the @handle does. It carries the business's
 * brand (colour and logo, set in Brand). Print it as a branded poster, save
 * it as an image, share the link, or add it to Apple Wallet / Google Wallet
 * to show as a card. Wallet cards are issued once the business is verified.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Share, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useHaptics } from '@/hooks';
import { extractErrorMessage } from '@/hooks';
import { businessService, type BusinessPayCode } from '@/services/business';
import { BrandedQr } from '@/components/business/BrandedQr';
import { brandOr, plaqueHtml, PLAQUE_LOCALES } from '@/lib/plaque';
import { logoDataUri } from '@/lib/brandAssets';

type Busy = null | 'print' | 'save' | 'wallet';

export default function BusinessQr() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const router = useRouter();
  const appLocale = useI18n((s) => s.locale);
  const posterLocale = PLAQUE_LOCALES.some((l) => l.code === appLocale) ? appLocale : 'en';
  const { data: code, isLoading, error, refetch } = useQuery({ queryKey: ['business-pay-code'], queryFn: businessService.payCode });
  const [busy, setBusy] = useState<Busy>(null);
  // The logo inlined, so print and the saved image never miss it.
  const [logo, setLogo] = useState<string | null>(null);
  const logoUrl = code?.brand.logoUrl ?? null;
  useEffect(() => { let on = true; logoDataUri(logoUrl).then((d) => { if (on) setLogo(d); }); return () => { on = false; }; }, [logoUrl]);
  // A large copy of the code, off screen, for print and image export.
  const exportRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);

  const png = () => new Promise<string>((resolve, reject) => {
    if (!exportRef.current) return reject(new Error('QR not ready'));
    exportRef.current.toDataURL(resolve);
  });

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind); h.selection();
    try { await fn(); }
    catch (e) { h.error(); Alert.alert(t('bizqr.failed'), extractErrorMessage(e, t('pay.loadFailedHint'))); }
    finally { setBusy(null); }
  };

  const onPrint = (c: BusinessPayCode) => run('print', async () => {
    await Print.printAsync({
      html: plaqueHtml({
        name: c.name, value: c.payUrl, primary: c.brand.primary, secondary: c.brand.secondary,
        logo: logo, locale: posterLocale, size: 'A4', till: c.handle ? `@${c.handle}` : null,
      }),
    });
  });

  const onSave = (c: BusinessPayCode) => run('save', async () => {
    const out = new File(Paths.cache, `tazdan-pay-${c.handle ?? 'business'}.png`);
    if (out.exists) out.delete();
    out.create();
    out.write(await png(), { encoding: 'base64' });
    // The share sheet carries "Save Image" (iOS) / save to Photos or Files.
    await Sharing.shareAsync(out.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('bizqr.save') });
  });

  const onShare = (c: BusinessPayCode) => {
    h.light();
    Share.share({ message: t('bizqr.shareText', { name: c.name, url: c.payUrl }) });
  };

  // Safari adds the pass when it opens the .pkpass link; Google Wallet opens
  // its own save page. Neither needs a native module.
  const onWallet = () => run('wallet', async () => {
    const url = Platform.OS === 'ios' ? await businessService.appleWalletUrl() : await businessService.googleWalletUrl();
    await Linking.openURL(url);
  });

  const walletReady = Platform.OS === 'ios' ? code?.wallet.apple : Platform.OS === 'android' ? code?.wallet.google : false;

  return (
    <ScreenShell title={t('bizqr.title')}>
      {isLoading ? (
        <View style={{ paddingTop: 80, alignItems: 'center' }}><ActivityIndicator color={p.fgMuted} /></View>
      ) : error || !code ? (
        <View style={{ paddingTop: 80, alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{t('bizqr.loadFailed')}</Text>
          <Pressable onPress={() => refetch()} hitSlop={10} accessibilityRole="button" style={{ marginTop: 14 }}>
            <Text style={{ color: p.accentText, fontSize: 14, fontWeight: '600' }}>{t('pay.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          {/* White on purpose: scanners need the light quiet zone. */}
          <View style={{
            width: '100%', maxWidth: 340, alignItems: 'center', backgroundColor: '#FFFFFF',
            borderRadius: 24, paddingTop: 26, paddingBottom: 22, paddingHorizontal: 20,
          }}>
            <BrandedQr value={code.payUrl} size={232} brand={code.brand.primary} logo={logo ?? logoUrl} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, maxWidth: '100%' }}>
              <Text numberOfLines={1} style={{ color: brandOr(code.brand.primary), fontSize: 20, fontWeight: '700', letterSpacing: -0.3, flexShrink: 1 }}>{code.name}</Text>
              {code.verified && <Ionicons name="checkmark-circle" size={18} color="#24384F" accessibilityLabel={t('pay.business')} />}
            </View>
            {!!code.handle && <Text style={{ color: '#5B6470', fontSize: 14, fontWeight: '500', marginTop: 2 }}>@{code.handle}</Text>}
            <Text style={{ color: '#5B6470', fontSize: 13, marginTop: 10 }}>{t('bizqr.scan')}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 24 }}>
            <RoundAction icon="print-outline" label={t('bizqr.print')} busy={busy === 'print'} onPress={() => onPrint(code)} />
            <RoundAction icon="download-outline" label={t('bizqr.save')} busy={busy === 'save'} onPress={() => onSave(code)} />
            <RoundAction icon="share-outline" label={t('bizqr.share')} onPress={() => onShare(code)} />
          </View>

          {walletReady && (
            <Pressable
              onPress={onWallet}
              disabled={!!busy}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginTop: 24, height: 50, borderRadius: 25, paddingHorizontal: 22, minWidth: 240,
                backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: pressed || busy === 'wallet' ? 0.8 : 1,
              })}
            >
              {busy === 'wallet' ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />}
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                {Platform.OS === 'ios' ? t('bizqr.apple') : t('bizqr.google')}
              </Text>
            </Pressable>
          )}

          <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 22, paddingHorizontal: 12 }}>
            {code.verified ? t('bizqr.permanent') : t('bizqr.unverified')}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <Pressable onPress={() => router.push('/business/brand' as never)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, backgroundColor: p.bgElev, opacity: pressed ? 0.8 : 1 })}>
              <Ionicons name="color-palette-outline" size={17} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Logo & colours</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/business/plaque' as never)} accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, backgroundColor: p.bgElev, opacity: pressed ? 0.8 : 1 })}>
              <Ionicons name="pricetag-outline" size={17} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Till plaques</Text>
            </Pressable>
          </View>

          <View pointerEvents="none" style={{ position: 'absolute', left: -4000, top: 0, opacity: 0 }}>
            <BrandedQr value={code.payUrl} size={1024} quietZone={64} brand={code.brand.primary} logo={logo}
              getRef={(c) => { exportRef.current = c as any; }} />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

function RoundAction({ icon, label, onPress, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; busy?: boolean }) {
  const p = useThemedPalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={p.fg} /> : <Ionicons name={icon} size={22} color={p.fg} />}
      </View>
      <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}
