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
import { ActionSheetIOS, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SendMoneySheet } from '@/components/messages/SendMoneySheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import {
  useThread, useSendMessage, useEditMessage, useDeleteMessage,
  useBlockUser, useReportMessage, useEscalateP2P, useHaptics,
} from '@/hooks';
import { getSocket } from '@/lib/socket';
import { profileService, messageService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import { PaymentReceiptBubble } from '@/components/messages/PaymentReceiptBubble';
import { REPORT_REASONS, type ApiMessage, type Conversation } from '@/types/messages';
import { TopGradient } from '@/components/ui/ScreenShell';
import { useTransactionSound } from '@/hooks/useTransactionSound';

import { BottomSheet } from '@/components/ui/BottomSheet';
const BRAND_BLUE = '#63a1db'; // soft brand blue — my bubbles, send button, accents

export default function MessageThread() {
  const { id: partnerIdParam, openPay } = useLocalSearchParams<{ id: string; openPay?: string }>();
  const partnerId = String(partnerIdParam ?? '');
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const t = useT();
  const me = useAuthStore((s) => s.user);
  // Reactive read so the star icon flips immediately when the user
  // toggles their contact list.
  const isContact = useChatPrefs((s) => s.contacts.has(partnerId));
  const readReceiptsOn = useChatPrefs((s) => s.readReceiptsOn);
  const lastSeenOn = useChatPrefs((s) => s.lastSeenOn);
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const txSound = useTransactionSound();

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
    enabled:  !!partnerId,
    staleTime: 60_000,
  });
  const partner = fetchedPartner ?? cachedPartner ?? null;
  const isSupport = partner?.username === 'support' || partner?.role === 'AGENT';
  const { data: serverPrivacy } = useQuery({
    queryKey: ['message-privacy'],
    queryFn: messageService.privacy,
    staleTime: 30_000,
  });
  const privacy = serverPrivacy ?? { readReceiptsOn, lastSeenOn };
  const canSeeReadReceipts = Boolean(privacy.readReceiptsOn && (partner?.messagePrivacy?.canSeeReadReceipts ?? true));
  const canSeePresence = Boolean(privacy.lastSeenOn && (partner?.messagePrivacy?.canSeePresence ?? true));

  useEffect(() => {
    if (!serverPrivacy) return;
    useChatPrefs.getState().setReadReceiptsOn(serverPrivacy.readReceiptsOn).catch(() => {});
    useChatPrefs.getState().setLastSeenOn(serverPrivacy.lastSeenOn).catch(() => {});
  }, [serverPrivacy]);

