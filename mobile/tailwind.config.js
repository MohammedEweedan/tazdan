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
        // ── Monochrome accent (white in dark, black in light) ──────
        // `mono.fg` / `mono.accent` / `mono.bg` are the foundation. The
        // `brand` ramp below is kept as an alias mapping to grayscale so
        // existing `bg-brand-500` style classes still compile.
        mono: {
          bg:         '#0A0A0B',
          bgElev:     '#141416',
          bgRaised:   '#1C1C1F',
          line:       'rgba(255,255,255,0.08)',
          lineStrong: 'rgba(255,255,255,0.14)',
          fg:         '#FAFAFA',
          fgDim:      'rgba(250,250,250,0.72)',
          fgMuted:    'rgba(250,250,250,0.46)',
          fgFaint:    'rgba(250,250,250,0.28)',
          accent:     '#FFFFFF',
          accentFg:   '#0A0A0B',
        },
        // Legacy brand alias — points at grayscale so `bg-brand-500` etc.
        // continue to read as the new mono accent during the migration.
        brand: {
          50:  '#F4F4F4',
          100: '#E5E5E5',
          200: '#D4D4D4',
          300: '#A3A3A3',
          400: '#FFFFFF', // primary CTA fill (was brand mid blue)
          500: '#FAFAFA',
          600: '#0A0A0B', // primary CTA dark variant (was deep blue)
          700: '#262626',
          800: '#171717',
          900: '#0A0A0B',
        },
        // Surface ramp — graphite, no blue undertone
        surface: {
          0:   '#000000',
          50:  '#0A0A0B',
          100: '#141416',
          200: '#1C1C1F',
          300: '#26262A',
          400: '#2F2F33',
          500: '#3A3A3F',
        },
        // Status (kept — accessibility signals)
        success: '#2BB36F',
        danger:  '#E5484D',
        warning: '#E8A33A',
        // Text
        ink: {
          primary:   '#FAFAFA',
          secondary: 'rgba(250,250,250,0.72)',
          tertiary:  'rgba(250,250,250,0.46)',
          muted:     'rgba(250,250,250,0.28)',
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
