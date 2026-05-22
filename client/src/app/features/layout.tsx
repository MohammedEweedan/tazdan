import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore all fortuni features: P2P crypto marketplace, instant money transfers, virtual Visa card, social wallet, and bank-grade security — all in one app.',
  openGraph: {
    title: 'fortuni Features — P2P Trading, Transfers, Visa Card & More',
    description:
      'P2P marketplace, social wallet, instant transfers, Visa card, and bank-grade security built for MENA.',
    url: 'https://promrkts.com/features',
  },
  alternates: { canonical: 'https://promrkts.com/features' },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
