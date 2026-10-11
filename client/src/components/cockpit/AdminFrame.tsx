'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@chakra-ui/react';
import { CockpitShell } from './CockpitShell';
import { cockpitTheme } from './theme';

/** Everything under /admin runs inside the cockpit shell except the sign-in page. */
export default function AdminFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  // cssVarsRoot=":root" re-declares the theme variables while the cockpit is
  // mounted, so portalled content (modals, menus) picks up the cockpit scale too.
  return (
    <ThemeProvider theme={cockpitTheme} cssVarsRoot=":root">
      {pathname.startsWith('/admin/login') ? children : <CockpitShell>{children}</CockpitShell>}
    </ThemeProvider>
  );
}
