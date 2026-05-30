import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tazdan.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep admin / dashboard / auth flows out of search results —
        // they aren't useful as landing pages and they leak product state.
        disallow: ['/admin', '/dashboard', '/api', '/login', '/register', '/reset-password', '/forgot-password', '/verify-email'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
