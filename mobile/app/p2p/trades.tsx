/**
 * P2P trade tracker — mutual confirmation flow:
 *
 *   PENDING           → buyer hasn't paid yet
 *   ESCROW_FUNDED     → escrow locked, awaiting buyer payment
 *   PAYMENT_SENT      → buyer marked paid; seller must confirm
 *   PAYMENT_CONFIRMED → seller confirmed fiat received, crypto released to buyer;
 *                       buyer must confirm they got it
 *   COMPLETED         → both confirmed, done
 *   DISPUTED          → one side denied, support intervenes
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useHaptics, useMyP2PTrades, useThread, useSendMessage, useEscalateP2P } from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { p2pService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import type { Palette } from '@/store/themeStore';
import type { P2PTrade } from '@/services';

const BRAND_BLUE = '#737373'; // mono accent neutral
type Filter = 'ACTIVE' | 'COMPLETED' | 'ALL';

const ACTIVE_STATUSES = new Set<P2PTrade['status']>([
  'PENDING', 'ESCROW_FUNDED', 'PAYMENT_SENT', 'PAYMENT_CONFIRMED', 'DISPUTED',
]);
const windowMs = (mins?: number | null) => (mins ?? 30) * 60 * 1000;

export default function P2PTrades() {
  const h = useHaptics();
  const p = useThemedPalette();
  const t = useT();
  const qc = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const myHandle = useAuthStore((s) => s.user?.username);
  const { data: trades, isLoading, refetch } = useMyP2PTrades();
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatTrade, setChatTrade] = useState<P2PTrade | null>(null);
  const [disputeTrade, setDisputeTrade] = useState<P2PTrade | null>(null);
  const [shareTrade, setShareTrade] = useState<P2PTrade | null>(null);

  const filtered = useMemo(() => {
    const all = trades ?? [];
    if (filter === 'ALL')       return all;
    if (filter === 'COMPLETED') return all.filter((x) => x.status === 'COMPLETED');
    return all.filter((x) => ACTIVE_STATUSES.has(x.status));
  }, [trades, filter]);

  const lockedFiat = useMemo(() => {
    if (!trades) return 0;
    return trades
      .filter((x) => ACTIVE_STATUSES.has(x.status))
      .reduce((s, x) => s + Number(x.totalFiat || 0), 0);
  }, [trades]);

  const callAction = async (id: string, fn: () => Promise<unknown>, label: string) => {
    setBusyId(id);
    h.medium();
    try {
      await fn();
      h.success();
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.wallets });
    } catch (e: any) {
      h.error();
      Alert.alert(`Failed to ${label}`, e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ScreenShell title={t('p2p.trades')} subtitle={t('p2p.escrowLocked')}>
        {/* Escrow summary */}
        <Panel style={{ marginTop: 12 }}>
          <View style={{ padding: 18 }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
              {t('p2p.inEscrow').toUpperCase()}
            </Text>
            <Text style={{ color: p.fg, fontSize: 32, fontWeight: '600', letterSpacing: -0.7, marginTop: 4, fontVariant: ['tabular-nums'] }}>
              ${lockedFiat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 4 }}>
              {filtered.filter((x) => ACTIVE_STATUSES.has(x.status)).length} active
            </Text>
          </View>
        </Panel>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', backgroundColor: p.pillBg, borderRadius: 12, padding: 4, gap: 4, marginTop: 14 }}>
          {(['ACTIVE', 'COMPLETED', 'ALL'] as const).map((f) => {
            const label = f === 'ACTIVE' ? t('p2p.filter.active') : f === 'COMPLETED' ? t('p2p.filter.completed') : t('p2p.filter.all');
            return (
              <Pressable key={f} onPress={() => { h.selection(); setFilter(f); }} style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: filter === f ? p.fg : 'transparent', alignItems: 'center' }}>
                <Text style={{ color: filter === f ? p.bg : p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                  {label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Warning */}
        <View style={{ marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Ionicons name="warning-outline" size={14} color="#f59e0b" style={{ marginTop: 1 }} />
          <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 16 }}>
            {t('p2p.penaltyWarning')}
          </Text>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={p.fg} /></View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <Ionicons name="lock-closed-outline" size={36} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 14, textAlign: 'center' }}>
              {t('p2p.noTrades')}
            </Text>
            <Pressable onPress={() => { h.selection(); refetch(); }} style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}>
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>{t('common.refresh')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 14, gap: 10 }}>
            {filtered.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                palette={p}
                busy={busyId === trade.id}
                t={t}
                currentUserId={currentUserId ?? ''}
                onPaid={() => callAction(trade.id, () => p2pService.markPaymentSent(trade.id), 'mark paid')}
                onConfirm={() => callAction(trade.id, () => p2pService.confirmPayment(trade.id), 'confirm')}
                onBuyerConfirm={() => callAction(trade.id, () => p2pService.buyerConfirm(trade.id), 'confirm receipt')}
                onDeny={() => {
                  Alert.alert('Deny payment?', 'This will open a dispute and notify support.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Deny & Dispute', style: 'destructive', onPress: () => callAction(trade.id, () => p2pService.denyPayment(trade.id, 'Payment denied'), 'deny') },
                  ]);
                }}
                onCancel={() => callAction(trade.id, () => p2pService.cancelTrade(trade.id), 'cancel')}
                onDispute={() => setDisputeTrade(trade)}
                onChat={() => setChatTrade(trade)}
                onShare={() => setShareTrade(trade)}
              />
            ))}
          </View>
        )}
      </ScreenShell>

      {chatTrade && (
        <TradeChatModal
          trade={chatTrade}
          currentUserId={currentUserId ?? ''}
          myHandle={myHandle}
          palette={p}
          t={t}
          onClose={() => setChatTrade(null)}
          onEscalated={() => { setChatTrade(null); qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades }); }}
        />
      )}

      {disputeTrade && (
        <DisputeModal
          trade={disputeTrade}
          currentUserId={currentUserId ?? ''}
          palette={p}
          t={t}
          onClose={() => setDisputeTrade(null)}
          onSubmitted={() => { setDisputeTrade(null); qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades }); qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations }); }}
        />
      )}

      {shareTrade && (
        <PostTradeShareModal
          trade={shareTrade}
          currentUserId={currentUserId ?? ''}
          palette={p}
          t={t}
          onClose={() => setShareTrade(null)}
        />
      )}
    </>
  );
}

