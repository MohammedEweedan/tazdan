import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { View, Pressable, Animated, Dimensions, Image } from 'react-native';
import { TopGradient } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';
import { parseScannedCode } from '@/lib/payCode';

const { width: SCREEN_W } = Dimensions.get('window');
const SCAN_SIZE = Math.min(SCREEN_W * 0.72, 280);

export default function ScannerPage() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const LOGO = require('../assets/logo-white.png');
  const themeMode = useTheme((s) => s.mode);
  const t = useT();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedHandle, setScannedHandle] = useState('');
  const [unknownCode, setUnknownCode] = useState(false);
  const [scannedKind, setScannedKind] = useState<'pay' | 'claim'>('pay');

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const playSuccess = () => {
    h.success();
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  // One parser for every code (see lib/payCode): claim links open the claim
  // flow; a person's or shop's code opens Pay, with any amount the code asks.
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    const code = parseScannedCode(data);
    if (!code) {
      // Not ours — say so and keep scanning.
      setScanned(true);
      setUnknownCode(true);
      h.warning();
      setTimeout(() => { setUnknownCode(false); setScanned(false); }, 1600);
      return;
    }
    setScanned(true);
    setScannedKind(code.kind);
    // Codes of accounts without a handle carry an id — not worth showing.
    setScannedHandle(code.kind === 'claim' ? t('pay.scanner.claim') : /^[A-Za-z0-9_]{1,30}$/.test(code.payee) ? `@${code.payee}` : '');
    playSuccess();
    setTimeout(() => {
      if (code.kind === 'claim') {
        router.replace(`/claim/${code.token}`);
        return;
      }
      router.replace({
        pathname: '/pay/[payee]',
        params: {
          payee: code.payee,
          ...(code.currency ? { currency: code.currency } : {}),
          ...(code.amount ? { amount: code.amount } : {}),
          ...(code.reference ? { ref: code.reference } : {}),
          ...(code.till ? { till: code.till } : {}),
        },
      });
    }, 700);
  };

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
      <TopGradient />
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        <Text style={{ color: p.fgMuted, fontSize: 14 }}>{t('pay.scanner.waiting')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        <Ionicons name="camera-outline" size={48} color={p.fgFaint} />
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          {t('pay.scanner.denied')}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
          {t('pay.scanner.deniedHint')}
        </Text>
        <Pressable
          onPress={requestPermission}
          style={{
            marginTop: 24, paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 22, backgroundColor: p.ctaBg,
          }}
        >
          <Text style={{ color: p.ctaFg, fontSize: 14, fontWeight: '700' }}>{t('pay.scanner.allow')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 12, paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 22, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
          }}
        >
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>{t('pay.scanner.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />

      {/* Camera fills the screen */}
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Dark overlay with clear cutout */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <View style={{ width: SCAN_SIZE, height: SCAN_SIZE }} />
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        </View>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      </View>

      {/* Corner brackets around the scan area */}
      <View pointerEvents="none" style={{
        position: 'absolute',
        top: '50%', left: '50%',
        marginTop: -SCAN_SIZE / 2,
        marginLeft: -SCAN_SIZE / 2,
        width: SCAN_SIZE, height: SCAN_SIZE,
      }}>
        {/* Top-left */}
        <View style={{ position: 'absolute', top: 0, left: 0, width: 28, height: 3, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', top: 0, left: 0, width: 3, height: 28, backgroundColor: '#fff' }} />
        {/* Top-right */}
        <View style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 3, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', top: 0, right: 0, width: 3, height: 28, backgroundColor: '#fff' }} />
        {/* Bottom-left */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: 28, height: 3, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, width: 3, height: 28, backgroundColor: '#fff' }} />
        {/* Bottom-right */}
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 3, backgroundColor: '#fff' }} />
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: 3, height: 28, backgroundColor: '#fff' }} />
      </View>

      {/* Top controls */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
        }}>
          <Pressable
            onPress={() => { h.selection(); router.back(); }}
            hitSlop={8}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '600', marginRight: 48 }}>
            {t('pay.scan')}
          </Text>
        </View>
      </SafeAreaView>

      {/* Bottom hint */}
      <View
        style={{
          position: 'absolute',
          bottom: 42,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Image
          source={LOGO}
          resizeMode="contain"
          style={{
            width: 180, // scaled from 1548x490 (~3.16:1)
            height: 57,
            marginBottom: 14,
          }}
        />

        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontWeight: '600',
          }}
        >
          {unknownCode ? t('pay.scanner.unknown') : t('pay.scanHint')}
        </Text>
      </View>

      {/* Success overlay */}
      {scanned && !unknownCode && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}>
          <Animated.View style={{
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            alignItems: 'center',
          }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: '#22c55e',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={{
              color: '#fff', fontSize: 16, fontWeight: '700',
              marginTop: 16,
            }}>
              {scannedHandle}
            </Text>
            {scannedKind === 'pay' && (
              <Text style={{
                color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4,
              }}>
                {t('pay.scanner.opening')}
              </Text>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}
