'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { TolgeeProvider, useTolgee } from '@tolgee/react';
import { createTolgee } from '@/i18n/tolgee';
import theme from '@/theme';

function LangInit() {
  const pathname = usePathname();
  const tolgee = useTolgee();
  useEffect(() => {
    const pathLocale = pathname?.split('/')[1];
    const lang = pathLocale === 'ar' || pathLocale === 'en' ? pathLocale : pathname === '/' ? 'en' : localStorage.getItem('lang') || 'en';
    tolgee.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [pathname, tolgee]);
  return null;
}

export default function AppProviders({ children, initialLanguage = 'en' }: { children: React.ReactNode; initialLanguage?: string }) {
  const [tolgee] = useState(() => createTolgee(initialLanguage));
  return (
    <TolgeeProvider tolgee={tolgee} ssr={{ language: initialLanguage }} fallback="Loading...">
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <LangInit />
        {children}
      </ChakraProvider>
    </TolgeeProvider>
  );
}
