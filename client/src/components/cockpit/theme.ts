/**
 * Cockpit theme: the site theme with a brand scale centred on the Tazdan
 * accent #63a1db. (The public site's `brand` scale mixes indigo steps, which
 * Chakra uses for dark-mode buttons, switches and links.) Applied only while
 * the cockpit is mounted, so public pages keep their own look.
 */
import { extendTheme } from '@chakra-ui/react';
import base from '@/theme';

export const cockpitTheme = extendTheme(
  {
    colors: {
      brand: {
        50: '#EEF5FC',
        100: '#D6E7F7',
        200: '#B3D3F0',
        300: '#8BBCE8',
        400: '#75AEE1',
        500: '#63A1DB',
        600: '#3E78AE',
        700: '#2F5D88',
        800: '#234566',
        900: '#172E44',
      },
    },
    fonts: {
      heading: `var(--font-inter), 'Inter', system-ui, sans-serif`,
      body: `var(--font-inter), 'Inter', system-ui, sans-serif`,
    },
    components: {
      Switch: { defaultProps: { colorScheme: 'brand' } },
      Checkbox: { defaultProps: { colorScheme: 'brand' } },
      Tabs: { defaultProps: { colorScheme: 'brand' } },
      Link: { baseStyle: { color: 'brand.600', _dark: { color: 'brand.300' } } },
    },
  },
  base,
);
