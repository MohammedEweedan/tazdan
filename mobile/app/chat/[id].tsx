/**
 * P2P trade chat — real-time buyer ↔ seller messaging during an active trade.
 *
 *   Trade status banner — shows current status + payment-window countdown.
 *   Message list       — TEXT bubbles + PAYMENT_PROOF image bubbles +
 *                        SYSTEM event cards for status transitions.
 *   Composer           — text input + image picker (payment proof) + send.
 *   Action bar         — context-sensitive trade actions (Mark Paid,
 *                        Confirm Received, Deny, Cancel, Dispute).
 *   Real-time          — Socket.IO via existing useMessageRealtime hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, ActivityIndicator, Alert, Image, KeyboardAvoidingView,
  Linking, Modal, Platform, Pressable, ScrollView, View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { brand, useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import {
  useThread, useSendMessage, useMessageRealtime,
  useEscalateP2P, useHaptics,
} from '@/hooks';
import { p2pService, messageService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import type { P2PTrade } from '@/services';
import type { ApiMessage } from '@/types/messages';

const BRAND_BLUE = '#737373'; // mono accent neutral

/* ── Helpers ───────────────────────────────────────────────────── */

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (remaining === null) return null;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Status config ─────────────────────────────────────────────── */

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  PENDING:           { label: 'Awaiting payment',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: 'time-outline' },
  ESCROW_FUNDED:     { label: 'Escrow funded — pay now', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: 'lock-closed-outline' },
  PAYMENT_SENT:      { label: 'Payment sent — awaiting confirmation', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', icon: 'hourglass-outline' },
  PAYMENT_CONFIRMED: { label: 'Payment confirmed',       color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: 'checkmark-circle-outline' },
  COMPLETED:         { label: 'Trade completed ✓',       color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: 'checkmark-done-outline' },
  ESCROW_RELEASED:   { label: 'Escrow released ✓',       color: '#4ade80', bg: 'rgba(74,222,128,0.12)', icon: 'checkmark-done-outline' },
  DISPUTED:          { label: 'Dispute opened — support reviewing', color: '#f87171', bg: 'rgba(248,113,113,0.12)', icon: 'alert-circle-outline' },
  CANCELLED:         { label: 'Trade cancelled',         color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: 'close-circle-outline' },
  EXPIRED:           { label: 'Trade expired',           color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: 'timer-outline' },
};

const DONE_STATUSES = new Set(['COMPLETED', 'ESCROW_RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED']);

/* ══════════════════════════════════════════════════════════════════
   MAIN SCREEN
   ══════════════════════════════════════════════════════════════════ */

