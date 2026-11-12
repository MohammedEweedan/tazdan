'use client';

import { LegacyList, call } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { ago, dateTime, shortId } from '@/lib/cockpit/format';

export default function SessionsPage() {
  return <LegacyList title="Sessions & keys" subtitle="Customer sessions, sign-in history and API keys." tabs={[
    { key: 'sessions', label: 'Sessions', path: '/admin/sessions', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'ipAddress', label: 'IP' }, { key: 'userAgent', label: 'Client', render: (r: any) => (r.userAgent ?? r.deviceName ?? '—').slice(0, 60) }, { key: 'lastUsedAt', label: 'Last used', render: (r: any) => ago(r.lastUsedAt ?? r.updatedAt) }],
      actions: [{ label: 'Revoke', perm: 'customers.sessions.revoke', danger: true, run: (r: any) => call(`/admin/sessions/${r.id}`, 'DELETE') }] },
    { key: 'logins', label: 'Sign-in history', path: '/admin/login-history', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'ipAddress', label: 'IP' }, { key: 'success', label: 'Result', render: (r: any) => <StatusBadge value={r.success === false ? 'FAILED' : 'OK'} /> }] },
    { key: 'keys', label: 'API keys', path: '/admin/api-keys', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'name', label: 'Name' }, { key: 'prefix', label: 'Prefix', render: (r: any) => `${r.prefix ?? ''}…` }, { key: 'isActive', label: 'Status', render: (r: any) => <StatusBadge value={r.isActive ? 'ACTIVE' : 'DISABLED'} /> }],
      actions: [{ label: 'Revoke', perm: 'controls.operate', danger: true, show: (r: any) => r.isActive, run: (r: any) => call(`/admin/api-keys/${r.id}/revoke`, 'PUT') }] },
  ]} />;
}
