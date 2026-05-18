import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { Socket } from 'socket.io-client';
import { getSocket } from '@/src/lib/socket';
import { api } from '@/src/lib/api';

// ── Types ──────────────────────────────────────────────────────────────

type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM' | 'PAYMENT';

interface Message {
  id: string;
  tradeId: string;
  senderId: string;
  content: string;
  type: MessageType;
  imageUrl?: string;
  createdAt: string;
}

interface TradeInfo {
  id: string;
  status: string;
  buyerId: string;
  sellerId: string;
  asset: string;
  amount: string;
  fiatAmount: string;
  fiatCurrency: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const palette = {
  bg: '#0A0A0F',
  surface: '#14141E',
  border: '#2A2A3A',
  accent: '#7B5CF0',
  accentLight: '#A78BFA',
  textPrimary: '#F0F0FF',
  textSecondary: '#8B8BA0',
  bubbleOwn: '#7B5CF0',
  bubbleOther: '#1E1E2E',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  system: '#2A2A3A',
};

const TYPING_DEBOUNCE_MS = 800;

// ── Helpers ────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── Sub-components ─────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{formatDate(date)}</Text>
      <View style={styles.dateLine} />
    </View>
  );
}

function SystemBubble({ content }: { content: string }) {
  return (
    <View style={styles.systemBubble}>
      <Text style={styles.systemText}>{content}</Text>
    </View>
  );
}

