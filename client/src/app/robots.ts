import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tazdan.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Public pages are indexable. The API namespace and the staff-only
        // Control Cockpit (/admin) stay out of search results.
        disallow: ['/api', '/admin'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
