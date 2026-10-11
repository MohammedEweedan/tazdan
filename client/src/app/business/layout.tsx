import type { Metadata } from 'next';

const description =
  'Pay staff and suppliers in one batch, with a second approver for large payouts, team roles, scoped API keys and signed webhooks. tazdan Business, built for Libya.';

export const metadata: Metadata = {
  title: 'Business — tazdan',
  description,
  openGraph: {
    title: 'Business — tazdan',
    description,
    url: 'https://tazdan.com/business',
  },
  alternates: { canonical: 'https://tazdan.com/business' },
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
