/**
 * Transaction history — MoonPay-flavoured card list.
 *
 * Each row shows:
 *   - Type-coloured icon
 *   - Description (or pretty type)
 *   - ISO date+time to the second (e.g. "Apr 26, 2026, 14:23:07")
 *   - Tx hash / reference (monospace, truncated, tap-to-copy)
 *   - Signed amount + currency
 *   - Status pill (PENDING / COMPLETED / FAILED)
 */

import { useMemo } from 'react';
import { Alert, Pressable, Share, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useTransactions, useHaptics } from '@/hooks';
import { claimLinkService, type ClaimLink } from '@/services';
import { AssetTxRow } from '@/components/transactions/AssetTxRow';

type Tx = {
  id: string;
  type: string;
  amount: string | number;
  currency: string;
  fee?: string | number;
  description?: string | null;
  reference?: string | null;
  txHash?: string | null;
  status?: string;
  createdAt: string | Date;
};

export default function History() {
  const h = useHaptics();
  const t = useT();
  const p = useThemedPalette();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useTransactions(1);
  const items = (data?.items ?? []) as Tx[];

  // Pending claim links sent by this user — surface them above the
  // history list so the sender can cancel + reclaim if needed.
  const pendingClaims = useQuery({
    queryKey: ['claim-links', 'PENDING'],
    queryFn:  () => claimLinkService.listMine({ status: 'PENDING' }),
  });
  const pending: ClaimLink[] = pendingClaims.data?.items ?? [];

  async function cancelClaim(link: ClaimLink) {
    h.warning?.() ?? h.light();
    Alert.alert(
      t('claim.cancelTitle') || 'Cancel claim link?',
      `${(t('claim.cancelBody') || 'The funds will return to your wallet immediately.')}`,
      [
        { text: t('common.keep') || 'Keep it', style: 'cancel' },
        {
          text: t('common.cancelIt') || 'Cancel it',
          style: 'destructive',
          onPress: async () => {
            try {
              await claimLinkService.cancel(link.id);
              h.success();
              qc.invalidateQueries({ queryKey: ['claim-links'] });
              refetch();
            } catch (e: any) {
              h.error();
              Alert.alert(t('common.error') || 'Error', e?.response?.data?.error ?? 'Could not cancel');
            }
          },
        },
      ],
    );
  }

  // Group by ISO date so the user gets MoonPay-style date headers.
  const groups = useMemo(() => {
    const out: Record<string, Tx[]> = {};
    items.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      (out[key] ??= []).push(t);
    });
    return out;
  }, [items]);

  return (
    <ScreenShell title={t('history.title')} subtitle={t('history.subtitle')}>
      {/* Refresh pill */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
        <Pressable
          onPress={() => { h.light(); refetch(); }}
          hitSlop={6}
          style={({ pressed }) => ({
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          })}
        >
          <Ionicons name={isFetching ? 'sync' : 'refresh'} size={12} color={p.fgMuted} />
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
            {isFetching ? t('common.refreshing').toUpperCase() : t('common.refresh').toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* Pending claim links — surface above history so the sender can
          recall funds before the recipient claims. */}
      {pending.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <Text style={{
            color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
            marginLeft: 4, marginBottom: 8,
          }}>
            {(t('history.pendingClaims') || 'PENDING CLAIM LINKS').toUpperCase()}
          </Text>
          <Panel>
            {pending.map((link, i) => {
              const recipient = link.recipientEmail
                ?? link.recipientPhone
                ?? (link.recipientHandle ? `@${link.recipientHandle}` : 'recipient');
              const expiresAt = new Date(link.expiresAt);
              const ms = expiresAt.getTime() - Date.now();
              const days = Math.floor(ms / (24 * 60 * 60 * 1000));
              const expiryLabel = ms <= 0
                ? (t('claim.expiringSoon') || 'expiring')
                : days > 0
                  ? `${days}d left`
                  : `${Math.max(1, Math.floor(ms / (60 * 60 * 1000)))}h left`;
              return (
                <View
                  key={link.id}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border,
                  }}
                >
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="link-outline" size={16} color={p.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                      {`${link.amount} ${link.asset} → ${recipient}`}
                    </Text>
                    <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>
                      {expiryLabel}
                    </Text>
                  </View>
                  <Pressable
                    onPress={async () => {
                      if (!link.claimToken) {
                        Alert.alert(t('claim.linkUnavailable') || 'Share unavailable', 'Re-create this claim to get a fresh URL.');
                        return;
                      }
                      const url = `https://Fortuni.com/claim/${link.claimToken}`;
                      await Share.share({
                        message: `${(t('send.claimShareIntro') || 'I sent you')} ${link.amount} ${link.asset} on Fortuni → ${url}`,
                      });
                    }}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10, height: 30, borderRadius: 15,
                      backgroundColor: pressed ? p.border : p.pillBg,
                      borderWidth: 1, borderColor: p.border,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 4,
                    })}
                  >
                    <Ionicons name="share-outline" size={11} color={p.fg} />
                    <Text style={{ color: p.fg, fontSize: 10, fontWeight: '700' }}>
                      {t('common.share') || 'Share'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cancelClaim(link)}
                    hitSlop={6}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10, height: 30, borderRadius: 15,
                      backgroundColor: pressed ? p.redBg : 'transparent',
                      borderWidth: 1, borderColor: p.border,
                      alignItems: 'center', justifyContent: 'center',
                    })}
                  >
                    <Text style={{ color: p.redFg, fontSize: 10, fontWeight: '700' }}>
                      {t('common.cancel') || 'Cancel'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </Panel>
        </View>
      )}

      {isLoading ? (
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Text style={{ color: p.fgMuted }}>{t('history.loading')}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={{ paddingVertical: 64, alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={36} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14 }}>
            {t('history.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
          {Object.entries(groups).map(([day, txs]) => (
            <View key={day} style={{ marginTop: 12 }}>
              <Text style={{
                color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
                marginLeft: 4, marginBottom: 8,
              }}>
                {day.toUpperCase()}
              </Text>
              <Panel>
                {txs.map((tx, i) => (
                  <AssetTxRow
                    key={tx.id}
                    tx={tx}
                    palette={p}
                    last={i === txs.length - 1}
                    onCopyHash={(hash) => {
                      h.success();
                      Clipboard.setStringAsync(hash);
                      Alert.alert(t('history.hashCopied'), hash);
                    }}
                  />
                ))}
              </Panel>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </ScreenShell>
  );
}

/* TxRow / StatusPill / typeIcon / typeBg / typeFg / prettyType were
   inlined here before. They now live in `src/components/transactions/
   AssetTxRow.tsx` so the format is shared with the per-asset history
   panel on `/asset/[currency]` — fixes the "USD amount shown in BTC"
   drift that came from each page rendering rows its own way. */
