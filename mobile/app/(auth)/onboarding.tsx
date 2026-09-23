import { useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { secureStore } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/constants';

export default function Onboarding() {
  const router = useRouter();
  const p = useThemedPalette();
  const t = useT();
  const lastUser = useAuthStore((s) => s.lastUser);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigating = useRef(false);
  useEffect(() => {
    let alive = true;
    secureStore.get(STORAGE_KEYS.onboarded).catch(() => null).then((onboarded) => {
      if (!alive) return;
      if (lastUser) router.replace('/(auth)/welcome-back');
      else if (onboarded) router.replace('/(auth)/login');
      else setReady(true);
    });
    return () => { alive = false; };
  }, [lastUser, router]);

  const finish = async (destination: '/register' | '/login') => {
    if (navigating.current) return;
    navigating.current = true;
    setBusy(true);
    try {
      await secureStore.set(STORAGE_KEYS.onboarded, 'true');
      router.push(destination);
    } catch {
      Alert.alert(t('common.error'), t('common.retry'));
    } finally {
      navigating.current = false;
      setBusy(false);
    }
  };
  if (!ready) return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  return <OnboardingTour onFinish={() => finish('/register')} onLogin={() => finish('/login')} busy={busy} />;
}
