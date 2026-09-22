import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore all tazdan features: P2P crypto marketplace, instant money transfers, virtual Visa card, social wallet, and bank-grade security — all in one app.',
  openGraph: {
    title: 'tazdan Features — Wallets, Transfers, Remittance & Business',
    description:
      'P2P marketplace, social wallet, instant transfers, Visa card, and bank-grade security built for MENA.',
    url: 'https://tazdan.com/features',
  },
  alternates: { canonical: 'https://tazdan.com/features' },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
