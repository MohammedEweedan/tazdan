import { StackHeader } from '@/components/ui/ScreenHeader';
/**
 * Admin Waitlist — two tabs:
 *   List    : every signup, searchable, with per-entry resend + delete
 *   Launch  : compose the launch-day blast and send it to all (or only
 *             the not-yet-notified) entries in one tap
 *
 * The List tab also surfaces email transport health, so if confirmations
 * aren't landing you can see at a glance whether a transport is configured.
 */

import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { useDebounce } from '@/hooks/useDebounce';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';
import { formatRelativeTime } from '@/utils/format';

type Tab = 'list' | 'launch';
type Filter = 'all' | 'pending' | 'notified';

export default function AdminWaitlist() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('list');
  const [search, setSearch] = useState('');
  // One request per settled search, not per keystroke.
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<Filter>('all');

  // Launch composer state
  const [subject, setSubject] = useState('');
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [audience, setAudience] = useState<'pending' | 'all'>('pending');

  const q = useQuery({
    queryKey: ['admin-waitlist', debouncedSearch, filter],
    queryFn: () => adminService.waitlist({
      page: 1,
      limit: 100,
      search: debouncedSearch.trim() || undefined,
      filter: filter === 'all' ? undefined : filter,
    }),
    enabled: user?.role === 'ADMIN',
  });

  const stats = q.data?.stats ?? { total: 0, notified: 0, pending: 0 };
  const email = q.data?.email;
  const items = q.data?.items ?? [];

  const resendMut = useMutation({
    mutationFn: (id: string) => adminService.resendWaitlistConfirmation(id),
    onSuccess: (res) => Alert.alert('Sent', `Confirmation re-sent to ${res.email}`),
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Could not send'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteWaitlistEntry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-waitlist'] }),
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Could not delete'),
  });

  const launchMut = useMutation({
    mutationFn: () => adminService.waitlistLaunch({
      subject:  subject.trim() || undefined,
      heading:  heading.trim() || undefined,
      body:     body.trim() || undefined,
      ctaLabel: ctaLabel.trim() || undefined,
      ctaUrl:   ctaUrl.trim() || undefined,
      audience,
    }),
    onSuccess: (res) => {
      const errLine = res.failed > 0 && res.errors.length
        ? `\n\nFirst error: ${res.errors[0].email} — ${res.errors[0].error}`
        : '';
      Alert.alert(
        'Launch blast complete',
        `Sent: ${res.sent}\nFailed: ${res.failed}\nTotal attempted: ${res.total}${errLine}`,
      );
      qc.invalidateQueries({ queryKey: ['admin-waitlist'] });
      setTab('list');
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Unknown error'),
  });

  const confirmResend = (id: string, addr: string) =>
    Alert.alert('Resend confirmation?', `Send the signup confirmation email to ${addr} again?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => resendMut.mutate(id) },
    ]);

  const confirmDelete = (id: string, addr: string) =>
    Alert.alert('Remove entry?', `Delete ${addr} from the waitlist? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(id) },
    ]);

  const confirmLaunch = () => {
    const count = audience === 'all' ? stats.total : stats.pending;
    Alert.alert(
      'Send launch blast?',
      `This emails ${count.toLocaleString()} ${audience === 'all' ? 'total' : 'not-yet-notified'} waitlist ${count === 1 ? 'person' : 'people'}. ` +
        `Each successful send is marked notified so re-runs won't double-send.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Send to ${count.toLocaleString()}`, style: 'destructive', onPress: () => launchMut.mutate() },
      ],
    );
  };

  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <StackHeader title="Waitlist" right={<><Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '700' }}>{stats.total.toLocaleString()}</Text></>} />

        {/* Tab pills */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
          {(['list', 'launch'] as Tab[]).map((t) => {
            const on = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.accent : p.pillBg, borderWidth: 1, borderColor: on ? p.accent : p.border }}
              >
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 }}>
                  {t === 'list' ? 'Signups' : 'Launch blast'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'list' ? (
          /* ── LIST TAB ─────────────────────────────────────── */
          q.isLoading ? (
            <View style={{ flex: 1, paddingTop: 80, alignItems: 'center' }}>
              <LoadingPulse size={56} icon="people-outline" label="Loading signups…" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
            >
              {/* Stats strip */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <StatCell label="TOTAL" value={stats.total} p={p} />
                <StatCell label="NOTIFIED" value={stats.notified} accent="#22c55e" p={p} />
                <StatCell label="PENDING" value={stats.pending} accent="#f59e0b" p={p} />
              </View>

              {/* Email transport health — tells you WHY confirmations may not send */}
              {email && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  padding: 12, borderRadius: 12, marginBottom: 12,
                  backgroundColor: email.canSend ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.10)',
                  borderWidth: 1, borderColor: email.canSend ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.30)',
                }}>
                  <Ionicons name={email.canSend ? 'mail-outline' : 'warning-outline'} size={16} color={email.canSend ? '#22c55e' : '#ef4444'} />
                  <Text style={{ flex: 1, color: p.fgMuted, fontSize: 11, lineHeight: 16 }}>
                    {email.canSend
                      ? `Email transport: ${email.transport.toUpperCase()} · confirmations will send.`
                      : 'No email transport configured — confirmation & launch emails will NOT send. Set RESEND_API_KEY (or SMTP) on the server.'}
                  </Text>
                </View>
              )}

              {/* Search */}
              <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 44, justifyContent: 'center', marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="search-outline" size={16} color={p.fgFaint} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search email…"
                  placeholderTextColor={p.fgFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, color: p.fg, fontSize: 14 }}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={p.fgFaint} />
                  </Pressable>
                )}
              </View>

              {/* Filter pills */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {(['all', 'pending', 'notified'] as Filter[]).map((f) => {
                  const on = filter === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setFilter(f)}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, backgroundColor: on ? p.fg : p.pillBg, borderWidth: 1, borderColor: on ? p.fg : p.border }}
                    >
                      <Text style={{ color: on ? p.bg : p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3, textTransform: 'capitalize' }}>{f}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {items.length === 0 ? (
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={42} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, marginTop: 10 }}>No signups{search ? ' match' : ' yet'}</Text>
                </View>
              ) : (
                items.map((row) => (
                  <View
                    key={row.id}
                    style={{ backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 14, marginBottom: 10 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>{row.email}</Text>
                      {row.notified ? (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(34,197,94,0.12)' }}>
                          <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }}>NOTIFIED</Text>
                        </View>
                      ) : (
                        <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: p.pillBg }}>
                          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 }}>PENDING</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {row.source && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: p.pillBg }}>
                          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700' }}>{row.source}</Text>
                        </View>
                      )}
                      {row.locale && (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: p.pillBg }}>
                          <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700' }}>{row.locale}</Text>
                        </View>
                      )}
                      <Text style={{ color: p.fgFaint, fontSize: 11 }}>{formatRelativeTime(row.createdAt)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                      <Pressable
                        onPress={() => confirmResend(row.id, row.email)}
                        disabled={resendMut.isPending}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border }}
                      >
                        <Ionicons name="mail-outline" size={13} color={p.fg} />
                        <Text style={{ color: p.fg, fontSize: 11, fontWeight: '700' }}>Resend confirm</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmDelete(row.id, row.email)}
                        disabled={deleteMut.isPending}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}
                      >
                        <Ionicons name="trash-outline" size={13} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )
        ) : (
          /* ── LAUNCH TAB ───────────────────────────────────── */
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 8, padding: 12, marginBottom: 16, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
              <Ionicons name="rocket-outline" size={16} color={p.accent} />
              <Text style={{ flex: 1, color: p.fgMuted, fontSize: 11, lineHeight: 16 }}>
                Leave fields blank to use the polished default "we're live" announcement. Each successful send marks the entry notified.
              </Text>
            </View>

            <Field label="SUBJECT (optional)" value={subject} onChange={setSubject} placeholder="🎉 tazdan is live — your pioneer access is ready" p={p} />
            <Field label="HEADING (optional)" value={heading} onChange={setHeading} placeholder="We're live. Your seat is ready." p={p} />

            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>BODY (optional)</Text>
            <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, marginBottom: 14 }}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={'Write the launch message…\n\nBlank lines become paragraphs.'}
                placeholderTextColor={p.fgFaint}
                multiline
                style={{ color: p.fg, fontSize: 14, minHeight: 120, textAlignVertical: 'top' }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="CTA LABEL" value={ctaLabel} onChange={setCtaLabel} placeholder="Open tazdan" p={p} />
              </View>
              <View style={{ flex: 1.4 }}>
                <Field label="CTA URL" value={ctaUrl} onChange={setCtaUrl} placeholder="https://tazdan.com" p={p} autoCapitalize="none" />
              </View>
            </View>

            {/* Audience toggle */}
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>AUDIENCE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {([['pending', `Not yet notified (${stats.pending.toLocaleString()})`], ['all', `Everyone (${stats.total.toLocaleString()})`]] as [typeof audience, string][]).map(([a, lbl]) => {
                const on = audience === a;
                return (
                  <Pressable
                    key={a}
                    onPress={() => setAudience(a)}
                    style={{ flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center', backgroundColor: on ? p.accent : p.pillBg, borderWidth: 1, borderColor: on ? p.accent : p.border }}
                  >
                    <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 11, fontWeight: '700' }}>{lbl}</Text>
                  </Pressable>
                );
              })}
            </View>

            {email && !email.canSend && (
              <View style={{ flexDirection: 'row', gap: 8, padding: 12, marginBottom: 14, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.10)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)' }}>
                <Ionicons name="warning-outline" size={16} color="#ef4444" />
                <Text style={{ flex: 1, color: p.fgMuted, fontSize: 11, lineHeight: 16 }}>
                  No email transport is configured on the server — sends will fail. Set RESEND_API_KEY (or SMTP) first.
                </Text>
              </View>
            )}

            {/* Send button */}
            <Pressable
              onPress={confirmLaunch}
              disabled={launchMut.isPending}
              style={{
                height: 50, borderRadius: 12, backgroundColor: p.fg,
                alignItems: 'center', justifyContent: 'center',
                opacity: launchMut.isPending ? 0.7 : 1,
              }}
            >
              <Text style={{ color: p.bg, fontWeight: '700', fontSize: 14 }}>
                {launchMut.isPending
                  ? 'Sending…'
                  : `Send launch blast to ${(audience === 'all' ? stats.total : stats.pending).toLocaleString()}`}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/* ── helpers ────────────────────────────────────────── */

function StatCell({ label, value, accent, p }: { label: string; value: number; accent?: string; p: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12 }}>
      <Text style={{ color: p.fgFaint, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: accent ?? p.fg, fontSize: 22, fontWeight: '600', marginTop: 4, fontVariant: ['tabular-nums'] }}>{value.toLocaleString()}</Text>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, p, autoCapitalize = 'sentences',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; p: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>{label}</Text>
      <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, height: 46, justifyContent: 'center', marginBottom: 14 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={p.fgFaint}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={{ color: p.fg, fontSize: 14 }}
        />
      </View>
    </>
  );
}
