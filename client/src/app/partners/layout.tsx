import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Partners — tazdan',
  description: 'How tazdan works with licensed partners for payments and liquidity—we don\'t custody funds.',
  openGraph: {
    title: 'Partners — tazdan',
    description: 'How tazdan works with banks, payment companies, card issuers and remittance operators across MENA.',
    url: 'https://tazdan.com/partners',
  },
  alternates: { canonical: 'https://tazdan.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
