import type { Metadata } from 'next';

const TITLE = 'Partners & licensing — tazdan';
const DESCRIPTION =
  'Where tazdan stands on licensing with the Central Bank of Libya, on Libyan banks for dinar deposits and payouts, and on Visa, Banxa and Crypto.com as potential partners — each with an honest status and what has to happen next. Listing a company does not mean an agreement exists.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description:
      'Licensing, Libyan banks and the card, on-ramp and liquidity partners in tazdan’s pipeline — each with an honest status and what has to happen next.',
    url: 'https://tazdan.com/partners',
  },
  alternates: { canonical: 'https://tazdan.com/partners' },
};

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
