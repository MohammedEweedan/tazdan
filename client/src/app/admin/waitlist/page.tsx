'use client';

import { useState } from 'react';
import { Box, Button } from '@chakra-ui/react';
import { LegacyList, ActionModal, call, type RowAction } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { useCan } from '@/components/cockpit/CockpitShell';
import { dateTime } from '@/lib/cockpit/format';

const launch: RowAction = {
  label: 'Send launch email', perm: 'settings.manage', danger: true,
  fields: [
    { key: 'subject', label: 'Subject', optional: true, placeholder: 'tazdan is live' },
    { key: 'heading', label: 'Heading', optional: true },
    { key: 'body', label: 'Message', type: 'textarea', optional: true },
    { key: 'ctaLabel', label: 'Button text', optional: true },
    { key: 'ctaUrl', label: 'Button link (https)', optional: true },
    { key: 'audience', label: 'Send to', type: 'select', options: [{ value: 'pending', label: 'Only people not yet emailed' }, { value: 'all', label: 'Everyone on the list again' }] },
    { key: 'limit', label: 'Limit (test with a few first)', optional: true, placeholder: '5' },
  ],
  run: (_r, v) => call('/admin/waitlist/launch', 'POST', {
    ...Object.fromEntries(Object.entries(v).filter(([k, x]) => x && k !== 'limit')),
    ...(v.limit ? { limit: Number(v.limit) } : {}),
  }),
};

export default function WaitlistPage() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <LegacyList key={key} title="Waitlist" subtitle="Website sign-ups. The launch email goes only to people not yet emailed unless you choose everyone."
        header={can('settings.manage') ? <Box mb={4}><Button size="sm" colorScheme="brand" onClick={() => setOpen(true)}>Send launch email</Button></Box> : null}
        tabs={[{ key: 'list', label: 'Sign-ups', path: '/admin/waitlist', columns: [
          { key: 'createdAt', label: 'Joined', render: (r: any) => dateTime(r.createdAt) },
          { key: 'email', label: 'Email' },
          { key: 'country', label: 'Country', render: (r: any) => r.country ?? '—' },
          { key: 'notified', label: 'Launch email', render: (r: any) => <StatusBadge value={r.notified ? 'DELIVERED' : 'PENDING'} /> },
        ], actions: [
          { label: 'Resend confirmation', perm: 'settings.manage', run: (r: any) => call(`/admin/waitlist/${r.id}/resend`, 'POST', {}) },
          { label: 'Delete', perm: 'settings.manage', danger: true, run: (r: any) => call(`/admin/waitlist/${r.id}`, 'DELETE') },
        ] }]} />
      <ActionModal action={open ? launch : null} row={null} onClose={() => setOpen(false)} onDone={() => setKey((k) => k + 1)} />
    </>
  );
}
