import { useLocalSearchParams } from 'expo-router';
import { SendWidget } from '@/components/exchange/SendWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';

export default function Send() {
  // Opened from a contact: the recipient is already chosen.
  const params = useLocalSearchParams<{ to?: string; handle?: string; name?: string }>();
  const initialRecipient = params.to && params.handle
    ? { id: params.to, username: params.handle, firstName: (params.name ?? '').split(' ')[0] ?? '', lastName: (params.name ?? '').split(' ').slice(1).join(' ') }
    : undefined;
  return (
    <ScreenShell closeOnly title="Send money" scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <SendWidget initialRecipient={initialRecipient} />
    </ScreenShell>
  );
}
