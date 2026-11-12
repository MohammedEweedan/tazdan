/**
 * Message thread — real-time conversation against /api/messages.
 *
 *   • useThread(partnerId) drives the bubble list (auto-marks read on open).
 *   • useSendMessage / useEditMessage / useDeleteMessage drive composer + menu.
 *   • Long-press a bubble  → Edit / Copy / Delete (own) or Copy / Report (theirs).
 *   • Header overflow      → View profile · Block · Report · Escalate to support.
 *   • Cash icon next to send → opens a sheet to attach a payment receipt.
 *   • PaymentReceiptBubble plays the gradual checkmark animation on first render.
 *   • Unconfirmed sends stay as "Not sent" bubbles; tap resends with the same
 *     clientId (never a duplicate). Scrolling to the top loads earlier history.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SendMoneySheet } from '@/components/messages/SendMoneySheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useT } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import { useChatPrefs } from '@/store/chatPrefsStore';
import {
  useThread, useSendMessage, useEditMessage, useDeleteMessage,
  useBlockUser, useReportMessage, useEscalateP2P, useHaptics,
  useStepUpAuth, StepUpDeniedError,
} from '@/hooks';
import {
  isHandleParam, resolveUserIdByHandle, useLoadEarlier, isTransientSendError,
  isLocalMessage, removeLocalMessage, resendVars,
} from '@/hooks/useMessages';
import { setActiveChat } from '@/lib/pushNotifications';
import { useUsdValue } from '@/hooks/useForexRates';
import { StepUpModal } from '@/components/ui/StepUpModal';
import { isStepUpChallengeError } from '@/lib/stepUpErrors';
import { getSocket } from '@/lib/socket';
import { profileService, messageService } from '@/services';
import { QUERY_KEYS } from '@/constants';
import { MoneyRequestCard, PaymentReceiptBubble, type RequestStatus } from '@/components/messages/PaymentReceiptBubble';

const STICKER_IDS = ['paid', 'thanks', 'deal', 'gift', 'moon', 'chart', 'locked', 'verified'];
const STICKER_EMOJI: Record<string, string> = { paid: '💸', thanks: '🙏', deal: '🤝', gift: '🎁', moon: '🚀', chart: '📈', locked: '🔒', verified: '✅' };
import { REPORT_REASONS, type ApiMessage, type Conversation } from '@/types/messages';
import { TopGradient } from '@/components/ui/ScreenShell';
import { useTransactionSound } from '@/hooks/useTransactionSound';

import { BottomSheet } from '@/components/ui/BottomSheet';

/**
 * `/messages/<id>` normally carries a user id, but entry points like the
 * "Message tazdan Support" tile pass a handle (`support`). The messaging API
 * only understands ids — opening the thread with the handle showed a blank
 * "Conversation" screen whose sends were rejected (400) and vanished — so
 * resolve the handle first and swap the route for the real id.
 */
export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const raw = String(id ?? '');
  return isHandleParam(raw) ? <ResolveHandle handle={raw} /> : <MessageThread />;
}

function ResolveHandle({ handle }: { handle: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const p = useThemedPalette();
  const t = useT();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    resolveUserIdByHandle(qc, handle).then((userId) => {
      if (!live) return;
      if (userId) router.replace(`/messages/${userId}`);
      else setFailed(true);
    });
    return () => { live = false; };
  }, [handle, qc, router]);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      {failed ? (
        <>
          <Ionicons name="cloud-offline-outline" size={32} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', textAlign: 'center' }}>{t('common.error')}</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={{ color: p.accentText, fontSize: 14, fontWeight: '700' }}>{t('common.close')}</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={p.fgMuted} />
      )}
    </View>
  );
}

