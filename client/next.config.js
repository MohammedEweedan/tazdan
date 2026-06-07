const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Don't let the service worker serve a cached SPA shell for unknown URLs —
  // that hijacks navigation and shows a stale page instead of Next's real 404.
  // With no document fallback, unmatched routes hit the network and Next
  // renders not-found.tsx correctly in production.
  fallbacks: {},
  // Network-first for page navigations so a deploy's new 404 (and fresh pages)
  // win over any previously-cached document.
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'next-static', expiration: { maxEntries: 256, maxAgeSeconds: 31536000 } },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?)$/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'assets', expiration: { maxEntries: 256, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
  ],
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.promrkts.com';
const API_URL = new URL(API_BASE);
const API_ORIGIN = API_URL.origin;
const API_PATH = API_URL.pathname.replace(/\/$/, '');
const API_REWRITE_BASE = API_URL.hostname === 'api.promrkts.com'
  ? API_ORIGIN
  : `${API_ORIGIN}${API_PATH || '/api'}`;

// Dev API origin for local server (used in CSP connect-src)
const DEV_API_ORIGIN = 'http://localhost:5001';
const isDev = process.env.NODE_ENV !== 'production';

// Fonts now ship from /_next/static/media/* via next/font (self-hosted),
// so fonts.googleapis.com / fonts.gstatic.com are removed from CSP.
// Tighter origin set = fewer DNS lookups + better Lighthouse "best
// practices" score.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https: ${API_ORIGIN};
  connect-src 'self' ${API_ORIGIN} wss://${new URL(API_ORIGIN).host} https://api.stripe.com https://cryptocompare.com${isDev ? ` ${DEV_API_ORIGIN}` : ''};
  frame-src https://js.stripe.com https://checkout.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s+/g, ' ').trim();

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

// Cache aggressively for immutable hashed assets.
const STATIC_CACHE_HEADERS = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // `standalone` is for the Docker/self-hosted Node server. On Vercel it
  // breaks App Router routing — unmatched paths fall through to Vercel's own
  // platform 404 instead of our app/not-found.tsx. Vercel sets VERCEL=1, so
  // only emit standalone when NOT on Vercel.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  // Next.js 14 swc minify is on by default; explicit so it survives a Next bump.
  swcMinify: true,
  reactStrictMode: true,
  // Skip Next.js x-powered-by → one fewer header byte per response, tiny privacy win.
  poweredByHeader: false,
  // Drop console.* from production bundles — typical client-side logs add up.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Trim large icon barrel imports — only the few icons we use ship.
  // Without this, `import { FiSearch } from 'react-icons/fi'` drags the
  // entire 1300-icon set into the page chunk.
  modularizeImports: {
    'react-icons/fi': { transform: 'react-icons/fi/index.esm.js', skipDefaultConversion: true },
    'react-icons/fa': { transform: 'react-icons/fa/index.esm.js', skipDefaultConversion: true },
    'react-icons/si': { transform: 'react-icons/si/index.esm.js', skipDefaultConversion: true },
  },
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'react-icons',
      '@chakra-ui/react',
      'lucide-react',
      'date-fns',
    ],
  },
  i18n: {
    locales: ['en', 'ar', 'fr', 'es', 'de', 'nl', 'ru'],
    defaultLocale: 'en',
  },
  images: {
    domains: ['bit.ly'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 1 day — bigger than 60s default
    deviceSizes: [320, 420, 768, 1024, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      { source: '/(.*)',                           headers: securityHeaders     },
      { source: '/_next/static/(.*)',              headers: STATIC_CACHE_HEADERS },
      { source: '/icon-:rest*.png',                headers: STATIC_CACHE_HEADERS },
      { source: '/og-image.png',                   headers: STATIC_CACHE_HEADERS },
      { source: '/manifest.json',                  headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_REWRITE_BASE}/:path*`,
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
