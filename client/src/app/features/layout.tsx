import type { Metadata } from 'next';

const title = 'Personal — everything tazdan does';
const description =
  'Every capability of the tazdan app, with its honest status: wallets for dinars, dollars and USDT, payments by @handle and claim links, P2P with escrow, send abroad, savings goals, payments in chat, and security and privacy built in.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title: `tazdan — ${title}`, description, url: 'https://tazdan.com/features' },
  alternates: { canonical: 'https://tazdan.com/features' },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
