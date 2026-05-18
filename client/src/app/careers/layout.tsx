import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Join the promrkts team — engineers, product managers, compliance officers and more. Help us build the financial layer for the MENA region.',
  openGraph: {
    title: 'Careers at promrkts',
    description:
      'We are hiring engineers, PMs, and compliance specialists. Build the future of money with us.',
    url: 'https://promrkts.com/careers',
  },
  alternates: { canonical: 'https://promrkts.com/careers' },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
