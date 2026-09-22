import { NextRequest, NextResponse } from 'next/server';

// App Router locale pages use explicit routes instead of Pages Router i18n.
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set('x-tazdan-locale', request.nextUrl.pathname === '/ar' ? 'ar' : 'en');
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/', '/ar', '/en'] };
