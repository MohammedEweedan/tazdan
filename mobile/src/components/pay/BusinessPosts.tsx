/**
 * A business's offers and news, as its customers see them: a chip on the
 * pay screen (the latest post, tap for all) and a list on its profile. Only
 * verified business accounts have posts (server: storefront publicPosts).
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { payService } from '@/services';
import { useThemedPalette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';

type Post = Awaited<ReturnType<typeof payService.posts>>[number];
const ICON = { OFFER: 'pricetag', DEAL: 'flash', NEWS: 'newspaper' } as const;

export function useBusinessPosts(ref?: string | null) {
  return useQuery({
    queryKey: ['payee', ref, 'posts'],
    queryFn: () => payService.posts(ref!),
    enabled: !!ref,
    staleTime: 60_000,
    retry: false,
  });
}

function PostCard({ post }: { post: Post }) {
  const p = useThemedPalette();
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const until = post.endsAt ? new Date(post.endsAt).toLocaleDateString(locale === 'ar' ? 'ar-LY' : 'en-GB', { day: 'numeric', month: 'short' }) : null;
  return (
    <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={ICON[post.kind]} size={13} color={p.accentText} />
        <Text style={{ color: p.accentText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{t(`posts.${post.kind.toLowerCase()}`).toUpperCase()}</Text>
        {until ? <Text style={{ color: p.fgFaint, fontSize: 12, marginStart: 'auto' }}>{t('posts.until', { date: until })}</Text> : null}
      </View>
      <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 6 }}>{post.title}</Text>
      <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{post.body}</Text>
    </View>
  );
}

/** Profile section: every live post, or nothing. */
export function BusinessPostList({ refId }: { refId?: string | null }) {
  const p = useThemedPalette();
  const t = useT();
  const { data } = useBusinessPosts(refId);
  if (!data?.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginStart: 4, marginBottom: 8 }}>{t('posts.title').toUpperCase()}</Text>
      {data.map((post) => <PostCard key={post.id} post={post} />)}
    </View>
  );
}

/** Pay screen: the latest post as one line; tap for all of them. */
export function OffersChip({ refId, name }: { refId?: string | null; name: string }) {
  const p = useThemedPalette();
  const t = useT();
  const { data } = useBusinessPosts(refId);
  const [open, setOpen] = useState(false);
  if (!data?.length) return null;
  const first = data[0];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={t('posts.title')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'center', maxWidth: '100%',
          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, opacity: pressed ? 0.8 : 1 })}>
        <Ionicons name={ICON[first.kind]} size={13} color={p.accentText} />
        <Text numberOfLines={1} style={{ color: p.fg, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{first.title}</Text>
        {data.length > 1 ? <Text style={{ color: p.fgMuted, fontSize: 12 }}>{t('posts.more', { n: data.length - 1 })}</Text> : null}
        <Ionicons name="chevron-forward" size={13} color={p.fgFaint} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 20, fontWeight: '700' }}>{t('posts.title')}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 13, marginTop: 2 }}>{t('posts.from', { name })}</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityLabel="Close"
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.bgElev, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color={p.fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8 }}>
            {data.map((post) => <PostCard key={post.id} post={post} />)}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
