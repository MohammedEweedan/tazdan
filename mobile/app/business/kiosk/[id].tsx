/**
 * Till kiosk — a tablet or phone on the counter.
 *
 * Shows the till's QR in the business's brand (colour and logo). The cashier
 * can type an amount first, so the customer only scans and confirms with
 * Face ID from their balance: no card, no PIN said out loud. A payment at
 * this till turns the screen green with the amount and the payer's first
 * name, plays the confirmation, then resets. On a phone the QR and keypad
 * take turns; on a tablet they sit side by side.
 *
 * Leaving: a 2-second hold, then the manager's kiosk PIN (set in Tills;
 * checked by the server, five wrong tries lock it for 15 minutes). With no
 * PIN set, the device owner's Face ID / passcode. The device itself is
 * locked to the app with Guided Access (iOS) or screen pinning (Android), so
 * customers can't swipe home either; the swipe-back gesture and Android back
 * button are off here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { BrandedQr } from '@/components/business/BrandedQr';
import { TazdanMark } from '@/components/business/PlaquePreview';
import { extractErrorMessage, useHaptics, useTransactionSound } from '@/hooks';
import { businessService, type TillPayment } from '@/services/business';
import { brandOr, onBrand } from '@/lib/plaque';
import { isDeviceLocked, kioskLockAvailable, lockDevice, unlockDevice } from '../../../modules/kiosk-lock';

const GREEN = '#0F7B4A';
const CURRENCIES = ['LYD', 'USD'] as const;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
const fmt = (v: string | number) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 3 });

export default function TillKiosk() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const h = useHaptics();
  const { playSuccess } = useTransactionSound();
  const { width, height } = useWindowDimensions();
  const wide = width > height && width >= 700;
  // Side by side on a landscape tablet, stacked on a tall tablet, turns on a phone.
  const split = wide || (width >= 700 && height >= 1000);

  const [typed, setTyped] = useState('');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('LYD');
  const [charge, setCharge] = useState<{ amount: string; currency: string } | null>(null);
  const [pad, setPad] = useState(false);
  const [since, setSince] = useState(() => new Date().toISOString());
  const [paid, setPaid] = useState<TillPayment | null>(null);
  const [exiting, setExiting] = useState(false);
  const [locked, setLocked] = useState(true);
  const [lockHelp, setLockHelp] = useState(false);
  const [lockNoteHidden, setLockNoteHidden] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brandQ = useQuery({ queryKey: ['business-pay-code'], queryFn: businessService.payCode, staleTime: 5 * 60_000 });
  const pinQ = useQuery({ queryKey: ['business', 'kiosk-pin'], queryFn: businessService.kioskPin });
  const brand = brandQ.data?.brand;
  const bg = brandOr(brand?.primary);
  const fg = onBrand(brand?.primary);
  const glass = (a: number) => (fg === '#FFFFFF' ? `rgba(255,255,255,${a})` : `rgba(10,10,11,${a})`);

  const code = useQuery({
    queryKey: ['business', 'till', id, 'code', charge?.amount, charge?.currency],
    queryFn: () => businessService.tillCode(id!, charge?.amount, charge?.currency),
    enabled: !!id,
  });

  // Watch for a payment at this till since the code was shown.
  const feed = useQuery({
    queryKey: ['business', 'till', id, 'kiosk', since],
    queryFn: () => businessService.tillPayments(id!, since),
    enabled: !!id && !paid,
    refetchInterval: 2000,
  });

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPaid(null);
    setCharge(null);
    setTyped('');
    setPad(false);
    setSince(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (paid || !feed.data?.length) return;
    // With an amount on screen, only that payment counts; an open code takes any.
    const match = feed.data.find((x) => !charge || (x.currency === charge.currency && Math.abs(Number(x.amount) - Number(charge.amount)) < 1e-9));
    if (!match) return;
    setPaid(match);
    playSuccess('transfer');
    resetTimer.current = setTimeout(reset, 6000);
  }, [feed.data, charge, paid, playSuccess, reset]);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  // Lock the device to the app where the OS lets the app do it itself, and
  // keep checking (the manager may turn Guided Access on by hand).
  useEffect(() => {
    if (!kioskLockAvailable) return;
    let on = true;
    const check = async () => { const l = await isDeviceLocked(); if (on) setLocked(l); };
    lockDevice().then(check);
    const iv = setInterval(check, 3000);
    return () => { on = false; clearInterval(iv); };
  }, []);

  // No hardware back out of the kiosk on Android: it asks like the hold does.
  const askExitRef = useRef<() => void>(() => {});
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { askExitRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const press = (k: string) => {
    h.selection();
    setTyped((v) => {
      if (k === '⌫') return v.slice(0, -1);
      if (k === '.' && (v.includes('.') || !v)) return v;
      if (v.includes('.') && v.split('.')[1].length >= 3) return v;
      if (v.length >= 9) return v;
      return v === '0' && k !== '.' ? k : v + k;
    });
  };
  const startCharge = () => {
    if (!typed || Number(typed) <= 0) return;
    h.medium();
    setCharge({ amount: typed, currency });
    setPad(false);
    setSince(new Date().toISOString());
  };

  const leave = async () => {
    setExiting(false);
    await unlockDevice();
    if (await isDeviceLocked()) {
      Alert.alert('One more step', Platform.OS === 'ios'
        ? 'Triple-click the side button and enter the Guided Access passcode to unlock this device.'
        : 'Hold Back and Overview together to unpin tazdan.');
    }
    router.back();
  };

  // Hold to exit: manager PIN when one is set, else the device owner's Face ID / passcode.
  const askExit = async () => {
    h.medium();
    if (pinQ.data?.set) { setExiting(true); return; }
    if (pinQ.isLoading) return;
    try {
      const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Leave kiosk mode', disableDeviceFallback: false });
      if (!ok.success) return;
    } catch { /* no biometrics set up: the hold alone */ }
    leave();
  };
  askExitRef.current = askExit;

  const tillName = code.data?.till.name ?? '';
  const qrSize = split ? Math.min(wide ? height * 0.56 : width * 0.5, 420) : Math.min(width * 0.7, height * 0.42, 380);

  if (paid) {
    return (
      <Pressable onPress={reset} style={{ flex: 1, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <StatusBar hidden />
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={78} color="#fff" />
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 28 }}>Paid</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: '#fff', fontSize: 54, fontWeight: '800', marginTop: 6, fontVariant: ['tabular-nums'] }}>{fmt(paid.amount)} {paid.currency}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 18, marginTop: 10 }}>from {paid.payer}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 28 }}>Tap for the next customer</Text>
      </Pressable>
    );
  }

  const qrPanel = (
    <View style={{ alignItems: 'center', justifyContent: 'center', flex: wide ? 1.2 : undefined }}>
      {brandQ.data ? <Text numberOfLines={1} style={{ color: fg, fontSize: wide ? 18 : 16, fontWeight: '800', opacity: 0.95 }}>{brandQ.data.name}</Text> : null}
      <Text style={{ color: glass(0.7), fontSize: 14, fontWeight: '600', marginTop: 2 }}>{tillName}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: fg, fontSize: wide ? 30 : 26, fontWeight: '800', marginTop: 6, textAlign: 'center' }}>
        {charge ? `Pay ${fmt(charge.amount)} ${charge.currency}` : 'Scan to pay'}
      </Text>
      <View style={{ marginTop: 18, padding: 16, backgroundColor: '#fff', borderRadius: 28 }}>
        {code.data ? <BrandedQr value={code.data.url} size={qrSize} brand={brand?.primary} logo={brand?.logoUrl} />
          : <View style={{ width: qrSize, height: qrSize, alignItems: 'center', justifyContent: 'center' }}>
              {code.error ? <Text style={{ color: '#24384F', textAlign: 'center' }}>{extractErrorMessage(code.error, 'This till is closed or unavailable.')}</Text> : <ActivityIndicator color="#24384F" />}
            </View>}
      </View>
      <Text style={{ color: glass(0.78), fontSize: 14, marginTop: 16, textAlign: 'center', maxWidth: 420, lineHeight: 20 }}>
        Open tazdan, tap Scan, and confirm with Face ID. No card or PIN needed.
      </Text>
      {charge ? (
        <Pressable onPress={reset} style={{ marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: glass(0.35) }}>
          <Text style={{ color: fg, fontWeight: '700' }}>Cancel amount</Text>
        </Pressable>
      ) : !split ? (
        <Pressable onPress={() => { h.selection(); setPad(true); }} accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16, backgroundColor: fg, opacity: pressed ? 0.85 : 1 })}>
          <Ionicons name="keypad-outline" size={18} color={bg} />
          <Text style={{ color: bg, fontSize: 16, fontWeight: '800' }}>Enter amount</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const keypad = (
    <View style={{ flex: wide ? 1 : undefined, maxWidth: 420, width: '100%', alignSelf: 'center', justifyContent: 'center' }}>
      {!split ? (
        <Pressable onPress={() => setPad(false)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginBottom: 14 }}>
          <Ionicons name="qr-code-outline" size={16} color={glass(0.8)} />
          <Text style={{ color: glass(0.8), fontWeight: '700' }}>Back to QR (any amount)</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
        {CURRENCIES.map((c) => (
          <Pressable key={c} onPress={() => setCurrency(c)} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, backgroundColor: currency === c ? fg : glass(0.12) }}>
            <Text style={{ color: currency === c ? bg : fg, fontWeight: '800' }}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: fg, fontSize: 44, fontWeight: '800', textAlign: 'center', fontVariant: ['tabular-nums'], marginBottom: 12 }}>
        {typed || '0'} <Text style={{ color: glass(0.6), fontSize: 22 }}>{currency}</Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        {KEYS.map((k) => (
          <Pressable key={k} onPress={() => press(k)} style={({ pressed }) => ({ width: '30%', height: split ? 64 : 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? glass(0.22) : glass(0.1) })}>
            <Text style={{ color: fg, fontSize: 24, fontWeight: '700' }}>{k}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={startCharge} disabled={!typed || Number(typed) <= 0}
        style={({ pressed }) => ({ marginTop: 14, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: fg, opacity: !typed || Number(typed) <= 0 ? 0.4 : pressed ? 0.85 : 1 })}>
        <Text style={{ color: bg, fontSize: 17, fontWeight: '800' }}>Charge {typed ? `${fmt(typed)} ${currency}` : ''}</Text>
      </Pressable>
    </View>
  );

  const showKeypad = !charge && (split || pad);
  const showQr = split || !pad || !!charge;

  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: wide ? 40 : 20, paddingTop: wide ? 40 : 64 }}>
      <Stack.Screen options={{ gestureEnabled: false, animation: 'fade' }} />
      <StatusBar hidden />
      <Pressable onLongPress={askExit} delayLongPress={2000} hitSlop={12} accessibilityLabel="Hold to leave kiosk mode"
        style={{ position: 'absolute', top: wide ? 18 : 44, left: 18, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.5 }}>
        <Ionicons name="lock-closed" size={14} color={fg} />
        <Text style={{ color: fg, fontSize: 12 }}>Hold to exit</Text>
      </Pressable>
      <View style={{ position: 'absolute', top: wide ? 18 : 44, right: 18, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.6 }}>
        <TazdanMark size={16} color={fg} hole={bg} />
        <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>tazdan</Text>
      </View>

      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 24, justifyContent: 'center' }}>
        {showQr ? qrPanel : null}
        {showKeypad ? keypad : null}
      </View>

      {kioskLockAvailable && !locked && !lockNoteHidden ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: glass(0.12), maxWidth: 520 }}>
          <Ionicons name="shield-outline" size={16} color={fg} />
          <Text style={{ color: fg, fontSize: 12, flexShrink: 1 }}>This device isn’t locked to the kiosk yet.</Text>
          <Pressable onPress={() => setLockHelp(true)} hitSlop={8}><Text style={{ color: fg, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' }}>Lock it</Text></Pressable>
          <Pressable onPress={() => setLockNoteHidden(true)} hitSlop={8} accessibilityLabel="Hide"><Ionicons name="close" size={16} color={glass(0.7)} /></Pressable>
        </View>
      ) : null}

      {exiting ? <ManagerPin bg={bg} fg={fg} onCancel={() => setExiting(false)} onOk={leave} /> : null}
      {lockHelp ? <LockHelp bg={bg} fg={fg} onClose={() => setLockHelp(false)} /> : null}
    </View>
  );
}

