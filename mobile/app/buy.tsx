import { BuyWidget } from '@/components/exchange/BuyWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function Buy() {
  return (
    <ScreenShell title="Buy" scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <BuyWidget />
    </ScreenShell>
  );
}
