/**
 * Mobile Control Cockpit kit — the same /api/cockpit endpoints and staff
 * permissions as the web cockpit, in the mobile admin look.
 *
 *   const { can } = useStaff();
 *   const q = useCockpit<any>('/cockpit/approvals', { status });
 *   <Section title="Pending"><Row title=… subtitle=… right={<Pill …/>} /></Section>
 *   <ActionSheet … fields={[…]} onSubmit={(values, reason) => cockpitCall(…)} />
 *
 * Every write goes through ActionSheet, which asks for the reason the server
 * records in the audit trail (at least 5 characters).
 */
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Text } from '@/components/ui/Text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

// ── Data ─────────────────────────────────────────────────────────────

export interface StaffMe {
  user: { id: string; email: string; firstName: string; lastName: string; twoFactorEnabled: boolean };
  roles: string[];
  permissions: string[];
  implicitSuperAdmin: boolean;
  environment: string;
}

/** The signed-in staff member and what they may do. */
export function useStaff() {
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';
  const q = useQuery({
    queryKey: ['cockpit', 'me'],
    queryFn: async () => (await api.get<StaffMe>('/cockpit/me')).data,
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const perms = new Set(q.data?.permissions ?? []);
  return { me: q.data ?? null, loading: q.isLoading, error: q.error, can: (perm: string) => perms.has(perm) };
}

/** GET a cockpit endpoint. Refetch with `q.refetch()` after an action. */
export function useCockpit<T = any>(path: string | null, query?: Record<string, unknown>, opts: { refreshMs?: number } = {}) {
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';
  const params = Object.fromEntries(Object.entries(query ?? {}).filter(([, v]) => v !== '' && v != null));
  return useQuery({
    queryKey: ['cockpit', path, params],
    queryFn: async () => (await api.get<T>(path!, { params })).data,
    enabled: Boolean(path) && isAdmin,
    refetchInterval: opts.refreshMs,
  });
}

export async function cockpitCall<T = any>(path: string, method: 'POST' | 'PUT' | 'DELETE' = 'POST', body?: unknown): Promise<T> {
  const res = await api.request<T>({ url: path, method, data: body });
  return res.data;
}

/** Refresh every cockpit query after a write. */
export function useCockpitRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['cockpit'] });
}

export function errMsg(e: any): string {
  const d = e?.response?.data;
  if (typeof d?.error === 'string') return d.error;
  if (typeof d?.error?.message === 'string') return d.error.message;
  if (typeof d?.message === 'string') return d.message;
  return e?.message ?? 'Something went wrong';
}

// ── Formatting ───────────────────────────────────────────────────────

export function ago(v?: string | Date | null): string {
  if (!v) return '—';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
export function dateTime(v?: string | Date | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}
export function num(v: unknown, digits = 0): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : String(v);
}
export function money(v: unknown, currency?: string | null): string {
  const n = Number(v ?? 0);
  const s = Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : String(v);
  return currency ? `${s} ${currency}` : s;
}
export const shortId = (id?: string | null) => (id ? id.slice(0, 8) : '—');
export const personName = (p?: { firstName?: string; lastName?: string; username?: string | null } | null) =>
  p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() + (p.username ? ` · @${p.username}` : '') : '—';

// ── Layout ───────────────────────────────────────────────────────────

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'muted';

/** Map common server statuses to a tone. */
export function toneOf(value?: string | null): Tone {
  const v = String(value ?? '').toUpperCase();
  if (/^(ACTIVE|OK|APPROVED|EXECUTED|COMPLETED|CONFIRMED|ENABLED|PAID|RESOLVED|HEALTHY|AVAILABLE|LIVE|PASSED|SETTLED|DELIVERED|VERIFIED)$/.test(v)) return 'ok';
  if (/^(BLOCKED|FAILED|REJECTED|SUSPENDED|FROZEN|DISABLED|CRITICAL|HIGH|HIDDEN|DOWN|CANCELLED|EXPIRED|DECLINED|BREACH|HALTED)$/.test(v)) return 'bad';
  if (/^(PENDING|PAUSED|LOCKED|REVIEW|OPEN|MEDIUM|WARNING|DEGRADED|HELD|IN_REVIEW|ON_HOLD|SANDBOX_ONLY|PROCESSING|ESCALATED|STALE)$/.test(v)) return 'warn';
  return 'muted';
}

function toneColor(p: Palette, tone: Tone) {
  return tone === 'ok' ? p.greenFg : tone === 'bad' ? p.redFg : tone === 'warn' ? p.amberFg : tone === 'info' ? p.accent : p.fgMuted;
}