const { data: messages = [], isLoading } = useThread(partnerId);  const sendMut   = useSendMessage(partnerId);
  const editMut   = useEditMessage(partnerId);
  const deleteMut = useDeleteMessage(partnerId);
  const blockMut  = useBlockUser();
  const reportMut = useReportMessage();
  const escalateMut = useEscalateP2P();

  // Mark inbound as read whenever we open the thread or a new ws push lands.
  useEffect(() => {
    if (partnerId && privacy.readReceiptsOn) messageService.markRead(partnerId).catch(() => {});
  }, [partnerId, messages?.length, privacy.readReceiptsOn]);

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
  const [requestSheet, setRequestSheet] = useState(false);
  const [profileSheet, setProfileSheet] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ messageId?: string } | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  // Admin "reply as @support" toggle — only available to admins
  const isAdmin = me?.role === 'ADMIN';
  const [replyAsSupport, setReplyAsSupport] = useState(false);
  const partnerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEmittingTypingRef   = useRef(false);

  const STICKERS = useMemo(() => [
    { id: 'paid', emoji: '💸', label: t('chat.sticker.paid') },
    { id: 'moon', emoji: '🚀', label: t('chat.sticker.moon') },
    { id: 'locked', emoji: '🔒', label: t('chat.sticker.locked') },
    { id: 'thanks', emoji: '🙏', label: t('chat.sticker.thanks') },
    { id: 'deal', emoji: '🤝', label: t('chat.sticker.deal') },
    { id: 'chart', emoji: '📈', label: t('chat.sticker.chart') },
    { id: 'verified', emoji: '✅', label: t('chat.sticker.verified') },
    { id: 'gift', emoji: '🎁', label: t('chat.sticker.gift') },
  ], [t]);

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

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    // Hard guard against a double-fire (button + keyboard "send", or a fast
    // double-tap before the disabled state re-renders) — that's what caused
    // duplicate messages.
    if (sendMut.isPending || editMut.isPending) return;
    h.light();
    stopTypingEmit();
    if (editing) {
      editMut.mutate({ id: editing.id, content: body }, {
        onSuccess: () => { setEditing(null); setDraft(''); },
      });
      return;
    }
    if (isAdmin && replyAsSupport) {
      // Reply as the @support user — the target user sees the message
      // from support, not from the admin's personal handle.
      try {
        const { adminService } = await import('@/services');
        await adminService.replyAsSupport({ userId: partnerId, content: body });
        setDraft('');
        // Refresh thread so the new message appears
        qc.invalidateQueries({ queryKey: ['thread', partnerId] });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      } catch (e: any) {
        Alert.alert(t('chat.replyFailed'), e?.response?.data?.error ?? e?.message ?? t('common.retry'));
      }
      return;
    }
    sendMut.mutate({ receiverId: partnerId, content: body });
    setDraft('');
  };

  const sendPayment = (amount: number, currency: string, note?: string) => {
    sendMut.mutate(
      {
        receiverId: partnerId,
        content: note || `${amount} ${currency}`,
        type: 'PAYMENT',
        metadata: { amount, currency, note, status: 'COMPLETED' },
      },
      {
        onSuccess: () => {
          h.success();
          txSound.playSuccess('transfer');
          setPaymentSheet(false);
        },
        onError: (e: any) => {
          // Surface the server's actual reason for the rejection — a
          // silent failure (the old behaviour) made the user think
          // "non-USDT crypto doesn't work in chat" when in fact the
          // back-end was returning, e.g., "Insufficient ETH balance"
          // and nobody ever saw it.
          h.error();
          const msg = e?.response?.data?.error
            ?? e?.response?.data?.message
            ?? e?.message
            ?? t('chat.paymentFailedBody');
          Alert.alert(t('chat.paymentFailed'), msg);
        },
      },
    );
  };

  const sendRequest = (amount: number, currency: string, note?: string) => {
    sendMut.mutate(
      {
        receiverId: partnerId,
        content: note || `${amount} ${currency}`,
        type: 'REQUEST',
        metadata: { amount, currency, note, status: 'PENDING' },
      },
      {
        onSuccess: () => {
          h.success();
          txSound.playSuccess('transfer');
          setRequestSheet(false);
        },
        onError: (e: any) => {
          h.error();
          Alert.alert(t('chat.requestFailed'), e?.response?.data?.error ?? e?.message ?? t('chat.requestFailedBody'));
        },
      },
    );
  };

  const sendSticker = (sticker: { id: string; emoji: string; label: string }) => {
    h.light();
    sendMut.mutate({
      receiverId: partnerId,
      content: sticker.label,
      type: 'STICKER',
      metadata: sticker,
    });
    setShowStickers(false);
  };

  // ── Header overflow menu ────────────────────────────────────────
  const openHeaderMenu = () => {
    const options = [
      t('chat.viewProfile'),
      t('chat.blockUser'),
      t('chat.reportUser'),
      ...(isSupport ? [] : [t('chat.escalateSupport')]),
      t('common.cancel'),
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
      Alert.alert(t('chat.actionsTitle'), undefined, [
        { text: t('chat.viewProfile'),         onPress: () => run(0) },
        { text: t('chat.blockUser'),           style: 'destructive', onPress: () => run(1) },
        { text: t('chat.reportUser'),          onPress: () => run(2) },
        ...(isSupport ? [] : [{ text: t('chat.escalateSupport'), onPress: () => run(3) }]),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      t('chat.blockTitle', { name: partner?.firstName ?? 'this user' }),
      t('chat.blockBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.block'), style: 'destructive',
          onPress: () => {
            blockMut.mutate({ userId: partnerId }, {
              onSuccess: () => { router.back(); },
              onError: (e: any) => Alert.alert(t('chat.blockFailed'), e?.response?.data?.error ?? t('common.retry')),
            });
          },
        },
      ],
    );
  };

  const confirmEscalate = () => {
    Alert.alert(
      t('chat.escalateTitle'),
      t('chat.escalateBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chat.escalate'),
          onPress: () => {
            escalateMut.mutate(
              { counterpartyId: partnerId, reason: 'User-initiated escalation' },
              {
                onSuccess: (res) => {
                  Alert.alert(t('chat.escalationOpened'), t('chat.escalationOpenedBody'));
                  router.replace(`/messages/${res.supportThreadWith}`);
                },
                onError: (e: any) => Alert.alert(t('chat.escalateFailed'), e?.response?.data?.error ?? t('common.retry')),
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
      ? [t('common.copy'), ...(m.type === 'TEXT' ? [t('chat.edit')] : []), t('common.delete'), t('common.cancel')]
      : [t('common.copy'), t('chat.reportMessage'), t('common.cancel')];
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
          destructiveButtonIndex: mine ? options.indexOf(t('common.delete')) : undefined,
        },
        run,
      );
    } else {
      const buttons: any[] = [];
      options.slice(0, -1).forEach((label, i) => {
        buttons.push({
          text: label,
          style: label === t('common.delete') ? 'destructive' : undefined,
          onPress: () => run(i),
        });
      });
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(t('chat.message'), undefined, buttons);
    }
  };

  const confirmDelete = (m: ApiMessage) => {
    Alert.alert(t('chat.deleteTitle'), t('chat.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteMut.mutate(m.id) },
    ]);
  };

  // ── Render ──────────────────────────────────────────────────────
  const grouped = useMemo(() => groupByDay(messages ?? []), [messages]);

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
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
          <Pressable
            onPress={() => { h.selection(); setProfileSheet(true); }}
            style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: isSupport ? BRAND_BLUE : (partner?.avatarUrl ? p.bgElev : '#5b86b0'),
            alignItems: 'center', justifyContent: 'center',
            borderWidth: !isSupport && partner?.avatarUrl ? 1 : 0,
            borderColor: p.border,
          }}>
            {isSupport ? (
              <Ionicons name="headset" size={16} color="#fff" />
            ) : partner?.avatarUrl ? (
              <Text style={{ fontSize: 18 }}>{partner.avatarUrl}</Text>
            ) : (
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {(partner?.firstName?.[0] ?? partner?.username?.[0] ?? '?').toUpperCase()}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => { h.selection(); setProfileSheet(true); }} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>
                {partner ? `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim() || `@${partner.username ?? '…'}` : 'Conversation'}
              </Text>
              {isSupport && (
                <View style={{
                  paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5,
                  backgroundColor: BRAND_BLUE,
                }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600' }}>STAFF</Text>
                </View>
              )}
              {partner?.kycStatus === 'APPROVED' && !isSupport && (
                <Ionicons name="checkmark-circle" size={12} color={BRAND_BLUE} />
              )}
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
              {isSupport ? t('chat.staffStatus')
               : canSeePresence && partner?.messagePrivacy?.onlineNow ? t('chat.onlineNow')
               : canSeePresence && partner?.messagePrivacy?.lastSeenAt
                 ? t('chat.lastSeen', { time: relativeTime(partner.messagePrivacy.lastSeenAt) })
               : partner?.username ? `@${partner.username}` : ' '}
            </Text>
          </Pressable>
          {/* Contact / favourite toggle.  Tap = add to (or remove
              from) your saved contacts; the row then surfaces in the
              messages tab's horizontal contacts strip.  Long-press
              pins this chat to the top instead. */}
          {!isSupport && !!partner && (
            <Pressable
              hitSlop={6}
              onPress={async () => {
                h.selection();
                const prefs = useChatPrefs.getState();
                if (prefs.isContact(partner.id)) {
                  await prefs.removeContact(partner.id);
                } else {
                  await prefs.addContact({
                    id: partner.id,
                    handle: partner.username ?? undefined,
                    name: `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim() || undefined,
                    avatarUrl: partner.avatarUrl ?? null,
                    addedAt: Date.now(),
                  });
                }
              }}
              onLongPress={async () => {
                h.medium();
                await useChatPrefs.getState().togglePin(partner.id);
              }}
              delayLongPress={400}
              accessibilityLabel="Add to contacts / pin"
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
                marginRight: 6,
              }}
            >
              <Ionicons
                name={isContact ? 'star' : 'star-outline'}
                size={16}
                color={isContact ? '#f59e0b' : p.fg}
              />
            </Pressable>
          )}
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
            {/* Privacy banner.
                WARNING — current implementation is NOT end-to-end
                encrypted.  Messages traverse the server in plaintext
                (see server/src/controllers/message.controller.ts).
                The user explicitly requested this copy; until a
                Signal-protocol / libsignal layer is wired in, this
                label is aspirational and must be replaced with
                "Secured in transit" (or implemented for real) before
                any public launch. */}
            <View style={{
              alignSelf: 'center',
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: p.border,
              marginBottom: 8,
            }}>
              <Ionicons name="lock-closed" size={11} color={p.fgMuted} />
              <Text style={{
                color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.2,
              }}>
                {t('chat.e2eBanner')}
              </Text>
            </View>

            {isLoading && !messages?.length ? (
              <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 48 }}>
                {t('chat.loadingThread')}
              </Text>
            ) : (messages?.length ?? 0) === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 }}>
                <Ionicons name="chatbubbles-outline" size={32} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                  {t('chat.emptyThread', { name: partner?.firstName ?? 'them' })}
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
                        showReadReceipt={canSeeReadReceipts}
                        t={t}
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
            {/* Admin "reply as support" toggle */}
            {isAdmin && (
              <Pressable
                onPress={() => { h.selection(); setReplyAsSupport((v) => !v); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
                  borderRadius: 10,
                  backgroundColor: replyAsSupport ? p.accentSoft : p.pillBg,
                  borderWidth: 1, borderColor: replyAsSupport ? p.accentBorder : p.border,
                }}
              >
                <Ionicons name={replyAsSupport ? 'shield-checkmark' : 'shield-outline'} size={14} color={replyAsSupport ? p.accentText : p.fgMuted} />
                <Text style={{ color: replyAsSupport ? p.accentText : p.fgMuted, fontSize: 12, fontWeight: '700', flex: 1 }}>
                  {replyAsSupport ? t('chat.replyingAsSupport') : t('chat.replyAsSupport')}
                </Text>
                <View style={{
                  width: 32, height: 18, borderRadius: 9,
                  backgroundColor: replyAsSupport ? '#A3A3A3' : p.border,
                  padding: 2, alignItems: replyAsSupport ? 'flex-end' : 'flex-start', justifyContent: 'center',
                }}>
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
                </View>
              </Pressable>
            )}
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
                accessibilityLabel={t('chat.sendPayment')}
              >
                <Ionicons name="cash-outline" size={18} color={p.fgMuted} />
              </Pressable>
              <Pressable
                onPress={() => { h.light(); setRequestSheet(true); }}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: pressed ? p.border : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
                accessibilityLabel={t('chat.requestMoney')}
              >
                <Ionicons name="receipt-outline" size={18} color={p.fgMuted} />
              </Pressable>
              <Pressable
                onPress={() => { h.selection(); setShowStickers((s) => !s); }}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: pressed ? p.border : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                })}
                accessibilityLabel={t('chat.stickers')}
              >
                <Ionicons name={showStickers ? 'close' : 'happy-outline'} size={18} color={p.fgMuted} />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={(text) => {
                  setDraft(text);
                  if (showStickers) setShowStickers(false);
                  if (text.trim()) {
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
                placeholder={t('chat.messagePlaceholder')}
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
                accessibilityLabel={t('action.send')}
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
                    key={s.id}
                    onPress={() => sendSticker(s)}
                    style={({ pressed }) => ({
                      width: 72, height: 78, borderRadius: 18,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: pressed ? p.pillBg : p.bgElev,
                      borderWidth: 1, borderColor: p.border,
                      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
                    })}
                  >
                    <Text style={{ fontSize: 30 }}>{s.emoji}</Text>
                    <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', marginTop: 4 }}>
                      {s.label}
                    </Text>
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
        mode="SEND"
        recipientLabel={partner ? (partner.username ? `@${partner.username}` : `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim()) : undefined}
        onClose={() => setPaymentSheet(false)}
        onSubmit={sendPayment}
      />
      <SendMoneySheet
        visible={requestSheet}
        palette={p}
        mode="REQUEST"
        recipientLabel={partner ? (partner.username ? `@${partner.username}` : `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim()) : undefined}
        onClose={() => setRequestSheet(false)}
        onSubmit={sendRequest}
      />

      <ProfileSheet
        visible={profileSheet}
        palette={p}
        partner={partner}
        privacy={privacy}
        onClose={() => setProfileSheet(false)}
        t={t}
        onToggleReadReceipts={async (on) => {
          const next = await messageService.updatePrivacy({ readReceiptsOn: on });
          await useChatPrefs.getState().setReadReceiptsOn(next.readReceiptsOn);
          qc.setQueryData(['message-privacy'], next);
          qc.invalidateQueries({ queryKey: ['partner', partnerId] });
        }}
        onToggleLastSeen={async (on) => {
          const next = await messageService.updatePrivacy({ lastSeenOn: on });
          await useChatPrefs.getState().setLastSeenOn(next.lastSeenOn);
          qc.setQueryData(['message-privacy'], next);
          qc.invalidateQueries({ queryKey: ['partner', partnerId] });
        }}
      />

      {/* Report sheet */}
      <ReportSheet
        visible={!!reportTarget}
        palette={p}
        t={t}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason, details) => {
          reportMut.mutate({
            reportedUserId: partnerId,
            messageId: reportTarget?.messageId,
            reason, details,
          }, {
            onSuccess: () => {
              setReportTarget(null);
              Alert.alert(t('chat.reportSubmitted'), t('chat.reportSubmittedBody'));
            },
            onError: (e: any) => Alert.alert(t('chat.reportFailed'), e?.response?.data?.error ?? t('common.retry')),
          });
        }}
      />
    </View>
  );
}

