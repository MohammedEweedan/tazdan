import type { Metadata, Viewport } from 'next';
import AppProviders from '@/providers/AppProviders';
import PageTitle from '@/components/PageTitle';

export const metadata: Metadata = {
  title: {
    default: 'promrkts — Crypto Exchange & Money Transfer for MENA',
    template: '%s | promrkts',
  },
  description:
    'Send money to Libya, Egypt & UAE instantly. Buy & sell crypto with a P2P marketplace. Get a virtual Visa card. No SWIFT fees, no bank queues.',
  keywords: [
    'Libya crypto', 'LYD USDT', 'send money Libya', 'Libya remittance',
    'MENA crypto exchange', 'P2P crypto marketplace', 'virtual Visa crypto card',
    'Egypt crypto', 'UAE crypto', 'crypto to fiat MENA', 'promrkts',
  ],
  manifest: '/manifest.json',
  authors: [{ name: 'promrkts' }],
  creator: 'promrkts',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://promrkts.com',
    siteName: 'promrkts',
    title: 'promrkts — Crypto Exchange & Money Transfer for MENA',
    description:
      'Send money to Libya, Egypt & UAE instantly. Buy & sell crypto. Get a virtual Visa card. No SWIFT fees.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'promrkts — Banking the MENA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'promrkts — Crypto & Money Transfer for MENA',
    description: 'Send money to Libya instantly. Buy & sell crypto. Virtual Visa card.',
    images: ['/og-image.png'],
    creator: '@promrkts',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://promrkts.com' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Critical hero images — preload to prevent layout shift and scroll jank */}
        <link rel="preload" href="/iphone-frame.png" as="image" type="image/png" />
        <link rel="preload" href="/icon-black.png" as="image" type="image/png" />
        <link rel="preload" href="/visa.png" as="image" type="image/png" />
        <link rel="preload" href="/icon-color.png" as="image" type="image/png" />
        <link rel="preload" href="/icon.gif" as="image" type="image/gif" />
        {/* Background video — preload metadata only, full decode happens when visible via IntersectionObserver */}
        <link rel="preload" href="/videos/WebHeader.mp4" as="video" type="video/mp4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