export function Pill({ label, tone }: { label?: string | null; tone?: Tone }) {
  const p = useThemedPalette();
  const c = toneColor(p, tone ?? toneOf(label));
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: c }}>
      <Text style={{ color: c, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 }} numberOfLines={1}>{String(label ?? '—').replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function Section({ title, subtitle, right, children, pad = true }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; pad?: boolean }) {
  const p = useThemedPalette();
  return (
    <View style={{ marginBottom: 14 }}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '800' }}>{title}</Text>
            {subtitle ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      <View style={{ backgroundColor: p.bgElev, borderRadius: 16, borderWidth: 1, borderColor: p.border, paddingHorizontal: pad ? 14 : 0, paddingVertical: pad ? 6 : 0, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

export function Row({ title, subtitle, meta, right, onPress, last }: {
  title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; right?: ReactNode; onPress?: () => void; last?: boolean;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? <Text style={{ color: p.fg, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{title}</Text> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{subtitle}</Text> : subtitle) : null}
        {meta ? (typeof meta === 'string' ? <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{meta}</Text> : meta) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={15} color={p.fgFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { h.selection(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable>;
}

export function KV({ items }: { items: Array<[string, ReactNode]> }) {
  const p = useThemedPalette();
  return (
    <View>
      {items.map(([k, v], i) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: i === items.length - 1 ? 0 : 1, borderBottomColor: p.border }}>
          <Text style={{ color: p.fgMuted, fontSize: 12.5 }}>{k}</Text>
          {typeof v === 'string' || typeof v === 'number'
            ? <Text style={{ color: p.fg, fontSize: 12.5, fontWeight: '700', flexShrink: 1, textAlign: 'right' }} selectable>{String(v)}</Text>
            : <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{v ?? <Text style={{ color: p.fgFaint }}>—</Text>}</View>}
        </View>
      ))}
    </View>
  );
}

export function Stats({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone }> }) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {items.map((s) => (
        <View key={s.label} style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: p.bgElev, borderRadius: 14, borderWidth: 1, borderColor: p.border, padding: 12 }}>
          <Text style={{ color: p.fgMuted, fontSize: 11.5 }} numberOfLines={1}>{s.label}</Text>
          <Text style={{ color: s.tone ? toneColor(p, s.tone) : p.fg, fontSize: 18, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Empty({ text, loading }: { text: string; loading?: boolean }) {
  const p = useThemedPalette();
  return (
    <View style={{ paddingVertical: 28, alignItems: 'center' }}>
      {loading ? <ActivityIndicator color={p.fgMuted} /> : <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>{text}</Text>}
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const p = useThemedPalette();
  if (!error) return null;
  return (
    <Pressable onPress={onRetry} style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.redFg, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: p.redFg, fontSize: 13, fontWeight: '700' }}>{errMsg(error)}</Text>
      {onRetry ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>Tap to retry</Text> : null}
    </Pressable>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  const p = useThemedPalette();
  return (
    <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: toneColor(p, tone), padding: 12, marginBottom: 12 }}>
      {typeof children === 'string' ? <Text style={{ color: p.fg, fontSize: 12.5, lineHeight: 18 }}>{children}</Text> : children}
    </View>
  );
}

export function Btn({ label, onPress, tone = 'primary', disabled, small, icon }: {
  label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'ghost'; disabled?: boolean; small?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  const bg = tone === 'primary' ? p.accent : 'transparent';
  const fg = tone === 'primary' ? p.accentFg : tone === 'danger' ? p.redFg : p.fg;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { h.selection(); onPress(); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingHorizontal: small ? 10 : 14, paddingVertical: small ? 7 : 11, borderRadius: small ? 10 : 12,
        backgroundColor: bg, borderWidth: tone === 'primary' ? 0 : 1, borderColor: tone === 'danger' ? p.redFg : p.border,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={small ? 13 : 15} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: small ? 12 : 14, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Segmented choice (filters, states). */
export function Segments<T extends string>({ value, options, onChange }: { value: T; options: Array<{ key: T; label: string }>; onChange: (v: T) => void }) {
  const p = useThemedPalette();
  const h = useHaptics();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => { h.selection(); onChange(o.key); }}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: on ? p.accent : p.bgElev, borderWidth: 1, borderColor: on ? p.accent : p.border }}>
            <Text style={{ color: on ? p.accentFg : p.fgMuted, fontSize: 12.5, fontWeight: '700' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder, onSubmit }: { value: string; onChange: (v: string) => void; placeholder: string; onSubmit?: () => void }) {
  const p = useThemedPalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, marginBottom: 12 }}>
      <Ionicons name="search" size={15} color={p.fgFaint} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={p.fgFaint} onSubmitEditing={onSubmit}
        autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{ flex: 1, color: p.fg, fontSize: 14, paddingVertical: 10 }} />
      {value ? <Pressable onPress={() => onChange('')} hitSlop={8}><Ionicons name="close-circle" size={16} color={p.fgFaint} /></Pressable> : null}
    </View>
  );
}

export function Pager({ page, total, limit, onPage }: { page: number; total?: number; limit: number; onPage: (p: number) => void }) {
  const p = useThemedPalette();
  const pages = Math.max(1, Math.ceil((total ?? 0) / limit));
  if (pages <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
      <Btn small tone="ghost" label="Previous" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <Text style={{ color: p.fgMuted, fontSize: 12 }}>{page} / {pages}</Text>
      <Btn small tone="ghost" label="Next" disabled={page >= pages} onPress={() => onPage(page + 1)} />
    </View>
  );
}

// ── Actions ──────────────────────────────────────────────────────────

export type Field =
  | { key: string; label: string; type: 'text' | 'number' | 'multiline'; placeholder?: string; initial?: string; optional?: boolean; help?: string }
  | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }>; initial?: string; help?: string }
  | { key: string; label: string; type: 'toggle'; initial?: boolean; help?: string }
  | { key: string; label: string; type: 'multi'; options: Array<{ value: string; label: string; help?: string }>; initial?: string[]; help?: string };

