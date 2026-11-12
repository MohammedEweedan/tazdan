/**
 * Security — sign-in failures, staff sign-ins, configuration checks and the
 * security event log (last 7 days).
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  Empty, ErrorNote, NoPermission, Note, Pager, Pill, Row, Section, Segments, Stats, dateTime, num, shortId,
  useCockpit, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const TYPES = ['', 'FAILED_LOGIN', 'MFA_FAILURE', 'ADMIN_LOGIN', 'ACCESS_DENIED', 'PERMISSION_CHANGE', 'WEBHOOK_REJECTED', 'SESSION_REVOKED', 'CONTROL_CHANGED', 'RATE_LIMITED', 'STEP_UP_FAILED', 'NEW_DEVICE'];

export default function AdminSecurity() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const q = useCockpit<any>(can('security.read') ? '/cockpit/security' : null, { type, page, limit: 30 }, { refreshMs: 60_000 });
  const totals: Record<string, number> = {};
  for (const s of q.data?.summary ?? []) totals[s.type] = (totals[s.type] ?? 0) + s.count;
  const d = q.data;

  return (
    <AdminScreen title="Security" subtitle="Last 7 days"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('security.read') ? <NoPermission perm="security.read" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {d ? (
        <>
          <Stats items={[
            { label: 'Failed sign-ins', value: num(totals.FAILED_LOGIN ?? 0) },
            { label: '2FA failures', value: num(totals.MFA_FAILURE ?? 0) },
            { label: 'Access denied', value: num(totals.ACCESS_DENIED ?? 0) },
            { label: 'Rejected webhooks', value: num(totals.WEBHOOK_REJECTED ?? 0) },
            { label: 'Locked accounts', value: num(d.lockedAccounts) },
            { label: 'New trusted devices', value: num(d.newDevices7d) },
          ]} />
          <Section title="Configuration checks">
            {d.configuration.map((k: any, i: number) => (
              <Row key={k.check} last={i === d.configuration.length - 1} title={k.check} right={<Pill label={k.ok ? 'OK' : 'FAILED'} />} />
            ))}
          </Section>
          {d.staffWithout2fa.length
            ? <Note tone="bad">{`Staff without 2FA: ${d.staffWithout2fa.map((s: any) => s.email).join(', ')}`}</Note>
            : <Note tone="ok">Every active staff account has 2FA enabled.</Note>}
          <Section title="Staff sign-ins">
            {d.adminLogins.length ? d.adminLogins.slice(0, 20).map((r: any, i: number, all: any[]) => (
              <Row key={r.id ?? i} last={i === all.length - 1} title={shortId(r.userId)} subtitle={r.ipAddress ?? '—'} meta={`${dateTime(r.createdAt)} · ${r.details?.userAgent ?? ''}`} />
            )) : <Empty text="No staff sign-ins in 7 days." />}
          </Section>
          <Segments value={type} onChange={(v) => { setType(v); setPage(1); }} options={TYPES.map((t) => ({ key: t, label: t ? t.replace(/_/g, ' ').toLowerCase() : 'All events' }))} />
          <Section title="Event log">
            {d.events.length ? d.events.map((r: any, i: number, all: any[]) => (
              <Row key={r.id} last={i === all.length - 1} title={r.type.replace(/_/g, ' ')} subtitle={`${shortId(r.userId)} · ${r.ipAddress ?? '—'}${r.path ? ` · ${r.path}` : ''}`}
                meta={dateTime(r.createdAt)} right={<Pill label={r.severity} />} />
            )) : <Empty text="No events." />}
          </Section>
          <Pager page={page} total={d.total} limit={30} onPage={setPage} />
        </>
      ) : q.isLoading ? <Empty loading text="" /> : null}
    </AdminScreen>
  );
}
