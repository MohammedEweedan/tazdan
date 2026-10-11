export const DEFAULT_ACCENT = '#24384F';

export function normalizeAccent(value: string): string | null {
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) return '#' + hex.split('').map(c => c + c).join('').toUpperCase();
  return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null;
}

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = (values: number[]) => '#' + values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const luminance = (color: string) => rgb(color).map(v => {
  const s = v / 255;
  return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
}).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

export function mixColor(a: string, b: string, amount: number): string {
  const target = rgb(b);
  return hex(rgb(a).map((v, i) => v + (target[i] - v) * amount));
}

export function accentTokens(color: string, surfaces: string[], light: boolean) {
  const channels = rgb(color);
  let text = color;
  // Preserve the hue while lifting/darkening small text to readable contrast.
  for (let step = 0; step <= 100 && surfaces.some(bg => contrastRatio(text, bg) < 4.5); step++) {
    text = hex(channels.map(v => v + ((light ? 0 : 255) - v) * step / 100));
  }
  const balanceStop = (amount: number) => {
    let stop = mixColor(surfaces[0], color, amount);
    while (amount > 0 && contrastRatio(stop, light ? '#0A0A0B' : '#F4F5F7') < 4.5) {
      amount = Math.max(0, amount - .02);
      stop = mixColor(surfaces[0], color, amount);
    }
    return stop;
  };
  return {
    balanceGradient: [balanceStop(light ? .04 : .55), balanceStop(light ? .12 : 1), surfaces[0]] as const,
    accent: color,
    accentFg: contrastRatio(color, '#000000') > contrastRatio(color, '#FFFFFF') ? '#000000' : '#FFFFFF',
    accentText: text,
    accentSoft: `rgba(${channels.join(',')},${light ? .12 : .16})`,
    accentBorder: `rgba(${channels.join(',')},.42)`,
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return hex([f(5), f(3), f(1)]);
}

export function hexToHsv(color: string): [number, number, number] {
  const [r, g, b] = rgb(color).map(c => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? d / max : 0, max];
}
