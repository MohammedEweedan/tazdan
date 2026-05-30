import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Virtual & Physical Visa Card',
  description:
    'Get a tazdan Visa card — virtual or physical. Spend crypto anywhere Visa is accepted. No FX markup, 1% USDT cashback, instant freeze/unfreeze.',
  openGraph: {
    title: 'tazdan Visa Card — Spend Crypto Anywhere',
    description:
      'Virtual and physical Visa card. Zero FX markup. 1% USDT cashback. 190+ countries. Instant freeze from the app.',
    url: 'https://tazdan.com/cards',
  },
  alternates: { canonical: 'https://tazdan.com/cards' },
};

export default function CardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
