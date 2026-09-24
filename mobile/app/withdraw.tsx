import { WithdrawWidget } from '@/components/exchange/WithdrawWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

export default function Withdraw() {
  const t = useT();
  return (
    <ScreenShell closeOnly title={t('action.withdraw')} keyboard contentStyle={{ paddingHorizontal: 0 }}>
      <WithdrawWidget />
    </ScreenShell>
  );
}
