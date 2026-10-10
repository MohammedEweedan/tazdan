import { useLocalSearchParams } from 'expo-router';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { FiatExchangeWidget } from '@/components/exchange/FiatExchangeWidget';

export default function Exchange() {
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();
  return <ScreenShell closeOnly scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
    <FiatExchangeWidget initialFrom={from} initialTo={to} />
  </ScreenShell>;
}
