/**
 * Group chat screen.
 *
 *   Header:  group name + member count + settings (owner) + back
 *   LP card: when the group has a pool — balance, kind, status, actions
 *   Message list: text + image bubbles + system "pool" cards
 *   Composer: text input + image picker + send button
 *
 * Image upload uses expo-image-picker → multipart POST through the
 * groupService.sendImage helper. All state mutations flow through
 * React Query hooks; the realtime layer pushes server-side events.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import { APP } from '@/constants';
import { brand, useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import {
  useGroup, useGroupMessages, useSendGroupMessage,
  usePoolDeposit, usePoolWithdraw, usePoolClose,
  useGroupRealtime, useHaptics,
} from '@/hooks';
import { useAuthStore } from '@/store/authStore';
import { groupService } from '@/services/groups';
import type { GroupMessage, LiquidityPool } from '@/types/groups';

// Server returns attachmentUrl like "/uploads/media/xxx.jpg" — prefix
// with the API base so the mobile image loader can fetch it.
function resolveUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${APP.apiBaseUrl?.replace(/\/$/, '')}${url}`;
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function GroupChat() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;
  const me = useAuthStore((s) => s.user?.id);

  useGroupRealtime();

  const { data: group } = useGroup(id);
  const { data: messages } = useGroupMessages(id);
  const send = useSendGroupMessage(id);

  const [text, setText] = useState('');
  const [pickedImage, setPickedImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Mark read on mount.
  useEffect(() => {
    if (id) groupService.markRead(id).catch(() => {});
  }, [id]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages?.length]);

  const memberMap = useMemo(() => {
    const map = new Map<string, { name: string; isMe: boolean }>();
    (group?.members ?? []).forEach((m) => {
      map.set(m.userId, {
        name: m.user ? `${m.user.firstName}` : '—',
        isMe: m.userId === me,
      });
    });
    return map;
  }, [group?.members, me]);

  const pickImage = async () => {
    h.selection();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
    setPickedImage({
      uri:  asset.uri,
      name: `chat_${Date.now()}.${ext}`,
      type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
    });
  };

  const sendMessage = async () => {
    if (send.isPending) return;
    const content = text.trim();
    if (!content && !pickedImage) return;
    h.medium();
    setText('');
    const imageToSend = pickedImage;
    setPickedImage(null);
    try {
      await send.mutateAsync({
        content: content || undefined,
        image:   imageToSend ?? undefined,
      });
    } catch (e: any) {
      // Restore the draft if the send fails.
      setText(content);
      setPickedImage(imageToSend);
    }
  };

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  const activeMembers = (group.members ?? []).filter((m) => !m.leftAt);
  const myRole = activeMembers.find((m) => m.userId === me)?.role ?? 'MEMBER';

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
          borderBottomWidth: 1, borderBottomColor: p.border,
        }}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>

          <View style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: `${accent}1F`,
            borderWidth: 1, borderColor: `${accent}44`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="people" size={18} color={accent} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
              {activeMembers.length} member{activeMembers.length === 1 ? '' : 's'}
              {group.pool ? ` · 💰 $${Number(group.pool.totalBalanceUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : ''}
            </Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 6 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Liquidity pool card */}
            {group.pool && (
              <PoolCard
                pool={group.pool}
                palette={p}
                accent={accent}
                themeMode={themeMode}
                role={myRole}
                onDeposit={() => setDepositOpen(true)}
                onWithdraw={() => setWithdrawOpen(true)}
              />
            )}

            {(messages ?? []).map((m, i) => {
              const sender = memberMap.get(m.senderId);
              const isMine = sender?.isMe;
              const prev = messages?.[i - 1];
              const showHeader = !prev || prev.senderId !== m.senderId;
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isMine={!!isMine}
                  senderName={sender?.name ?? '—'}
                  showHeader={showHeader}
                  palette={p}
                  accent={accent}
                />
              );
            })}
          </ScrollView>

          {/* Composer */}
          <View style={{
            borderTopWidth: 1, borderTopColor: p.border,
            paddingHorizontal: 12, paddingVertical: 10,
            paddingBottom: Platform.OS === 'ios' ? 14 : 10,
            gap: 8,
          }}>
            {pickedImage && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14,
                backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
              }}>
                <Image source={{ uri: pickedImage.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                  Photo ready to send
                </Text>
                <Pressable onPress={() => setPickedImage(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={p.fgFaint} />
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <Pressable
                onPress={pickImage}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: pressed ? `${accent}1F` : p.bgElev,
                  borderWidth: 1, borderColor: pressed ? `${accent}66` : p.border,
                  alignItems: 'center', justifyContent: 'center',
                })}
              >
                <Ionicons name="image-outline" size={18} color={accent} />
              </Pressable>

              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message"
                placeholderTextColor={p.fgFaint}
                multiline
                maxLength={4000}
                style={{
                  flex: 1, minHeight: 40, maxHeight: 120,
                  borderRadius: 20,
                  backgroundColor: p.bgElev,
                  borderWidth: 1, borderColor: p.border,
                  paddingHorizontal: 14, paddingVertical: 10,
                  color: p.fg, fontSize: 14, fontWeight: '500',
                }}
              />

              <Pressable
                onPress={sendMessage}
                disabled={send.isPending || (!text.trim() && !pickedImage)}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
                  opacity: (!text.trim() && !pickedImage) ? 0.45 : pressed ? 0.8 : 1,
                })}
              >
                <LinearGradient
                  colors={[brand.primaryDark, brand.deep]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  {send.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Pool deposit modal */}
      {group.pool && (
        <PoolDepositModal
          visible={depositOpen}
          onClose={() => setDepositOpen(false)}
          groupId={id}
          palette={p}
          accent={accent}
        />
      )}
      {group.pool && (
        <PoolWithdrawModal
          visible={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          groupId={id}
          pool={group.pool}
          mySharePosition={
            group.pool.members?.find((m) => m.userId === me)
              ? Number(group.pool.members.find((m) => m.userId === me)!.totalContributedUsd) -
                Number(group.pool.members.find((m) => m.userId === me)!.totalWithdrawnUsd)
              : 0
          }
          palette={p}
          accent={accent}
        />
      )}
    </View>
  );
}

