import { useLocalSearchParams } from 'expo-router';
import { SellWidget } from '@/components/exchange/SellWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

/** /sell — optional `?asset=BTC` preselects (and locks) the asset. */
export default function Sell() {
  const t = useT();
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  return (
    <ScreenShell closeOnly title={t('action.sell')} scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <SellWidget defaultAsset={asset} lockAsset={!!asset} />
    </ScreenShell>
  );
}
