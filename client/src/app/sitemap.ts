import type { MetadataRoute } from 'next';

const SITE_URL = 'https://tazdan.com';

/**
 * Public sitemap. Generated at build time (zero runtime cost) and served
 * at /sitemap.xml. We list only routes that are content-public, not
 * auth-gated. Each entry gets a `lastModified` so Google's crawl
 * prioritises whichever pages changed most recently.
 *
 * `alternates.languages` builds hreflang annotations Google uses to
 * route MENA users to /ar (etc.) automatically — critical for the
 * Arabic-speaking audience.
 */
const PUBLIC_ROUTES: { path: string; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '/',           changeFrequency: 'weekly',  priority: 1.0  },
  { path: '/about',      changeFrequency: 'monthly', priority: 0.7  },
  { path: '/features',   changeFrequency: 'weekly',  priority: 0.9  },
  { path: '/business',   changeFrequency: 'weekly',  priority: 0.8  },
  { path: '/fees',       changeFrequency: 'monthly', priority: 0.8  },
  { path: '/trust',      changeFrequency: 'monthly', priority: 0.7  },
  { path: '/security',   changeFrequency: 'monthly', priority: 0.6  },
  { path: '/compliance', changeFrequency: 'monthly', priority: 0.6  },
  { path: '/risk',       changeFrequency: 'monthly', priority: 0.5  },
  { path: '/privacy',    changeFrequency: 'monthly', priority: 0.4  },
  { path: '/terms',      changeFrequency: 'monthly', priority: 0.4  },
  { path: '/help',       changeFrequency: 'weekly',  priority: 0.6  },
  { path: '/faq',        changeFrequency: 'weekly',  priority: 0.6  },
  { path: '/contact',    changeFrequency: 'monthly', priority: 0.6  },
  { path: '/partners',   changeFrequency: 'monthly', priority: 0.6  },
  { path: '/delete-account', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/careers',    changeFrequency: 'weekly',  priority: 0.6  },
  { path: '/register',   changeFrequency: 'monthly', priority: 0.9  },
];

// Only the home page has per-locale URLs (/en, /ar); every other page picks
// its language from the visitor's choice, so it has a single URL and no
// hreflang alternates (pointing at /fr/features etc. would advertise 404s).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    ...(path === '/'
      ? { alternates: { languages: { en: `${SITE_URL}/en`, ar: `${SITE_URL}/ar` } } }
      : {}),
  }));
}
