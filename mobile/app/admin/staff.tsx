/**
 * Staff and roles — least privilege. Changes take effect within a minute and
 * are audited.
 */
import { useState } from 'react';
import { RefreshControl } from 'react-native';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Empty, ErrorNote, NoPermission, Note, Pill, Row, Section, ago, cockpitCall,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const ROLE_HELP: Record<string, string> = {
  SUPER_ADMIN: 'Everything, including staff roles and availability',
  EXECUTIVE: 'Read-only dashboards across the business',
  OPERATIONS: 'Queues, deposits, withdrawals, remittance operations, providers, kill switches',
  FINANCE: 'Ledger, adjustments (maker and checker), refunds, reconciliation, revenue',
  TREASURY: 'Liquidity pools, prefunding, FX overrides',
  COMPLIANCE: 'KYC/KYB decisions, cases, watchlists, risk rules, freezes',
  AML_ANALYST: 'Investigate cases and alerts',
  FRAUD_ANALYST: 'Fraud cases, session revocation',
  SUPPORT: 'Customer 360 and replies — no money movement',
  SECURITY: 'Security events, audit, session revocation, kill switches',
  TECH_OPS: 'System health and providers — no financial authority',
  AUDITOR: 'Read-only access to every view',
};

export default function AdminStaff() {
  const p = useThemedPalette();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(can('staff.manage') ? '/cockpit/staff' : null);
  const [editing, setEditing] = useState<any>(null);

  return (
    <AdminScreen title="Staff & roles" subtitle="Who can do what"
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      {!can('staff.manage') ? <NoPermission perm="staff.manage" /> : null}
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      <Note>Give each person only the roles their job needs. An admin with no roles is treated as a super admin until roles are set.</Note>
      <Section>
        {q.isLoading ? <Empty loading text="" /> : (q.data?.staff ?? []).map((s: any, i: number, all: any[]) => (
          <Row key={s.id} last={i === all.length - 1} title={`${s.firstName} ${s.lastName}`}
            subtitle={s.staffRoles.length ? s.staffRoles.join(', ').replace(/_/g, ' ') : 'No roles — implicit super admin'}
            meta={`${s.email} · 2FA ${s.twoFactorEnabled ? 'on' : 'off'} · signed in ${ago(s.lastLoginAt)}`}
            right={<Pill label={s.status} />} onPress={() => setEditing(s)} />
        ))}
      </Section>
      <ActionSheet visible={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Roles for ${editing.firstName} ${editing.lastName}` : ''} confirmLabel="Save roles"
        fields={[{
          key: 'roles', label: 'Roles', type: 'multi',
          initial: editing ? (editing.staffRoles.length ? editing.staffRoles : ['SUPER_ADMIN']) : [],
          options: Object.entries(ROLE_HELP).map(([value, help]) => ({ value, label: value.replace(/_/g, ' '), help })),
        }]}
        onSubmit={async (v, reason) => {
          if (!v.roles?.length) throw new Error('Pick at least one role');
          await cockpitCall(`/cockpit/staff/${editing.id}/roles`, 'PUT', { roles: v.roles, reason });
          await refresh();
        }} />
    </AdminScreen>
  );
}
