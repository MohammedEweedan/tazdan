import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tazdan.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // The web app is marketing-only now (landing + register + content
        // pages). Only the API namespace stays out of search results.
        disallow: ['/api'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
