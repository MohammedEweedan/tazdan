import type { Metadata, Viewport } from 'next';
import { DM_Sans, Cairo, Inter } from 'next/font/google';
import AppProviders from '@/providers/AppProviders';
import PageTitle from '@/components/PageTitle';

/* ─────────────────────────────────────────────────────────────────
   Fonts — self-hosted via next/font.

   Why this matters for Lighthouse:
   - One fewer DNS lookup + TLS handshake (no fonts.googleapis.com).
   - Removes the render-blocking <link rel="stylesheet"> for fonts.
   - Automatic subsetting (latin) cuts file size ~80%.
   - `display: 'swap'` prevents invisible-text FOIT during load.
   - Per-font variable lets us drop weights/styles we don't actually use.

   Cairo carries the Arabic glyphs. DM Sans is the display family.
   Inter is the body fallback in case the page renders bare HTML.
   ───────────────────────────────────────────────────────────── */
const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

const SITE_URL = 'https://fortuni.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Fortuni — Crypto Exchange & Money Transfer for MENA',
    template: '%s | Fortuni',
  },
  description:
    'Send money to Libya, Egypt & UAE instantly. Buy & sell crypto with a P2P marketplace. Get a virtual Visa card. No SWIFT fees, no bank queues.',
  keywords: [
    'Libya crypto', 'LYD USDT', 'send money Libya', 'Libya remittance',
    'MENA crypto exchange', 'P2P crypto marketplace', 'virtual Visa crypto card',
    'Egypt crypto', 'UAE crypto', 'crypto to fiat MENA', 'Fortuni', 'claim link transfer',
    'send crypto to email', 'send crypto to phone',
  ],
  manifest: '/manifest.json',
  applicationName: 'Fortuni',
  authors: [{ name: 'Fortuni' }],
  creator: 'Fortuni',
  publisher: 'Fortuni',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Fortuni',
    title: 'Fortuni — Crypto Exchange & Money Transfer for MENA',
    description:
      'Send money to Libya, Egypt & UAE instantly. Buy & sell crypto. Get a virtual Visa card. No SWIFT fees.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Fortuni — Banking the MENA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fortuni — Crypto & Money Transfer for MENA',
    description: 'Send money to Libya instantly. Buy & sell crypto. Virtual Visa card.',
    images: ['/og-image.png'],
    creator: '@Fortuni',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: `${SITE_URL}/en`,
      ar: `${SITE_URL}/ar`,
      fr: `${SITE_URL}/fr`,
      es: `${SITE_URL}/es`,
      de: `${SITE_URL}/de`,
      nl: `${SITE_URL}/nl`,
      ru: `${SITE_URL}/ru`,
    },
  },
  icons: { icon: '/favicon.ico', apple: '/icon-black.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Don't lock zoom — accessibility (WCAG 2.5.5) requires user-pinch-zoom.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0A0A0B' },
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
  ],
};

/* JSON-LD structured data — surfaces in Google Knowledge Panel and is
 * the single highest-ROI SEO win for a site like this. Three blobs:
 *   1. Organization     → brand info + same-as URLs.
 *   2. WebSite           → enables sitelinks search box on SERPs.
 *   3. FinancialProduct → describes Fortuni for finance verticals. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#org`,
      name: 'Fortuni',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-black.png`,
      sameAs: [
        'https://twitter.com/Fortuni',
        'https://www.linkedin.com/company/fortuni',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#site`,
      url: SITE_URL,
      name: 'Fortuni',
      publisher: { '@id': `${SITE_URL}#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FinancialProduct',
      name: 'Fortuni Wallet & Exchange',
      description:
        'Multi-currency crypto wallet, P2P exchange, virtual Visa card, and claim-link transfers across MENA.',
      provider: { '@id': `${SITE_URL}#org` },
      areaServed: ['Libya', 'Egypt', 'United Arab Emirates', 'Saudi Arabia', 'Tunisia', 'Algeria', 'Morocco'],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${dmSans.variable} ${inter.variable} ${cairo.variable}`}
    >
      <head>
        {/* Preconnect to the API origin — opens TCP + TLS in parallel
            with HTML parse, so the first /me / /markets call doesn't
            pay the full handshake cost. */}
        <link rel="preconnect" href="https://api.Fortuni.com" />
        <link rel="dns-prefetch" href="https://api.Fortuni.com" />

        {/* Only preload the actual LCP image. Stacking 5+ image preloads
            (the old layout) burns the high-priority queue on assets
            that aren't on the critical path and HURTS Lighthouse. */}
        <link rel="preload" href="/icon-black.png" as="image" type="image/png" fetchPriority="high" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Fortuni" />
        <meta name="format-detection" content="telephone=no" />

        {/* Structured data — JSON-LD, inlined so Googlebot sees it on
            first byte without waiting for client JS. */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <AppProviders>
          <PageTitle />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
