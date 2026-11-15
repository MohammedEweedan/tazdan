import type { Metadata } from 'next';
import AdminFrame from '@/components/cockpit/AdminFrame';

// Each response carries its own CSP nonce (middleware.ts), so never prerender.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Control Cockpit — tazdan',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminFrame>{children}</AdminFrame>;
}
