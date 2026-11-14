import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compliance — tazdan',
  description: 'How tazdan verifies customers, screens payments and keeps records to keep financial crime out — and what that means for you.',
  openGraph: {
    title: 'Compliance — tazdan',
    description: 'Verification levels, sanctions screening, a 17-rule risk engine and append-only records.',
    url: 'https://tazdan.com/compliance',
  },
  alternates: { canonical: 'https://tazdan.com/compliance' },
};

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
