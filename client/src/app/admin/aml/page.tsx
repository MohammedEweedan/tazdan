'use client';

import { LegacyList, call } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, shortId } from '@/lib/cockpit/format';

export default function AmlPage() {
  return <LegacyList title="AML flags" subtitle="Automatic AML flags. Clear, escalate or freeze each one." tabs={[
    { key: 'flags', label: 'Flags', path: '/admin/aml-flags', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'type', label: 'Type', render: (r: any) => r.type ?? r.rule }, { key: 'reason', label: 'Reason', render: (r: any) => r.reason ?? r.description ?? '—' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }],
      actions: [{ label: 'Decide', perm: 'compliance.decide', show: (r: any) => !['CLEARED', 'RESOLVED'].includes(r.status),
        fields: [{ key: 'status', label: 'Decision', type: 'select', options: [{ value: 'CLEARED', label: 'Clear' }, { value: 'ESCALATED', label: 'Escalate' }, { value: 'FROZEN', label: 'Freeze the customer' }] }, { key: 'resolution', label: 'Resolution (recorded)', type: 'textarea' }],
        run: (r: any, v) => call(`/admin/aml-flags/${r.id}/resolve`, 'PUT', { status: v.status, resolution: v.resolution }) }] },
  ]} />;
}
