/**
 * AnnouncementBanner — BuyWidget-style card + bottom sheet.
 *
 * Banner: rounded card like BuyWidget's asset selector row — icon/image left,
 *         title + subtitle right, dismiss ✕ top-right.
 * Sheet:  full BuyWidget bottom sheet style — handle bar, 16:9 hero image,
 *         title, body, "Got it" CTA + quiet opt-out link.
 * Opt-out persisted in AsyncStorage.
 */

import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Text } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { useThemedPalette } from '@/store/themeStore';
import { useLatestAnnouncement, useMarkRead } from '@/hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP } from '@/constants';

const OPT_OUT_KEY = '@announcements_opted_out';

function resolveMediaUrl(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const apiBase = APP.apiBaseUrl.replace(/\/api\/?$/, '');
  if (raw.startsWith('/')) return `${apiBase}${raw}`;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(raw)) {
    const tail = raw.replace(/^https?:\/\/[^/]+/, '');
    return `${apiBase}${tail}`;
  }
  return raw;
}

function useOptOut() {
  const [optedOut, setOptedOut] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(OPT_OUT_KEY).then((v) => { setOptedOut(v === 'true'); setReady(true); });
  }, []);
  const set = (v: boolean) => {
    setOptedOut(v);
    AsyncStorage.setItem(OPT_OUT_KEY, v ? 'true' : 'false');
  };
  return { optedOut, set, ready };
}

export function AnnouncementBanner() {
  const p = useThemedPalette();
  const insets = useSafeAreaInsets();
  const { data } = useLatestAnnouncement();
  const markRead = useMarkRead();
  const { optedOut, set: setOptOut, ready } = useOptOut();

  const [dismissed, setDismissed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const ann = data?.notification;

  if (!ready || optedOut || !ann || dismissed === ann.id) return null;

  const dismiss = () => { setOpen(false); setDismissed(ann.id); markRead.mutate(ann.id); };
  const optOut  = () => { setOptOut(true); setOpen(false); };

  const imgUrl   = resolveMediaUrl(ann.mediaUrl);
  const hasImage = !!imgUrl && ann.mediaType !== 'none' && ann.mediaType !== 'video';

  return (
    <>
      {/* ── Banner card (BuyWidget selector row style) ── */}
      <Animated.View
        entering={FadeInDown.duration(300).springify()}
        exiting={FadeOutUp.duration(200)}
        style={{
          marginHorizontal: 16, marginTop: 12, marginBottom: 4,
          borderRadius: 18,
          backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border,
          overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
        }}
      >
        <Pressable
          onPress={() => setOpen(true)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 14, opacity: pressed ? 0.85 : 1 })}
        >
          {/* Left: image or icon circle */}
          {hasImage ? (
            <Image
              source={{ uri: imgUrl }}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: p.pillBg }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: `${p.ctaBg}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="megaphone" size={22} color={p.ctaBg} />
            </View>
          )}

          {/* Right: text */}
          <View style={{ flex: 1, marginLeft: 14, marginRight: 28 }}>
            {!ann.isRead && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.ctaBg }} />
                <Text style={{ color: p.ctaBg, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }}>NEW</Text>
              </View>
            )}
            <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500', letterSpacing: 0 }} numberOfLines={1}>
              {ann.title}
            </Text>
            {(ann.subtitle || ann.message) ? (
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }} numberOfLines={1}>
                {ann.subtitle || ann.message}
              </Text>
            ) : null}
          </View>

          <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
        </Pressable>

        {/* Dismiss ✕ */}
        <Pressable
          onPress={dismiss} hitSlop={10}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={13} color={p.fgMuted} />
        </Pressable>
      </Animated.View>

      {/* ── Full sheet (BuyWidget modal style) ── */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: insets.bottom + 12, maxHeight: '90%' }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              {/* Hero image */}
              {hasImage && (
                <Image
                  source={{ uri: imgUrl }}
                  style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 18, marginBottom: 20, backgroundColor: p.pillBg }}
                  resizeMode="cover"
                />
              )}

              {/* Chip */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: `${p.ctaBg}18`,
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                }}>
                  <Ionicons name="megaphone" size={12} color={p.ctaBg} />
                  <Text style={{ color: p.ctaBg, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>Announcement</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={{ color: p.fg, fontSize: 22, fontWeight: '500', letterSpacing: 0, marginBottom: 6 }}>
                {ann.title}
              </Text>

              {/* Subtitle */}
              {ann.subtitle ? (
                <Text style={{ color: p.fgMuted, fontSize: 15, fontWeight: '500', marginBottom: 14 }}>
                  {ann.subtitle}
                </Text>
              ) : null}

              {/* Body */}
              <Text style={{ color: p.fgMuted, fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
                {ann.description ?? ann.message}
              </Text>
            </ScrollView>

            {/* Actions */}
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <Pressable
                onPress={dismiss}
                style={({ pressed }) => ({
                  height: 56, borderRadius: 16,
                  backgroundColor: p.ctaBg,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: p.ctaFg, fontSize: 16, fontWeight: '500' }}>Got it</Text>
              </Pressable>

              <Pressable
                onPress={optOut}
                style={({ pressed }) => ({
                  height: 40, borderRadius: 12,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="eye-off-outline" size={13} color={p.fgFaint} />
                <Text style={{ color: p.fgFaint, fontSize: 12, fontWeight: '500' }}>Don't show announcements</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function AnnouncementOptInButton() {
  const p = useThemedPalette();
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(OPT_OUT_KEY).then((v) => setOptedOut(v === 'true'));
  }, []);

  if (!optedOut) return null;

  return (
    <Pressable
      onPress={() => { AsyncStorage.setItem(OPT_OUT_KEY, 'false'); setOptedOut(false); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 13,
        backgroundColor: p.bgElev, borderRadius: 16,
        borderWidth: 1, borderColor: p.border,
        opacity: pressed ? 0.8 : 1,
        marginHorizontal: 16, marginTop: 8,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: `${p.ctaBg}18`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="eye-outline" size={18} color={p.ctaBg} />
      </View>
      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '500', flex: 1 }}>Re-enable announcements</Text>
      <Ionicons name="chevron-forward" size={15} color={p.fgFaint} />
    </Pressable>
  );
}