/* ── Bubble ─── */
function Bubble({
  message: m, isLastInRun, meId, palette: p, onLongPress, showReadReceipt, t,
}: {
  message: ApiMessage;
  isLastInRun: boolean;
  meId: string;
  palette: Palette;
  onLongPress: () => void;
  /** When false, the bubble shows a generic delivered tick instead
   *  of the "read" double-check, reflecting the local user's
   *  read-receipts preference. */
  showReadReceipt: boolean;
  t: ReturnType<typeof useT>;
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

  // PAYMENT / REQUEST bubble — animated money cards.
  if ((m.type === 'PAYMENT' || m.type === 'REQUEST') && m.metadata) {
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
          fromMe={m.type === 'REQUEST' ? !isMe : isMe}
          labelOverride={m.type === 'REQUEST' ? (isMe ? t('chat.youRequested') : t('chat.requestedFromYou')) : undefined}
          // Only animate if the bubble was created in the last 5s, so old
          // receipts don't replay every time the user scrolls.
          animate={Date.now() - +new Date(m.createdAt) < 5_000}
        />
      </Pressable>
    );
  }

  if (m.type === 'STICKER' && m.metadata) {
    const emoji = String(m.metadata.emoji ?? m.content ?? '✨');
    const label = String(m.metadata.label ?? '');
    return (
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}
      >
        <View style={{
          width: 138, minHeight: 142, borderRadius: 28,
          backgroundColor: isMe ? '#262626' : p.bgElev,
          borderWidth: 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center',
          padding: 14,
          shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
        }}>
          <Text style={{ fontSize: 58, lineHeight: 70 }}>{emoji}</Text>
          {!!label && (
            <Text style={{ color: isMe ? '#fff' : p.fg, fontSize: 14, fontWeight: '800', marginTop: 8, textAlign: 'center' }}>
              {label}
            </Text>
          )}
        </View>
        {isLastInRun && (
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: isMe ? 'right' : 'left', paddingHorizontal: 8 }}>
            {time}
          </Text>
        )}
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
          {deleted ? t('chat.deleted') : m.content}
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
              {t('chat.edited')} ·
            </Text>
          )}
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600' }}>
            {time}
          </Text>
          {isMe && !deleted && (
            <Ionicons
              name={m.id.startsWith('local_') ? 'time-outline'
                  : (showReadReceipt && m.isRead) ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={(showReadReceipt && m.isRead) ? p.greenFg : p.fgMuted}
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

function ProfileSheet({
  visible, palette: p, partner, privacy, onClose, onToggleReadReceipts, onToggleLastSeen, t,
}: {
  visible: boolean;
  palette: Palette;
  partner: Conversation['partner'] | null;
  privacy: { readReceiptsOn: boolean; lastSeenOn: boolean };
  onClose: () => void;
  t: ReturnType<typeof useT>;
  onToggleReadReceipts: (on: boolean) => Promise<void>;
  onToggleLastSeen: (on: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const name = partner ? `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim() || `@${partner.username ?? 'user'}` : t('chat.profile');
  const presence = partner?.messagePrivacy?.canSeePresence
    ? partner.messagePrivacy.onlineNow ? t('chat.onlineNow')
      : partner.messagePrivacy.lastSeenAt ? t('chat.lastSeen', { time: relativeTime(partner.messagePrivacy.lastSeenAt) })
      : t('chat.lastSeenUnavailable')
    : t('chat.presenceHidden');
  const joinedDate = partner?.createdAt
    ? new Date(partner.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const toggle = async (key: 'read' | 'seen', next: boolean) => {
    setBusy(key);
    try {
      if (key === 'read') await onToggleReadReceipts(next);
      else await onToggleLastSeen(next);
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} contentStyle={{ paddingHorizontal: 0 }}>
            <View style={{
              width: 86, height: 86, borderRadius: 43,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 42 }}>
                {partner?.avatarUrl ?? (partner?.firstName?.[0] ?? partner?.username?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: p.fg, fontSize: 24, fontWeight: '800', marginTop: 14, letterSpacing: -0.4 }}>{name}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
              {partner?.username ? `@${partner.username}` : presence}
            </Text>
            {partner?.username && (
              <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '600', marginTop: 3 }}>{presence}</Text>
            )}
          </BottomSheet>
  );
}

function ProfileInfoRow({
  icon, label, value, borderTop, palette: p,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  borderTop?: boolean;
  palette: Palette;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 13,
      borderTopWidth: borderTop ? 1 : 0, borderTopColor: p.border,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={16} color={p.fgMuted} />
      </View>
      <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12, fontWeight: '800' }}>{label}</Text>
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '800', maxWidth: '52%', textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PrivacyRow({
  icon, title, subtitle, value, disabled, borderTop, palette: p, onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  borderTop?: boolean;
  palette: Palette;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14,
      borderTopWidth: borderTop ? 1 : 0, borderTopColor: p.border,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.pillBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={p.fgMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 2, lineHeight: 15 }}>{subtitle}</Text>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onValueChange} />
    </View>
  );
}

/* ── Report sheet ─── */
function ReportSheet({
  visible, palette: p, onClose, onSubmit, t,
}: {
  visible: boolean;
  palette: Palette;
  t: ReturnType<typeof useT>;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');

  useEffect(() => { if (!visible) { setReason(null); setDetails(''); } }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('chat.reportTitle')}>
          <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>
            {t('chat.reportBody')}
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
                  {t(`report.${r.key}`)}
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
              placeholder={t('chat.reportDetailsPlaceholder')}
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
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
              {t('chat.submitReport')}
            </Text>
          </Pressable>
        </BottomSheet>
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

function relativeTime(iso: string): string {
  const ms = Date.now() - +new Date(iso);
  const mins = Math.max(1, Math.floor(ms / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
