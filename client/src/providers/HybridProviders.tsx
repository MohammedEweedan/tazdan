'use client';

import { useState } from 'react';

import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { TolgeeProvider } from '@tolgee/react';
import { createTolgee } from '@/i18n/tolgee';
import theme from '@/theme';
import MuiThemeProvider from '@/app/providers/mui-theme-provider';

export default function HybridProviders({ children }: { children: React.ReactNode }) {
  const [tolgee] = useState(() => createTolgee('en'));
  return (
    <TolgeeProvider tolgee={tolgee} ssr fallback="Loading...">
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <MuiThemeProvider>
          {children}
        </MuiThemeProvider>
      </ChakraProvider>
    </TolgeeProvider>
  );
}
