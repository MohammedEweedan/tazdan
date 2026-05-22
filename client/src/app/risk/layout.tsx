import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Risk Summary — fortuni',
  description: 'Due to the potential for losses, the FCA considers this investment to be high risk. Read our full risk summary before investing.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://promrkts.com/risk' },
};

export default function RiskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
