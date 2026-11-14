/**
 * Widget colours — the app's dark (charcoal, not black) and light palettes
 * from store/themeStore, in the colour formats Android widgets accept.
 */
import type { ColorProp } from 'react-native-android-widget';

export interface WidgetTheme {
  bg: ColorProp; bgElev: ColorProp; fg: ColorProp; fgMuted: ColorProp; fgFaint: ColorProp;
  border: ColorProp; pillBg: ColorProp; green: ColorProp; red: ColorProp;
  accent: ColorProp; accentFg: ColorProp; accentText: ColorProp;
}

export const DARK: WidgetTheme = {
  bg: '#16181C', bgElev: '#1E2127', fg: '#F4F5F7', fgMuted: '#AEB6C3', fgFaint: '#8C96A6',
  border: 'rgba(255, 255, 255, 0.09)', pillBg: 'rgba(255, 255, 255, 0.07)',
  green: '#3FCF8E', red: '#F87171', accent: '#24384F', accentFg: '#FFFFFF', accentText: '#9BA8B7',
};

export const LIGHT: WidgetTheme = {
  bg: '#F6F7FA', bgElev: '#FFFFFF', fg: '#0A0A0B', fgMuted: '#586579', fgFaint: '#697589',
  border: 'rgba(10, 10, 11, 0.08)', pillBg: 'rgba(10, 10, 11, 0.06)',
  green: '#1F8F58', red: '#C0272D', accent: '#24384F', accentFg: '#FFFFFF', accentText: '#24384F',
};

/** Outline glyphs (24×24), drawn in the theme's ink. */
export function glyph(name: 'up' | 'down' | 'scan' | 'plus' | 'chat' | 'chart', color: string): string {
  const paths: Record<typeof name, string> = {
    up:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    chart: '<path d="M4 18l5-6 4 3 7-9"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
