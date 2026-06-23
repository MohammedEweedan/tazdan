import { Tolgee, DevTools } from '@tolgee/web';
import enTranslations from './en.json';
import arTranslations from './ar.json';
import frTranslations from './fr.json';
import deTranslations from './de.json';
import esTranslations from './es.json';
import ruTranslations from './ru.json';
import nlTranslations from './nl.json';
import cnTranslations from './cn.json';
import trTranslations from './tr.json';
import ptTranslations from './pt.json';

export const tolgee = Tolgee()
  .use(DevTools())
  .init({
    language: typeof window !== 'undefined'
      ? localStorage.getItem('lang') || 'en'
      : 'en',
    staticData: {
      en: enTranslations,
      ar: arTranslations,
      fr: frTranslations,
      de: deTranslations,
      nl: nlTranslations,
      ru: ruTranslations,
      es: esTranslations,
      tr: trTranslations,
      pt: ptTranslations,
      cn: cnTranslations
    },
    defaultLanguage: 'en',
    availableLanguages: ['en', 'ar', 'fr', 'de', 'es', 'nl', 'ru', 'tr', 'pt', 'cn'],
  });

export function getDirection(lang: string): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
