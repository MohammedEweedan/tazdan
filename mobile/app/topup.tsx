/**
 * Top-up route. Renders the shared TopupBody inside a ScreenShell so
 * deep links / push notifications can land here directly. The same
 * body is used inside a BottomSheet from the home screen.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TopupBody } from '@/components/topup/TopupSheet';
import { useThemedPalette } from '@/store/themeStore';
import type { Currency } from '@/types';

export default function Topup() {
  const router = useRouter();
  const p = useThemedPalette();
  const params = useLocalSearchParams<{ currency?: string }>();
  const initial = (params.currency as Currency | undefined) || undefined;

  return (
    <ScreenShell title="Top up balance" scroll>
      <TopupBody
        palette={p}
        initialCurrency={initial}
        onComplete={() => router.back()}
      />
    </ScreenShell>
  );
}
