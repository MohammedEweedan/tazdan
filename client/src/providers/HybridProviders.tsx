'use client';

import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { TolgeeProvider } from '@tolgee/react';
import { tolgee } from '@/i18n/tolgee';
import theme from '@/theme';
import MuiThemeProvider from '@/app/providers/mui-theme-provider';

export default function HybridProviders({ children }: { children: React.ReactNode }) {
  return (
    <TolgeeProvider tolgee={tolgee} fallback="Loading...">
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <MuiThemeProvider>
          {children}
        </MuiThemeProvider>
      </ChakraProvider>
    </TolgeeProvider>
  );
}
