'use client';

import { useState } from 'react';
import { Box, Button, HStack } from '@chakra-ui/react';
import { useApi } from '@/lib/cockpit/useApi';
import { useCan } from '@/components/cockpit/CockpitShell';
import { ActionModal, call, type RowAction } from '@/components/cockpit/LegacyList';
import { ErrorBox, JsonView, Notice, PageHeader, Panel } from '@/components/cockpit/ui';

const dailyClose: RowAction = { label: 'Run daily close', perm: 'recon.run', run: () => call('/admin/daily-close', 'POST', {}) };
const clearHalt: RowAction = {
  label: 'Clear trading halt', perm: 'controls.operate', danger: true,
  fields: [{ key: 'note', label: 'Why it is safe to resume (recorded)', type: 'textarea' }],
  run: (_r, v) => call('/admin/clear-trading-halt', 'POST', { note: v.note }),
};

/** Runtime metrics, operational readiness, daily close and the integrity halt. */
export default function DiagnosticsPage() {
  const can = useCan();
  const metrics = useApi<any>('/admin/metrics', undefined, { refreshMs: 30_000 });
  const readiness = useApi<any>('/admin/operational-readiness', undefined, { refreshMs: 60_000 });
  const [action, setAction] = useState<RowAction | null>(null);
  return (
    <Box>
      <PageHeader title="Diagnostics" subtitle="Process metrics, operational readiness checks, the daily close and the integrity halt." />
      <Box mb={4}><Notice tone="warning">Never clear an integrity halt just to restore service — reconcile first.</Notice></Box>
      <HStack mb={4}>
        {can('recon.run') ? <Button size="sm" onClick={() => setAction(dailyClose)}>Run daily close</Button> : null}
        {can('controls.operate') ? <Button size="sm" colorScheme="red" variant="outline" onClick={() => setAction(clearHalt)}>Clear trading halt</Button> : null}
      </HStack>
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
        <Panel title="Operational readiness"><ErrorBox error={readiness.error} onRetry={readiness.reload} /><JsonView value={readiness.data} /></Panel>
        <Panel title="Metrics"><ErrorBox error={metrics.error} onRetry={metrics.reload} /><JsonView value={metrics.data} /></Panel>
      </Box>
      <ActionModal action={action} row={null} onClose={() => setAction(null)} onDone={async () => { await readiness.reload(); await metrics.reload(); }} />
    </Box>
  );
}