export type FieldValues = Record<string, any>;

function FieldInput({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  const p = useThemedPalette();
  const label = <Text style={{ color: p.fg, fontSize: 12.5, fontWeight: '700', marginBottom: 6 }}>{field.label}</Text>;
  const help = field.help ? <Text style={{ color: p.fgMuted, fontSize: 11.5, marginTop: -2, marginBottom: 6 }}>{field.help}</Text> : null;
  if (field.type === 'toggle') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <View style={{ flex: 1 }}>{label}{help}</View>
        <Switch value={Boolean(value)} onValueChange={onChange} />
      </View>
    );
  }
  if (field.type === 'select' || field.type === 'multi') {
    const multi = field.type === 'multi';
    const selected: string[] = multi ? (value ?? []) : [value];
    return (
      <View style={{ marginBottom: 14 }}>
        {label}{help}
        <View style={{ flexDirection: multi ? 'column' : 'row', flexWrap: 'wrap', gap: 6 }}>
          {field.options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <Pressable key={o.value}
                onPress={() => onChange(multi ? (on ? selected.filter((x) => x !== o.value) : [...selected, o.value]) : o.value)}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: on ? p.accent : p.bg, borderWidth: 1, borderColor: on ? p.accent : p.border }}>
                <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 12.5, fontWeight: '700' }}>{o.label}</Text>
                {'help' in o && o.help ? <Text style={{ color: on ? p.accentFg : p.fgMuted, fontSize: 11, marginTop: 1 }}>{o.help}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 14 }}>
      {label}{help}
      <TextInput
        value={value ?? ''} onChangeText={onChange} placeholder={field.placeholder} placeholderTextColor={p.fgFaint}
        keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'} multiline={field.type === 'multiline'}
        autoCapitalize="none" autoCorrect={false}
        style={{ color: p.fg, fontSize: 14, backgroundColor: p.bg, borderRadius: 10, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, paddingVertical: 10, minHeight: field.type === 'multiline' ? 70 : undefined, textAlignVertical: 'top' }}
      />
    </View>
  );
}

const initialOf = (f: Field) => (f.type === 'toggle' ? Boolean(f.initial) : f.type === 'multi' ? f.initial ?? [] : f.initial ?? (f.type === 'select' ? f.options[0]?.value : ''));

/**
 * A sheet that collects fields and a reason, then runs `onSubmit`. Errors
 * from the server stay in the sheet so the reason isn't lost.
 */
