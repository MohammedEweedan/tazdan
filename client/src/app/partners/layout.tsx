import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partners — tazdan',
  description: 'Regulated infrastructure behind tazdan. We connect you to regulated partners for payments and liquidity—we don\'t custody funds.',
  openGraph: {
    title: 'Partners — tazdan',
    description: 'Regulated infrastructure behind tazdan. Buy, sell, and swap through compliant rails powered by Banxa and Crypto.com.',
    url: 'https://tazdan.com/partners',
  },
  alternates: { canonical: 'https://tazdan.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
