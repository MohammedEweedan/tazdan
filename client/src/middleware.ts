import { NextRequest, NextResponse } from 'next/server';

/** Public routes that server-render in the visitor's language. `/ar` and `/en`
 *  pin the locale by path; every other public page follows the `tazdan_lang`
 *  cookie the language switcher sets, so Arabic visitors get an Arabic (RTL)
 *  first paint instead of an English flash. Only en and ar are bundled for
 *  SSR — other locales load on the client (see i18n/tolgee.ts). */
export const LOCALE_COOKIE = 'tazdan_lang';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5001/api' : 'https://api.promrkts.com');
const isDev = process.env.NODE_ENV !== 'production';

/**
 * The Control Cockpit keeps staff tokens in sessionStorage, so it gets its
 * own policy: only scripts carrying this request's nonce run (Next.js stamps
 * it on its own scripts; the root layout on its inline ones). An injected
 * inline script — the way an XSS bug would steal a staff session — doesn't.
 * The public site keeps the broader policy in next.config.js.
 */
function cockpit(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const api = new URL(API_BASE);
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: https: ${api.origin}`,
    `connect-src 'self' ${api.origin} wss://${api.host}${isDev ? ' ws://localhost:5001 http://localhost:5001' : ''}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return cockpit(request);
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    pathname === '/ar' ? 'ar'
    : pathname === '/en' || pathname === '/' ? 'en'
    : cookie === 'ar' ? 'ar' : 'en';
  const headers = new Headers(request.headers);
  headers.set('x-tazdan-locale', locale);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    '/admin', '/admin/:path*',
    '/', '/ar', '/en',
    '/about', '/business', '/careers', '/compliance', '/contact', '/delete-account', '/faq',
    '/features', '/fees', '/partners', '/privacy', '/register', '/risk', '/security', '/terms', '/trust',
  ],
};