/* ── Trade card ── */
function TradeCard({ trade: tr, palette: p, busy, t, currentUserId, onPaid, onConfirm, onBuyerConfirm, onDeny, onCancel, onDispute, onChat, onShare }: {
  trade: P2PTrade; palette: Palette; busy: boolean;
  t: (k: string, v?: Record<string, string | number>) => string;
  currentUserId: string;
  onPaid: () => void; onConfirm: () => void; onBuyerConfirm: () => void;
  onDeny: () => void; onCancel: () => void; onDispute: () => void;
  onChat: () => void; onShare: () => void;
}) {
  const status = tr.status;
  const isActive = ACTIVE_STATUSES.has(status);
  const isBuyer  = !!currentUserId && (currentUserId === tr.buyerId  || currentUserId === tr.buyer?.id);
  const isSeller = !!currentUserId && (currentUserId === tr.sellerId || currentUserId === tr.seller?.id);
  const cpRaw = isBuyer ? tr.seller : tr.buyer;
  const cp = tr.counterparty ?? cpRaw;
  const cpHandle = (cp as any)?.username ?? (cp as any)?.handle;
  const cpName = cpHandle ? `@${cpHandle}` : (`${(cp as any)?.firstName ?? ''} ${(cp as any)?.lastName ?? ''}`.trim()) || 'Trader';
  const cpInitial = cpName.replace('@', '')[0]?.toUpperCase() ?? 'T';
  const cryptoAmt = isNaN(Number(tr.amount)) ? null : Number(tr.amount);
  const fiatAmt   = isNaN(Number(tr.totalFiat)) ? null : Number(tr.totalFiat);
  const expiresAt = new Date(tr.createdAt).getTime() + windowMs((tr as any).listing?.timeframeMins);

  return (
    <Panel>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusPill status={status} palette={p} />
          <View style={{ flex: 1 }} />
          {isActive && <TradeTimer expiresAt={expiresAt} palette={p} />}
        </View>

        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: p.border }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{cpInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{cpName}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
              {cryptoAmt != null ? `${cryptoAmt.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${tr.listing?.currency ?? ''}` : tr.listing?.currency ?? '—'}
              {' · '}
              {fiatAmt != null ? `${fiatAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tr.listing?.fiatCurrency ?? ''}` : tr.listing?.fiatCurrency ?? '—'}
            </Text>
          </View>
        </View>

        {isActive && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {/* Buyer: mark paid */}
              {(status === 'ESCROW_FUNDED' || status === 'PENDING') && isBuyer && (
                <ActionBtn label={t('p2p.markPaid')} icon="checkmark-circle" busy={busy} primary palette={p} onPress={onPaid} />
              )}
              {/* Seller: confirm fiat received */}
              {status === 'PAYMENT_SENT' && isSeller && (
                <ActionBtn label={t('p2p.confirmReceived')} icon="shield-checkmark" busy={busy} primary palette={p} onPress={onConfirm} />
              )}
              {/* Buyer: confirm crypto received */}
              {status === 'PAYMENT_CONFIRMED' && isBuyer && (
                <ActionBtn label="I got my crypto" icon="checkmark-done" busy={busy} primary palette={p} onPress={onBuyerConfirm} />
              )}
              {/* Cancel (early stages) */}
              {(status === 'PENDING' || status === 'ESCROW_FUNDED') && (
                <ActionBtn label={t('p2p.cancelTrade')} icon="close-circle" busy={busy} palette={p} onPress={onCancel} />
              )}
              {/* Chat */}
              <Pressable onPress={onChat} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="chatbubble-outline" size={16} color={p.fg} />
              </Pressable>
            </View>

            {/* Seller deny button when PAYMENT_SENT */}
            {status === 'PAYMENT_SENT' && isSeller && (
              <Pressable onPress={onDeny} style={({ pressed }) => ({ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="close-circle-outline" size={14} color={p.redFg} />
                <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600' }}>I DID NOT RECEIVE PAYMENT</Text>
              </Pressable>
            )}

            {/* Buyer deny button when PAYMENT_CONFIRMED */}
            {status === 'PAYMENT_CONFIRMED' && isBuyer && (
              <Pressable onPress={onDeny} style={({ pressed }) => ({ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="close-circle-outline" size={14} color={p.redFg} />
                <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600' }}>I DID NOT RECEIVE CRYPTO</Text>
              </Pressable>
            )}

            {/* Generic dispute for other active states */}
            {(status === 'PAYMENT_SENT' && isBuyer) && (
              <Pressable onPress={onDispute} style={({ pressed }) => ({ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="alert-circle-outline" size={14} color={p.redFg} />
                <Text style={{ color: p.redFg, fontSize: 12, fontWeight: '600' }}>{t('p2p.dispute').toUpperCase()}</Text>
              </Pressable>
            )}

            {/* Status hint */}
            {status === 'PAYMENT_CONFIRMED' && isSeller && (
              <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: p.greenBg, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' }}>
                <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '600' }}>
                  Crypto sent to buyer. Waiting for them to confirm receipt.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Share handle after completion */}
        {status === 'COMPLETED' && (
          <Pressable onPress={onShare} style={({ pressed }) => ({ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: p.greenBg, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.85 : 1 })}>
            <Ionicons name="sparkles-outline" size={16} color={p.greenFg} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
                {t('p2p.shareProfile').toUpperCase()}
              </Text>
              <Text style={{ color: p.greenFg, fontSize: 11, fontWeight: '500', marginTop: 2, opacity: 0.85 }} numberOfLines={2}>
                {t('p2p.shareProfileDesc')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={p.greenFg} />
          </Pressable>
        )}

        {/* Chat link for completed/cancelled */}
        {!isActive && (
          <Pressable onPress={onChat} style={({ pressed }) => ({ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="chatbubble-outline" size={13} color={p.fgMuted} />
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{t('p2p.chatWith', { name: cpName })}</Text>
          </Pressable>
        )}
      </View>
    </Panel>
  );
}

/* ── Trade timer ── */
function TradeTimer({ expiresAt, palette: p }: { expiresAt: number; palette: Palette }) {
  const [label, setLabel] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setLabel('Expired'); setUrgent(true); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setUrgent(diff < 5 * 60_000);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="time-outline" size={12} color={urgent ? p.redFg : p.fgMuted} />
      <Text style={{ color: urgent ? p.redFg : p.fgMuted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

/* ── Trade chat modal — matches messages/[id].tsx visual language ── */
function TradeChatModal({ trade, currentUserId, myHandle, palette: p, t, onClose, onEscalated }: {
  trade: P2PTrade; currentUserId: string; myHandle?: string;
  palette: Palette; t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void; onEscalated: () => void;
}) {
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const iAmBuyer = currentUserId === trade.buyerId || currentUserId === trade.buyer?.id;
  const counterpartyId = iAmBuyer ? (trade.sellerId ?? trade.seller?.id ?? '') : (trade.buyerId ?? trade.buyer?.id ?? '');
  const cpRaw = iAmBuyer ? trade.seller : trade.buyer;
  const cp = trade.counterparty ?? cpRaw as any;
  const cpHandle = cp?.username ?? cp?.handle;
  const cpFullName = (`${cp?.firstName ?? ''} ${cp?.lastName ?? ''}`.trim()) || 'Trader';
  const cpName = cpHandle ? `@${cpHandle}` : cpFullName;
  const cpInitial = cpName.replace('@', '')[0]?.toUpperCase() ?? 'T';

  const { data: messages = [], isLoading } = useThread(counterpartyId);
  const sendMsg = useSendMessage(counterpartyId);
  const escalate = useEscalateP2P();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);
  const isActive = ACTIVE_STATUSES.has(trade.status);
  const expiresAt = new Date(trade.createdAt).getTime() + windowMs((trade as any).listing?.timeframeMins);

  const tradeMessages = messages.filter((m) => !m.tradeId || m.tradeId === trade.id);

  useEffect(() => {
    if (tradeMessages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [tradeMessages.length]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    sendMsg.mutate({ receiverId: counterpartyId, content, tradeId: trade.id });
  };

  const shareHandle = () => {
    if (!myHandle) {
      Alert.alert('No handle set', 'Set a @handle in your profile first.');
      return;
    }
    h.medium();
    sendMsg.mutate({ receiverId: counterpartyId, content: `My handle: @${myHandle} 👋`, tradeId: trade.id });
    h.success();
  };

  const handleEscalate = () => {
    Alert.alert(t('p2p.escalate'), t('p2p.escalateConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('p2p.escalate'), style: 'destructive',
        onPress: async () => {
          try {
            await escalate.mutateAsync({ counterpartyId, tradeId: trade.id, reason: 'Trade dispute' });
            sendMsg.mutate({ receiverId: counterpartyId, content: t('p2p.escalated'), tradeId: trade.id });
            onEscalated();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        {/* Header — same pattern as messages/[id].tsx */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 12,
          borderBottomWidth: 1, borderBottomColor: p.border, gap: 10,
        }}>
          <Pressable onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={18} color={p.fg} />
          </Pressable>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{cpInitial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }} numberOfLines={1}>{cpName}</Text>
            {isActive ? (
              <TradeTimer expiresAt={expiresAt} palette={p} />
            ) : (
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>Trade chat</Text>
            )}
          </View>
          <StatusPill status={trade.status} palette={p} />
          {isActive && trade.status !== 'DISPUTED' && (
            <Pressable onPress={handleEscalate} style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: p.redFg, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: p.redFg, fontSize: 11, fontWeight: '600' }}>ESCALATE</Text>
            </Pressable>
          )}
        </View>

        {/* Trade summary bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: p.bgElev, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
            {!isNaN(Number(trade.amount))
              ? `${Number(trade.amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} ${trade.listing?.currency ?? ''}`
              : trade.listing?.currency ?? '—'}
            {'  ·  '}
            {!isNaN(Number(trade.totalFiat))
              ? `${Number(trade.totalFiat).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${trade.listing?.fiatCurrency ?? ''}`
              : trade.listing?.fiatCurrency ?? '—'}
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          {/* Messages */}
          <FlatList
            ref={listRef}
            data={tradeMessages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 18, paddingBottom: 8, gap: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              isLoading ? (
                <View style={{ alignItems: 'center', paddingTop: 60 }}><ActivityIndicator color={p.fg} /></View>
              ) : (
                <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
                  <Ionicons name="chatbubbles-outline" size={32} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                    Say something — your conversation with {cpName} starts here.
                  </Text>
                </View>
              )
            }
            renderItem={({ item: m, index }) => {
              const next = tradeMessages[index + 1];
              const isLastInRun = !next || next.senderId !== m.senderId;
              const isMe = m.senderId === currentUserId || m.senderId === 'me';
              const isSystem = m.type === 'SYSTEM' || !m.senderId;
              if (isSystem) {
                return (
                  <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border, maxWidth: '88%' }}>
                      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{m.content}</Text>
                    </View>
                  </View>
                );
              }
              const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return (
                <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '82%', marginTop: 1 }}>
                  <View style={{
                    borderRadius: 18,
                    borderBottomRightRadius: isMe && isLastInRun ? 6 : 18,
                    borderBottomLeftRadius: !isMe && isLastInRun ? 6 : 18,
                    backgroundColor: isMe ? BRAND_BLUE : p.bgElev,
                    borderWidth: isMe ? 0 : 1, borderColor: p.border,
                    paddingHorizontal: 14, paddingVertical: 10,
                  }}>
                    <Text style={{ color: isMe ? '#fff' : p.fg, fontSize: 15, fontWeight: '500', lineHeight: 20 }}>
                      {m.deletedAt ? <Text style={{ fontStyle: 'italic', opacity: 0.5 }}>Message deleted</Text> : m.content}
                    </Text>
                  </View>
                  {isLastInRun && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, alignSelf: isMe ? 'flex-end' : 'flex-start', paddingHorizontal: 8 }}>
                      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600' }}>{time}</Text>
                      {isMe && <Ionicons name={m.isRead ? 'checkmark-done' : 'checkmark'} size={11} color={m.isRead ? BRAND_BLUE : p.fgFaint} />}
                    </View>
                  )}
                </View>
              );
            }}
          />

          {/* Composer */}
          <View style={{
            paddingHorizontal: 12, paddingTop: 10,
            paddingBottom: Platform.OS === 'ios' ? 20 : 12,
            borderTopWidth: 1, borderTopColor: p.border,
            backgroundColor: p.bg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 22, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, paddingHorizontal: 6, paddingVertical: 6, minHeight: 44 }}>
              {/* Share handle quick-send */}
              <Pressable
                onPress={shareHandle}
                hitSlop={6}
                style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, backgroundColor: pressed ? p.border : 'transparent', alignItems: 'center', justifyContent: 'center' })}
              >
                <Ionicons name="at" size={18} color={p.fgMuted} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor={p.fgFaint}
                multiline
                style={{ flex: 1, color: p.fg, fontSize: 15, fontWeight: '500', paddingHorizontal: 4, paddingTop: Platform.OS === 'ios' ? 8 : 4, paddingBottom: Platform.OS === 'ios' ? 8 : 4, maxHeight: 120 }}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || sendMsg.isPending}
                style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: text.trim() ? BRAND_BLUE : p.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
              >
                {sendMsg.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="arrow-up" size={18} color="#fff" />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ── Status pill ── */
function StatusPill({ status, palette: p }: { status: P2PTrade['status']; palette: Palette }) {
  const cfg: Record<P2PTrade['status'], { bg: string; fg: string; label: string }> = {
    PENDING:           { bg: p.pillBg,                 fg: p.fg,       label: 'PENDING' },
    ESCROW_FUNDED:     { bg: 'rgba(99,102,241,0.15)',  fg: '#818cf8',  label: 'ESCROW' },
    PAYMENT_SENT:      { bg: 'rgba(245,158,11,0.16)',  fg: '#f59e0b',  label: 'AWAITING' },
    PAYMENT_CONFIRMED: { bg: 'rgba(245,158,11,0.16)',  fg: '#f59e0b',  label: 'CONFIRM ?' },
    COMPLETED:         { bg: p.greenBg,                fg: p.greenFg,  label: 'DONE' },
    ESCROW_RELEASED:   { bg: p.greenBg,                fg: p.greenFg,  label: 'RELEASED' },
    CANCELLED:         { bg: p.pillBg,                 fg: p.fgMuted,  label: 'CANCELLED' },
    EXPIRED:           { bg: p.pillBg,                 fg: p.fgMuted,  label: 'EXPIRED' },
    DISPUTED:          { bg: 'rgba(239,68,68,0.16)',   fg: p.redFg,    label: 'DISPUTED' },
  };
  const c = cfg[status] ?? { bg: p.pillBg, fg: p.fgMuted, label: String(status) };
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: c.bg }}>
      <Text style={{ color: c.fg, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>{c.label}</Text>
    </View>
  );
}

/* ── Dispute modal ── */
function DisputeModal({ trade, currentUserId, palette: p, t, onClose, onSubmitted }: {
  trade: P2PTrade; currentUserId: string; palette: Palette;
  t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void; onSubmitted: () => void;
}) {
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const iAmBuyer2 = currentUserId === trade.buyerId || currentUserId === trade.buyer?.id;
  const counterpartyId = iAmBuyer2 ? (trade.sellerId ?? trade.seller?.id ?? '') : (trade.buyerId ?? trade.buyer?.id ?? '');
  const sendMsg = useSendMessage(counterpartyId);
  const escalate = useEscalateP2P();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const role = iAmBuyer2 ? t('p2p.buyer') : t('p2p.seller');
  // Server requires 10–1000 chars. We keep the client min in sync so the
  // submit button disables instead of getting a 400 back.
  const trimmedLen = reason.trim().length;
  const tooShort = trimmedLen < 10;
  const tooLong = trimmedLen > 1000;
  const invalid = tooShort || tooLong;

  const submit = async () => {
    if (invalid || busy) {
      if (tooShort) Alert.alert(t('p2p.disputeTitle'), t('p2p.disputeShort'));
      else if (tooLong) Alert.alert(t('p2p.disputeTitle'), 'Reason must be 1000 characters or fewer.');
      return;
    }
    setBusy(true); h.medium();
    try {
      await p2pService.raiseDispute(trade.id, reason.trim());
      await escalate.mutateAsync({ counterpartyId, tradeId: trade.id, reason: `Dispute (${role}): ${reason.trim().slice(0, 80)}`, details: reason.trim() }).catch(() => {});
      sendMsg.mutate({ receiverId: counterpartyId, content: t('p2p.escalated'), tradeId: trade.id });
      h.success();
      Alert.alert(t('p2p.disputeTitle'), t('p2p.disputeFiled'));
      onSubmitted();
    } catch (e: any) {
      h.error();
      Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="chevron-down" size={22} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '700', marginLeft: 6 }}>{t('p2p.disputeTitle')}</Text>
          <StatusPill status={trade.status} palette={p} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Ionicons name="alert-circle-outline" size={16} color={p.redFg} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, color: p.redFg, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>{t('p2p.disputeBody')}</Text>
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 }}>{t('p2p.disputeReason').toUpperCase()}</Text>
          <TextInput value={reason} onChangeText={setReason} placeholder={t('p2p.disputeReasonPlaceholder')} placeholderTextColor={p.fgFaint} multiline textAlignVertical="top" style={{ minHeight: 140, padding: 14, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, color: p.fg, fontSize: 14, lineHeight: 20 }} />
          <Text style={{ color: invalid ? p.fgFaint : p.greenFg, fontSize: 11, fontWeight: '600', marginTop: 6 }}>{trimmedLen}/1000 (min 10)</Text>
          <Pressable onPress={submit} disabled={invalid || busy} style={({ pressed }) => ({ marginTop: 20, height: 48, borderRadius: 24, backgroundColor: p.redFg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: invalid ? 0.4 : pressed || busy ? 0.85 : 1 })}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="shield-half-outline" size={16} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>{t('p2p.disputeSubmit').toUpperCase()}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Post-trade share modal ── */
const SHARE_EMOJIS = ['🎉', '🤝', '🚀', '🔥', '💎', '🙏', '😎', '✨', '👍', '💸', '🤑', '⚡️'];

function PostTradeShareModal({ trade, currentUserId, palette: p, t, onClose }: {
  trade: P2PTrade; currentUserId: string; palette: Palette;
  t: (k: string, v?: Record<string, string | number>) => string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const h = useHaptics();
  const me = useAuthStore((s) => s.user);
  const iAmBuyer3 = currentUserId === trade.buyerId || currentUserId === trade.buyer?.id;
  const counterpartyId = iAmBuyer3 ? (trade.sellerId ?? trade.seller?.id ?? '') : (trade.buyerId ?? trade.buyer?.id ?? '');
  const sendMsg = useSendMessage(counterpartyId);
  const myHandle = me?.username;
  const [emoji, setEmoji] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const cpRaw2 = iAmBuyer3 ? trade.seller : trade.buyer;
  const cp = trade.counterparty ?? cpRaw2 as any;
  const cpHandle = cp?.username ?? cp?.handle;
  const cpName = cpHandle ? `@${cpHandle}` : 'your counterparty';

  const share = () => {
    h.medium();
    const lines: string[] = [];
    if (myHandle) lines.push(`@${myHandle}`);
    if (emoji) lines.push(emoji);
    if (!lines.length) return;
    sendMsg.mutate({ receiverId: counterpartyId, content: lines.join('  '), tradeId: trade.id });
    h.success();
    setShared(true);
    setTimeout(onClose, 900);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}><Ionicons name="chevron-down" size={22} color={p.fg} /></Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 16, fontWeight: '700', marginLeft: 6 }}>{t('p2p.shareProfile')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 + insets.bottom }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: p.greenBg, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)' }}>
            <Ionicons name="checkmark-circle" size={36} color={p.greenFg} />
            <Text style={{ color: p.greenFg, fontSize: 14, fontWeight: '600', marginTop: 8 }}>{t('p2p.tradeCompleted')}</Text>
            <Text style={{ color: p.greenFg, fontSize: 12, fontWeight: '500', marginTop: 4, opacity: 0.85 }}>{t('p2p.shareProfileDesc')}</Text>
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 22, marginBottom: 8 }}>
            {myHandle ? t('p2p.shareHandle', { handle: myHandle }).toUpperCase() : 'YOUR HANDLE'}
          </Text>
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="at" size={16} color={p.fg} />
            </View>
            <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '700' }}>{myHandle ? `@${myHandle}` : '— no handle set —'}</Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600' }}>→ {cpName}</Text>
          </View>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 22, marginBottom: 8 }}>{t('p2p.pickEmoji').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SHARE_EMOJIS.map((e) => {
              const active = emoji === e;
              return (
                <Pressable key={e} onPress={() => { h.selection(); setEmoji(active ? null : e); }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? p.ctaBg : p.bgElev, borderWidth: 1, borderColor: active ? p.ctaBg : p.border }}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            <Pressable onPress={onClose} style={({ pressed }) => ({ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>{t('p2p.notNow').toUpperCase()}</Text>
            </Pressable>
            <Pressable onPress={share} disabled={(!myHandle && !emoji) || shared || sendMsg.isPending} style={({ pressed }) => ({ flex: 1.4, height: 48, borderRadius: 24, backgroundColor: p.ctaBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (!myHandle && !emoji) ? 0.4 : pressed ? 0.85 : 1 })}>
              {sendMsg.isPending ? <ActivityIndicator color={p.ctaFg} /> : shared ? <Ionicons name="checkmark" size={18} color={p.ctaFg} /> : <Ionicons name="paper-plane" size={16} color={p.ctaFg} />}
              <Text style={{ color: p.ctaFg, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>{(shared ? t('p2p.shareSent') : t('p2p.shareProfile')).toUpperCase()}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Action button ── */
function ActionBtn({ palette: p, label, icon, primary, busy, onPress }: {
  palette: Palette; label: string; icon: keyof typeof Ionicons.glyphMap;
  primary?: boolean; busy: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => ({ flex: 1, height: 42, borderRadius: 21, backgroundColor: primary ? p.ctaBg : 'transparent', borderWidth: primary ? 0 : 1, borderColor: p.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
      {busy ? <ActivityIndicator size="small" color={primary ? p.ctaFg : p.fg} /> : <Ionicons name={icon} size={14} color={primary ? p.ctaFg : p.fg} />}
      <Text style={{ color: primary ? p.ctaFg : p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  );
}

