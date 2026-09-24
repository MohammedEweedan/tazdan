import { useLocalSearchParams } from 'expo-router';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

/** /buy — optional `?asset=BTC` preselects (and locks) the asset. */
export default function Buy() {
  const t = useT();
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  return (
    <ScreenShell closeOnly title={t('action.buy')} scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      <BuyWidget defaultAsset={asset} lockAsset={!!asset} />
    </ScreenShell>
  );
}
