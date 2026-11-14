'use client';

import { useState } from 'react';
import { Box, Button, HStack, Input, Text } from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Notice, PageHeader, Panel } from '@/components/cockpit/ui';
import { dateTime } from '@/lib/cockpit/format';

/** Platform settings (key/value). FX market-maker settings change only through an approved FX override. */
export default function SettingsPage() {
  const can = useCan();
  const { data, error, loading, reload } = useApi<any>('/admin/settings');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await api('/admin/settings', { method: 'PUT', body: { settings: { [key.trim()]: value } } }); setMsg('Saved.'); await reload(); } catch (e: any) { setMsg(e?.message ?? 'Save failed'); } finally { setBusy(false); }
  };
  return (
    <Box>
      <PageHeader title="Settings" subtitle="Platform settings such as the quote spread and card fees. Every change is audited." />
      <ErrorBox error={error} onRetry={reload} />
      <Box mb={4}><Notice>Market-maker pricing (fx_market_maker.*) only takes effect through an approved FX override — use FX and Approvals for it.</Notice></Box>
      {can('settings.manage') ? (
        <Panel title="Change a setting">
          <HStack flexWrap="wrap">
            <Input size="sm" maxW="280px" placeholder="Key, e.g. quote_spread_pct" value={key} onChange={(e) => setKey(e.target.value)} />
            <Input size="sm" maxW="280px" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} />
            <Button size="sm" colorScheme="brand" isLoading={busy} isDisabled={!key.trim()} onClick={save}>Save</Button>
          </HStack>
          {msg ? <Text fontSize="sm" mt={2}>{msg}</Text> : null}
        </Panel>
      ) : null}
      <Box mt={4}>
        <Panel pad={false}>
          <DataTable loading={loading} rows={data?.settings} onRowClick={(r: any) => { setKey(r.key); setValue(r.value); }} columns={[
            { key: 'key', label: 'Key' },
            { key: 'value', label: 'Value', render: (r: any) => <Text fontFamily="mono" fontSize="12px" noOfLines={2} maxW="420px">{r.value}</Text> },
            { key: 'description', label: 'Description', render: (r: any) => r.description ?? '—' },
            { key: 'updatedAt', label: 'Updated', render: (r: any) => dateTime(r.updatedAt) },
          ]} />
        </Panel>
      </Box>
    </Box>
  );
}
