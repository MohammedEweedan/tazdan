import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & privacy — tazdan',
  description: 'How tazdan keeps every dinar accounted for, checks risky payments and keeps your details private — and what isn’t done yet.',
  openGraph: {
    title: 'Security & privacy — tazdan',
    description: 'A balanced double-entry ledger, step-up checks before money moves, and payments by @handle instead of bank details.',
    url: 'https://tazdan.com/security',
  },
  alternates: { canonical: 'https://tazdan.com/security' },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
