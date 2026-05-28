import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partners — Fortuni',
  description: 'Regulated infrastructure behind Fortuni. We connect you to regulated partners for payments and liquidity—we don\'t custody funds.',
  openGraph: {
    title: 'Partners — Fortuni',
    description: 'Regulated infrastructure behind Fortuni. Buy, sell, and swap through compliant rails powered by Banxa and Crypto.com.',
    url: 'https://Fortuni.com/partners',
  },
  alternates: { canonical: 'https://Fortuni.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
