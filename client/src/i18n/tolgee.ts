import { Tolgee, DevTools } from '@tolgee/web';

// en + ar are STATIC on purpose — see the note below.
import enTranslations from './en.json';
import arTranslations from './ar.json';
// Public-site copy lives in per-page namespaces (site/<ns>/<locale>.json) so
// pages can be edited independently; the aggregator merges them per locale.
import enSite from './site/_locales/en';
import arSite from './site/_locales/ar';

/* ─────────────────────────────────────────────────────────────────────────
   Locales are loaded LAZILY, one chunk per language.

   They used to be ten static `import ... from './xx.json'` statements, which
   meant every page bundled all ten — ~1.3 MB and ~14,700 strings — even
   though a visitor only ever reads one. Two costs came out of that:

     • Runtime — every visitor downloaded nine locales they cannot read.
     • Build   — the files sit in the static module graph, so touching ONE
                 locale invalidated the lot and webpack re-parsed 1.3 MB of
                 JSON across a ~2,000 module graph. That is what turned an
                 edit into a 40-second rebuild.

   With `() => import(...)` each locale becomes its own async chunk: a visitor
   fetches one, and editing `ar.json` only rebuilds `ar`.

   Tolgee accepts a loader function per language and awaits it; `.default` is
   needed because a JSON dynamic import resolves to a module namespace.

   EXCEPT en and ar, which stay STATIC. A loader is async, so during server
   rendering Tolgee has no data yet and every string renders empty — making
   this lazy cost the Arabic page its entire server-rendered body, which is
   bad for both first paint and SEO. English and Arabic are the two markets
   that actually matter here, so they are bundled; the other eight stay lazy
   and still remove ~80% of the old payload.
   ───────────────────────────────────────────────────────────────────────── */

const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es', 'nl', 'ru', 'tr', 'pt', 'cn'] as const;
export type AppLocale = (typeof LANGUAGES)[number];

/** Base locale file + its site namespaces, as one lazily loaded chunk. */
const lazy = (base: () => Promise<{ default: Record<string, string> }>, site: () => Promise<{ default: Record<string, string> }>) =>
  () => Promise.all([base(), site()]).then(([b, s]) => ({ ...b.default, ...s.default }));

const staticData = {
  en: { ...enTranslations, ...enSite },
  ar: { ...arTranslations, ...arSite },
  fr: lazy(() => import('./fr.json'), () => import('./site/_locales/fr')),
  de: lazy(() => import('./de.json'), () => import('./site/_locales/de')),
  es: lazy(() => import('./es.json'), () => import('./site/_locales/es')),
  nl: lazy(() => import('./nl.json'), () => import('./site/_locales/nl')),
  ru: lazy(() => import('./ru.json'), () => import('./site/_locales/ru')),
  tr: lazy(() => import('./tr.json'), () => import('./site/_locales/tr')),
  pt: lazy(() => import('./pt.json'), () => import('./site/_locales/pt')),
  cn: lazy(() => import('./cn.json'), () => import('./site/_locales/cn')),
};

export const createTolgee = (language = 'en') => {
  const tolgee = Tolgee();
  if (process.env.NODE_ENV === 'development') tolgee.use(DevTools());
  return tolgee.init({
    language,
    staticData,
    defaultLanguage: 'en',
    fallbackLanguage: 'en',
    availableLanguages: [...LANGUAGES],
  });
};

export function getDirection(lang: string): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
