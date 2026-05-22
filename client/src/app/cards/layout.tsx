import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virtual & Physical Visa Card',
  description:
    'Get a fortuni Visa card — virtual or physical. Spend crypto anywhere Visa is accepted. No FX markup, 1% USDT cashback, instant freeze/unfreeze.',
  openGraph: {
    title: 'fortuni Visa Card — Spend Crypto Anywhere',
    description:
      'Virtual and physical Visa card. Zero FX markup. 1% USDT cashback. 190+ countries. Instant freeze from the app.',
    url: 'https://promrkts.com/cards',
  },
  alternates: { canonical: 'https://promrkts.com/cards' },
};

export default function CardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
