import { NextRequest, NextResponse } from 'next/server';

/** Public routes that server-render in the visitor's language. `/ar` and `/en`
 *  pin the locale by path; every other public page follows the `tazdan_lang`
 *  cookie the language switcher sets, so Arabic visitors get an Arabic (RTL)
 *  first paint instead of an English flash. Only en and ar are bundled for
 *  SSR — other locales load on the client (see i18n/tolgee.ts). */
export const LOCALE_COOKIE = 'tazdan_lang';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    '/', '/ar', '/en',
    '/about', '/business', '/careers', '/compliance', '/contact', '/delete-account', '/faq',
    '/features', '/fees', '/partners', '/privacy', '/register', '/risk', '/security', '/terms', '/trust',
  ],
};
