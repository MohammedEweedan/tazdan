import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partners — fortuni',
  description: 'Regulated infrastructure behind fortuni. We connect you to regulated partners for payments and liquidity—we don\'t custody funds.',
  openGraph: {
    title: 'Partners — fortuni',
    description: 'Regulated infrastructure behind fortuni. Buy, sell, and swap through compliant rails powered by Banxa and Crypto.com.',
    url: 'https://promrkts.com/partners',
  },
  alternates: { canonical: 'https://promrkts.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
