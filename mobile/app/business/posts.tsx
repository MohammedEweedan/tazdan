/**
 * Offers & news — posts on the business's public profile (the page a
 * customer sees after scanning or opening @handle). Posts go public once the
 * business is verified, run between optional dates, and can be kept as
 * drafts. tazdan staff can take a post down (shown here as "Hidden by tazdan").
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Text } from '@/components/ui/Text';
import { useThemedPalette } from '@/store/themeStore';
import { extractErrorMessage, useHaptics } from '@/hooks';
import { businessService, type BusinessPost, type PostKind } from '@/services/business';
import { postState, POST_KIND_LABEL } from '@/lib/posts';

const DAY = 86_400_000;
const RUNS = [
  { key: 'none', label: 'No end date', days: 0 },
  { key: '7', label: '1 week', days: 7 },
  { key: '14', label: '2 weeks', days: 14 },
  { key: '30', label: '1 month', days: 30 },
] as const;
type Run = (typeof RUNS)[number]['key'];

export default function BusinessPosts() {
  const p = useThemedPalette();
  const h = useHaptics();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['business', 'posts'], queryFn: businessService.posts });

  const [editing, setEditing] = useState<BusinessPost | null>(null);
  const [kind, setKind] = useState<PostKind>('OFFER');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [run, setRun] = useState<Run>('none');
  const [busy, setBusy] = useState(false);

  const clear = () => { setEditing(null); setKind('OFFER'); setTitle(''); setBody(''); setRun('none'); };
  const refresh = () => qc.invalidateQueries({ queryKey: ['business', 'posts'] });

  const startEdit = (post: BusinessPost) => {
    h.selection();
    setEditing(post);
    setKind(post.kind);
    setTitle(post.title);
    setBody(post.body);
    setRun('none');
  };

  const canPost = title.trim().length >= 3 && body.trim().length >= 1;

  const submit = async (published: boolean) => {
    if (!canPost || busy) return;
    setBusy(true);
    const days = RUNS.find((r) => r.key === run)!.days;
    // Editing keeps the existing dates unless a new run length is chosen.
    const endsAt = days ? new Date(Date.now() + days * DAY).toISOString() : editing ? undefined : null;
    try {
      const draft = { kind, title: title.trim(), body: body.trim(), published, ...(endsAt !== undefined ? { endsAt } : {}) };
      if (editing) await businessService.updatePost(editing.id, draft);
      else await businessService.createPost(draft);
      h.success();
      clear();
      await refresh();
    } catch (e) {
      h.error();
      Alert.alert('Post not saved', extractErrorMessage(e));
    } finally { setBusy(false); }
  };

  const toggle = async (post: BusinessPost) => {
    try { await businessService.updatePost(post.id, { published: !post.published }); h.selection(); await refresh(); }
    catch (e) { Alert.alert('Could not update the post', extractErrorMessage(e)); }
  };

  const remove = (post: BusinessPost) => Alert.alert('Delete this post?', post.title, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await businessService.deletePost(post.id); if (editing?.id === post.id) clear(); await refresh(); }
      catch (e) { Alert.alert('Could not delete the post', extractErrorMessage(e)); }
    } },
  ]);

  const posts = q.data ?? [];
  const input = { color: p.fg, fontSize: 15, backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 14, paddingVertical: 12 } as const;

  return (
    <ScreenShell title="Offers & news" subtitle="Shown on your public profile" keyboard onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <View style={{ backgroundColor: p.bgElev, borderRadius: 18, borderWidth: 1, borderColor: p.border, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>{editing ? 'Edit post' : 'New post'}</Text>
          {editing ? <Pressable onPress={clear} hitSlop={8}><Text style={{ color: p.accentText, fontWeight: '600' }}>Cancel</Text></Pressable> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => (
            <Pressable key={k} onPress={() => { h.selection(); setKind(k); }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: kind === k ? p.accent : p.bg, borderWidth: 1, borderColor: kind === k ? p.accent : p.border }}>
              <Text style={{ color: kind === k ? p.accentFg : p.fg, fontWeight: '700', fontSize: 13 }}>{POST_KIND_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={title} onChangeText={setTitle} maxLength={80} placeholder="Headline, e.g. 2 coffees for 5 LYD" placeholderTextColor={p.fgFaint} style={input} />
        <TextInput value={body} onChangeText={setBody} maxLength={600} multiline placeholder="Details: what, when, any conditions" placeholderTextColor={p.fgFaint}
          style={[input, { marginTop: 10, minHeight: 96, textAlignVertical: 'top' }]} />
        <Text style={{ color: p.fgFaint, fontSize: 11, textAlign: 'right', marginTop: 4 }}>{body.length}/600</Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 6, marginBottom: 8 }}>{editing ? 'Run for (leave as is to keep the dates)' : 'Run for'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {RUNS.map((r) => (
            <Pressable key={r.key} onPress={() => setRun(r.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: run === r.key ? p.fg : p.bg, borderWidth: 1, borderColor: run === r.key ? p.fg : p.border }}>
              <Text style={{ color: run === r.key ? p.bg : p.fg, fontSize: 13, fontWeight: '600' }}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Pressable onPress={() => submit(false)} disabled={!canPost || busy}
            style={({ pressed }) => ({ flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: p.border, opacity: !canPost ? 0.5 : pressed ? 0.8 : 1 })}>
            <Text style={{ color: p.fg, fontWeight: '700' }}>Save draft</Text>
          </Pressable>
          <Pressable onPress={() => submit(true)} disabled={!canPost || busy}
            style={({ pressed }) => ({ flex: 1.4, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: p.accent, opacity: !canPost ? 0.5 : pressed ? 0.85 : 1 })}>
            {busy ? <ActivityIndicator color={p.accentFg} /> : <Text style={{ color: p.accentFg, fontWeight: '800' }}>{editing ? 'Save & publish' : 'Publish'}</Text>}
          </Pressable>
        </View>
      </View>

      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.7, marginTop: 26, marginBottom: 10 }}>YOUR POSTS</Text>
      {q.isLoading ? <ActivityIndicator color={p.fgMuted} style={{ marginTop: 20 }} /> : null}
      {q.error ? <Text style={{ color: p.redFg }}>{extractErrorMessage(q.error)}</Text> : null}
      {!q.isLoading && !posts.length && !q.error ? (
        <Text style={{ color: p.fgMuted, textAlign: 'center', marginTop: 16, lineHeight: 20 }}>
          Nothing posted yet. Offers and news show on your profile when customers scan your code or look you up.
        </Text>
      ) : null}
      {posts.map((post) => {
        const st = postState(post);
        return (
          <View key={post.id} style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: editing?.id === post.id ? p.accent : p.border, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>{POST_KIND_LABEL[post.kind].toUpperCase()}</Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: st.tone === 'live' ? p.greenBg : st.tone === 'bad' ? p.redBg : p.bg }}>
                <Text style={{ color: st.tone === 'live' ? p.greenFg : st.tone === 'bad' ? p.redFg : p.fgMuted, fontSize: 11, fontWeight: '700' }}>{st.label}</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => startEdit(post)} hitSlop={8} accessibilityLabel="Edit"><Ionicons name="create-outline" size={18} color={p.fg} /></Pressable>
              <Pressable onPress={() => toggle(post)} hitSlop={8} accessibilityLabel={post.published ? 'Unpublish' : 'Publish'}>
                <Ionicons name={post.published ? 'eye-off-outline' : 'eye-outline'} size={18} color={p.fg} />
              </Pressable>
              <Pressable onPress={() => remove(post)} hitSlop={8} accessibilityLabel="Delete"><Ionicons name="trash-outline" size={18} color={p.redFg} /></Pressable>
            </View>
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700', marginTop: 8 }}>{post.title}</Text>
            <Text style={{ color: p.fgMuted, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{post.body}</Text>
            {st.when ? <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 8 }}>{st.when}</Text> : null}
          </View>
        );
      })}
    </ScreenShell>
  );
}
