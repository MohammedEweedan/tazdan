import { useLocalSearchParams } from 'expo-router';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { FiatExchangeWidget, isFiatExchangeCurrency } from '@/components/exchange/FiatExchangeWidget';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { useT } from '@/store/i18nStore';

/** /buy — optional `?asset=BTC` preselects (and locks) the asset. */
export default function Buy() {
  const t = useT();
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  return (
    <ScreenShell closeOnly title={t('action.buy')} scroll={false} contentStyle={{ paddingHorizontal: 0, paddingBottom: 0 }}>
      {isFiatExchangeCurrency(asset) ? <FiatExchangeWidget initialTo={asset} initialFrom={asset === 'USD' ? 'LYD' : 'USD'} />
        : <BuyWidget defaultAsset={asset} lockAsset={!!asset} />}
    </ScreenShell>
  );
}
