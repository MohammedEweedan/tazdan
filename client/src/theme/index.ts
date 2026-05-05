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
      50:  '#e8f0fc',
      100: '#c4d8f7',
      200: '#9cbef0',
      300: '#73a4e9',
      400: '#6099e5',
      500: '#4A8FE0', // main brand color
      600: '#3478cc',
      700: '#2060b5',
      800: '#0f4a96',
      900: '#003370',
    },
    accent: {
      50:  '#e8f0fc',
      100: '#c4d8f7',
      200: '#9cbef0',
      300: '#73a4e9',
      400: '#60a5fa',
      500: '#4A8FE0',
      600: '#3478cc',
      700: '#2060b5',
      800: '#0f4a96',
      900: '#003370',
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