export default function TradeChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const h       = useHaptics();
  const p       = useThemedPalette();
  const mode    = useTheme((s) => s.mode);
  const accent  = mode === 'dark' ? brand.primaryDark : brand.primary;
  const me      = useAuthStore((s) => s.user);
  const qc      = useQueryClient();

  // Real-time message pushes
  useMessageRealtime(me?.id);

  /* ── Fetch trade ── */
  const [trade, setTrade]           = useState<P2PTrade | null>(null);
  const [loadingTrade, setLoading]  = useState(true);

  useEffect(() => {
    if (!id) return;
    p2pService.myTrades().then((trades) => {
      const t = trades.find((x) => x.id === id) ?? null;
      setTrade(t);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  /* ── Resolve counterparty ── */
  const counterpartyId = useMemo(() => {
    if (!trade || !me) return null;
    if (trade.buyerId === me.id)  return trade.sellerId;
    if (trade.sellerId === me.id) return trade.buyerId;
    return null;
  }, [trade, me]);

  const counterparty = useMemo(() => {
    if (!trade || !me) return null;
    const isBuyer = trade.buyerId === me.id;
    return isBuyer ? trade.seller : trade.buyer;
  }, [trade, me]);

  const amBuyer   = trade?.buyerId === me?.id;
  const isCrypto  = trade?.listing?.currency ?? 'USDT';
  const isFiat    = trade?.listing?.fiatCurrency ?? 'USD';

  /* ── Messages ── */
  const { data: messages = [], isLoading: msgLoading } = useThread(counterpartyId ?? '');
  const sendMut = useSendMessage(counterpartyId ?? '');
  const escalate = useEscalateP2P();

  // Filter to messages scoped to this trade
  const tradeMessages = useMemo(
    () => (counterpartyId
      ? messages.filter((m) =>
          !m.tradeId || m.tradeId === id
        )
      : []),
    [messages, id, counterpartyId]
  );

  /* ── Composer state ── */
  const [text, setText]             = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [sending, setSending]       = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /* ── Payment countdown ── */
  const expiresAt = useMemo(() => {
    if (!trade) return null;
    // 30-minute window from trade creation
    const t = new Date(trade.createdAt).getTime() + 30 * 60 * 1000;
    return new Date(t).toISOString();
  }, [trade]);
  const countdown = useCountdown(expiresAt);

  // Mark read when thread opens
  useEffect(() => {
    if (counterpartyId) {
      messageService.markRead(counterpartyId).catch(() => {});
    }
  }, [counterpartyId, tradeMessages.length]);

  // Auto-scroll on new messages
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [tradeMessages.length]);

  /* ── Image picker ── */
  const pickProof = async () => {
    h.selection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to send payment proof.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
    setPickedImage({
      uri: asset.uri,
      name: `proof_${Date.now()}.${ext}`,
      type: ext === 'png' ? 'image/png' : 'image/jpeg',
    });
  };

  /* ── Send ── */
  const send = async () => {
    if (sending || !counterpartyId) return;
    const content = text.trim();
    if (!content && !pickedImage) return;
    h.medium();
    setSending(true);
    const img = pickedImage;
    setText('');
    setPickedImage(null);
    try {
      // If sending a proof image, use payment type
      const type = img && !content ? 'PAYMENT' : 'TEXT';
      await sendMut.mutateAsync({
        receiverId: counterpartyId,
        content:    content || (img ? 'Payment proof' : ''),
        type,
        tradeId:    id,
        metadata:   img ? { proofUri: img.uri } : undefined,
      });
      h.success();
    } catch {
      setText(content);
      setPickedImage(img);
      h.error();
    } finally {
      setSending(false);
    }
  };

  /* ── Trade actions ── */
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const doAction = async (label: string, fn: () => Promise<unknown>) => {
    setActionLoading(label);
    h.medium();
    try {
      await fn();
      h.success();
      qc.invalidateQueries({ queryKey: QUERY_KEYS.p2pMyTrades });
      // Refresh trade
      const trades = await p2pService.myTrades();
      setTrade(trades.find((x) => x.id === id) ?? null);
    } catch (e: any) {
      h.error();
      Alert.alert('Action failed', e?.response?.data?.error ?? e?.message ?? 'Try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = () =>
    Alert.alert('Mark as paid?', 'Only mark paid after you have transferred the funds. Abuse may result in penalties.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes, I\'ve paid', onPress: () => doAction('paid', () => p2pService.markPaymentSent(id)) }]);

  const handleConfirm = () =>
    Alert.alert('Confirm payment received?', 'The crypto will be released to the buyer.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => doAction('confirm', () => p2pService.confirmPayment(id)) }]);

  const handleDeny = () =>
    Alert.alert('Deny payment?', 'The trade will be marked as disputed.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Deny', style: 'destructive', onPress: () => doAction('deny', () => p2pService.denyPayment(id, 'Payment not received')) }]);

  const handleCancel = () =>
    Alert.alert('Cancel trade?', 'This cannot be undone.',
      [{ text: 'Keep trade', style: 'cancel' }, { text: 'Cancel trade', style: 'destructive', onPress: () => doAction('cancel', () => p2pService.cancelTrade(id)) }]);

  const [disputeOpen, setDisputeOpen] = useState(false);

  /* ── Loading ── */
  if (loadingTrade) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  if (!trade || !counterpartyId) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Ionicons name="alert-circle-outline" size={44} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
          Trade not found or you don't have access.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: accent, fontSize: 14, fontWeight: '700' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const status    = STATUS_META[trade.status] ?? STATUS_META.PENDING;
  const isDone    = DONE_STATUSES.has(trade.status);
  const cpName    = counterparty
    ? `${counterparty.firstName ?? ''} ${counterparty.lastName ?? ''}`.trim() || counterparty.username || 'Trader'
    : 'Trader';
  const cpHandle  = counterparty?.username ? `@${counterparty.username}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {/* ── Header ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
          borderBottomWidth: 1, borderBottomColor: p.border,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={8}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>

          {/* Avatar */}
          <View style={{
            width: 38, height: 38, borderRadius: 19, backgroundColor: `${BRAND_BLUE}22`,
            borderWidth: 1, borderColor: `${BRAND_BLUE}44`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: BRAND_BLUE, fontSize: 16, fontWeight: '700' }}>
              {cpName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }} numberOfLines={1}>
              {cpName}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
              {cpHandle ? `${cpHandle} · ` : ''}{Number(trade.amount).toFixed(4)} {isCrypto}
            </Text>
          </View>

          {/* Dispute button */}
          {!isDone && (
            <Pressable
              onPress={() => { h.warning(); setDisputeOpen(true); }}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
                backgroundColor: pressed ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.08)',
                borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
              })}
            >
              <Text style={{ color: '#f87171', fontSize: 11.5, fontWeight: '700' }}>⚠ Dispute</Text>
            </Pressable>
          )}
        </View>

        {/* ── Trade status banner ── */}
        <View style={{
          marginHorizontal: 14, marginTop: 10, marginBottom: 4,
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
          backgroundColor: status.bg,
          borderWidth: 1, borderColor: status.color + '44',
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Ionicons name={status.icon} size={16} color={status.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: status.color, fontSize: 12, fontWeight: '700' }}>
              {status.label}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '600' }}>
                {Number(trade.totalFiat).toLocaleString('en-US', { style: 'currency', currency: isFiat })} ·{' '}
                {trade.paymentMethod ?? 'Bank transfer'}
              </Text>
              {countdown && !isDone && (
                <Text style={{ color: Number(countdown.split(':')[0]) < 5 ? '#f87171' : p.fgMuted, fontSize: 10.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  ⏱ {countdown}
                </Text>
              )}
            </View>
          </View>

          {/* Copy trade ID */}
          <Pressable
            onPress={() => { Clipboard.setStringAsync(trade.id); h.selection(); }}
            hitSlop={8}
          >
            <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>
              #{trade.id.slice(-6).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          {/* ── Messages ── */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, gap: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* System intro card */}
            <SystemCard palette={p} accent={accent}>
              Trade started · {new Date(trade.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {'\n'}Only communicate and transfer payment through promrkts.
            </SystemCard>

            {msgLoading && (
              <ActivityIndicator color={accent} style={{ marginTop: 20 }} />
            )}

            {tradeMessages.map((m, i) => {
              const isMine   = m.senderId === me?.id;
              const prev     = tradeMessages[i - 1];
              const showHead = !prev || prev.senderId !== m.senderId;
              return (
                <ChatBubble
                  key={m.id}
                  msg={m}
                  isMine={isMine}
                  senderName={isMine ? 'You' : cpName}
                  showHeader={showHead}
                  palette={p}
                  accent={accent}
                />
              );
            })}

            {tradeMessages.length === 0 && !msgLoading && (
              <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
                <Text style={{ color: p.fgFaint, fontSize: 13, fontWeight: '600' }}>
                  No messages yet. Say hello 👋
                </Text>
              </View>
            )}
          </ScrollView>

          {/* ── Trade action bar ── */}
          {!isDone && (
            <ActionBar
              trade={trade}
              amBuyer={amBuyer}
              loading={actionLoading}
              palette={p}
              accent={accent}
              onMarkPaid={handleMarkPaid}
              onConfirm={handleConfirm}
              onDeny={handleDeny}
              onCancel={handleCancel}
            />
          )}

          {/* ── Composer ── */}
          {!isDone && (
            <View style={{
              borderTopWidth: 1, borderTopColor: p.border,
              paddingHorizontal: 12, paddingVertical: 10,
              paddingBottom: Platform.OS === 'ios' ? 14 : 10,
              gap: 8,
            }}>
              {/* Proof image preview */}
              {pickedImage && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 10, borderRadius: 14,
                  backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
                }}>
                  <Image source={{ uri: pickedImage.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                  <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12.5, fontWeight: '600' }}>
                    Payment proof ready
                  </Text>
                  <Pressable onPress={() => setPickedImage(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={p.fgFaint} />
                  </Pressable>
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                {/* Image attach */}
                <Pressable onPress={pickProof} hitSlop={6}
                  style={({ pressed }) => ({
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: pressed ? `${accent}1F` : p.bgElev,
                    borderWidth: 1, borderColor: pressed ? `${accent}66` : p.border,
                    alignItems: 'center', justifyContent: 'center',
                  })}
                >
                  <Ionicons name="camera-outline" size={18} color={accent} />
                </Pressable>

                {/* Text input */}
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Message counterparty…"
                  placeholderTextColor={p.fgFaint}
                  multiline
                  maxLength={2000}
                  style={{
                    flex: 1, minHeight: 40, maxHeight: 110,
                    borderRadius: 20, backgroundColor: p.bgElev,
                    borderWidth: 1, borderColor: p.border,
                    paddingHorizontal: 14, paddingVertical: 10,
                    color: p.fg, fontSize: 14, fontWeight: '500',
                  }}
                />

                {/* Send */}
                <Pressable
                  onPress={send}
                  disabled={sending || (!text.trim() && !pickedImage)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
                    opacity: (!text.trim() && !pickedImage) ? 0.4 : pressed ? 0.8 : 1,
                  })}
                >
                  <LinearGradient
                    colors={[brand.primaryDark, brand.deep]}
                    start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {sending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Ionicons name="send" size={16} color="#fff" />}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {isDone && (
            <View style={{
              paddingVertical: 16, paddingHorizontal: 20,
              borderTopWidth: 1, borderTopColor: p.border,
              alignItems: 'center',
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
                This trade is {trade.status.toLowerCase()}. Messaging is closed.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Dispute modal ── */}
      <DisputeModal
        visible={disputeOpen}
        tradeId={id}
        onClose={() => setDisputeOpen(false)}
        onSubmit={async (reason) => {
          await doAction('dispute', () => p2pService.raiseDispute(id, reason));
          setDisputeOpen(false);
        }}
        palette={p}
        accent={accent}
      />
    </View>
  );
}

/* ── Chat bubble ──────────────────────────────────────────────────── */

function ChatBubble({ msg, isMine, senderName, showHeader, palette: p, accent }: {
  msg: ApiMessage; isMine: boolean; senderName: string;
  showHeader: boolean; palette: Palette; accent: string;
}) {
  if (msg.type === 'SYSTEM' || msg.type === 'ESCALATION') {
    return <SystemCard palette={p} accent={accent}>{msg.content}</SystemCard>;
  }

  const hasImage = msg.type === 'PAYMENT' && msg.metadata?.proofUri;

  return (
    <View style={{ marginVertical: 2, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
      {!isMine && showHeader && (
        <Text style={{ color: accent, fontSize: 10.5, fontWeight: '700', marginBottom: 2, marginLeft: 12 }}>
          {senderName}
        </Text>
      )}
      <View style={{
        maxWidth: '78%',
        paddingHorizontal: hasImage ? 6 : 12, paddingVertical: hasImage ? 6 : 8,
        borderRadius: 18,
        borderTopRightRadius: isMine ? 4 : 18, borderTopLeftRadius: isMine ? 18 : 4,
        backgroundColor: isMine ? accent : p.bgElev,
        borderWidth: isMine ? 0 : 1, borderColor: p.border,
      }}>
        {hasImage && (
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: msg.metadata!.proofUri }}
              style={{ width: 220, height: 160, borderRadius: 12 }}
              resizeMode="cover"
            />
            <View style={{
              position: 'absolute', bottom: 8, left: 8,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
              <Text style={{ color: '#fff', fontSize: 9.5, fontWeight: '700' }}>Payment Proof</Text>
            </View>
          </View>
        )}
        {!!msg.content && msg.content !== 'Payment proof' && (
          <Text style={{
            color: isMine ? '#fff' : p.fg, fontSize: 14, fontWeight: '500',
            marginTop: hasImage ? 6 : 0, paddingHorizontal: hasImage ? 6 : 0,
          }}>
            {msg.deletedAt ? 'Message deleted' : msg.content}
          </Text>
        )}
        <Text style={{
          color: isMine ? 'rgba(255,255,255,0.6)' : p.fgFaint,
          fontSize: 9.5, fontWeight: '600', marginTop: 3,
          alignSelf: 'flex-end', paddingHorizontal: hasImage ? 6 : 0,
        }}>
          {timeStr(msg.createdAt)}{msg.editedAt ? ' · edited' : ''}
        </Text>
      </View>
    </View>
  );
}

function SystemCard({ children, palette: p, accent }: { children: React.ReactNode; palette: Palette; accent: string }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
        backgroundColor: `${accent}14`, borderWidth: 1, borderColor: `${accent}30`,
        maxWidth: '85%',
      }}>
        <Text style={{ color: accent, fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 16 }}>
          {children as string}
        </Text>
      </View>
    </View>
  );
}

/* ── Trade action bar ───────────────────────────────────────────── */

function ActionBar({ trade, amBuyer, loading, palette: p, accent, onMarkPaid, onConfirm, onDeny, onCancel }: {
  trade: P2PTrade; amBuyer: boolean; loading: string | null;
  palette: Palette; accent: string;
  onMarkPaid: () => void; onConfirm: () => void;
  onDeny: () => void; onCancel: () => void;
}) {
  const s = trade.status;
  const isLoading = (label: string) => loading === label;

  const btns: Array<{ label: string; action: () => void; primary?: boolean; danger?: boolean }> = [];

  if (amBuyer) {
    if (s === 'PENDING' || s === 'ESCROW_FUNDED') {
      btns.push({ label: "I've paid", action: onMarkPaid, primary: true });
      btns.push({ label: 'Cancel',   action: onCancel,   danger: true });
    }
  } else {
    // Seller
    if (s === 'PAYMENT_SENT') {
      btns.push({ label: 'Confirm received', action: onConfirm, primary: true });
      btns.push({ label: 'Deny',             action: onDeny,    danger: true });
    }
    if (s === 'PENDING') {
      btns.push({ label: 'Cancel', action: onCancel, danger: true });
    }
  }

  if (btns.length === 0) return null;

  return (
    <View style={{
      flexDirection: 'row', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: p.border,
    }}>
      {btns.map((b) => (
        <Pressable
          key={b.label}
          onPress={b.action}
          disabled={!!loading}
          style={({ pressed }) => ({
            flex: 1, height: 42, borderRadius: 21, overflow: 'hidden',
            opacity: loading ? 0.55 : pressed ? 0.82 : 1,
          })}
        >
          {b.primary ? (
            <LinearGradient
              colors={[brand.primaryDark, brand.deep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {isLoading(b.label.toLowerCase())
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>{b.label}</Text>}
            </LinearGradient>
          ) : (
            <View style={{
              flex: 1, alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              borderColor: b.danger ? 'rgba(248,113,113,0.5)' : p.border,
              backgroundColor: b.danger ? 'rgba(248,113,113,0.08)' : p.bgElev,
              borderRadius: 21,
            }}>
              {isLoading(b.label.toLowerCase())
                ? <ActivityIndicator color={b.danger ? '#f87171' : accent} size="small" />
                : <Text style={{ color: b.danger ? '#f87171' : p.fgMuted, fontSize: 13.5, fontWeight: '700' }}>{b.label}</Text>}
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/* ── Dispute modal ──────────────────────────────────────────────── */

const DISPUTE_REASONS = [
  'Payment not received',
  'Incorrect amount received',
  'Payment proof is fraudulent',
  'Counterparty is unresponsive',
  'Crypto not released after payment',
  'Other',
];

function DisputeModal({ visible, tradeId, onClose, onSubmit, palette: p, accent }: {
  visible: boolean; tradeId: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  palette: Palette; accent: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom]     = useState('');
  const [loading, setLoading]   = useState(false);
  const h = useHaptics();

  const submit = async () => {
    const reason = selected === 'Other' ? custom.trim() : selected;
    if (!reason) return;
    setLoading(true);
    try { await onSubmit(reason); } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 34, paddingHorizontal: 20 }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          <Text style={{ color: p.fg, fontSize: 19, fontWeight: '700', marginBottom: 4 }}>Open a dispute</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 18, marginBottom: 18 }}>
            A support agent will be assigned within 24 hours. Only open a dispute if you have a genuine issue.
          </Text>

          {DISPUTE_REASONS.map((r) => (
            <Pressable key={r} onPress={() => { h.selection(); setSelected(r); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 6,
                backgroundColor: selected === r ? `${accent}15` : pressed ? p.bgElev : 'transparent',
                borderWidth: 1, borderColor: selected === r ? `${accent}55` : p.border,
              })}
            >
              <View style={{
                width: 18, height: 18, borderRadius: 9,
                borderWidth: 2, borderColor: selected === r ? accent : p.fgFaint,
                backgroundColor: selected === r ? accent : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {selected === r && <Ionicons name="checkmark" size={10} color="#fff" />}
              </View>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: selected === r ? '700' : '500' }}>{r}</Text>
            </Pressable>
          ))}

          {selected === 'Other' && (
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Describe the issue…"
              placeholderTextColor={p.fgFaint}
              multiline
              maxLength={500}
              style={{
                color: p.fg, backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border, borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 12,
                fontSize: 14, fontWeight: '500', minHeight: 80, marginBottom: 12,
              }}
            />
          )}

          <Pressable
            onPress={submit}
            disabled={!selected || loading || (selected === 'Other' && !custom.trim())}
            style={({ pressed }) => ({
              marginTop: 12, borderRadius: 26, overflow: 'hidden',
              opacity: (!selected || loading) ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={['#dc2626', '#b91c1c']}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ height: 50, alignItems: 'center', justifyContent: 'center' }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '700' }}>Submit dispute</Text>}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
