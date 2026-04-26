/**
 * Transaction history — full list with date grouping.
 * Currently mounts the same TransactionItem component used on the home
 * screen, just paginated and unfiltered. Will get filters + search in v2.
 */

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { useTransactions } from '@/hooks';

export default function History() {
  const { data, isLoading } = useTransactions(1);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScreenHeader title="Activity" subtitle="All transactions" showBack />
        <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 20 }}>
          <View className="bg-white/[0.03] rounded-2xl px-3 mt-2 border border-white/[0.06]">
            {isLoading ? (
              <View className="py-2">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
              </View>
            ) : (
              data?.items.map((tx, i) => (
                <View key={tx.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <TransactionItem tx={tx} />
                </View>
              ))
            )}
          </View>
          <Text className="text-ink-muted text-xs text-center mt-6">
            Showing {data?.items.length ?? 0} of {data?.total ?? 0}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
