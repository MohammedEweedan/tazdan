import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', system-ui, sans-serif`,
    body: `'Inter', system-ui, sans-serif`,
    mono: `'JetBrains Mono', monospace`,
  },
  colors: {
    brand: {
      50: '#e6effa',
      100: '#c2d6f0',
      200: '#9bbbe5',
      300: '#749fdb',
      400: '#4d84d1',
      500: '#0057b8', // main brand color
      600: '#004ea6',
      700: '#004594',
      800: '#003c82',
      900: '#002f66',
    },
    accent: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
  },
  styles: {
    global: (props: any) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
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