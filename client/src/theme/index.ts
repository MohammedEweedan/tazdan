import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  fonts: {
    heading: `'DM Sans', system-ui, sans-serif`,
    body: `'DM Sans', system-ui, sans-serif`,
    mono: `'JetBrains Mono', monospace`,
  },
  colors: {
    brand: {
      50:  '#efeaff',
      100: '#92abff',
      200: '#5f74ff',
      300: '#286df7',
      400: '#286df7',
      500: '#63a1db', // periwinkle — main brand color
      600: '#194ed4',
      700: '#135ba3',
      800: '#0d2475',
      900: '#071647',
    },
    accent: {
      50:  '#efeaff',
      100: '#d6caff',
      200: '#b9a5ff',
      300: '#286df7',
      400: '#286df7',
      500: '#63a1db', // periwinkle
      600: '#4419d4',
      700: '#3413a3',
      800: '#250d75',
      900: '#170747',
    },
  },
  styles: {
    global: (props: any) => ({
      body: {
        // Soft charcoal in dark mode (matches the mobile app), not Chakra's
        // default near-black gray.900 — easier on the eyes.
        bg: props.colorMode === 'dark' ? '#16181C' : 'gray.50',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      },
      "html[lang='ar'] *, html[dir='rtl'] *": {
        fontFamily: `var(--font-cairo), system-ui, sans-serif !important`,
        letterSpacing: `0em !important`,
      },
      "html[lang='ar'] h1, html[lang='ar'] h2, html[lang='ar'] h3, html[lang='ar'] h4, html[lang='ar'] h5, html[lang='ar'] h6, html[dir='rtl'] h1, html[dir='rtl'] h2, html[dir='rtl'] h3, html[dir='rtl'] h4, html[dir='rtl'] h5, html[dir='rtl'] h6": {
        letterSpacing: `0em !important`,
        fontWeight: `800`,
      },
    }),
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Card: {
      baseStyle: (props: any) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
          borderWidth: '1px',
          borderRadius: 'xl',
        },
      }),
    },
    Input: {
      defaultProps: {
        variant: 'filled',
      },
      variants: {
        filled: (props: any) => ({
          field: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
            _hover: { bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200' },
            _focus: {
              bg: props.colorMode === 'dark' ? 'gray.600' : 'white',
              borderColor: 'brand.500',
            },
          },
        }),
      },
    },
    Select: {
      defaultProps: {
        variant: 'filled',
      },
      variants: {
        filled: (props: any) => ({
          field: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
            _hover: { bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200' },
          },
        }),
      },
    },
  },
  semanticTokens: {
    colors: {
      'card-bg': { default: 'white', _dark: 'gray.800' },
      'card-border': { default: 'gray.200', _dark: 'gray.700' },
      'sidebar-bg': { default: 'white', _dark: 'gray.900' },
      'hover-bg': { default: 'gray.100', _dark: 'gray.700' },
      'subtle-text': { default: 'gray.600', _dark: 'gray.400' },
      'muted-text': { default: 'gray.500', _dark: 'gray.500' },
    },
  },
});

export default theme;