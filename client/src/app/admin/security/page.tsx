'use client';

import { useState } from 'react';
import { Box, Flex, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { dateTime, num, shortId } from '@/lib/cockpit/format';
import { BarList } from '@/components/cockpit/charts';
import { DataTable, ErrorBox, Grid, PageHeader, Pagination, Panel, Stat, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

export default function SecurityPage() {
  const t = useT();
  const c = useCockpitColors();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<any>('/cockpit/security', { type, page, limit: 50 }, { refreshMs: 60_000 });
  const totals: Record<string, number> = {};
  for (const s of data?.summary ?? []) totals[s.type] = (totals[s.type] ?? 0) + s.count;

  return (
    <Box>
      <PageHeader title={t('Security')} subtitle="Security operations — last 7 days." />
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="180px">
            <Stat label="Failed sign-ins" value={num(totals.FAILED_LOGIN ?? 0)} />
            <Stat label="2FA failures" value={num(totals.MFA_FAILURE ?? 0)} />
            <Stat label="Access denied" value={num(totals.ACCESS_DENIED ?? 0)} hint="staff missing a permission" />
            <Stat label="Rejected webhooks" value={num(totals.WEBHOOK_REJECTED ?? 0)} />
            <Stat label="Locked accounts" value={num(data.lockedAccounts)} />
            <Stat label="New trusted devices" value={num(data.newDevices7d)} />
          </Grid>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Configuration checks">
              <Box display="grid" gap={2}>
                {data.configuration.map((k: any) => (
                  <Flex key={k.check} justify="space-between"><Text fontSize="13px">{k.check}</Text><StatusBadge value={k.ok ? 'OK' : 'FAILED'} /></Flex>
                ))}
                {data.staffWithout2fa.length ? <Text fontSize="12px" color={c.critical} mt={2}>Staff without 2FA: {data.staffWithout2fa.map((s: any) => s.email).join(', ')}</Text> : <Text fontSize="12px" color={c.muted} mt={2}>Every active staff account has 2FA enabled.</Text>}
              </Box>
            </Panel>
            <Panel title="Events by type">
              <BarList items={Object.entries(totals).map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))} format={(n) => num(n)} />
            </Panel>
          </Box>
          <Panel title="Staff sign-ins" pad={false}>
            <DataTable rows={data.adminLogins} empty="No staff sign-ins in 7 days." columns={[
              { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
              { key: 'userId', label: 'Staff', render: (r: any) => shortId(r.userId) },
              { key: 'ipAddress', label: 'IP' },
              { key: 'ua', label: 'Client', render: (r: any) => <Text noOfLines={1} maxW="320px">{r.details?.userAgent ?? '—'}</Text> },
            ]} />
          </Panel>
          <Panel title="Event log" pad={false} actions={
            <Select size="xs" w="200px" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All events</option>
              {['FAILED_LOGIN', 'MFA_FAILURE', 'ADMIN_LOGIN', 'ACCESS_DENIED', 'PERMISSION_CHANGE', 'WEBHOOK_REJECTED', 'SESSION_REVOKED', 'CONTROL_CHANGED', 'RATE_LIMITED', 'STEP_UP_FAILED', 'NEW_DEVICE'].map((x) => <option key={x}>{x}</option>)}
            </Select>
          }>
            <DataTable loading={loading} rows={data.events} columns={[
              { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
              { key: 'type', label: 'Event' },
              { key: 'severity', label: 'Severity', render: (r: any) => <StatusBadge value={r.severity} /> },
              { key: 'userId', label: 'User', render: (r: any) => shortId(r.userId) },
              { key: 'ipAddress', label: 'IP' },
              { key: 'path', label: 'Path' },
            ]} />
            <Pagination page={page} total={data.total} limit={50} onPage={setPage} />
          </Panel>
        </Box>
      ) : null}
    </Box>
  );
}