function MessageBubble({
  msg,
  isOwn,
}: {
  msg: Message;
  isOwn: boolean;
}) {
  if (msg.type === 'SYSTEM') return <SystemBubble content={msg.content} />;

  if (msg.type === 'PAYMENT') {
    return (
      <View style={[styles.paymentBubble, isOwn && styles.paymentBubbleOwn]}>
        <Text style={styles.paymentIcon}>💸</Text>
        <Text style={styles.paymentText}>{msg.content}</Text>
        <Text style={styles.bubbleTime}>{formatTime(msg.createdAt)}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isOwn && styles.bubbleRowOwn]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {msg.type === 'IMAGE' && msg.imageUrl ? (
          <Image source={{ uri: msg.imageUrl }} style={styles.bubbleImage} resizeMode="cover" />
        ) : null}
        {msg.content ? (
          <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{msg.content}</Text>
        ) : null}
        <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{formatTime(msg.createdAt)}</Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { id: tradeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [trade, setTrade] = useState<TradeInfo | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ── Bootstrap ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!tradeId) return;

    let mounted = true;

    const bootstrap = async () => {
      try {
        const [profileRes, messagesRes, tradeRes] = await Promise.all([
          api.get('/auth/me'),
          api.get(`/messages/trade/${tradeId}`),
          api.get(`/p2p/trades/${tradeId}`),
        ]);

        if (!mounted) return;

        setMyUserId(profileRes.data?.id ?? '');
        setMessages(messagesRes.data ?? []);
        setTrade(tradeRes.data ?? null);

        const sock = await getSocket();
        socketRef.current = sock;

        sock.emit('join:trade', { tradeId });

        sock.on('message:new', (msg: Message) => {
          if (msg.tradeId !== tradeId) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        sock.on('typing:start', ({ userId }: { userId: string }) => {
          if (userId !== myUserId) setPeerTyping(true);
        });
        sock.on('typing:stop', ({ userId }: { userId: string }) => {
          if (userId !== myUserId) setPeerTyping(false);
        });
        sock.on('trade:updated', (updated: TradeInfo) => {
          if (updated.id === tradeId) setTrade(updated);
        });
      } catch (err) {
        if (mounted) Alert.alert('Error', 'Failed to load chat.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      socketRef.current?.emit('leave:trade', { tradeId });
      socketRef.current?.off('message:new');
      socketRef.current?.off('typing:start');
      socketRef.current?.off('typing:stop');
      socketRef.current?.off('trade:updated');
    };
  }, [tradeId]);

  // ── Typing indicator ───────────────────────────────────────────────

  const handleTyping = useCallback(
    (text: string) => {
      setInput(text);
      socketRef.current?.emit('typing:start', { tradeId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { tradeId });
      }, TYPING_DEBOUNCE_MS);
    },
    [tradeId],
  );

  // ── Send message ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string, type: MessageType = 'TEXT', imageUrl?: string) => {
      if (!content.trim() && type === 'TEXT') return;
      setSending(true);
      socketRef.current?.emit('typing:stop', { tradeId });

      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        tradeId: tradeId!,
        senderId: myUserId,
        content,
        type,
        imageUrl,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      setInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      try {
        await api.post('/messages', { tradeId, content, type, imageUrl });
      } catch {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        Alert.alert('Send failed', 'Could not send message. Try again.');
        setInput(content);
      } finally {
        setSending(false);
      }
    },
    [tradeId, myUserId],
  );

  // ── Image picker ───────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets.length) return;
    const uri = result.assets[0].uri;

    // Upload image to server
    try {
      const form = new FormData();
      form.append('file', { uri, name: 'payment.jpg', type: 'image/jpeg' } as any);
      const { data } = await api.post('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await sendMessage(data.url, 'IMAGE', data.url);
    } catch {
      Alert.alert('Upload failed', 'Could not upload image.');
    }
  }, [sendMessage]);

  // ── Trade actions ──────────────────────────────────────────────────

  const markPaymentSent = useCallback(async () => {
    Alert.alert('Confirm', 'Mark payment as sent?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          try {
            await api.post(`/p2p/trades/${tradeId}/payment-sent`);
          } catch {
            Alert.alert('Error', 'Failed to update trade status.');
          }
        },
      },
    ]);
  }, [tradeId]);

  const confirmRelease = useCallback(async () => {
    Alert.alert('Release funds?', 'This will release crypto to the buyer. Confirm only after receiving payment.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Release',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/p2p/trades/${tradeId}/confirm`);
          } catch {
            Alert.alert('Error', 'Failed to confirm trade.');
          }
        },
      },
    ]);
  }, [tradeId]);

  const openDispute = useCallback(async () => {
    Alert.alert('Open Dispute', 'Open a dispute with our support team?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Dispute',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/p2p/trades/${tradeId}/dispute`);
          } catch {
            Alert.alert('Error', 'Failed to open dispute.');
          }
        },
      },
    ]);
  }, [tradeId]);

  // ── Render helpers ─────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = messages[index - 1];
      const showDate = !prev || !isSameDay(prev.createdAt, item.createdAt);
      return (
        <>
          {showDate && <DateSeparator date={item.createdAt} />}
          <MessageBubble msg={item} isOwn={item.senderId === myUserId} />
        </>
      );
    },
    [messages, myUserId],
  );

  const isBuyer = trade?.buyerId === myUserId;
  const isSeller = trade?.sellerId === myUserId;
  const showPaymentSent = isBuyer && trade?.status === 'PAYMENT_PENDING';
  const showRelease = isSeller && trade?.status === 'PAYMENT_SENT';
  const canDispute = ['IN_PROGRESS', 'PAYMENT_PENDING', 'PAYMENT_SENT'].includes(trade?.status ?? '');

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    );
  }

  // ── UI ─────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: trade ? `${trade.asset} · ${trade.amount}` : 'Chat',
          headerStyle: { backgroundColor: palette.surface },
          headerTintColor: palette.textPrimary,
          headerRight: () =>
            canDispute ? (
              <Pressable onPress={openDispute} style={styles.disputeBtn}>
                <Text style={styles.disputeText}>Dispute</Text>
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Trade status banner */}
        {trade && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {trade.fiatAmount} {trade.fiatCurrency} · {trade.status.replace(/_/g, ' ')}
            </Text>
          </View>
        )}

        {/* Trade action buttons */}
        {(showPaymentSent || showRelease) && (
          <View style={styles.actionRow}>
            {showPaymentSent && (
              <Pressable style={styles.actionBtn} onPress={markPaymentSent}>
                <Text style={styles.actionBtnText}>Mark Payment Sent</Text>
              </Pressable>
            )}
            {showRelease && (
              <Pressable style={[styles.actionBtn, styles.releaseBtn]} onPress={confirmRelease}>
                <Text style={styles.actionBtnText}>Release Funds</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Message list */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
            </View>
          }
        />

        {/* Typing indicator */}
        {peerTyping && (
          <View style={styles.typingRow}>
            <Text style={styles.typingText}>typing…</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <Pressable onPress={pickImage} style={styles.attachBtn}>
            <Text style={styles.attachIcon}>📎</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={handleTyping}
            placeholder="Message…"
            placeholderTextColor={palette.textSecondary}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <Pressable
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: palette.textSecondary, fontSize: 14 },

  banner: {
    backgroundColor: palette.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  bannerText: { color: palette.textSecondary, fontSize: 12, textAlign: 'center' },

  actionRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  releaseBtn: { backgroundColor: palette.success },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  list: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1 },

  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: palette.border },
  dateText: { color: palette.textSecondary, fontSize: 11 },

  systemBubble: {
    alignSelf: 'center',
    backgroundColor: palette.system,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 4,
    maxWidth: '80%',
  },
  systemText: { color: palette.textSecondary, fontSize: 12, textAlign: 'center' },

  paymentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.warning,
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentBubbleOwn: { alignSelf: 'flex-end' },
  paymentIcon: { fontSize: 20 },
  paymentText: { color: palette.textPrimary, fontSize: 13, flex: 1 },

  bubbleRow: { marginVertical: 3, maxWidth: '80%', alignSelf: 'flex-start' },
  bubbleRowOwn: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleOwn: { backgroundColor: palette.bubbleOwn, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: palette.bubbleOther, borderBottomLeftRadius: 4 },
  bubbleText: { color: palette.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTextOwn: { color: '#fff' },
  bubbleTime: { color: palette.textSecondary, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.65)' },
  bubbleImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 4 },

  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { color: palette.textSecondary, fontSize: 12, fontStyle: 'italic' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: 8,
  },
  attachBtn: { paddingBottom: 8 },
  attachIcon: { fontSize: 22 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: palette.bg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: palette.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 16 },

  disputeBtn: { marginRight: 12 },
  disputeText: { color: palette.danger, fontWeight: '600', fontSize: 14 },
});
