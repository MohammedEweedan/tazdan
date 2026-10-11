'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, Link, Select, Text } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useT } from '@/lib/cockpit/i18n';
import { ago, dateTime, money, num } from '@/lib/cockpit/format';
import { BarList } from '@/components/cockpit/charts';
import { NetworkGraph } from '@/components/cockpit/NetworkGraph';
import { DataTable, ErrorBox, Grid, PageHeader, Panel, Stat, StatusBadge } from '@/components/cockpit/ui';

export default function FraudPage() {
  const t = useT();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const { data, error, reload } = useApi<any>('/cockpit/fraud', { days }, { refreshMs: 120_000 });
  const d = data?.decisions ?? {};
  const total = Object.values(d as Record<string, number>).reduce((a, b) => a + b, 0);

  return (
    <Box>
      <PageHeader title={t('Fraud')} subtitle="Signals raised by the risk engine and security events, linked accounts, and pending withdrawals from high-risk customers."
        actions={<Select size="sm" w="130px" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((n) => <option key={n} value={n}>Last {n} days</option>)}</Select>} />
      <ErrorBox error={error} onRetry={reload} />
      {data ? (
        <Box display="grid" gap={4}>
          <Grid min="160px">
            <Stat label="Risk decisions" value={num(total)} />
            <Stat label="Sent to review" value={num((d.REVIEW ?? 0) + (d.REQUEST_INFORMATION ?? 0))} />
            <Stat label="Challenged (step-up)" value={num(d.CHALLENGE ?? 0)} />
            <Stat label="Rejected / blocked" value={num((d.REJECT ?? 0) + (d.BLOCK ?? 0) + (d.FREEZE ?? 0))} />
            <Stat label="Linked-account clusters" value={num(data.graph.nodes.filter((n: any) => n.type !== 'customer').length)} />
            <Stat label="Risky pending withdrawals" value={num(data.riskyPendingWithdrawals.length)} />
          </Grid>
          <Panel title="Linked accounts" subtitle="customers sharing a device (solid line) or a payout account (dashed); hover to isolate, click a customer to open their profile">
            <NetworkGraph nodes={data.graph.nodes} edges={data.graph.edges} onCustomer={(id) => router.push(`/admin/customers/${id}`)} />
          </Panel>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1.6fr' }} gap={4} alignItems="start">
            <Panel title="Signals by type"><BarList items={data.signals.slice(0, 14).map((s: any) => ({ label: s.type.replace(/_/g, ' '), value: s.count }))} format={num} /></Panel>
            <Panel title="Recent fraud & security signals" pad={false}>
              <DataTable rows={data.recent} empty="No fraud signals in this period." columns={[
                { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                { key: 'type', label: 'Signal', render: (r: any) => r.type.replace(/_/g, ' ') },
                { key: 'severity', label: 'Severity', render: (r: any) => <StatusBadge value={r.severity} /> },
                { key: 'userId', label: 'Customer', render: (r: any) => r.userId ? <Link as={NextLink} href={`/admin/customers/${r.userId}`}>{r.userId.slice(0, 8)}</Link> : '—' },
                { key: 'subject', label: 'Subject', render: (r: any) => r.subjectType ? `${r.subjectType} ${r.subjectId?.slice(0, 8) ?? ''}` : '—' },
              ]} />
            </Panel>
          </Box>
          <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
            <Panel title="Pending withdrawals from high-risk customers" subtitle="risk score ≥ 40 in this period" pad={false}>
              <DataTable rows={data.riskyPendingWithdrawals} empty="None." onRowClick={() => router.push('/admin/queues/withdrawals')} columns={[
                { key: 'createdAt', label: 'Requested', render: (r: any) => dateTime(r.createdAt) },
                { key: 'reference', label: 'Reference' },
                { key: 'userId', label: 'Customer', render: (r: any) => r.userId.slice(0, 8) },
                { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
              ]} />
            </Panel>
            <Panel title="Failed sign-ins by customer" pad={false}>
              <DataTable rows={data.failedLoginsByUser.map((f: any) => ({ ...f, id: f.userId }))} empty="No failed sign-ins." columns={[
                { key: 'userId', label: 'Customer', render: (r: any) => <Link as={NextLink} href={`/admin/customers/${r.userId}`}>{r.userId.slice(0, 8)}</Link> },
                { key: 'count', label: 'Failures', align: 'right', render: (r: any) => num(r.count) },
              ]} />
            </Panel>
          </Box>
          <Text fontSize="11px" opacity={0.7}>Signals come from rules you can tune under Compliance → Rules. Nothing here blocks a customer automatically beyond what those rules already do.</Text>
        </Box>
      ) : null}
    </Box>
  );
}
