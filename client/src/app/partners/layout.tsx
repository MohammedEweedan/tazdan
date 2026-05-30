import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partners — promrkts',
  description: 'Regulated infrastructure behind promrkts. We connect you to regulated partners for payments and liquidity—we don\'t custody funds.',
  openGraph: {
    title: 'Partners — promrkts',
    description: 'Regulated infrastructure behind promrkts. Buy, sell, and swap through compliant rails powered by Banxa and Crypto.com.',
    url: 'https://promrkts.com/partners',
  },
  alternates: { canonical: 'https://promrkts.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
