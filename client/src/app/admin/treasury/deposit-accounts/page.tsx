'use client';

/**
 * Deposit accounts — the Tazdan bank accounts customers are told to pay into
 * when they top up by bank transfer. In production, adding an account or
 * changing its payment details goes to a second approver (Approvals).
 */
import { useState } from 'react';
import NextLink from 'next/link';
import { Box, Button, Grid as CGrid, Input, Link, Switch, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { dateTime, num } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Grid, Notice, PageHeader, Panel, ReasonModal, Stat, StatusBadge } from '@/components/cockpit/ui';

const FIELDS: Array<{ key: string; label: string; required?: boolean; placeholder?: string }> = [
  { key: 'currency', label: 'Currency', required: true, placeholder: 'LYD' },
  { key: 'country', label: 'Country (ISO-2)', required: true, placeholder: 'LY' },
  { key: 'bankName', label: 'Bank', required: true },
  { key: 'accountName', label: 'Account holder', required: true, placeholder: 'Tazdan …' },
  { key: 'iban', label: 'IBAN' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'swift', label: 'SWIFT / BIC' },
  { key: 'sortCode', label: 'Sort code' },
  { key: 'routingNumber', label: 'Routing number' },
  { key: 'branch', label: 'Branch' },
  { key: 'memo', label: 'Note shown to customers' },
];

type Form = Record<string, any>;

export default function DepositAccountsPage() {
  const can = useCan();
  const { data, error, loading, reload } = useApi<any>('/admin/platform-banks');
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const items: any[] = data?.items ?? [];
  const active = items.filter((b) => b.isActive);
  const currencies = Array.from(new Set(active.map((b) => b.currency as string)));

  const startEdit = (b?: any) => setEditing({
    id: b?.id ?? null,
    form: Object.fromEntries([...FIELDS.map((f) => [f.key, b?.[f.key] ?? '']), ['isActive', b ? b.isActive : true]]) as Form,
  });

  return (
    <Box>
      <PageHeader title="Deposit accounts" subtitle="Tazdan bank accounts shown to customers who top up by bank transfer. Customers can only top up by bank in a currency that has an active account here."
        actions={can('treasury.operate') ? <Button size="sm" onClick={() => startEdit()}>Add account</Button> : null} />
      {message ? <Box mb={3}><Notice>{message}</Notice></Box> : null}
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gap={4}>
        <Grid min="180px">
          <Stat label="Active accounts" value={num(active.length)} hint={active.length ? currencies.join(' · ') : 'customers cannot top up by bank'} />
          <Stat label="Inactive" value={num(items.length - active.length)} hint="history kept" />
        </Grid>
        {!loading && !active.length ? (
          <Notice tone="warning">No active deposit account. Bank transfer top-ups are unavailable until one is added. Enter only accounts Tazdan controls; the placeholder accounts that used to be seeded were switched off.</Notice>
        ) : null}
        <Panel title="Accounts" pad={false} actions={<Link as={NextLink} href="/admin/approvals" fontSize="12px">Pending approvals</Link>}>
          <DataTable loading={loading} rows={items} empty="No deposit accounts yet." onRowClick={can('treasury.operate') ? (b: any) => startEdit(b) : undefined} columns={[
            { key: 'currency', label: 'Currency' },
            { key: 'bankName', label: 'Bank' },
            { key: 'accountName', label: 'Holder' },
            { key: 'iban', label: 'IBAN / account', render: (b: any) => <Text fontFamily="mono" fontSize="12px">{b.iban || b.accountNumber || '—'}</Text> },
            { key: 'swift', label: 'SWIFT', render: (b: any) => b.swift || '—' },
            { key: 'country', label: 'Country' },
            { key: 'isActive', label: 'Status', render: (b: any) => <StatusBadge value={b.isActive ? 'ACTIVE' : 'DISABLED'} /> },
            { key: 'updatedAt', label: 'Updated', render: (b: any) => dateTime(b.updatedAt) },
          ]} />
        </Panel>
      </Box>

      <ReasonModal isOpen={Boolean(editing)} onClose={() => setEditing(null)} minLength={5}
        title={editing?.id ? 'Edit deposit account' : 'Add deposit account'} confirmLabel="Save"
        description={editing ? (
          <Box display="grid" gap={3}>
            <Text fontSize="12px">Customers will be told to send money to this account. In production a second staff member must approve new accounts and changes to payment details before customers see them.</Text>
            <CGrid templateColumns="repeat(2, 1fr)" gap={2}>
              {FIELDS.map((f) => (
                <Box key={f.key} gridColumn={f.key === 'memo' ? 'span 2' : undefined}>
                  <Text fontSize="11px" fontWeight={600} mb={1}>{f.label}{f.required ? ' *' : ''}</Text>
                  <Input size="sm" value={editing.form[f.key] ?? ''} placeholder={f.placeholder}
                    onChange={(e) => setEditing({ ...editing, form: { ...editing.form, [f.key]: f.key === 'currency' || f.key === 'country' ? e.target.value.toUpperCase() : e.target.value } })} />
                </Box>
              ))}
            </CGrid>
            <Box display="flex" alignItems="center" gap={2}>
              <Switch size="sm" isChecked={Boolean(editing.form.isActive)} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isActive: e.target.checked } })} />
              <Text fontSize="12px">Show to customers</Text>
            </Box>
          </Box>
        ) : null}
        onConfirm={async (reason) => {
          const f = editing!.form;
          for (const field of FIELDS.filter((x) => x.required)) if (!String(f[field.key] ?? '').trim()) throw new Error(`${field.label} is required`);
          if (!String(f.iban ?? '').trim() && !String(f.accountNumber ?? '').trim()) throw new Error('Enter an IBAN or an account number');
          const body: Record<string, unknown> = { reason, isActive: Boolean(f.isActive) };
          for (const field of FIELDS) {
            const v = String(f[field.key] ?? '').trim();
            body[field.key] = v || (editing!.id ? null : undefined);
          }
          const r = await api<any>(editing!.id ? `/admin/platform-banks/${editing!.id}` : '/admin/platform-banks', { method: editing!.id ? 'PUT' : 'POST', body });
          setMessage(r.pendingApproval ? `${r.message} Request ${r.approvalId.slice(0, 8)}.` : 'Saved.');
          await reload();
        }} />
    </Box>
  );
}
