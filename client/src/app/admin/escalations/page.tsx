'use client';

import { LegacyList, call } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, shortId } from '@/lib/cockpit/format';

export default function EscalationsPage() {
  return <LegacyList title="Escalations" subtitle="Conversations handed to a person. Assign and resolve them here." tabs={[
    { key: 'open', label: 'Escalations', path: '/admin/escalations', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'reason', label: 'Reason', render: (r: any) => String(r.reason ?? '').slice(0, 90) }, { key: 'assignedToId', label: 'Owner', render: (r: any) => r.assignedToId ? shortId(r.assignedToId) : 'unassigned' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }],
      actions: [
        { label: 'Take it', perm: 'support.reply', show: (r: any) => !r.assignedToId, run: (r: any) => call(`/admin/escalations/${r.id}/assign`, 'PUT', {}) },
        { label: 'Resolve', perm: 'support.reply', show: (r: any) => r.status !== 'RESOLVED', fields: [{ key: 'resolutionNote', label: 'Resolution', type: 'textarea' }], run: (r: any, v) => call(`/admin/escalations/${r.id}/resolve`, 'PUT', { resolutionNote: v.resolutionNote }) },
      ] },
  ]} />;
}
