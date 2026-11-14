'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime } from '@/lib/cockpit/format';

export default function WhatsappPage() {
  return <LegacyList title="WhatsApp" subtitle="WhatsApp channel messages." tabs={[
    { key: 'messages', label: 'Messages', path: '/admin/whatsapp/messages', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'direction', label: 'Direction' }, { key: 'phone', label: 'Phone', render: (r: any) => r.phone ?? r.from ?? r.to }, { key: 'body', label: 'Message', render: (r: any) => String(r.body ?? r.content ?? '').slice(0, 80) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
