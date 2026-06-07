import { SendWidget } from '@/components/exchange/SendWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function Send() {
  return (
    <ScreenShell title="Send money" scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <SendWidget />
    </ScreenShell>
  );
}
