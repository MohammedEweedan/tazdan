'use client';

import { LegacyList, ActionModal, call, type RowAction } from '@/components/cockpit/LegacyList';
import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { useCan } from '@/components/cockpit/CockpitShell';
import { dateTime } from '@/lib/cockpit/format';

const broadcast: RowAction = {
  label: 'Send broadcast', perm: 'settings.manage',
  fields: [
    { key: 'title', label: 'Title' },
    { key: 'body', label: 'Message', type: 'textarea' },
    { key: 'audience', label: 'Send to', type: 'select', options: [{ value: 'USER', label: 'All customers' }, { value: 'ADMIN', label: 'Staff only' }, { value: 'ALL', label: 'Everyone' }] },
    { key: 'targetUserIds', label: 'Or only these customer IDs (comma-separated)', optional: true },
  ],
  run: (_r, v) => call('/admin/notifications/broadcast', 'POST', {
    title: v.title, body: v.body,
    ...(v.targetUserIds ? { targetUserIds: v.targetUserIds.split(',').map((s) => s.trim()).filter(Boolean) } : v.audience === 'ALL' ? {} : { targetRoles: [v.audience] }),
  }),
};

export default function NotificationsPage() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <LegacyList key={key} title="Notifications" subtitle="In-app and push broadcasts, with who received each one."
        header={can('settings.manage') ? <Box mb={4}><Button size="sm" colorScheme="brand" onClick={() => setOpen(true)}>Send broadcast</Button></Box> : null}
        tabs={[{ key: 'sent', label: 'Broadcasts', path: '/admin/notifications', columns: [
          { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
          { key: 'title', label: 'Title' },
          { key: 'body', label: 'Message', render: (r: any) => String(r.body ?? r.message ?? r.description ?? '').slice(0, 90) },
          { key: 'recipients', label: 'Recipients', align: 'right', render: (r: any) => r.recipientCount ?? r._count?.recipients ?? '—' },
        ] }]} />
      <ActionModal action={open ? broadcast : null} row={null} onClose={() => setOpen(false)} onDone={() => setKey((k) => k + 1)} />
    </>
  );
}
