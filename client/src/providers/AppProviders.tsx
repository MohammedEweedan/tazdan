'use client';

import { useEffect } from 'react';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { TolgeeProvider } from '@tolgee/react';
import { tolgee } from '@/i18n/tolgee';
import theme from '@/theme';

function LangInit() {
  useEffect(() => {
    const lang = localStorage.getItem('lang') || 'en';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, []);
  return null;
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TolgeeProvider tolgee={tolgee} fallback="Loading...">
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <LangInit />
        {children}
      </ChakraProvider>
    </TolgeeProvider>
  );
}
