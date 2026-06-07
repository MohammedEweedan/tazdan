import { SellWidget } from '@/components/exchange/SellWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function Sell() {
  return (
    <ScreenShell title="Sell" scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <SellWidget />
    </ScreenShell>
  );
}