export function ActionSheet({ visible, onClose, title, description, fields = [], reason = true, reasonLabel = 'Reason', confirmLabel = 'Confirm', danger, onSubmit, children }: {
  visible: boolean; onClose: () => void; title: string; description?: ReactNode; fields?: Field[]; reason?: boolean;
  reasonLabel?: string; confirmLabel?: string; danger?: boolean; children?: ReactNode;
  onSubmit: (values: FieldValues, reason: string) => Promise<unknown> | unknown;
}) {
  const p = useThemedPalette();
  const h = useHaptics();
  const [values, setValues] = useState<FieldValues>({});
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (visible) { setValues(Object.fromEntries(fields.map((f) => [f.key, initialOf(f)]))); setWhy(''); setErr(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const missing = fields.some((f) => (f.type === 'text' || f.type === 'number' || f.type === 'multiline') && !f.optional && !String(values[f.key] ?? '').trim());
  const ready = !missing && (!reason || why.trim().length >= 5);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await onSubmit(values, why.trim()); h.success?.(); onClose(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <BottomSheet visible={visible} onClose={() => { if (!busy) onClose(); }} title={title}
      footer={
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={{ flex: 1 }}><Btn tone="ghost" label="Cancel" onPress={onClose} disabled={busy} /></View>
          <View style={{ flex: 1 }}><Btn tone={danger ? 'danger' : 'primary'} label={busy ? 'Working…' : confirmLabel} onPress={submit} disabled={!ready || busy} /></View>
        </View>
      }>
      <View style={{ paddingHorizontal: 4 }}>
        {description ? (typeof description === 'string' ? <Text style={{ color: p.fgMuted, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>{description}</Text> : <View style={{ marginBottom: 14 }}>{description}</View>) : null}
        {children}
        {fields.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />)}
        {reason ? (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ color: p.fg, fontSize: 12.5, fontWeight: '700', marginBottom: 6 }}>{reasonLabel} <Text style={{ color: p.fgMuted, fontWeight: '400' }}>(recorded in the audit trail)</Text></Text>
            <TextInput value={why} onChangeText={setWhy} placeholder="At least 5 characters" placeholderTextColor={p.fgFaint} multiline
              style={{ color: p.fg, fontSize: 14, backgroundColor: p.bg, borderRadius: 10, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, paddingVertical: 10, minHeight: 64, textAlignVertical: 'top' }} />
          </View>
        ) : null}
        {err ? <Text style={{ color: p.redFg, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
      </View>
    </BottomSheet>
  );
}

/** Raw record viewer for anything without a purpose-built detail view. */
export function JsonSheet({ value, onClose, title = 'Details' }: { value: unknown; onClose: () => void; title?: string }) {
  const p = useThemedPalette();
  return (
    <BottomSheet visible={value != null} onClose={onClose} title={title}>
      <Text selectable style={{ color: p.fg, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 }}>{JSON.stringify(value, null, 2)}</Text>
    </BottomSheet>
  );
}

/** Shown when the staff member lacks the permission for a page. */
export function NoPermission({ perm }: { perm: string }) {
  return <Note tone="warn">{`Your staff roles don't include ${perm}. Ask a super admin to add a role that has it.`}</Note>;
}

// ── Investigation views ──────────────────────────────────────────────

/** Lifecycle transitions of one financial object (state machine log). */
export function Timeline({ items }: { items?: Array<{ id: string; fromState: string | null; toState: string; createdAt: string; actorType: string; actorId: string | null; reason: string | null; provider?: string | null }> }) {
  const p = useThemedPalette();
  if (!items?.length) return <Empty text="No lifecycle transitions recorded for this object." />;
  return (
    <View style={{ paddingVertical: 8 }}>
      {items.map((t, i) => (
        <View key={t.id} style={{ flexDirection: 'row', gap: 10, paddingBottom: i === items.length - 1 ? 0 : 12 }}>
          <View style={{ alignItems: 'center', width: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.accent, marginTop: 4 }} />
            {i < items.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: p.border, marginTop: 2 }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {t.fromState ? <><Pill label={t.fromState} /><Text style={{ color: p.fgFaint }}>→</Text></> : null}
              <Pill label={t.toState} />
            </View>
            <Text style={{ color: p.fgMuted, fontSize: 11.5, marginTop: 4 }}>{dateTime(t.createdAt)} · {t.actorType}{t.actorId ? ` ${shortId(t.actorId)}` : ''}{t.provider ? ` · ${t.provider}` : ''}</Text>
            {t.reason ? <Text style={{ color: p.fg, fontSize: 12.5, marginTop: 3 }}>{t.reason}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Double-entry journal groups; each must sum to zero per currency. */
export function LedgerGroups({ groups }: { groups?: any[] }) {
  const p = useThemedPalette();
  if (!groups?.length) return <Empty text="No ledger journal posted for this object." />;
  return (
    <View style={{ gap: 10, paddingVertical: 8 }}>
      {groups.map((g) => {
        const sums: Record<string, number> = {};
        for (const e of g.entries) sums[e.currency] = (sums[e.currency] ?? 0) + Number(e.amount);
        const balanced = Object.values(sums).every((v) => Math.abs(v) < 1e-9);
        return (
          <View key={g.groupId} style={{ borderWidth: 1, borderColor: p.border, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: p.pillBg }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '800' }}>{g.refType}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 10.5 }}>{dateTime(g.createdAt)}</Text>
              </View>
              <Pill label={balanced ? 'BALANCED' : 'UNBALANCED'} tone={balanced ? 'ok' : 'bad'} />
            </View>
            {g.entries.map((e: any, i: number) => (
              <View key={e.id ?? i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: p.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 12 }}>{e.account?.type}{e.account?.userId ? ` · ${shortId(e.account.userId)}` : ''}</Text>
                  {e.memo ? <Text style={{ color: p.fgFaint, fontSize: 10.5 }}>{e.memo}</Text> : null}
                </View>
                <Text style={{ color: Number(e.amount) < 0 ? p.redFg : p.greenFg, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {Number(e.amount) < 0 ? 'Dr ' : 'Cr '}{money(Math.abs(Number(e.amount)), e.currency)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
