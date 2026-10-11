'use client';

import { useState } from 'react';
import { Box, Checkbox, Text, Wrap, WrapItem } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago } from '@/lib/cockpit/format';
import { DataTable, ErrorBox, PageHeader, Panel, ReasonModal, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

const ROLE_HELP: Record<string, string> = {
  SUPER_ADMIN: 'Everything, including staff roles',
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

export default function StaffPage() {
  const t = useT();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>('/cockpit/staff');
  const [editing, setEditing] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);

  return (
    <Box>
      <PageHeader title={t('Staff & roles')} subtitle="Least privilege: give each person only the roles their job needs. Changes take effect within a minute and are audited." />
      <ErrorBox error={error} onRetry={reload} />
      <Panel pad={false}>
        <DataTable loading={loading} rows={data?.staff} onRowClick={(r: any) => { setEditing(r); setRoles(r.staffRoles.length ? r.staffRoles : ['SUPER_ADMIN']); }} columns={[
          { key: 'name', label: 'Staff member', render: (r: any) => <Box><Text fontWeight={600}>{r.firstName} {r.lastName}</Text><Text fontSize="12px" color={c.muted}>{r.email}</Text></Box> },
          { key: 'roles', label: 'Roles', render: (r: any) => r.staffRoles.length ? r.staffRoles.join(', ') : <Text as="span" color={c.serious}>none — implicit SUPER_ADMIN</Text> },
          { key: 'twoFactorEnabled', label: '2FA', render: (r: any) => <StatusBadge value={r.twoFactorEnabled ? 'ENABLED' : 'DISABLED'} /> },
          { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
          { key: 'lastLoginAt', label: 'Last sign-in', render: (r: any) => ago(r.lastLoginAt) },
        ]} />
      </Panel>
      <ReasonModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Roles for ${editing.firstName} ${editing.lastName}` : ''} confirmLabel="Save roles"
        description={
          <Wrap spacing={2}>
            {Object.keys(ROLE_HELP).map((r) => (
              <WrapItem key={r} w="100%">
                <Checkbox isChecked={roles.includes(r)} onChange={(e) => setRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))}>
                  <Text fontSize="13px" fontWeight={600}>{r.replace('_', ' ')}</Text>
                  <Text fontSize="11px" color={c.muted}>{ROLE_HELP[r]}</Text>
                </Checkbox>
              </WrapItem>
            ))}
          </Wrap>
        }
        onConfirm={async (reason) => {
          if (!roles.length) throw new Error('Pick at least one role');
          await api(`/cockpit/staff/${editing.id}/roles`, { method: 'PUT', body: { roles, reason } });
          await reload();
        }} />
    </Box>
  );
}