/** Six-digit manager PIN, checked by the server. */
function ManagerPin({ bg, fg, onOk, onCancel }: { bg: string; fg: string; onOk: () => void; onCancel: () => void }) {
  const h = useHaptics();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);

  const check = async (value: string) => {
    setChecking(true);
    try {
      await businessService.verifyKioskPin(value);
      h.success();
      onOk();
    } catch (e: any) {
      h.error();
      setPin('');
      if (!e?.response) setOffline(true);
      setError(extractErrorMessage(e, 'Could not check the PIN'));
    } finally { setChecking(false); }
  };

  const tap = (k: string) => {
    if (checking || !k) return;
    h.selection();
    setError(null);
    if (k === '⌫') { setPin((v) => v.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 6);
    setPin(next);
    if (next.length === 6) check(next);
  };

  // No connection to check the PIN: the device owner's passcode instead.
  const devicePasscode = async () => {
    const ok = await LocalAuthentication.authenticateAsync({ promptMessage: 'Leave kiosk mode', disableDeviceFallback: false }).catch(() => ({ success: false }));
    if (ok.success) onOk();
  };

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 360, borderRadius: 28, backgroundColor: bg, padding: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
        <Text style={{ color: fg, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>Manager PIN</Text>
        <Text style={{ color: fg, opacity: 0.7, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Enter the kiosk PIN to leave</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: 20 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: fg, backgroundColor: i < pin.length ? fg : 'transparent' }} />
          ))}
        </View>
        <View style={{ minHeight: 20, marginBottom: 8 }}>
          {checking ? <ActivityIndicator color={fg} /> : error ? <Text style={{ color: fg, fontSize: 13, textAlign: 'center', fontWeight: '600' }}>{error}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          {PIN_KEYS.map((k, i) => (
            <Pressable key={`${k}${i}`} onPress={() => tap(k)} disabled={!k} accessibilityLabel={k === '⌫' ? 'Delete' : k || undefined}
              style={({ pressed }) => ({ width: '29%', height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: !k ? 'transparent' : pressed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)' })}>
              <Text style={{ color: fg, fontSize: 24, fontWeight: '700' }}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16 }}>
          <Pressable onPress={onCancel} hitSlop={10}><Text style={{ color: fg, fontWeight: '700' }}>Cancel</Text></Pressable>
          {offline ? <Pressable onPress={devicePasscode} hitSlop={10}><Text style={{ color: fg, fontWeight: '700', opacity: 0.85 }}>Use device passcode</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );
}

/** How to lock the device to the kiosk, per platform. */
function LockHelp({ bg, fg, onClose }: { bg: string; fg: string; onClose: () => void }) {
  const ios = Platform.OS === 'ios';
  const steps = ios ? [
    'Open Settings › Accessibility › Guided Access and turn it on.',
    'Tap Passcode Settings › Set Guided Access Passcode. Use the same 6 digits as your kiosk PIN.',
    'Come back here, triple-click the side button (or Home button) and tap Start.',
    'Customers can’t leave tazdan now. To end it, triple-click and enter the passcode.',
  ] : [
    'Tap Lock now. Android pins tazdan to the screen.',
    'In Settings › Security › App pinning, turn on “Ask for PIN before unpinning” so only staff can unpin.',
    'To leave, hold to exit here and enter the kiosk PIN.',
  ];
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <View style={{ width: '100%', maxWidth: 440, borderRadius: 28, backgroundColor: bg, padding: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
        <Text style={{ color: fg, fontSize: 19, fontWeight: '800' }}>Lock this device to the kiosk</Text>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: fg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: bg, fontSize: 12, fontWeight: '800' }}>{i + 1}</Text>
            </View>
            <Text style={{ color: fg, fontSize: 14, lineHeight: 20, flex: 1 }}>{s}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          {!ios ? (
            <Pressable onPress={async () => { await lockDevice(); onClose(); }}
              style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: fg, opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: bg, fontWeight: '800' }}>Lock now</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ color: fg, fontWeight: '700' }}>{ios ? 'Got it' : 'Close'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
