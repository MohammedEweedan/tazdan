import { useRouter } from 'expo-router';
import { RecurringBuyWidget } from '@/components/exchange/RecurringBuyWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

export default function Recurring() {
  const t = useT();
  const router = useRouter();
  return (
    <ScreenShell closeOnly title={t('recurring.title')} contentStyle={{ paddingHorizontal: 0 }}>
      <RecurringBuyWidget onDone={() => router.back()} />
    </ScreenShell>
  );
}