// ── Message bubble ─────────────────────────────────────────────────

function MessageBubble({
  msg, isMine, senderName, showHeader, palette: p, accent,
}: {
  msg: GroupMessage;
  isMine: boolean;
  senderName: string;
  showHeader: boolean;
  palette: Palette;
  accent: string;
}) {
  // System messages render as centered narrative cards.
  if (msg.type === 'POOL_CREATED' || msg.type === 'POOL_DEPOSIT' || msg.type === 'POOL_WITHDRAW' || msg.type === 'POOL_CLOSED' || msg.type === 'SYSTEM') {
    let label = 'System update';
    if (msg.type === 'POOL_CREATED')  label = `💰 Pool created${msg.metadata?.name ? `: ${msg.metadata.name}` : ''}`;
    if (msg.type === 'POOL_DEPOSIT')  label = `💰 Deposit of $${Number(msg.metadata?.amountUsd ?? 0).toFixed(2)}`;
    if (msg.type === 'POOL_WITHDRAW') label = `💸 Withdrew $${Number(msg.metadata?.amountUsd ?? 0).toFixed(2)}`;
    if (msg.type === 'POOL_CLOSED')   label = `✅ Pool closed · $${Number(msg.metadata?.distributedUsd ?? 0).toFixed(2)} distributed`;
    return (
      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
          backgroundColor: `${accent}1A`, borderWidth: 1, borderColor: `${accent}33`,
        }}>
          <Text style={{ color: accent, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
        </View>
      </View>
    );
  }

  const imageUrl = resolveUrl(msg.attachmentUrl);

  return (
    <View style={{ marginVertical: 1, alignItems: isMine ? 'flex-end' : 'flex-start' }}>
      {!isMine && showHeader && (
        <Text style={{ color: accent, fontSize: 11, fontWeight: '700', marginBottom: 2, marginLeft: 12 }}>
          {senderName}
        </Text>
      )}
      <View
        style={{
          maxWidth: '78%',
          paddingHorizontal: imageUrl ? 6 : 12,
          paddingVertical: imageUrl ? 6 : 8,
          borderRadius: 18,
          borderTopRightRadius: isMine ? 4 : 18,
          borderTopLeftRadius:  isMine ? 18 : 4,
          backgroundColor: isMine ? accent : p.bgElev,
          borderWidth: isMine ? 0 : 1,
          borderColor: p.border,
        }}
      >
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 220, height: 220, borderRadius: 14 }}
            resizeMode="cover"
          />
        )}
        {!!msg.content && (
          <Text style={{
            color: isMine ? '#fff' : p.fg,
            fontSize: 14, fontWeight: '500',
            marginTop: imageUrl ? 6 : 0,
            paddingHorizontal: imageUrl ? 6 : 0,
            paddingBottom: imageUrl ? 4 : 0,
          }}>
            {msg.deletedAt ? 'Message deleted' : msg.content}
          </Text>
        )}
        <Text style={{
          color: isMine ? 'rgba(255,255,255,0.65)' : p.fgFaint,
          fontSize: 9.5, fontWeight: '600',
          marginTop: 2, alignSelf: 'flex-end',
          paddingHorizontal: imageUrl ? 6 : 0,
        }}>
          {timeStr(msg.createdAt)}
          {msg.editedAt ? ' · edited' : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Pool card ───────────────────────────────────────────────────────

function PoolCard({
  pool, palette: p, accent, themeMode, role, onDeposit, onWithdraw,
}: {
  pool: LiquidityPool;
  palette: Palette;
  accent: string;
  themeMode: 'dark' | 'light';
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onDeposit: () => void;
  onWithdraw: () => void;
}) {
  const h = useHaptics();
  const close = usePoolClose(pool.groupId);
  const progress = pool.targetAmountUsd
    ? Math.min(1, Number(pool.totalBalanceUsd) / Number(pool.targetAmountUsd))
    : null;

  return (
    <View style={{
      borderRadius: 22, overflow: 'hidden', marginBottom: 14,
      shadowColor: accent, shadowOpacity: themeMode === 'dark' ? 0.35 : 0.18,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    }}>
      <LinearGradient
        colors={[`${accent}33`, `${accent}1A`]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={{
          padding: 16,
          borderWidth: 1, borderColor: `${accent}55`,
          borderRadius: 22,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 }}>
              {pool.kind === 'GOAL_BASED' ? 'SAVINGS GOAL' : 'SHARED POOL'} · {pool.status}
            </Text>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', letterSpacing: -0.2, marginTop: 2 }}>
              {pool.name}
            </Text>
          </View>
          {role === 'OWNER' && pool.status !== 'DISSOLVED' && (
            <Pressable
              onPress={() => { h.medium(); close.mutate(); }}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
                backgroundColor: pressed ? p.border : 'transparent',
                borderWidth: 1, borderColor: p.border,
              })}
            >
              <Text style={{ color: p.fgMuted, fontSize: 10.5, fontWeight: '700' }}>
                {close.isPending ? '…' : 'CLOSE'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: p.fg, fontSize: 30, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
            ${Number(pool.totalBalanceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {pool.targetAmountUsd && (
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
              / ${Number(pool.targetAmountUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          )}
        </View>

        {progress !== null && (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: `${accent}22`, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: accent }} />
          </View>
        )}

        {pool.status !== 'DISSOLVED' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Pressable
              onPress={onDeposit}
              style={({ pressed }) => ({
                flex: 1, height: 38, borderRadius: 19, overflow: 'hidden',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={[brand.primaryDark, brand.deep]}
                start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
              >
                <Ionicons name="arrow-up" size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '700' }}>Deposit</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              onPress={onWithdraw}
              style={({ pressed }) => ({
                flex: 1, height: 38, borderRadius: 19,
                backgroundColor: p.bg, borderWidth: 1, borderColor: `${accent}55`,
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="arrow-down" size={13} color={accent} />
              <Text style={{ color: accent, fontSize: 12.5, fontWeight: '700' }}>Withdraw</Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

// ── Deposit / withdraw modals ──────────────────────────────────────

function PoolDepositModal({
  visible, onClose, groupId, palette: p, accent,
}: {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  palette: Palette;
  accent: string;
}) {
  const h = useHaptics();
  const deposit = usePoolDeposit(groupId);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USDT' | 'USDC' | 'USD'>('USDT');

  const submit = async () => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return;
    h.medium();
    try {
      await deposit.mutateAsync({ currency, amount: n });
      setAmount('');
      onClose();
    } catch (e: any) {
      // Stay open so user can see error.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: p.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 12, paddingBottom: 28, paddingHorizontal: 22,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
            Deposit to pool
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 12.5, fontWeight: '500', marginTop: 4, lineHeight: 17 }}>
            v1 settles in USD-pegged stablecoins. Crypto deposits coming soon.
          </Text>

          {/* Currency picker */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {(['USDT', 'USDC', 'USD'] as const).map((c) => {
              const active = currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => { h.selection(); setCurrency(c); }}
                  style={({ pressed }) => ({
                    flex: 1, height: 42, borderRadius: 14,
                    backgroundColor: active ? `${accent}1A` : p.bgElev,
                    borderWidth: 1, borderColor: active ? accent : p.border,
                    alignItems: 'center', justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: active ? accent : p.fg, fontSize: 13, fontWeight: '700' }}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 14, gap: 6 }}>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              style={{
                color: p.fg, backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border, borderRadius: 14,
                paddingHorizontal: 14, paddingVertical: 14,
                fontSize: 22, fontWeight: '700',
              }}
            />
          </View>

          <Pressable
            onPress={submit}
            disabled={!amount || deposit.isPending}
            style={({ pressed }) => ({
              marginTop: 16, borderRadius: 26, overflow: 'hidden',
              opacity: (!amount || deposit.isPending) ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <LinearGradient
              colors={[brand.primaryDark, brand.primary, brand.deep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ height: 50, alignItems: 'center', justifyContent: 'center' }}
            >
              {deposit.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Deposit ${amount || '0.00'}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PoolWithdrawModal({
  visible, onClose, groupId, pool, mySharePosition, palette: p, accent,
}: {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  pool: LiquidityPool;
  mySharePosition: number;
  palette: Palette;
  accent: string;
}) {
  const h = useHaptics();
  const withdraw = usePoolWithdraw(groupId);
  const [amount, setAmount] = useState('');

  const locked = pool.kind === 'GOAL_BASED' && pool.status !== 'COMPLETED' && pool.status !== 'DISSOLVED';
  const maxUsd = Math.max(0, mySharePosition);

  const submit = async () => {
    const n = Number(amount);
    if (!isFinite(n) || n <= 0) return;
    h.medium();
    try {
      await withdraw.mutateAsync({ amountUsd: n });
      setAmount('');
      onClose();
    } catch {
      /* keep open */
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: p.bg,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 12, paddingBottom: 28, paddingHorizontal: 22,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginTop: 8 }}>
            Withdraw from pool
          </Text>

          {locked ? (
            <Text style={{ color: p.amberFg, fontSize: 13, fontWeight: '600', marginTop: 12, lineHeight: 19 }}>
              This pool is goal-based and locked until the target is met or the owner closes it.
            </Text>
          ) : (
            <>
              <Text style={{ color: p.fgMuted, fontSize: 12.5, fontWeight: '500', marginTop: 4 }}>
                Your available share: <Text style={{ color: p.fg, fontWeight: '700' }}>${maxUsd.toFixed(2)}</Text>
              </Text>

              <View style={{ marginTop: 14, gap: 6 }}>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>Amount (USDT)</Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={p.fgFaint}
                  keyboardType="decimal-pad"
                  style={{
                    color: p.fg, backgroundColor: p.bgElev,
                    borderWidth: 1, borderColor: p.border, borderRadius: 14,
                    paddingHorizontal: 14, paddingVertical: 14,
                    fontSize: 22, fontWeight: '700',
                  }}
                />
                <Pressable onPress={() => setAmount(maxUsd.toFixed(2))}>
                  <Text style={{ color: accent, fontSize: 11.5, fontWeight: '700', alignSelf: 'flex-end' }}>
                    Use max
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={submit}
                disabled={!amount || withdraw.isPending}
                style={({ pressed }) => ({
                  marginTop: 16, borderRadius: 26, overflow: 'hidden',
                  opacity: (!amount || withdraw.isPending) ? 0.5 : pressed ? 0.85 : 1,
                })}
              >
                <LinearGradient
                  colors={[brand.primaryDark, brand.primary, brand.deep]}
                  start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
                  style={{ height: 50, alignItems: 'center', justifyContent: 'center' }}
                >
                  {withdraw.isPending ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                      Withdraw ${amount || '0.00'}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
