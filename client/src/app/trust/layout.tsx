import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust centre — tazdan',
  description: 'Where tazdan stands today: product status, licensing, how customer money is protected, privacy, compliance and your rights.',
  openGraph: {
    title: 'Trust centre — tazdan',
    description: 'Status, licensing, protections and your rights — stated plainly, including what isn’t done yet.',
    url: 'https://tazdan.com/trust',
  },
  alternates: { canonical: 'https://tazdan.com/trust' },
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
