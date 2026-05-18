/**
 * Admin Notifications — two tabs:
 *   History  : paginated broadcast log with detail bottom sheet
 *   Compose  : full broadcast composer with type picker, target,
 *              media attachment and live send button
 */

import { useState, useRef } from 'react';
import {
  Alert, Image, Modal, Pressable, RefreshControl,
  ScrollView, View, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';
import { formatRelativeTime } from '@/utils/format';
import { APP } from '@/constants';

/**
 * Server's media endpoint sits at `${apiBaseUrl_without_/api}/media/<file>`.
 * If a stored URL came back relative (e.g. "/media/abc.jpg") or with a
 * stale `localhost` host, rewrite it to use the current LAN base so it
 * loads on physical devices.
 */
function resolveMediaUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const apiBase = APP.apiBaseUrl.replace(/\/api\/?$/, '');
  if (raw.startsWith('/')) return `${apiBase}${raw}`;
  // Normalise localhost so the same upload works on physical devices
  // after the dev server's host shifts between sessions.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(raw)) {
    const tail = raw.replace(/^https?:\/\/[^/]+/, '');
    return `${apiBase}${tail}`;
  }
  return raw;
}

type Tab = 'history' | 'compose';
type NotifType = 'announcement' | 'info' | 'trade' | 'deposit' | 'withdraw' | 'kyc';

const NOTIF_TYPES: NotifType[] = ['announcement', 'info', 'trade', 'deposit', 'withdraw', 'kyc'];

