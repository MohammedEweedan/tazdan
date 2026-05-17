import type { Metadata, Viewport } from 'next';
import AppProviders from '@/providers/AppProviders';
import PageTitle from '@/components/PageTitle';

export const metadata: Metadata = {
  title: 'promrkts - money, simplified',
  description: 'Buy and sell crypto easily and swiftly.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0057b8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
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
