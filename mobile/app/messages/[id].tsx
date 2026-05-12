/**
 * Message thread — real-time conversation against /api/messages.
 *
 *   • useThread(partnerId) drives the bubble list (auto-marks read on open).
 *   • useSendMessage / useEditMessage / useDeleteMessage drive composer + menu.
 *   • Long-press a bubble  → Edit / Copy / Delete (own) or Copy / Report (theirs).
 *   • Header overflow      → View profile · Block · Report · Escalate to support.
 *   • Cash icon next to send → opens a sheet to attach a payment receipt.
 *   • PaymentReceiptBubble plays the gradual checkmark animation on first render.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { SendMoneySheet } from '@/components/messages/SendMoneySheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import {
  useThread, useSendMessage, useEditMessage, useDeleteMessage,
  useBlockUser, useReportMessage, useEscalateP2P, useHaptics,
} from '@/hooks';
import { getSocket } from '@/lib/socket';
import { profileService, messageService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import { PaymentReceiptBubble } from '@/components/messages/PaymentReceiptBubble';
import { REPORT_REASONS, type ApiMessage, type Conversation } from '@/types/messages';

const BRAND_BLUE = '#0057B8';

export default function MessageThread() {
  const { id: partnerIdParam, openPay } = useLocalSearchParams<{ id: string; openPay?: string }>();
  const partnerId = String(partnerIdParam ?? '');
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  // Partner profile — pulled from the conversation cache when available
  // (instant), otherwise fetched directly. Always returns *something* so
  // the header never flashes "unknown" with real data sitting in cache.
  const cachedPartner = useMemo(() => {
    const conv = qc.getQueryData<Conversation[]>(QUERY_KEYS.conversations) ?? [];
    return conv.find((c) => c.partner.id === partnerId)?.partner;
  }, [qc, partnerId]);

  const { data: fetchedPartner } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn:  () => profileService.byId(partnerId),
    enabled:  !cachedPartner && !!partnerId,
    staleTime: 60_000,
  });
  const partner = cachedPartner ?? fetchedPartner ?? null;
  const isSupport = partner?.username === 'support' || partner?.role === 'AGENT';

const { data: messages = [], isLoading } = useThread(partnerId);  const sendMut   = useSendMessage(partnerId);
  const editMut   = useEditMessage(partnerId);
  const deleteMut = useDeleteMessage(partnerId);
  const blockMut  = useBlockUser();
  const reportMut = useReportMessage();
  const escalateMut = useEscalateP2P();

  // Mark inbound as read whenever we open the thread or a new ws push lands.
  useEffect(() => {
    if (partnerId) messageService.markRead(partnerId).catch(() => {});
  }, [partnerId, messages?.length]);

  // Typing indicator — subscribe to partner's typing events via socket.
  useEffect(() => {
    if (!partnerId) return;
    let sockRef: Awaited<ReturnType<typeof getSocket>> | null = null;
    let cancelled = false;

    const onTypingStart = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId !== partnerId) return;
      setIsPartnerTyping(true);
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      partnerTypingTimerRef.current = setTimeout(() => setIsPartnerTyping(false), 3_000);
    };
    const onTypingStop = ({ fromUserId }: { fromUserId: string }) => {
      if (fromUserId !== partnerId) return;
      setIsPartnerTyping(false);
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
    };

    (async () => {
      sockRef = await getSocket();
      if (cancelled) return;
      sockRef.on('typing:start', onTypingStart);
      sockRef.on('typing:stop', onTypingStop);
    })();

    return () => {
      cancelled = true;
      if (partnerTypingTimerRef.current) clearTimeout(partnerTypingTimerRef.current);
      sockRef?.off('typing:start', onTypingStart);
      sockRef?.off('typing:stop', onTypingStop);
    };
  }, [partnerId]);

  // Auto-scroll on new messages.
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages?.length]);

  // ── Compose state ───────────────────────────────────────────────
  const [draft, setDraft]   = useState('');
  const [editing, setEditing] = useState<ApiMessage | null>(null);
  const [paymentSheet, setPaymentSheet] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ messageId?: string } | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const partnerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmittingTypingRef   = useRef(false);

  const STICKERS = useMemo(() => [
    '👍','❤️','😂','🔥','🎉','👏','😭','🤔','👀','🙏',
    '🚀','💯','✅','⭐','👋','🤝','💪','😎','🥳','😍',
    '🤯','😤','🫡','🥷','💀','👑','🎯','🏆','🎁','💸',
    '📈','📉','🌍','🌙','☀️','🔒','⚡','💎','🍀','🦅',
  ], []);

  // Auto-open the payment sheet when arriving with ?openPay=1 (e.g. from
  // the public profile page's "Send money" CTA). Tiny delay so the
  // header / partner data has hydrated before the sheet animates in.
  useEffect(() => {
    if (openPay === '1') {
      const t = setTimeout(() => setPaymentSheet(true), 220);
      return () => clearTimeout(t);
    }
  }, [openPay]);

  const stopTypingEmit = () => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    if (isEmittingTypingRef.current) {
      isEmittingTypingRef.current = false;
      getSocket().then((sock) => sock.emit('typing:stop', { toUserId: partnerId }));
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    h.light();
    stopTypingEmit();
    if (editing) {
      editMut.mutate({ id: editing.id, content: body }, {
        onSuccess: () => { setEditing(null); setDraft(''); },
      });
    } else {
      sendMut.mutate({ receiverId: partnerId, content: body });
      setDraft('');
    }
  };

  const sendPayment = (amount: number, currency: string, note?: string) => {
    sendMut.mutate({
      receiverId: partnerId,
      content: note || `${amount} ${currency}`,
      type: 'PAYMENT',
      metadata: { amount, currency, note, status: 'COMPLETED' },
    });
    setPaymentSheet(false);
  };

  const sendSticker = (sticker: string) => {
    h.light();
    sendMut.mutate({ receiverId: partnerId, content: sticker });
    setShowStickers(false);
  };

  // ── Header overflow menu ────────────────────────────────────────
  const openHeaderMenu = () => {
    const options = [
      'View profile',
      'Block user',
      'Report user',
      ...(isSupport ? [] : ['Escalate to support']),
      'Cancel',
    ];
    const cancelIdx = options.length - 1;

    const run = (idx: number) => {
      if (idx === 0) {
        if (partner?.username) router.push(`/u/${partner.username}`);
      } else if (idx === 1) {
        confirmBlock();
      } else if (idx === 2) {
        setReportTarget({});
      } else if (idx === 3 && !isSupport) {
        confirmEscalate();
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: 1 },
        run,
      );
    } else {
      // Android fallback — simple Alert with buttons.
      Alert.alert('Conversation actions', undefined, [
        { text: 'View profile',         onPress: () => run(0) },
        { text: 'Block user',           style: 'destructive', onPress: () => run(1) },
        { text: 'Report user',          onPress: () => run(2) },
        ...(isSupport ? [] : [{ text: 'Escalate to support', onPress: () => run(3) }]),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${partner?.firstName ?? 'this user'}?`,
      'They will no longer be able to message you, and you will not be able to message them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: () => {
            blockMut.mutate({ userId: partnerId }, {
              onSuccess: () => { router.back(); },
              onError: (e: any) => Alert.alert('Could not block', e?.response?.data?.error ?? 'Try again.'),
            });
          },
        },
      ],
    );
  };

  const confirmEscalate = () => {
    Alert.alert(
      'Escalate to support?',
      'A Promrkts agent will join the conversation and review the trade. Both participants will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          onPress: () => {
            escalateMut.mutate(
              { counterpartyId: partnerId, reason: 'User-initiated escalation' },
              {
                onSuccess: (res) => {
                  Alert.alert('Escalation opened', 'A support agent will respond shortly.');
                  router.replace(`/messages/${res.supportThreadWith}`);
                },
                onError: (e: any) => Alert.alert('Could not escalate', e?.response?.data?.error ?? 'Try again.'),
              },
            );
          },
        },
      ],
    );
  };

  // ── Per-bubble action menu ──────────────────────────────────────
  const onBubbleLongPress = (m: ApiMessage) => {
    if (m.deletedAt) return;
    const mine = m.senderId === me?.id;
    h.selection();
    const options = mine
      ? ['Copy', ...(m.type === 'TEXT' ? ['Edit'] : []), 'Delete', 'Cancel']
      : ['Copy', 'Report message', 'Cancel'];
    const cancelIdx = options.length - 1;

    const run = (idx: number) => {
      if (mine) {
        if (idx === 0) Clipboard.setStringAsync(m.content);
        else if (m.type === 'TEXT' && idx === 1) { setEditing(m); setDraft(m.content); }
        else if ((m.type === 'TEXT' && idx === 2) || (m.type !== 'TEXT' && idx === 1)) {
          confirmDelete(m);
        }
      } else {
        if (idx === 0) Clipboard.setStringAsync(m.content);
        else if (idx === 1) setReportTarget({ messageId: m.id });
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options, cancelButtonIndex: cancelIdx,
          destructiveButtonIndex: mine ? options.indexOf('Delete') : undefined,
        },
        run,
      );
    } else {
      const buttons: any[] = [];
      options.slice(0, -1).forEach((label, i) => {
        buttons.push({
          text: label,
          style: label === 'Delete' ? 'destructive' : undefined,
          onPress: () => run(i),
        });
      });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Message', undefined, buttons);
    }
  };

  const confirmDelete = (m: ApiMessage) => {
    Alert.alert('Delete this message?', 'It will be replaced with "Message deleted" for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(m.id) },
    ]);
  };

  // ── Render ──────────────────────────────────────────────────────
  const grouped = useMemo(() => groupByDay(messages ?? []), [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 10,
          borderBottomWidth: 1, borderBottomColor: p.border,
        }}>
          <Pressable
            onPress={() => { h.selection(); router.back(); }}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={18} color={p.fg} />
          </Pressable>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: isSupport ? BRAND_BLUE : (partner?.avatarUrl ? p.bgElev : '#7c3aed'),
            alignItems: 'center', justifyContent: 'center',
            borderWidth: !isSupport && partner?.avatarUrl ? 1 : 0,
            borderColor: p.border,
          }}>
            {isSupport ? (
              <Ionicons name="headset" size={16} color="#fff" />
            ) : partner?.avatarUrl ? (
              <Text style={{ fontSize: 18 }}>{partner.avatarUrl}</Text>
            ) : (
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                {(partner?.firstName?.[0] ?? partner?.username?.[0] ?? '?').toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}>
                {partner ? `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim() || `@${partner.username ?? '…'}` : 'Conversation'}
              </Text>
              {isSupport && (
                <View style={{
                  paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5,
                  backgroundColor: BRAND_BLUE,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>STAFF</Text>
                </View>
              )}
              {partner?.kycStatus === 'APPROVED' && !isSupport && (
                <Ionicons name="checkmark-circle" size={12} color={BRAND_BLUE} />
              )}
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              {isSupport ? 'Promrkts agent · usually replies in minutes'
               : partner?.username ? `@${partner.username}` : ' '}
            </Text>
          </View>
          <Pressable
            hitSlop={6}
            onPress={openHeaderMenu}
            accessibilityLabel="More options"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={p.fg} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, gap: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {isLoading && !messages?.length ? (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 48 }}>
                Loading…
              </Text>
            ) : (messages?.length ?? 0) === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
                <Ionicons name="chatbubbles-outline" size={32} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                  Say hi to {partner?.firstName ?? 'them'} — your conversation starts now.
                </Text>
              </View>
            ) : (
              grouped.map((group) => (
                <View key={group.label} style={{ gap: 8 }}>
                  <DayChip label={group.label} palette={p} />
                  {group.messages.map((m, idx) => {
                    const next = group.messages[idx + 1];
                    const isLastInRun = !next || next.senderId !== m.senderId;
                    return (
                      <Bubble
                        key={m.id}
                        message={m}
                        isLastInRun={isLastInRun}
                        meId={me?.id ?? ''}
                        palette={p}
                        onLongPress={() => onBubbleLongPress(m)}
                      />
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>

          {/* Typing indicator */}
          {isPartnerTyping && (
            <View style={{
              paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2,
              flexDirection: 'row', alignItems: 'center',
            }}>
              <View style={{
                paddingHorizontal: 12, paddingVertical: 8,
                borderRadius: 16, backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
              }}>
                <TypingDots palette={p} />
              </View>
            </View>
          )}

          {/* Composer */}
          <View style={{
            paddingHorizontal: 12, paddingTop: 10,
            paddingBottom: Platform.OS === 'ios' ? 14 : 12,
            borderTopWidth: 1, borderTopColor: p.border,
            backgroundColor: p.bg,
          }}>
            {editing && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6,
                borderRadius: 10, backgroundColor: p.pillBg,
                borderWidth: 1, borderColor: p.border,
                gap: 8,
              }}>
                <Ionicons name="create-outline" size={14} color={p.fgMuted} />
                <Text numberOfLines={1} style={{ flex: 1, color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>
                  Editing message
                </Text>
                <Pressable onPress={() => { setEditing(null); setDraft(''); }} hitSlop={6}>
                  <Ionicons name="close" size={14} color={p.fgMuted} />
                </Pressable>
              </View>
            )}
            <View style={{
              flexDirection: 'row', alignItems: 'flex-end', gap: 8,
              borderRadius: 22,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              paddingHorizontal: 6, paddingVertical: 6, minHeight: 44,
            }}>
              <Pressable
                onPress={() => { h.light(); setPaymentSheet(true); }}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: pressed ? p.border : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
                accessibilityLabel="Send a payment"
              >
                <Ionicons name="cash-outline" size={18} color={p.fgMuted} />
              </Pressable>
              <Pressable
                onPress={() => { h.selection(); setShowStickers((s) => !s); }}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: pressed ? p.border : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
                accessibilityLabel="Stickers"
              >
                <Ionicons name={showStickers ? 'close' : 'happy-outline'} size={18} color={p.fgMuted} />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={(t) => {
                  setDraft(t);
                  if (showStickers) setShowStickers(false);
                  if (t.trim()) {
                    getSocket().then((sock) => {
                      if (!isEmittingTypingRef.current) {
                        isEmittingTypingRef.current = true;
                        sock.emit('typing:start', { toUserId: partnerId });
                      }
                    });
                  }
                  if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
                  typingStopTimerRef.current = setTimeout(() => {
                    isEmittingTypingRef.current = false;
                    getSocket().then((sock) => sock.emit('typing:stop', { toUserId: partnerId }));
                  }, 1_500);
                }}
                placeholder="Message"
                placeholderTextColor={p.fgFaint}
                multiline
                style={{
                  flex: 1, color: p.fg, fontSize: 15, fontWeight: '500',
                  paddingHorizontal: 4, paddingTop: Platform.OS === 'ios' ? 8 : 4,
                  paddingBottom: Platform.OS === 'ios' ? 8 : 4, maxHeight: 120,
                }}
              />
              <Pressable
                onPress={send}
                disabled={!draft.trim() || sendMut.isPending || editMut.isPending}
                style={({ pressed }) => ({
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: draft.trim() ? BRAND_BLUE : p.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
                accessibilityLabel="Send"
              >
                <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={18} color="#fff" />
              </Pressable>
            </View>

            {/* Sticker picker */}
            {showStickers && (
              <View style={{
                flexDirection: 'row', flexWrap: 'wrap',
                gap: 8, paddingTop: 10, paddingBottom: 4,
              }}>
                {STICKERS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => sendSticker(s)}
                    style={({ pressed }) => ({
                      width: 40, height: 40, borderRadius: 12,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: pressed ? p.pillBg : p.bgElev,
                      borderWidth: 1, borderColor: p.border,
                    })}
                  >
                    <Text style={{ fontSize: 20 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Payment sheet — pulls the user's actual holdings, keyboard-safe */}
      <SendMoneySheet
        visible={paymentSheet}
        palette={p}
        recipientLabel={partner ? (partner.username ? `@${partner.username}` : `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim()) : undefined}
        onClose={() => setPaymentSheet(false)}
        onSubmit={sendPayment}
      />

      {/* Report sheet */}
      <ReportSheet
        visible={!!reportTarget}
        palette={p}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason, details) => {
          reportMut.mutate({
            reportedUserId: partnerId,
            messageId: reportTarget?.messageId,
            reason, details,
          }, {
            onSuccess: () => {
              setReportTarget(null);
              Alert.alert('Report submitted', 'Thanks for letting us know — our team will review.');
            },
            onError: (e: any) => Alert.alert('Could not submit', e?.response?.data?.error ?? 'Try again.'),
          });
        }}
      />
    </View>
  );
}

/* ── Bubble ─── */
function Bubble({
  message: m, isLastInRun, meId, palette: p, onLongPress,
}: {
  message: ApiMessage;
  isLastInRun: boolean;
  meId: string;
  palette: Palette;
  onLongPress: () => void;
}) {
  const isMe = m.senderId === meId;
  const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isSoloEmoji = !m.deletedAt && /^\p{Emoji_Presentation}$/u.test(m.content.trim());

  if (isSoloEmoji) {
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 1 }}
      >
        <Text style={{ fontSize: 44, lineHeight: 52 }}>{m.content.trim()}</Text>
        {isLastInRun && (
          <Text style={{
            color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 3,
            textAlign: isMe ? 'right' : 'left', paddingHorizontal: 4,
          }}>
            {time}
          </Text>
        )}
      </Pressable>
    );
  }

  // SYSTEM = centered chip.
  if (m.type === 'SYSTEM') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
          backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
          maxWidth: '88%',
        }}>
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
            {m.content}
          </Text>
        </View>
      </View>
    );
  }

  // PAYMENT bubble — animated receipt component.
  if (m.type === 'PAYMENT' && m.metadata) {
    const amount = Number(m.metadata.amount);
    const currency = String(m.metadata.currency ?? '');
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          marginTop: 2,
        }}
      >
        <PaymentReceiptBubble
          amount={amount}
          currency={currency}
          status={m.metadata.status as any}
          note={(m.metadata.note as string) || (m.content || undefined)}
          txRef={m.metadata.txRef as string | undefined}
          at={m.createdAt}
          fromMe={isMe}
          // Only animate if the bubble was created in the last 5s, so old
          // receipts don't replay every time the user scrolls.
          animate={Date.now() - +new Date(m.createdAt) < 5_000}
        />
      </Pressable>
    );
  }

  // Standard text bubble (TEXT, P2P_NOTE, ESCALATION).
  const deleted = !!m.deletedAt;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        marginTop: 1,
      }}
    >
      <View style={{
        borderRadius: 18,
        borderBottomRightRadius: isMe && isLastInRun ? 6 : 18,
        borderBottomLeftRadius:  !isMe && isLastInRun ? 6 : 18,
        backgroundColor: isMe ? BRAND_BLUE : p.bgElev,
        borderWidth: isMe ? 0 : 1,
        borderColor: p.border,
        paddingHorizontal: 14, paddingVertical: 10,
      }}>
        <Text style={{
          color: deleted ? (isMe ? '#ffffffaa' : p.fgFaint)
                         : (isMe ? '#fff' : p.fg),
          fontSize: 15, fontWeight: '500', lineHeight: 20,
          fontStyle: deleted ? 'italic' : 'normal',
        }}>
          {deleted ? 'Message deleted' : m.content}
        </Text>
      </View>
      {isLastInRun && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          marginTop: 3,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          paddingHorizontal: 8,
        }}>
          {!!m.editedAt && !deleted && (
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600' }}>
              edited ·
            </Text>
          )}
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600' }}>
            {time}
          </Text>
          {isMe && !deleted && (
            <Ionicons
              name={m.id.startsWith('local_') ? 'time-outline'
                  : m.isRead ? 'checkmark-done' : 'checkmark'}
              size={11}
              color={m.isRead ? BRAND_BLUE : p.fgFaint}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

function DayChip({ label, palette: p }: { label: string; palette: Palette }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 8 }}>
      <View style={{
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
        backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
      }}>
        <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/* ── Report sheet ─── */
function ReportSheet({
  visible, palette: p, onClose, onSubmit,
}: {
  visible: boolean;
  palette: Palette;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');

  useEffect(() => { if (!visible) { setReason(null); setDetails(''); } }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            marginTop: 'auto',
            backgroundColor: p.bg,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            padding: 20, paddingBottom: 32, gap: 12,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 42, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
            Report
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
            Reports are reviewed by Promrkts trust &amp; safety. False reports may affect your account standing.
          </Text>

          <View style={{ gap: 6 }}>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1, borderColor: reason === r.key ? BRAND_BLUE : p.border,
                  backgroundColor: reason === r.key ? 'rgba(0,87,184,0.08)' : p.bgElev,
                }}
              >
                <Text style={{ flex: 1, color: p.fg, fontSize: 13, fontWeight: '600' }}>
                  {r.label}
                </Text>
                {reason === r.key && <Ionicons name="checkmark-circle" size={16} color={BRAND_BLUE} />}
              </Pressable>
            ))}
          </View>

          <View style={{
            borderRadius: 12, borderWidth: 1, borderColor: p.border,
            backgroundColor: p.bgElev, paddingHorizontal: 14, paddingVertical: 10,
          }}>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Additional details (optional)"
              placeholderTextColor={p.fgFaint}
              multiline
              style={{ color: p.fg, fontSize: 13, fontWeight: '500', minHeight: 40 }}
            />
          </View>

          <Pressable
            disabled={!reason}
            onPress={() => reason && onSubmit(reason, details.trim() || undefined)}
            style={({ pressed }) => ({
              height: 50, borderRadius: 16, marginTop: 4,
              backgroundColor: reason ? BRAND_BLUE : p.border,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
              Submit report
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── Typing dots animation ─── */
function TypingDots({ palette: p }: { palette: Palette }) {
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1,   duration: 280, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 280, useNativeDriver: true }),
          Animated.delay(280),
        ]),
      );
    const anim = Animated.parallel([pulse(dot0, 0), pulse(dot1, 160), pulse(dot2, 320)]);
    anim.start();
    return () => anim.stop();
  }, [dot0, dot1, dot2]);

  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 12 }}>
      {([dot0, dot1, dot2] as Animated.Value[]).map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: p.fgMuted,
            opacity: d,
          }}
        />
      ))}
    </View>
  );
}

/* ── Helpers ─── */
function groupByDay(messages: ApiMessage[]): Array<{ label: string; messages: ApiMessage[] }> {
  const out: Array<{ label: string; messages: ApiMessage[] }> = [];
  let cur: { label: string; messages: ApiMessage[] } | null = null;
  for (const m of messages) {
    const label = dayLabel(m.createdAt);
    if (!cur || cur.label !== label) { cur = { label, messages: [] }; out.push(cur); }
    cur.messages.push(m);
  }
  return out;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yest))  return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