export default function AdminNotifications() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('history');
  const [detailItem, setDetailItem] = useState<any | null>(null);

  // Compose state
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [notifType, setNotifType] = useState<NotifType>('announcement');
  const [allUsers, setAllUsers] = useState(true);
  const [targetInput, setTargetInput] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'none'>('none');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const q = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => adminService.rawNotifications({ page: 1, limit: 50 }),
    enabled: user?.role === 'ADMIN',
  });

  const dash = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminService.dashboard(),
    enabled: user?.role === 'ADMIN',
  });

  const totalUsers = dash.data?.totalUsers ?? 0;

  const broadcastMut = useMutation({
    mutationFn: () => {
      const targetUserIds = allUsers
        ? undefined
        : targetInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      // Server uses `message` as the required broadcast body, `description`
      // as the optional long form. We send the textarea content as both
      // so the banner preview AND the sheet detail both render.
      const body = description.trim();
      return adminService.broadcastNotification({
        title:        title.trim(),
        subtitle:     subtitle.trim() || undefined,
        message:      body,
        description:  body,
        // The notification "type" lives on its own field — never abuse
        // targetRoles for it (that filter targets *user roles*, e.g. ADMIN).
        type:         notifType,
        mediaUrl:     mediaUrl ?? undefined,
        mediaType:    mediaUrl ? 'image' : 'none',
        targetUserIds: targetUserIds?.length ? targetUserIds : undefined,
      });
    },
    onSuccess: (res: any) => {
      Alert.alert('Broadcast sent', `Delivered to ${res?.delivered ?? res?.count ?? 'all'} users`);
      setTitle('');
      setSubtitle('');
      setDescription('');
      setNotifType('announcement');
      setAllUsers(true);
      setTargetInput('');
      setMediaUrl(null);
      setMediaType('none');
      setTab('history');
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Unknown error'),
  });

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const name = asset.fileName ?? `upload_${Date.now()}.jpg`;
    const type = asset.mimeType ?? 'image/jpeg';
    setUploadingMedia(true);
    try {
      const uploaded = await adminService.uploadMedia({ uri: asset.uri, name, type });
      setMediaUrl(uploaded.url);
      setMediaType('image');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.response?.data?.error ?? e?.message ?? 'Try again');
    } finally {
      setUploadingMedia(false);
    }
  };

  const items: any[] = q.data?.items ?? [];

  if (user?.role !== 'ADMIN') return null;

  const canSend = title.trim().length > 0 && description.trim().length > 0 && !broadcastMut.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }}>Notifications</Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{q.data?.total ?? 0}</Text>
        </View>

        {/* Tab pills */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['history', 'compose'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
              >
                <Text style={{ color: on ? p.bg : p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
                  {t === 'history' ? 'History' : 'Compose'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'history' ? (
          /* ── HISTORY TAB ─────────────────────────────────── */
          q.isLoading ? (
            <View style={{ flex: 1, paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="notifications-outline" label="Loading broadcasts…" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
              refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
            >
              {items.length === 0 ? (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Ionicons name="notifications-off-outline" size={42} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, marginTop: 10 }}>No broadcasts yet</Text>
                </View>
              ) : (
                items.map((row: any) => (
                  <Pressable
                    key={row.id}
                    onPress={() => setDetailItem(row)}
                    style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      {row.mediaUrl && (
                        <Image
                          source={{ uri: resolveMediaUrl(row.mediaUrl) }}
                          style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: p.pillBg }}
                          resizeMode="cover"
                        />
                      )}
                      <View style={{ flex: 1, marginRight: 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                            {row.title ?? '(no title)'}
                          </Text>
                          <Text style={{ color: p.fgFaint, fontSize: 11, flexShrink: 0 }}>
                            {formatRelativeTime(row.createdAt)}
                          </Text>
                        </View>
                        {(row.body ?? row.description ?? row.message) ? (
                          <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 3 }} numberOfLines={2}>
                            {row.body ?? row.description ?? row.message}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {row.type && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: p.pillBg }}>
                          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>{String(row.type).toUpperCase()}</Text>
                        </View>
                      )}
                      {row.recipientCount != null && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: p.pillBg }}>
                          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>{row.recipientCount} recipients</Text>
                        </View>
                      )}
                      {row.readCount != null && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(34,197,94,0.12)' }}>
                          <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 }}>{row.readCount} read</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )
        ) : (
          /* ── COMPOSE TAB ─────────────────────────────────── */
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            {/* Title */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>TITLE *</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 46, justifyContent: 'center', marginBottom: 14 }}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Broadcast title"
                placeholderTextColor={p.fgFaint}
                style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}
              />
            </View>

            {/* Subtitle */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>SUBTITLE (optional)</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 46, justifyContent: 'center', marginBottom: 14 }}>
              <TextInput
                value={subtitle}
                onChangeText={setSubtitle}
                placeholder="Short subtitle"
                placeholderTextColor={p.fgFaint}
                style={{ color: p.fg, fontSize: 14 }}
              />
            </View>

            {/* Body */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>MESSAGE BODY *</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 14 }}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Full notification content…"
                placeholderTextColor={p.fgFaint}
                multiline
                numberOfLines={4}
                style={{ color: p.fg, fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Type picker */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {NOTIF_TYPES.map((t) => {
                const on = notifType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setNotifType(t)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
                  >
                    <Text style={{ color: on ? p.bg : p.fg, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>{t.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Target */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>TARGET</Text>
              <Pressable
                onPress={() => setAllUsers(!allUsers)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <View style={{
                  width: 40, height: 22, borderRadius: 11,
                  backgroundColor: allUsers ? '#22c55e' : p.pillBg,
                  borderWidth: 1, borderColor: allUsers ? '#22c55e' : p.border,
                  justifyContent: 'center', paddingHorizontal: 2,
                }}>
                  <View style={{
                    width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
                    alignSelf: allUsers ? 'flex-end' : 'flex-start',
                  }} />
                </View>
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>All users</Text>
              </Pressable>
            </View>
            {!allUsers && (
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 14 }}>
                <TextInput
                  value={targetInput}
                  onChangeText={setTargetInput}
                  placeholder="user-id-1, user-id-2, email@example.com"
                  placeholderTextColor={p.fgFaint}
                  autoCapitalize="none"
                  multiline
                  style={{ color: p.fg, fontSize: 13, minHeight: 50, textAlignVertical: 'top' }}
                />
              </View>
            )}

            {/* Media */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>MEDIA</Text>
            {mediaUrl ? (
              <View style={{ marginBottom: 14 }}>
                <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
                  <Image source={{ uri: resolveMediaUrl(mediaUrl) }} style={{ width: 120, height: 80, borderRadius: 10, borderWidth: 1, borderColor: p.border }} resizeMode="cover" />
                  <Pressable
                    onPress={() => { setMediaUrl(null); setMediaType('none'); }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={pickMedia}
                disabled={uploadingMedia}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: p.border, borderStyle: 'dashed', marginBottom: 14, backgroundColor: p.bgElev, opacity: uploadingMedia ? 0.6 : 1 }}
              >
                {uploadingMedia ? (
                  <ActivityIndicator size="small" color={p.fg} />
                ) : (
                  <Ionicons name="image-outline" size={18} color={p.fgMuted} />
                )}
                <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
                  {uploadingMedia ? 'Uploading…' : 'Attach image'}
                </Text>
              </Pressable>
            )}

            {/* Recipient hint */}
            {allUsers && totalUsers > 0 && (
              <Text style={{ color: p.fgMuted, fontSize: 12, textAlign: 'center', marginBottom: 14 }}>
                Will be sent to{' '}
                <Text style={{ color: p.fg, fontWeight: '600' }}>{totalUsers.toLocaleString()}</Text>
                {' '}active users
              </Text>
            )}

            {/* Send button */}
            <Pressable
              onPress={() => broadcastMut.mutate()}
              disabled={!canSend}
              style={{
                height: 50, borderRadius: 12, backgroundColor: canSend ? p.fg : p.pillBg,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: canSend ? p.fg : p.border,
                opacity: broadcastMut.isPending ? 0.7 : 1,
              }}
            >
              <Text style={{ color: canSend ? p.bg : p.fgFaint, fontWeight: '600', fontSize: 14 }}>
                {broadcastMut.isPending
                  ? 'Sending…'
                  : allUsers
                    ? `Send to ${totalUsers > 0 ? totalUsers.toLocaleString() + ' ' : ''}users`
                    : `Send to selected users`}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Detail bottom sheet */}
      <Modal visible={!!detailItem} transparent animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, maxHeight: '80%' }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 16 }} />
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailItem && (
                <>
                  {detailItem.mediaUrl && (
                    <Image
                      source={{ uri: resolveMediaUrl(detailItem.mediaUrl) }}
                      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 16, backgroundColor: p.pillBg }}
                      resizeMode="cover"
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', flex: 1, marginRight: 8 }}>{detailItem.title}</Text>
                    <Text style={{ color: p.fgFaint, fontSize: 12 }}>{formatRelativeTime(detailItem.createdAt)}</Text>
                  </View>
                  {detailItem.subtitle && (
                    <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{detailItem.subtitle}</Text>
                  )}
                  <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                    {detailItem.body ?? detailItem.description ?? detailItem.message ?? '(no body)'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {detailItem.type && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: p.pillBg }}>
                        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700' }}>{String(detailItem.type).toUpperCase()}</Text>
                      </View>
                    )}
                    {detailItem.recipientCount != null && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: p.pillBg }}>
                        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>{detailItem.recipientCount} recipients</Text>
                      </View>
                    )}
                    {detailItem.readCount != null && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(34,197,94,0.12)' }}>
                        <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>{detailItem.readCount} read</Text>
                      </View>
                    )}
                  </View>
                  {detailItem.sender && (
                    <Text style={{ color: p.fgFaint, fontSize: 12 }}>
                      Sent by: {detailItem.sender?.firstName ?? ''} {detailItem.sender?.lastName ?? detailItem.sender?.email ?? 'Admin'}
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
            <Pressable
              onPress={() => setDetailItem(null)}
              style={{ marginTop: 16, height: 48, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: p.fg, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
