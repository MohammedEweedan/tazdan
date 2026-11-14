'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, shortId } from '@/lib/cockpit/format';

export default function MessagesPage() {
  return <LegacyList title="Messages" subtitle="Chat messages, reports and blocks (support review)." tabs={[
    { key: 'messages', label: 'Messages', path: '/admin/messages', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'senderId', label: 'From', render: (r: any) => shortId(r.senderId) }, { key: 'receiverId', label: 'To', render: (r: any) => shortId(r.receiverId) }, { key: 'type', label: 'Type' }, { key: 'content', label: 'Message', render: (r: any) => String(r.content ?? '').slice(0, 80) }] },
    { key: 'reports', label: 'Reports', path: '/admin/message-reports', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'reporterId', label: 'Reporter', render: (r: any) => shortId(r.reporterId) }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'blocks', label: 'Blocks', path: '/admin/user-blocks', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'blockerId', label: 'Blocker', render: (r: any) => shortId(r.blockerId) }, { key: 'blockedId', label: 'Blocked', render: (r: any) => shortId(r.blockedId) }, { key: 'reason', label: 'Reason' }] },
  ]} />;
}
