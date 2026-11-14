/**
 * Assistant — ask questions about the platform. Read-only, permission-scoped
 * tools; nothing changes without a person (same as the web cockpit).
 */
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AdminScreen } from '@/components/admin/AdminScreen';
import { Btn, ErrorNote, NoPermission, Note, Section, cockpitCall, errMsg, useCockpit, useStaff } from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

type Turn = { role: 'user' | 'assistant'; content: string };

export default function AdminAssistant() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const status = useCockpit<any>(can('ai.use') ? '/cockpit/ai/status' : null);
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ask = async () => {
    const question = q.trim();
    if (question.length < 3) return;
    setBusy(true); setErr(null);
    try {
      const r = await cockpitCall<any>('/cockpit/ai/ask', 'POST', { question, history: turns.slice(-10) });
      setTurns([...turns, { role: 'user', content: question }, { role: 'assistant', content: r.answer ?? r.refusal ?? '—' }]);
      setQ('');
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <AdminScreen title="Assistant" subtitle="Read-only answers about the platform">
      {!can('ai.use') ? <NoPermission perm="ai.use" /> : null}
      <ErrorNote error={status.error} />
      {status.data && !status.data.enabled ? <Note tone="warn">The assistant is switched off on this server (AI_LEVEL).</Note> : null}
      {turns.map((t, i) => (
        <Section key={i} title={t.role === 'user' ? 'You' : 'Assistant'}>
          <Text selectable style={{ color: p.fg, fontSize: 13.5, lineHeight: 20, paddingVertical: 8 }}>{t.content}</Text>
        </Section>
      ))}
      <View style={{ gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} multiline placeholder="e.g. Which withdrawals have waited more than a day?" placeholderTextColor={p.fgFaint}
          style={{ color: p.fg, fontSize: 14, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, padding: 12, minHeight: 80, textAlignVertical: 'top' }} />
        {err ? <Text style={{ color: p.redFg, fontSize: 13 }}>{err}</Text> : null}
        <Btn label={busy ? 'Thinking…' : 'Ask'} disabled={busy || q.trim().length < 3 || !can('ai.use')} onPress={ask} />
      </View>
    </AdminScreen>
  );
}
