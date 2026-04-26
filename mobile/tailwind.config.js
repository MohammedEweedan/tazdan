/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Web throws "dark mode is type 'media'" without this. We control theme
  // ourselves through `useTheme`, not via system media queries.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand — luxury blue
        brand: {
          50:  '#e8f0fc',
          100: '#c4d8f7',
          200: '#9cbef0',
          300: '#73a4e9',
          400: '#4A8FE0', // brand mid
          500: '#2477d3',
          600: '#0057B8', // brand deep
          700: '#00408a',
          800: '#002a5c',
          900: '#00152e',
        },
        // Surface — almost-black with blue undertone
        surface: {
          0:   '#000206',
          50:  '#030818',
          100: '#070d22',
          200: '#0c1430',
          300: '#121c44',
          400: '#1a2658',
          500: '#243366',
        },
        // Semantic
        success: '#22c55e',
        danger:  '#ef4444',
        warning: '#f59e0b',
        // Text
        ink: {
          primary:   '#ffffff',
          secondary: 'rgba(255,255,255,0.72)',
          tertiary:  'rgba(255,255,255,0.48)',
          muted:     'rgba(255,255,255,0.32)',
        },
        line: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans:    ['Inter', 'System'],
        display: ['DMSans', 'System'],
        mono:    ['JetBrainsMono', 'Menlo'],
      },
      fontSize: {
        '2xs': '10px',
        xs:    '12px',
        sm:    '13px',
        base:  '15px',
        lg:    '17px',
        xl:    '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
        '5xl': '48px',
        hero:  '64px',
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '32px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