function MessageThread() {
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

  const { data: messages = [], isLoading } = useThread(partnerId);
  const sendMut   = useSendMessage(partnerId);
  const earlier   = useLoadEarlier(partnerId);
  const editMut   = useEditMessage(partnerId);
  const deleteMut = useDeleteMessage(partnerId);
  const blockMut  = useBlockUser();
  const reportMut = useReportMessage();
  const escalateMut = useEscalateP2P();
  const stepUp = useStepUpAuth();
  const toUsd = useUsdValue();
  // A payment waiting for the server's 6-digit step-up code.
  const [payStepUp, setPayStepUp] = useState<{ amount: number; currency: string; note?: string; requestId?: string } | null>(null);
  // The money request being paid, declined or cancelled (its card shows a spinner).
  const [requestBusy, setRequestBusy] = useState<string | null>(null);

  // Mark inbound as read whenever we open the thread or a new ws push lands.
  // Always — the server clears my unread count either way and sends the
  // partner a receipt only when I share them (receipts off used to leave
  // the badge stuck).
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!partnerId) return;
    // Refresh the inbox once the server has the read, so the unread badge
    // clears right away instead of on the next poll.
    messageService.markRead(partnerId)
      .then(() => qc.invalidateQueries({ queryKey: QUERY_KEYS.conversations }))
      .catch(() => {});
  }, [partnerId, lastMessageId, qc]);

  // This chat is on screen: its pushes would only repeat what's visible.
  useFocusEffect(useCallback(() => {
    setActiveChat(partnerId);
    return () => setActiveChat(null);
  }, [partnerId]));

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

  // Auto-scroll on new messages (not when older history is paged in on top).
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [lastMessageId]);

  // "Load earlier": keep the reader's place while older bubbles are inserted
  // above (the content grows by exactly their height).
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const prependRef = useRef<{ height: number; offset: number } | null>(null);
  const loadingEarlierRef = useRef(false); // scroll events outrun state updates
  const loadEarlier = async () => {
    if (!earlier.hasEarlier || loadingEarlierRef.current) return;
    loadingEarlierRef.current = true;
    prependRef.current = { height: contentHeightRef.current, offset: scrollYRef.current };
    try {
      const added = await earlier.loadEarlier();
      if (!added) prependRef.current = null;
    } finally {
      loadingEarlierRef.current = false;
    }
  };

  // ── Compose state ───────────────────────────────────────────────
  const [draft, setDraft]   = useState('');
  const [composerHeight, setComposerHeight] = useState(36);
  const [editing, setEditing] = useState<ApiMessage | null>(null);
  const [paymentSheet, setPaymentSheet] = useState(false);
  // Recipient eligibility, checked while the payment sheet is open so the
  // sender hears "can't receive right now" before sending (UX only — the
  // transfer endpoint still enforces it). Never more specific than that.
  const { data: payEligibility } = useQuery({
    queryKey: ['recipient-check', partnerId],
    queryFn: () => messageService.recipientCheck(partnerId),
    enabled: paymentSheet && !!partnerId,
    staleTime: 30_000,
  });
  const payBlockedNotice = payEligibility?.canReceive === false
    ? (payEligibility.reason === 'SELF' ? t('confirm.recipientSelf') : t('confirm.recipientUnavailable'))
    : null;
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

  const STICKERS = useMemo(() => STICKER_IDS.map((id) => ({ id, emoji: STICKER_EMOJI[id], label: t(`chat.sticker.${id}`) })), [t]);

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
    sendMut.mutate({ receiverId: partnerId, content: body }, {
      // No reply (offline, timeout, 5xx): the bubble stays as "Not sent" and is
      // resent with the same id on tap or reconnect. A refusal removes the
      // bubble — hand the text back instead of silently losing it, and say why.
      onError: (e: any) => {
        if (isTransientSendError(e)) return;
        setDraft((cur) => cur || body);
        Alert.alert(t('common.error'), e?.response?.data?.error ?? e?.message ?? t('common.retry'));
      },
    });
    setDraft('');
  };

  // One key per intended payment: sending the same amount again after a lost
  // reply reuses it, so the server returns the first payment instead of
  // paying twice. Cleared once a payment is confirmed.
  const payAttemptRef = useRef<{ key: string; amount: number; currency: string; note?: string; requestId?: string } | null>(null);
  const paymentKey = (amount: number, currency: string, note?: string, requestId?: string) => {
    const a = payAttemptRef.current;
    if (a && a.amount === amount && a.currency === currency && (a.note ?? '') === (note ?? '') && a.requestId === requestId) return a.key;
    const key = `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    payAttemptRef.current = { key, amount, currency, note, requestId };
    return key;
  };

  /** `requestId`: the money request this payment settles (the server checks amount, currency and people). */
  const sendPayment = async (amount: number, currency: string, note?: string, stepUpCode?: string, requestId?: string): Promise<void> => {
    // High-value payments confirm with Face ID / Touch ID first; the server
    // may still ask for a 6-digit code (new device), handled by the modal.
    let biometricVerified = false;
    if (!stepUpCode) {
      try {
        biometricVerified = await stepUp.guard({ usdValue: toUsd(amount, currency) ?? Number.POSITIVE_INFINITY, reason: `Send ${amount} ${currency}` });
      } catch (e: any) {
        if (e instanceof StepUpDeniedError) { h.error(); Alert.alert(t('chat.paymentFailed'), e.message); return; }
        throw e;
      }
    }
    return new Promise<void>((resolve, reject) => {
      sendMut.mutate(
        {
          receiverId: partnerId,
          clientId: paymentKey(amount, currency, note, requestId),
          content: note || `${amount} ${currency}`,
          type: 'PAYMENT',
          metadata: {
            amount, currency, note, status: 'COMPLETED',
            ...(requestId ? { requestId } : {}),
            ...(biometricVerified ? { biometricVerified: true } : {}),
            ...(stepUpCode ? { stepUpCode } : {}),
          },
        },
        {
          onSuccess: () => {
            payAttemptRef.current = null;
            h.success();
            txSound.playSuccess('transfer');
            setPaymentSheet(false);
            setPayStepUp(null);
            resolve();
          },
          onError: (e: any) => {
            if (isStepUpChallengeError(e) && !stepUpCode) { setPayStepUp({ amount, currency, note, requestId }); resolve(); return; }
            if (isTransientSendError(e)) {
              // It may have gone through. Sending it again reuses the key.
              h.error();
              setPayStepUp(null);
              Alert.alert(t('chat.paymentUnconfirmed'), t('chat.paymentUnconfirmedBody'));
              resolve();
              return;
            }
            if (stepUpCode) { reject(e); return; } // the modal shows the wrong-code error
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
            resolve();
          },
        },
      );
    });
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
          // Unconfirmed: the "Not sent" bubble in the thread offers the retry.
          if (isTransientSendError(e)) { setRequestSheet(false); return; }
          Alert.alert(t('chat.requestFailed'), e?.response?.data?.error ?? e?.message ?? t('chat.requestFailedBody'));
        },
      },
    );
  };

  // ── Money requests: pay (the exact amount asked), decline, or cancel ──
  const partnerName = partner ? (partner.username ? `@${partner.username}` : `${partner.firstName ?? ''}`.trim() || t('chat.request')) : '';
  const payRequest = (m: ApiMessage) => {
    const amount = Number(m.metadata?.amount);
    const currency = String(m.metadata?.currency ?? '');
    const note = (m.metadata?.note as string | undefined) || undefined;
    const label = `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(amount)} ${currency}`;
    h.selection();
    Alert.alert(
      t('chat.payRequestTitle', { amount: label }),
      t('chat.payRequestBody', { name: partnerName, note: note ? ` — “${note}”` : '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.pay'), onPress: async () => {
          setRequestBusy(m.id);
          try { await sendPayment(amount, currency, note, undefined, m.id); } finally { setRequestBusy(null); }
        } },
      ],
    );
  };
  const respondRequest = (m: ApiMessage, action: 'DECLINE' | 'CANCEL') => {
    h.selection();
    Alert.alert(action === 'DECLINE' ? t('chat.declineTitle') : t('chat.cancelTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: action === 'DECLINE' ? t('chat.decline') : t('chat.cancelRequest'), style: 'destructive', onPress: async () => {
        setRequestBusy(m.id);
        try {
          const updated = await messageService.respondRequest(m.id, action);
          qc.setQueryData<ApiMessage[]>(QUERY_KEYS.thread(partnerId), (cur) => cur?.map((x) => (x.id === updated.id ? updated : x)));
          h.success();
        } catch (e: any) {
          h.error();
          Alert.alert(t('common.error'), e?.response?.data?.error ?? e?.message ?? t('common.retry'));
        } finally { setRequestBusy(null); }
      } },
    ]);
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
  const retrySend = (m: ApiMessage) => {
    if (!m.clientId || m.localStatus !== 'failed') return;
    h.light();
    sendMut.mutate(resendVars(m));
  };

  const onBubbleLongPress = (m: ApiMessage) => {
    if (m.deletedAt) return;
    if (isLocalMessage(m)) {
      if (m.localStatus !== 'failed' || !m.clientId) return;
      const clientId = m.clientId;
      h.selection();
      Alert.alert(t('chat.notSentTitle'), undefined, [
        { text: t('chat.sendAgain'), onPress: () => retrySend(m) },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeLocalMessage(qc, partnerId, clientId) },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
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
            backgroundColor: isSupport ? p.accent : (partner?.avatarUrl ? p.bgElev : p.accent),
            alignItems: 'center', justifyContent: 'center',
            borderWidth: !isSupport && partner?.avatarUrl ? 1 : 0,
            borderColor: p.border,
          }}>
            {isSupport ? (
              <Ionicons name="headset" size={16} color={p.accentFg} />
            ) : partner?.avatarUrl ? (
              <Text style={{ fontSize: 18 }}>{partner.avatarUrl}</Text>
            ) : (
              <Text style={{ color: p.accentFg, fontSize: 14, fontWeight: '600' }}>
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
                  backgroundColor: p.accent,
                }}>
                  <Text style={{ color: p.accentFg, fontSize: 9, fontWeight: '600' }}>STAFF</Text>
                </View>
              )}
              {partner?.kycStatus === 'APPROVED' && !isSupport && (
                <Ionicons name="checkmark-circle" size={12} color={p.accent} />
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
            scrollEventThrottle={32}
            onScroll={(e) => {
              scrollYRef.current = e.nativeEvent.contentOffset.y;
              // Near the top with more history on the server: page it in.
              if (scrollYRef.current < 80 && contentHeightRef.current > 0) void loadEarlier();
            }}
            onContentSizeChange={(_w, height) => {
              const pre = prependRef.current;
              if (pre) {
                prependRef.current = null;
                scrollRef.current?.scrollTo({ y: pre.offset + (height - pre.height), animated: false });
              } else {
                scrollRef.current?.scrollToEnd({ animated: false });
              }
              contentHeightRef.current = height;
            }}
          >
            {earlier.hasEarlier && (
              <Pressable onPress={() => void loadEarlier()} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6, marginBottom: 4 }}>
                {earlier.loading
                  ? <ActivityIndicator size="small" color={p.fgMuted} />
                  : <Text style={{ color: p.accentText, fontSize: 12, fontWeight: '600' }}>{t('chat.loadEarlier')}</Text>}
              </Pressable>
            )}
            {/* Privacy banner.
                WARNING — current implementation is NOT end-to-end
                encrypted.  Messages traverse the server in plaintext
                (see server/src/controllers/message.controller.ts).
                The user explicitly requested this copy; until a
                Signal-protocol / libsignal layer is wired in, this
                label is aspirational and must be replaced with
                "Secured in transit" (or implemented for real) before
                any public launch. */}
            {/* Never on a support thread: staff read it in the cockpit, so the
                claim is plainly untrue there. */}
            {!isSupport && (
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
            )}

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
                        onRetry={() => retrySend(m)}
                        showReadReceipt={canSeeReadReceipts}
                        t={t}
                        requestBusy={requestBusy === m.id}
                        onPayRequest={() => payRequest(m)}
                        onRespondRequest={(action) => respondRequest(m, action)}
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
              flexDirection: 'row', alignItems: 'center', gap: 4,
              borderRadius: 26,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              paddingHorizontal: 8, paddingVertical: 8, minHeight: 52,
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
                onContentSizeChange={(event) => setComposerHeight(Math.max(36, Math.min(120, event.nativeEvent.contentSize.height)))}
                style={{
                  flex: 1, color: p.fg, fontSize: 15, fontWeight: '400',
                  paddingHorizontal: 6, paddingVertical: 7, height: composerHeight, minHeight: 36, maxHeight: 120,
                  lineHeight: 22, textAlignVertical: 'center', includeFontPadding: false,
                }}
              />
              <Pressable
                onPress={send}
                disabled={!draft.trim() || sendMut.isPending || editMut.isPending}
                style={({ pressed }) => ({
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: draft.trim() ? p.ctaBg : p.pillBg,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
                accessibilityLabel={t('action.send')}
              >
                <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={18} color={draft.trim() ? p.ctaFg : p.fgFaint} />
              </Pressable>
            </View>

            {/* Sticker tray — four even columns */}
            {showStickers && (
              <View style={{
                marginTop: 10, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 6,
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              }}>
                <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginLeft: 10, marginBottom: 2 }}>
                  {t('chat.stickersTitle').toUpperCase()}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {STICKERS.map((s) => (
                    <View key={s.id} style={{ width: '25%', padding: 4 }}>
                      <Pressable
                        onPress={() => sendSticker(s)}
                        accessibilityRole="button"
                        accessibilityLabel={s.label}
                        style={({ pressed }) => ({
                          height: 82, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: pressed ? p.pillBg : 'transparent',
                          transform: [{ scale: pressed ? 0.94 : 1 }],
                        })}
                      >
                        <Text style={{ fontSize: 36, lineHeight: 44 }}>{s.emoji}</Text>
                        <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          {s.label}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Payment sheet — pulls the user's actual holdings, keyboard-safe */}
      <SendMoneySheet
        visible={paymentSheet}
        palette={p}
        blockedNotice={payBlockedNotice}
        mode="SEND"
        recipientLabel={partner ? (partner.username ? `@${partner.username}` : `${partner.firstName ?? ''} ${partner.lastName ?? ''}`.trim()) : undefined}
        onClose={() => setPaymentSheet(false)}
        onSubmit={(amount: number, currency: string, note?: string) => { void sendPayment(amount, currency, note); }}
      />
      <StepUpModal
        visible={Boolean(payStepUp)}
        action="transfer"
        subtitle={payStepUp ? `${payStepUp.amount} ${payStepUp.currency}` : undefined}
        onSubmit={(code) => sendPayment(payStepUp!.amount, payStepUp!.currency, payStepUp!.note, code, payStepUp!.requestId)}
        onCancel={() => setPayStepUp(null)}
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
  message: m, isLastInRun, meId, palette: p, onLongPress, onRetry, showReadReceipt, t, requestBusy, onPayRequest, onRespondRequest,
}: {
  message: ApiMessage;
  isLastInRun: boolean;
  meId: string;
  palette: Palette;
  onLongPress: () => void;
  /** Resend an unconfirmed bubble (same clientId). */
  onRetry: () => void;
  /** When false, the bubble shows a generic delivered tick instead
   *  of the "read" double-check, reflecting the local user's
   *  read-receipts preference. */
  showReadReceipt: boolean;
  t: ReturnType<typeof useT>;
  /** A pay / decline / cancel on this request is in flight. */
  requestBusy?: boolean;
  onPayRequest?: () => void;
  onRespondRequest?: (action: 'DECLINE' | 'CANCEL') => void;
}) {
  const isMe = m.senderId === meId;
  const time = new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isSoloEmoji = !m.deletedAt && /^\p{Emoji_Presentation}$/u.test(m.content.trim());
  const failed = isMe && m.localStatus === 'failed';
  // Tap a failed bubble to resend; otherwise taps do nothing.
  const onPress = failed ? onRetry : undefined;
  const notSent = failed ? (
    <Pressable onPress={onRetry} hitSlop={6} style={{
      flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
      alignSelf: 'flex-end', paddingHorizontal: 8,
    }}>
      <Ionicons name="alert-circle" size={13} color={p.redFg} />
      <Text style={{ color: p.redFg, fontSize: 10, fontWeight: '600' }}>{t('chat.notSent')}</Text>
    </Pressable>
  ) : null;

  if (isSoloEmoji) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 1 }}
      >
        <Text style={{ fontSize: 44, lineHeight: 52 }}>{m.content.trim()}</Text>
        {notSent ?? (isLastInRun && (
          <Text style={{
            color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 3,
            textAlign: isMe ? 'right' : 'left', paddingHorizontal: 4,
          }}>
            {time}
          </Text>
        ))}
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

  // REQUEST — the person asked pays or declines; the asker can cancel.
  if (m.type === 'REQUEST' && m.metadata) {
    const status = String(m.metadata.status ?? 'PENDING') as RequestStatus;
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={350} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}>
        <MoneyRequestCard
          amount={Number(m.metadata.amount)}
          currency={String(m.metadata.currency ?? '')}
          note={(m.metadata.note as string) || undefined}
          at={m.createdAt}
          status={['PENDING', 'PAID', 'DECLINED', 'CANCELLED'].includes(status) ? status : 'PENDING'}
          mine={isMe}
          busy={requestBusy}
          onPay={onPayRequest}
          onDecline={() => onRespondRequest?.('DECLINE')}
          onCancel={() => onRespondRequest?.('CANCEL')}
        />
      </Pressable>
    );
  }

  // PAYMENT — the animated receipt card.
  if (m.type === 'PAYMENT' && m.metadata) {
    const settlesRequest = typeof m.metadata.requestId === 'string';
    return (
      <Pressable onLongPress={onLongPress} delayLongPress={350} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: 2 }}>
        <PaymentReceiptBubble
          amount={Number(m.metadata.amount)}
          currency={String(m.metadata.currency ?? '')}
          status={m.metadata.status as any}
          note={(m.metadata.note as string) || undefined}
          txRef={m.metadata.txRef as string | undefined}
          at={m.createdAt}
          fromMe={isMe}
          labelOverride={settlesRequest && !isMe ? t('chat.paidRequest').toUpperCase() : undefined}
          // Only animate fresh receipts, so old ones don't replay on scroll.
          animate={Date.now() - +new Date(m.createdAt) < 5_000}
        />
        {notSent}
      </Pressable>
    );
  }

  if (m.type === 'STICKER' && m.metadata) {
    const emoji = String(m.metadata.emoji ?? m.content ?? '✨');
    const id = String(m.metadata.id ?? '');
    const known = STICKER_IDS.includes(id);
    const label = known ? t(`chat.sticker.${id}`) : String(m.metadata.label ?? '');
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', alignItems: 'center', marginTop: 4, marginBottom: 2 }}
      >
        <View style={{
          width: 116, height: 116, borderRadius: 58,
          backgroundColor: isMe ? p.accentSoft : p.pillBg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 66, lineHeight: 80 }}>{emoji}</Text>
        </View>
        {!!label && (
          <View style={{
            marginTop: -14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 13,
            backgroundColor: isMe ? p.accent : p.bgElev, borderWidth: isMe ? 0 : 1, borderColor: p.border,
            shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
          }}>
            <Text style={{ color: isMe ? p.accentFg : p.fg, fontSize: 13, fontWeight: '800' }}>{label}</Text>
          </View>
        )}
        {notSent ?? (isLastInRun && (
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start', paddingHorizontal: 8 }}>
            {time}
          </Text>
        ))}
      </Pressable>
    );
  }

  // Standard text bubble (TEXT, P2P_NOTE, ESCALATION).
  const deleted = !!m.deletedAt;
  return (
    <Pressable
      onPress={onPress}
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
        backgroundColor: isMe ? p.accent : p.bgElev,
        borderWidth: isMe ? 0 : 1,
        borderColor: p.border,
        paddingHorizontal: 14, paddingVertical: 10,
      }}>
        <Text style={{
          color: deleted ? (isMe ? '#ffffffaa' : p.fgFaint)
                         : (isMe ? p.accentFg : p.fg),
          fontSize: 15, fontWeight: '500', lineHeight: 20,
          fontStyle: deleted ? 'italic' : 'normal',
        }}>
          {deleted ? t('chat.deleted') : m.content}
        </Text>
      </View>
      {notSent ?? (isLastInRun && (
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
      ))}
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
                  borderWidth: 1, borderColor: reason === r.key ? p.accent : p.border,
                  backgroundColor: reason === r.key ? 'rgba(0,87,184,0.08)' : p.bgElev,
                }}
              >
                <Text style={{ flex: 1, color: p.fg, fontSize: 13, fontWeight: '600' }}>
                  {t(`report.${r.key}`)}
                </Text>
                {reason === r.key && <Ionicons name="checkmark-circle" size={16} color={p.accent} />}
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
              backgroundColor: reason ? p.accent : p.border,
              alignItems: 'center', justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: p.accentFg, fontSize: 15, fontWeight: '600' }}>
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
