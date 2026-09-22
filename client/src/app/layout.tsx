import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import AppProviders from '@/providers/AppProviders';
import PageTitle from '@/components/PageTitle';

/* ─────────────────────────────────────────────────────────────────
   Fonts — TRULY self-hosted via next/font/local.

   The previous next/font/google config still hit Google's CDN at
   build time, so a flaky network surfaced the
   "Failed to fetch `Inter` from Google Fonts" warning and forced
   Next to fall back to system fonts.  We now bundle the WOFF2 files
   under client/public/fonts/, copied from the @fontsource packages.
   No DNS, no TLS, no fetch — the build is fully offline.

   Outfit is the neutral UI face. Cairo remains as the Arabic glyph fallback
   because Outfit's official self-hosted package is Latin/Latin-ext only.
   DM Sans is the display family. Inter is the body fallback in case the page
   renders bare HTML.
   ───────────────────────────────────────────────────────────── */
const dmSans = localFont({
  src: [
    { path: '../../public/fonts/DMSans-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/DMSans-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/DMSans-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/DMSans-700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/DMSans-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-dm-sans',
});

const inter = localFont({
  src: [
    { path: '../../public/fonts/Inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Inter-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Inter-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Inter-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-inter',
});

const outfit = localFont({
  src: [
    { path: '../../public/fonts/Outfit-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Outfit-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Outfit-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Outfit-latin-700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Outfit-latin-800.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-outfit',
});

// Cairo includes Arabic glyphs and stays as the fallback for Arabic characters
// until an Outfit Arabic subset exists in the asset pipeline.
const cairo = localFont({
  src: [
    { path: '../../public/fonts/Cairo-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Cairo-arabic-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Cairo-arabic-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/Cairo-arabic-700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Cairo-arabic-800.woff2', weight: '800', style: 'normal' },
    { path: '../../public/fonts/Cairo-latin-400.woff2',  weight: '400', style: 'normal' },
    { path: '../../public/fonts/Cairo-latin-500.woff2',  weight: '500', style: 'normal' },
    { path: '../../public/fonts/Cairo-latin-600.woff2',  weight: '600', style: 'normal' },
    { path: '../../public/fonts/Cairo-latin-700.woff2',  weight: '700', style: 'normal' },
    { path: '../../public/fonts/Cairo-latin-800.woff2',  weight: '800', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-cairo',
});

const SITE_URL = 'https://tazdan.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  description:
    'Meet tazdan: a Libyan wallet, crypto and international remittance app in the making. Clear costs in LYD. Join the waitlist.',
  title: 'tazdan — Libya. Crypto. Connected.',
  keywords: ['Libyan payments', 'LYD wallet', 'Libya payment app', 'tazdan', 'تزدان'],
  manifest: '/manifest.json',
  applicationName: 'tazdan',
  authors: [{ name: 'tazdan' }],
  creator: 'tazdan',
  publisher: 'tazdan',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'tazdan',
    title: 'tazdan — Libya. Crypto. Connected.',
    description:
      'Everyday payments in LYD. Built around life in Libya, with an international outlook. Join the waitlist.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'tazdan — Payments for Libya' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tazdan — Crypto and remittances for Libya',
    description: 'A new home for your everyday money in Libya. Explore proposed LYD plans.',
    images: ['/og-image.png'],
    creator: '@tazdan',
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
 *   3. FinancialProduct → describes tazdan for finance verticals. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#org`,
      name: 'tazdan',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-black.png`,
      sameAs: [
        'https://twitter.com/tazdan',
        'https://www.linkedin.com/company/tazdan',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#site`,
      url: SITE_URL,
      name: 'tazdan',
      publisher: { '@id': `${SITE_URL}#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'FinancialProduct',
      name: 'tazdan payments concept',
      description:
        'Proposed Libyan dinar wallet, supported crypto services and international remittances. Availability depends on providers and regulatory approval.',
      provider: { '@id': `${SITE_URL}#org` },
      areaServed: ['Libya'],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = headers().get('x-tazdan-locale') === 'ar' ? 'ar' : 'en';
  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${dmSans.variable} ${inter.variable} ${outfit.variable} ${cairo.variable}`}
    >
      <head>
        {/* Preconnect to the API origin — opens TCP + TLS in parallel
            with HTML parse, so the first /me / /markets call doesn't
            pay the full handshake cost. */}
        <link rel="preconnect" href="https://api.tazdan.com" />
        <link rel="dns-prefetch" href="https://api.tazdan.com" />

        {/* Only preload the actual LCP image. Stacking 5+ image preloads
            (the old layout) burns the high-priority queue on assets
            that aren't on the critical path and HURTS Lighthouse. */}
        <link rel="preload" href="/icon-black.png" as="image" type="image/png" fetchPriority="high" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="tazdan" />
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
        <AppProviders initialLanguage={locale}>
          <PageTitle />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
